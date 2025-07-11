#!/bin/bash

# Patreon Analytics Control Script
# Usage: ./patreon_control.sh [start|stop|restart|status]

# Configuration
SERVER_DIR="/Users/caseymeehan/Documents/base/work/other/code/Patreon_Analytics/server"
CLIENT_DIR="/Users/caseymeehan/Documents/base/work/other/code/Patreon_Analytics/client"
PID_FILE="/tmp/patreon_analytics.pids"
LOG_DIR="/tmp/patreon_analytics_logs"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Create log directory if it doesn't exist
mkdir -p "$LOG_DIR"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')]${NC} $1"
}

print_error() {
    echo -e "${RED}[$(date +'%H:%M:%S')]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[$(date +'%H:%M:%S')]${NC} $1"
}

# Function to start the server
start_server() {
    print_status "Starting Patreon Analytics Server..."
    
    cd "$SERVER_DIR" || {
        print_error "Failed to navigate to server directory: $SERVER_DIR"
        return 1
    }
    
    # Checkout main branch
    print_status "Checking out main branch..."
    git checkout main >> "$LOG_DIR/server.log" 2>&1
    
    # Start server in background
    print_status "Starting production server..."
    NODE_ENV=production nohup node server.js >> "$LOG_DIR/server.log" 2>&1 &
    SERVER_PID=$!
    
    # Wait a moment to check if server started successfully
    sleep 2
    if kill -0 $SERVER_PID 2>/dev/null; then
        print_success "Server started successfully (PID: $SERVER_PID)"
        echo "SERVER_PID=$SERVER_PID" > "$PID_FILE"
        return 0
    else
        print_error "Failed to start server"
        return 1
    fi
}

# Function to start the client
start_client() {
    print_status "Starting Patreon Analytics Client..."
    
    cd "$CLIENT_DIR" || {
        print_error "Failed to navigate to client directory: $CLIENT_DIR"
        return 1
    }
    
    # Start client in background
    print_status "Starting development client..."
    nohup npm run dev >> "$LOG_DIR/client.log" 2>&1 &
    CLIENT_PID=$!
    
    # Wait a moment to check if client started successfully
    sleep 3
    if kill -0 $CLIENT_PID 2>/dev/null; then
        print_success "Client started successfully (PID: $CLIENT_PID)"
        echo "CLIENT_PID=$CLIENT_PID" >> "$PID_FILE"
        return 0
    else
        print_error "Failed to start client"
        return 1
    fi
}

# Function to stop all processes
stop_processes() {
    print_status "Stopping Patreon Analytics..."
    
    if [ ! -f "$PID_FILE" ]; then
        print_warning "No PID file found. Attempting to find and kill processes..."
        
        # Try to find and kill node processes related to the project
        pkill -f "node server.js"
        pkill -f "npm run dev"
        
        print_success "Attempted to stop all related processes"
        return 0
    fi
    
    # Read PIDs from file
    source "$PID_FILE"
    
    # Stop server
    if [ ! -z "$SERVER_PID" ] && kill -0 $SERVER_PID 2>/dev/null; then
        print_status "Stopping server (PID: $SERVER_PID)..."
        kill $SERVER_PID
        sleep 2
        if kill -0 $SERVER_PID 2>/dev/null; then
            print_warning "Server didn't stop gracefully, force killing..."
            kill -9 $SERVER_PID
        fi
        print_success "Server stopped"
    else
        print_warning "Server process not running or already stopped"
    fi
    
    # Stop client
    if [ ! -z "$CLIENT_PID" ] && kill -0 $CLIENT_PID 2>/dev/null; then
        print_status "Stopping client (PID: $CLIENT_PID)..."
        kill $CLIENT_PID
        sleep 2
        if kill -0 $CLIENT_PID 2>/dev/null; then
            print_warning "Client didn't stop gracefully, force killing..."
            kill -9 $CLIENT_PID
        fi
        print_success "Client stopped"
    else
        print_warning "Client process not running or already stopped"
    fi
    
    # Clean up PID file
    rm -f "$PID_FILE"
    print_success "All processes stopped"
}

# Function to check status
check_status() {
    print_status "Checking Patreon Analytics status..."
    
    if [ ! -f "$PID_FILE" ]; then
        print_warning "No PID file found - services may not be running"
        return 1
    fi
    
    source "$PID_FILE"
    
    # Check server
    if [ ! -z "$SERVER_PID" ] && kill -0 $SERVER_PID 2>/dev/null; then
        print_success "Server is running (PID: $SERVER_PID)"
    else
        print_error "Server is not running"
    fi
    
    # Check client
    if [ ! -z "$CLIENT_PID" ] && kill -0 $CLIENT_PID 2>/dev/null; then
        print_success "Client is running (PID: $CLIENT_PID)"
    else
        print_error "Client is not running"
    fi
}

# Function to show logs
show_logs() {
    echo -e "\n${BLUE}=== Server Logs (last 20 lines) ===${NC}"
    if [ -f "$LOG_DIR/server.log" ]; then
        tail -20 "$LOG_DIR/server.log"
    else
        print_warning "No server log file found"
    fi
    
    echo -e "\n${BLUE}=== Client Logs (last 20 lines) ===${NC}"
    if [ -f "$LOG_DIR/client.log" ]; then
        tail -20 "$LOG_DIR/client.log"
    else
        print_warning "No client log file found"
    fi
}

# Main script logic
case "$1" in
    "start")
        print_status "Starting Patreon Analytics..."
        if start_server && start_client; then
            print_success "Patreon Analytics started successfully!"
            print_status "Server logs: $LOG_DIR/server.log"
            print_status "Client logs: $LOG_DIR/client.log"
            print_status "Use './patreon_control.sh status' to check running status"
            print_status "Use './patreon_control.sh logs' to view recent logs"
        else
            print_error "Failed to start Patreon Analytics"
            stop_processes  # Clean up any partial starts
            exit 1
        fi
        ;;
    "stop")
        stop_processes
        ;;
    "restart")
        print_status "Restarting Patreon Analytics..."
        stop_processes
        sleep 2
        if start_server && start_client; then
            print_success "Patreon Analytics restarted successfully!"
        else
            print_error "Failed to restart Patreon Analytics"
            exit 1
        fi
        ;;
    "status")
        check_status
        ;;
    "logs")
        show_logs
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status|logs}"
        echo ""
        echo "Commands:"
        echo "  start   - Start both server and client"
        echo "  stop    - Stop both server and client"
        echo "  restart - Stop and then start both services"
        echo "  status  - Check if services are running"
        echo "  logs    - Show recent logs from both services"
        exit 1
        ;;
esac