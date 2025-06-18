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

# Function to deploy (single mode)
deploy() {
    print_status "Deploying using docker-compose.yml..."
    check_prerequisites
    print_status "Building and starting environment..."
    docker compose up --build -d
    print_success "Deployment completed!"
    print_status "Container status:"
    docker compose ps
    print_status "To view logs: docker compose logs -f bogart-bot-prod"
    print_status "To stop: docker compose down"
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
    docker compose logs -f bogart-bot-prod
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
    docker compose pull
    docker compose up --build -d
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
        docker-compose.yml \
        Dockerfile \
        .dockerignore \
        2>/dev/null || true
    print_success "Backup created: $backup_dir/$backup_file"
}

# Function to show help
show_help() {
    echo "Bogart Discord Bot Deployment Script"
    echo ""
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  deploy             Deploy using docker-compose.yml"
    echo "  stop               Stop all services"
    echo "  logs               Show logs"
    echo "  status             Show service status"
    echo "  update             Update deployment"
    echo "  cleanup            Clean up unused Docker resources"
    echo "  backup             Backup configuration files"
    echo "  help               Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 deploy          # Deploy using docker-compose.yml"
    echo "  $0 logs            # Show logs"
    echo "  $0 update          # Update deployment"
    echo ""
}

# Main script logic
case "${1:-help}" in
    "deploy")
        deploy
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