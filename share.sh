#!/usr/bin/env bash
# =====================================================================
# Global Hero Registration Authority Management System (GHRMS)
# Network Sharing & Field Sentinel Checkpoint Terminal Launcher
# =====================================================================

set -e

PORT="${PORT:-8000}"
HOST="0.0.0.0"

# Detect local IP address across network interfaces
LOCAL_IP=""
if command -v hostname &>/dev/null && hostname -I &>/dev/null; then
    LOCAL_IP=$(hostname -I | awk '{print $1}')
elif command -v ip &>/dev/null; then
    LOCAL_IP=$(ip route get 1.1.1.1 2>/dev/null | awk '{print $7}')
elif command -v ifconfig &>/dev/null; then
    LOCAL_IP=$(ifconfig | grep -Eo 'inet (addr:)?([0-9]*\.){3}[0-9]*' | grep -Eo '([0-9]*\.){3}[0-9]*' | grep -v '127.0.0.1' | head -n1)
fi

echo "================================================================================"
echo "   GLOBAL HERO REGISTRATION AUTHORITY (GHRMS) // FIELD SHARING GATEWAY"
echo "================================================================================"
echo "Binding Server: http://${HOST}:${PORT}"
echo "Local Machine:  http://localhost:${PORT}/login"
if [ -n "${LOCAL_IP}" ]; then
    echo "LAN Access:     http://${LOCAL_IP}:${PORT}/login"
    echo "Field Scanner:  http://${LOCAL_IP}:${PORT}/sentinel (Sentinel Checkpoint Scanner)"
fi
echo "================================================================================"

# Verify PHP installation
if ! command -v php &>/dev/null; then
    echo "ERROR: PHP is not installed or not in PATH. Please install PHP 8.2+ to continue."
    exit 1
fi

# Run preflight system check
php check_system.php || {
    echo "Preflight check failed. Fix the issues above before sharing."
    exit 1
}

# Check for cloudflared tunnel option
if [ "$1" == "--tunnel" ] || [ "$1" == "-t" ]; then
    if command -v cloudflared &>/dev/null; then
        echo "Starting Cloudflare quick tunnel for public mobile access..."
        cloudflared tunnel --url "http://localhost:${PORT}" &
        TUNNEL_PID=$!
        trap "kill $TUNNEL_PID 2>/dev/null" EXIT
    elif command -v ngrok &>/dev/null; then
        echo "Starting Ngrok tunnel on port ${PORT}..."
        ngrok http "${PORT}" &
        TUNNEL_PID=$!
        trap "kill $TUNNEL_PID 2>/dev/null" EXIT
    else
        echo "Notice: Neither 'cloudflared' nor 'ngrok' found. Serving on local network only."
    fi
fi

echo "Starting GHRMS HTTP daemon on ${HOST}:${PORT}..."
exec php -S "${HOST}:${PORT}" router.php
