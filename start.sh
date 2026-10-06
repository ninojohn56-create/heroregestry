#!/usr/bin/env bash
# =====================================================================
# Global Hero Registration Authority Management System (GHRMS)
# Linux / macOS Double-Click or Terminal System Launcher
# =====================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

BOLD="\033[1m"
GREEN="\033[32m"
YELLOW="\033[33m"
CYAN="\033[36m"
RED="\033[31m"
RESET="\033[0m"

echo -e "\n${BOLD}${CYAN}================================================================================${RESET}"
echo -e "${BOLD}${YELLOW}   GLOBAL HERO REGISTRATION AUTHORITY (GHRMS) // SYSTEM LAUNCHER${RESET}"
echo -e "${BOLD}${CYAN}================================================================================${RESET}\n"

# 1. Locate PHP
if ! command -v php &>/dev/null; then
    echo -e "${RED}[ERROR] PHP 8.2+ runtime was not found on your system.${RESET}\n"
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo -e "${YELLOW}macOS installation:${RESET}"
        echo -e "  brew install php"
    elif [[ -f /etc/debian_version ]]; then
        echo -e "${YELLOW}Debian / Ubuntu installation:${RESET}"
        echo -e "  sudo apt update && sudo apt install -y php php-mbstring php-curl php-gd php-zip"
    elif [[ -f /etc/redhat-release ]] || [[ -f /etc/fedora-release ]]; then
        echo -e "${YELLOW}Fedora / RHEL installation:${RESET}"
        echo -e "  sudo dnf install -y php php-mbstring php-gd"
    else
        echo -e "${YELLOW}Please install PHP 8.2+ and add it to your PATH.${RESET}"
    fi
    echo -e "\nAlternatively, run with Docker: ${CYAN}docker compose up -d${RESET}\n"
    read -p "Press Enter to exit..."
    exit 1
fi

PORT="${PORT:-8000}"

# 2. Run Preflight Diagnostics
echo -e "${CYAN}[1/3] Running preflight system diagnostics...${RESET}"
php check_system.php || {
    echo -e "\n${RED}[FAIL] Preflight diagnostics failed. Please resolve above issues.${RESET}\n"
    read -p "Press Enter to exit..."
    exit 1
}

# 3. Verify Datastore
echo -e "${CYAN}[2/3] Checking datastore integrity...${RESET}"
if [ ! -f "backend/data/heroes.json" ]; then
    php backend/seed.php
fi

# 4. Start Server
echo -e "\n${GREEN}[3/3] Starting GHRMS Web Server on http://localhost:${PORT}...${RESET}"
echo -e "--------------------------------------------------------------------------------"
echo -e "  Security Clearance Gateway:  ${CYAN}http://localhost:${PORT}/login${RESET}"
echo -e "  Sentinel Checkpoint Scanner: ${CYAN}http://localhost:${PORT}/sentinel${RESET}"
echo -e "  API Health Diagnostics:      ${CYAN}http://localhost:${PORT}/api/health${RESET}"
echo -e "--------------------------------------------------------------------------------"
echo -e "${YELLOW}Default Credentials:${RESET}"
echo -e "  Super Admin:  callsign: ${BOLD}commander${RESET}   passkey: ${BOLD}admin123${RESET}"
echo -e "  Registrar:    callsign: ${BOLD}sarah.chen${RESET}  passkey: ${BOLD}registrar123${RESET}"
echo -e "  Hero:         callsign: ${BOLD}apex${RESET}        passkey: ${BOLD}hero123${RESET}"
echo -e "--------------------------------------------------------------------------------"
echo -e "Server running. Press ${BOLD}Ctrl+C${RESET} in this terminal to shut down.\n"

# Automatically open browser if available
if command -v open &>/dev/null; then
    open "http://localhost:${PORT}/login" 2>/dev/null || true
elif command -v xdg-open &>/dev/null; then
    xdg-open "http://localhost:${PORT}/login" 2>/dev/null || true
fi

exec php -S 0.0.0.0:${PORT} router.php
