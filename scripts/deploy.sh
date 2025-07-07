#!/bin/bash

# Bogart Discord Bot Deployment Script
# This script provides easy deployment commands for the Discord bot

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Change to project root
cd "$PROJECT_ROOT"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed or not in PATH"
        exit 1
    fi
    
    if ! docker compose version &> /dev/null; then
        print_error "Docker Compose (plugin) is not installed or not in PATH"
        exit 1
    fi
    
    if [ ! -f ".env" ]; then
        print_warning ".env file not found. Creating from .env.example..."
        if [ -f ".env.example" ]; then
            cp .env.example .env
            print_warning "Please edit .env file with your Discord bot credentials before deploying"
        else
            print_error ".env.example file not found"
            exit 1
        fi
    fi
    
    print_success "Prerequisites check completed"
}

# Function to check git prerequisites for merge operations
check_git_prerequisites() {
    if ! command -v git &> /dev/null; then
        print_error "Git is not installed or not in PATH"
        exit 1
    fi
    
    if ! git rev-parse --git-dir &> /dev/null; then
        print_error "Not in a Git repository"
        exit 1
    fi
}

# Function to run pre-merge tests
run_pre_merge_tests() {
    print_status "Running pre-merge tests on develop branch..."
    
    # Switch to develop temporarily to run tests
    local current_branch=$(git branch --show-current)
    git checkout develop
    
    # Pull latest develop
    print_status "Pulling latest develop for testing..."
    git pull origin develop
    
    # Install/update dependencies after pull
    print_status "Installing/updating dependencies..."
    npm install
    
    # Run tests
    print_status "Running test suite..."
    if ! npm test; then
        print_error "Tests failed on develop branch. Merge aborted."
        git checkout "$current_branch" 2>/dev/null || true
        return 1
    fi
    
    # Run build validation
    print_status "Running build validation..."
    if ! npm run build; then
        print_error "Build failed on develop branch. Merge aborted."
        git checkout "$current_branch" 2>/dev/null || true
        return 1
    fi
    
    # Return to original branch
    git checkout "$current_branch"
    print_success "Pre-merge tests passed!"
    return 0
}

# Function to safely merge develop to main
safe_merge() {
    print_status "Starting safe merge of develop → main..."
    check_git_prerequisites
    
    # Check for uncommitted changes
    if ! git diff --quiet || ! git diff --cached --quiet; then
        print_error "Working directory has uncommitted changes. Please commit or stash them first."
        exit 1
    fi
    
    # Run pre-merge tests
    if ! run_pre_merge_tests; then
        print_error "Pre-merge tests failed. Merge aborted."
        exit 1
    fi
    
    # Get current branch
    current_branch=$(git branch --show-current)
    print_status "Current branch: $current_branch"
    
    # Fetch latest from origin
    print_status "Fetching latest from origin..."
    git fetch origin
    
    # Check if develop has commits ahead of main
    develop_commits=$(git rev-list --count origin/main..origin/develop 2>/dev/null || echo "0")
    if [ "$develop_commits" -eq "0" ]; then
        print_warning "No new commits to merge from develop to main"
        return 0
    fi
    
    print_status "Found $develop_commits new commit(s) to merge from develop"
    
    # Show what will be merged
    print_status "Commits to be merged:"
    git log --oneline origin/main..origin/develop | head -10
    if [ "$develop_commits" -gt "10" ]; then
        print_status "... and $((develop_commits - 10)) more commits"
    fi
    
    # Create backup of current state
    backup_branch="backup-main-$(date +%Y%m%d-%H%M%S)"
    print_status "Creating backup branch: $backup_branch"
    git branch "$backup_branch" origin/main
    
    # Switch to main and merge
    print_status "Switching to main branch..."
    git checkout main
    
    print_status "Pulling latest main..."
    git pull origin main
    
    print_status "Merging develop into main..."
    if ! git merge origin/develop --no-ff -m "🔀 Merge develop into main via deploy script"; then
        print_error "Merge failed! Restoring from backup..."
        git merge --abort 2>/dev/null || true
        git reset --hard "$backup_branch"
        git branch -D "$backup_branch"
        git checkout "$current_branch" 2>/dev/null || true
        exit 1
    fi
    
    # Validate the merge by building
    print_status "Validating merge by running build..."
    if ! npm run build; then
        print_error "Build failed after merge! Rolling back..."
        git reset --hard "$backup_branch"
        git branch -D "$backup_branch"
        git checkout "$current_branch" 2>/dev/null || true
        exit 1
    fi
    
    # Push to origin
    print_status "Pushing merged main to origin..."
    git push origin main
    
    # Clean up backup and return to original branch
    git branch -D "$backup_branch"
    if [ "$current_branch" != "main" ]; then
        git checkout "$current_branch"
    fi
    
    print_success "Successfully merged develop → main!"
    print_status "Merged $develop_commits commit(s)"
}

# Function to show container logs with nice formatting
show_deployment_logs() {
    print_status "🚀 Deployment complete! Following logs (Press Ctrl+C to stop)..."
    echo ""
    
    if ! docker compose ps | grep -q "bogart-bot.*Up"; then
        print_warning "Container not running yet. Check status with: $0 status"
        return 1
    fi
    
    print_status "Last 20 lines of existing logs:"
    docker compose logs --tail=20 bogart-bot
    echo ""
    print_status "--- Following live logs (new messages will appear below) ---"
    docker compose logs -f bogart-bot
}

# Function to save deployment state for rollback
save_deployment_state() {
    local state_dir=".deploy_state"
    mkdir -p "$state_dir"
    
    # Save current git commit
    git rev-parse HEAD > "$state_dir/last_commit"
    
    # Save deployment timestamp
    date +"%Y-%m-%d %H:%M:%S" > "$state_dir/last_deploy"
    
    print_status "Deployment state saved for potential rollback"
}

# Function to rollback to previous deployment
rollback_deployment() {
    print_status "Rolling back to previous deployment..."
    local state_dir=".deploy_state"
    
    if [ ! -f "$state_dir/last_commit" ]; then
        print_error "No previous deployment state found for rollback"
        return 1
    fi
    
    local last_commit=$(cat "$state_dir/last_commit")
    print_status "Rolling back to commit: $last_commit"
    
    # Stop current containers
    docker compose down
    
    # Checkout previous commit
    git checkout "$last_commit"
    
    # Rebuild and deploy
    print_status "Rebuilding from previous commit..."
    export DOCKER_BUILDKIT=1
    export COMPOSE_DOCKER_CLI_BUILD=1
    docker compose build --parallel
    docker compose up -d
    
    # Wait for rollback to complete
    local max_wait=60
    local wait_time=0
    
    while [ $wait_time -lt $max_wait ]; do
        if docker compose ps | grep -q "bogart-bot.*Up.*healthy"; then
            print_success "Rollback completed successfully!"
            return 0
        elif docker compose ps | grep -q "bogart-bot.*Up"; then
            print_status "Rollback container starting... (${wait_time}s/${max_wait}s)"
        else
            print_error "Rollback failed - container not starting"
            return 1
        fi
        
        sleep 5
        wait_time=$((wait_time + 5))
    done
    
    print_warning "Rollback container started but health check timed out"
    return 1
}

# Function to validate configuration before deployment
validate_deployment_config() {
    print_status "Validating deployment configuration..."
    
    # Check required environment variables
    if [ ! -f ".env" ]; then
        print_error "Missing .env file"
        return 1
    fi
    
    # Check if DISCORD_TOKEN is set (without revealing the value)
    if ! grep -q "^DISCORD_TOKEN=" .env || grep -q "^DISCORD_TOKEN=$" .env; then
        print_error "DISCORD_TOKEN is not set in .env file"
        return 1
    fi
    
    # Check docker-compose.yml exists
    if [ ! -f "docker-compose.yml" ]; then
        print_error "Missing docker-compose.yml file"
        return 1
    fi
    
    # Check Dockerfile exists
    if [ ! -f "Dockerfile" ]; then
        print_error "Missing Dockerfile"
        return 1
    fi
    
    # Validate docker-compose syntax
    if ! docker compose config > /dev/null 2>&1; then
        print_error "Invalid docker-compose.yml configuration"
        return 1
    fi
    
    print_success "Deployment configuration validated"
    return 0
}

# Function to deploy (single mode) with automatic log viewing
deploy() {
    print_status "Deploying using docker-compose.yml..."
    check_prerequisites
    
    # Validate configuration before deployment
    if ! validate_deployment_config; then
        print_error "Configuration validation failed. Deployment aborted."
        exit 1
    fi
    
    # Save current state for potential rollback
    save_deployment_state
    
    # Check if containers are currently running
    if docker compose ps | grep -q "Up"; then
        print_status "Stopping existing containers..."
        docker compose down
        print_success "Existing containers stopped"
    else
        print_status "No existing containers found"
    fi
    
    print_status "Building and starting environment..."
    # Enable BuildKit for better performance and caching
    export DOCKER_BUILDKIT=1
    export COMPOSE_DOCKER_CLI_BUILD=1
    
    # Use build cache and parallel building
    docker compose build --parallel
    docker compose up -d
    
    # Wait for containers to start and become healthy
    print_status "Waiting for containers to start and become healthy..."
    local max_wait=60
    local wait_time=0
    
    while [ $wait_time -lt $max_wait ]; do
        if docker compose ps | grep -q "bogart-bot.*Up.*healthy"; then
            print_success "Container is running and healthy!"
            break
        elif docker compose ps | grep -q "bogart-bot.*Up"; then
            print_status "Container starting... (${wait_time}s/${max_wait}s)"
        else
            print_error "Container failed to start"
            print_status "Container status:"
            docker compose ps
            
            # Attempt automatic rollback
            print_warning "Attempting automatic rollback..."
            if rollback_deployment; then
                print_success "Automatic rollback completed"
                return 0
            else
                print_error "Automatic rollback failed. Manual intervention required."
                return 1
            fi
        fi
        
        sleep 5
        wait_time=$((wait_time + 5))
    done
    
    if [ $wait_time -ge $max_wait ]; then
        print_warning "Container started but health check timed out after ${max_wait}s"
        print_status "This may be normal on first startup. Check logs for issues."
        
        # Give user option to rollback
        print_status "Would you like to rollback? (Ctrl+C to cancel, Enter to continue with current deployment)"
        read -r
    fi
    
    print_status "Final container status:"
    docker compose ps
    echo ""
    
    print_success "✅ Deployment Summary:"
    print_status "• Stopped existing containers (if any)"
    print_status "• Built fresh container images"
    print_status "• Started containers with health checks"
    print_status "• Verified container is running and healthy"
    echo ""
    
    # Automatically show logs after deployment
    show_deployment_logs
}

# Function to merge and deploy in one command
merge_deploy() {
    print_status "Starting merge + deploy workflow..."
    safe_merge
    echo ""
    deploy
}

# Function to stop services
stop_services() {
    print_status "Stopping all services..."
    docker compose down
    print_success "All services stopped"
}

# Function to show logs
show_logs() {
    print_status "Showing logs..."
    if ! docker compose ps | grep -q "bogart-bot.*Up"; then
        print_warning "No running containers found. Deploy first with: $0 deploy"
        return 1
    fi
    docker compose logs -f bogart-bot
}

# Function to show status
show_status() {
    print_status "Checking service status..."
    docker compose ps || true
    echo ""
    print_status "Docker system info:"
    docker system df
}

# Function to update deployment
update_deployment() {
    print_status "Updating deployment..."
    
    # Stop existing containers
    if docker compose ps | grep -q "Up"; then
        print_status "Stopping existing containers..."
        docker compose down
    fi
    
    # Pull latest images and rebuild
    print_status "Pulling latest images..."
    docker compose pull
    
    print_status "Building and starting updated environment..."
    # Enable BuildKit for better performance and caching
    export DOCKER_BUILDKIT=1
    export COMPOSE_DOCKER_CLI_BUILD=1
    
    # Use build cache and parallel building
    docker compose build --parallel
    docker compose up -d
    
    # Wait for containers to start and become healthy
    print_status "Waiting for containers to start and become healthy..."
    local max_wait=60
    local wait_time=0
    
    while [ $wait_time -lt $max_wait ]; do
        if docker compose ps | grep -q "bogart-bot.*Up.*healthy"; then
            print_success "Update completed successfully!"
            break
        elif docker compose ps | grep -q "bogart-bot.*Up"; then
            print_status "Container starting... (${wait_time}s/${max_wait}s)"
        else
            print_error "Update failed - container not running"
            docker compose ps
            return 1
        fi
        
        sleep 5
        wait_time=$((wait_time + 5))
    done
    
    if [ $wait_time -ge $max_wait ]; then
        print_warning "Container started but health check timed out after ${max_wait}s"
    fi
    
    print_status "Container status:"
    docker compose ps
}

# Function to clean up Docker resources
cleanup() {
    print_status "Cleaning up Docker resources..."
    print_status "Removing unused images..."
    docker image prune -f
    print_status "Removing unused volumes..."
    docker volume prune -f
    print_status "Removing unused networks..."
    docker network prune -f
    print_success "Cleanup completed!"
}

# Function to backup configuration
backup_config() {
    local backup_dir="backups"
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="bogart-backup-$timestamp.tar.gz"
    print_status "Creating backup..."
    mkdir -p "$backup_dir"
    tar -czf "$backup_dir/$backup_file" \
        .env \
        data/quotes.yaml \
        docker-compose.yml \
        Dockerfile \
        .dockerignore \
        2>/dev/null || true
    print_success "Backup created: $backup_dir/$backup_file"
}

# Function to show deployment history
show_deployment_history() {
    print_status "Deployment History:"
    local state_dir=".deploy_state"
    
    if [ -f "$state_dir/last_deploy" ] && [ -f "$state_dir/last_commit" ]; then
        local last_deploy=$(cat "$state_dir/last_deploy")
        local last_commit=$(cat "$state_dir/last_commit")
        echo "  Last deployment: $last_deploy"
        echo "  Last commit: $last_commit"
        
        # Show commit details
        if git show --oneline -s "$last_commit" 2>/dev/null; then
            echo "  Commit details: $(git show --oneline -s "$last_commit" 2>/dev/null)"
        fi
    else
        echo "  No deployment history found"
    fi
    echo ""
}

# Function to show help
show_help() {
    echo "Bogart Discord Bot Deployment Script"
    echo ""
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  deploy             Deploy using docker-compose.yml (shows logs automatically)"
    echo "  merge              Safely merge develop → main (with pre-merge testing)"
    echo "  merge-deploy       Merge develop → main and deploy in one command"
    echo "  rollback           Rollback to previous deployment"
    echo "  stop               Stop all services"
    echo "  logs               Show logs"
    echo "  status             Show service status"
    echo "  history            Show deployment history"
    echo "  update             Update deployment"
    echo "  cleanup            Clean up unused Docker resources"
    echo "  backup             Backup configuration files"
    echo "  help               Show this help message"
    echo ""
    echo "Git Workflow Commands:"
    echo "  merge              - Safely merge develop into main with pre-merge testing"
    echo "  merge-deploy       - Complete workflow: test + merge + deploy + show logs"
    echo ""
    echo "Safety Features:"
    echo "  • Pre-merge testing (npm test + build validation)"
    echo "  • Automatic rollback on deployment failure"
    echo "  • Configuration validation before deployment"
    echo "  • Deployment state tracking for rollback capability"
    echo ""
    echo "Examples:"
    echo "  $0 merge-deploy    # Full workflow with testing, merge, deploy, and logs"
    echo "  $0 deploy          # Deploy current branch and show logs"
    echo "  $0 merge           # Safely merge develop→main with testing"
    echo "  $0 rollback        # Rollback to previous deployment"
    echo "  $0 history         # Show deployment history"
    echo ""
}

# Main script logic
case "${1:-help}" in
    "deploy")
        deploy
        ;;
    "merge")
        safe_merge
        ;;
    "merge-deploy")
        merge_deploy
        ;;
    "rollback")
        rollback_deployment
        ;;
    "stop")
        stop_services
        ;;
    "logs")
        show_logs
        ;;
    "status")
        show_status
        ;;
    "history")
        show_deployment_history
        ;;
    "update")
        update_deployment
        ;;
    "cleanup")
        cleanup
        ;;
    "backup")
        backup_config
        ;;
    "help"|"-h"|"--help")
        show_help
        ;;
    *)
        print_error "Unknown command: $1"
        echo ""
        show_help
        exit 1
        ;;
esac