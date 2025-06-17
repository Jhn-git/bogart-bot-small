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
    
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed or not in PATH"
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

# Function to deploy in development mode
deploy_dev() {
    print_status "Deploying in development mode..."
    check_prerequisites
    
    print_status "Building and starting development environment..."
    docker-compose -f docker-compose.yml -f docker-compose.dev.yml up --build -d
    
    print_success "Development deployment completed!"
    print_status "Container status:"
    docker-compose ps
    
    print_status "To view logs: docker-compose logs -f bogart-bot"
    print_status "To stop: docker-compose down"
}

# Function to deploy in production mode
deploy_prod() {
    print_status "Deploying in production mode..."
    check_prerequisites
    
    # Create production log directory if it doesn't exist
    if [ ! -d "/var/log/bogart-bot" ]; then
        print_status "Creating production log directory..."
        sudo mkdir -p /var/log/bogart-bot
        sudo chown 1001:1001 /var/log/bogart-bot
    fi
    
    print_status "Building and starting production environment..."
    docker-compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d
    
    print_success "Production deployment completed!"
    print_status "Container status:"
    docker-compose -f docker-compose.yml -f docker-compose.prod.yml ps
    
    print_status "To view logs: docker-compose -f docker-compose.yml -f docker-compose.prod.yml logs -f bogart-bot"
    print_status "To stop: docker-compose -f docker-compose.yml -f docker-compose.prod.yml down"
}

# Function to stop services
stop_services() {
    print_status "Stopping all services..."
    
    # Stop development services if running
    if docker-compose -f docker-compose.yml -f docker-compose.dev.yml ps | grep -q "Up"; then
        print_status "Stopping development services..."
        docker-compose -f docker-compose.yml -f docker-compose.dev.yml down
    fi
    
    # Stop production services if running
    if docker-compose -f docker-compose.yml -f docker-compose.prod.yml ps | grep -q "Up"; then
        print_status "Stopping production services..."
        docker-compose -f docker-compose.yml -f docker-compose.prod.yml down
    fi
    
    print_success "All services stopped"
}

# Function to show logs
show_logs() {
    local environment=${1:-""}
    
    if [ "$environment" = "prod" ] || [ "$environment" = "production" ]; then
        print_status "Showing production logs..."
        docker-compose -f docker-compose.yml -f docker-compose.prod.yml logs -f bogart-bot
    elif [ "$environment" = "dev" ] || [ "$environment" = "development" ]; then
        print_status "Showing development logs..."
        docker-compose -f docker-compose.yml -f docker-compose.dev.yml logs -f bogart-bot
    else
        # Try to detect which environment is running
        if docker-compose -f docker-compose.yml -f docker-compose.prod.yml ps | grep -q "Up"; then
            print_status "Showing production logs..."
            docker-compose -f docker-compose.yml -f docker-compose.prod.yml logs -f bogart-bot
        elif docker-compose -f docker-compose.yml -f docker-compose.dev.yml ps | grep -q "Up"; then
            print_status "Showing development logs..."
            docker-compose -f docker-compose.yml -f docker-compose.dev.yml logs -f bogart-bot
        else
            print_error "No running services found. Please specify 'dev' or 'prod'"
            exit 1
        fi
    fi
}

# Function to show status
show_status() {
    print_status "Checking service status..."
    
    echo ""
    print_status "Development services:"
    docker-compose -f docker-compose.yml -f docker-compose.dev.yml ps || true
    
    echo ""
    print_status "Production services:"
    docker-compose -f docker-compose.yml -f docker-compose.prod.yml ps || true
    
    echo ""
    print_status "Docker system info:"
    docker system df
}

# Function to update deployment
update_deployment() {
    local environment=${1:-"prod"}
    
    print_status "Updating $environment deployment..."
    
    if [ "$environment" = "dev" ] || [ "$environment" = "development" ]; then
        print_status "Pulling latest changes and rebuilding development environment..."
        docker-compose -f docker-compose.yml -f docker-compose.dev.yml pull
        docker-compose -f docker-compose.yml -f docker-compose.dev.yml up --build -d
    else
        print_status "Pulling latest changes and rebuilding production environment..."
        docker-compose -f docker-compose.yml -f docker-compose.prod.yml pull
        docker-compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d
    fi
    
    print_success "Update completed!"
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
        docker-compose*.yml \
        Dockerfile \
        .dockerignore \
        2>/dev/null || true
    
    print_success "Backup created: $backup_dir/$backup_file"
}

# Function to show help
show_help() {
    echo "Bogart Discord Bot Deployment Script"
    echo ""
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  dev                Deploy in development mode"
    echo "  prod               Deploy in production mode"
    echo "  stop               Stop all services"
    echo "  logs [env]         Show logs (env: dev/prod, auto-detect if omitted)"
    echo "  status             Show service status"
    echo "  update [env]       Update deployment (env: dev/prod, default: prod)"
    echo "  cleanup            Clean up unused Docker resources"
    echo "  backup             Backup configuration files"
    echo "  help               Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 dev             # Deploy in development mode"
    echo "  $0 prod            # Deploy in production mode"
    echo "  $0 logs prod       # Show production logs"
    echo "  $0 update dev      # Update development deployment"
    echo ""
}

# Main script logic
case "${1:-help}" in
    "dev"|"development")
        deploy_dev
        ;;
    "prod"|"production")
        deploy_prod
        ;;
    "stop")
        stop_services
        ;;
    "logs")
        show_logs "$2"
        ;;
    "status")
        show_status
        ;;
    "update")
        update_deployment "$2"
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