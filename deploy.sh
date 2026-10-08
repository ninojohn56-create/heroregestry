#!/usr/bin/env bash
# =====================================================================
# Global Hero Registration Authority Management System (GHRMS)
# Automated Linux / Server Production Deployment Engine
# =====================================================================

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

BOLD="\033[1m"
GREEN="\033[32m"
YELLOW="\033[33m"
CYAN="\033[36m"
RED="\033[31m"
RESET="\033[0m"

echo -e "\n${BOLD}${CYAN}================================================================================${RESET}"
echo -e "${BOLD}   GLOBAL HERO REGISTRATION AUTHORITY (GHRMS) // PRODUCTION DEPLOYMENT ENGINE${RESET}"
echo -e "${BOLD}${CYAN}================================================================================${RESET}\n"

# 1. Environment file setup
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}[INFO] .env file not found. Initializing from .env.example...${RESET}"
    cp .env.example .env
fi

# 2. Check and generate cryptographic master key if default
CURRENT_KEY=$(grep -E "^HRS_MASTER_KEY=" .env | cut -d'=' -f2- | tr -d '"' | tr -d "'" || true)
if [ "${CURRENT_KEY}" == "HRS_SECRET_VAULT_KEY_2026_HERO_SYSTEM" ] || [ -z "${CURRENT_KEY}" ]; then
    echo -e "${YELLOW}[SECURITY] Default master key detected. Generating cryptographically secure 48-byte key...${RESET}"
    NEW_KEY="HRS_$(openssl rand -hex 24)"
    sed -i "s/^HRS_MASTER_KEY=.*/HRS_MASTER_KEY=${NEW_KEY}/" .env
    echo -e "${GREEN}[OK] Master vault key updated in .env.${RESET}"
fi

# 3. Create required runtime directories and set secure permissions
echo -e "${CYAN}[1/4] Ensuring datastore directories and POSIX permissions...${RESET}"
mkdir -p backend/data/documents backend/data/ratelimit frontend/uploads/avatars

if command -v id &>/dev/null && [ "$(id -u)" -eq 0 ]; then
    WEB_USER="www-data"
    if ! id "${WEB_USER}" &>/dev/null; then
        WEB_USER="nginx"
    fi
    chown -R ${WEB_USER}:${WEB_USER} backend/data frontend/uploads
    chmod -R 775 backend/data frontend/uploads
    echo -e "${GREEN}[OK] Storage permissions granted to ${WEB_USER}.${RESET}"
else
    chmod -R 775 backend/data frontend/uploads 2>/dev/null || true
    echo -e "${GREEN}[OK] Local directories initialized with 775 permissions.${RESET}"
fi

# 4. Check deployment mode: Docker vs Native
MODE="docker"
if [ "$1" == "--native" ] || [ "$1" == "--systemd" ] || ! command -v docker &>/dev/null; then
    MODE="native"
fi

if [ "${MODE}" == "docker" ]; then
    echo -e "\n${CYAN}[2/4] Deploying via Docker Compose...${RESET}"
    if ! command -v docker compose &>/dev/null && ! command -v docker-compose &>/dev/null; then
        echo -e "${RED}[ERROR] Neither 'docker compose' nor 'docker-compose' found.${RESET}"
        echo -e "Falling back to native deployment..."
        MODE="native"
    else
        DOCKER_CMD="docker compose"
        if ! docker compose version &>/dev/null; then
            DOCKER_CMD="docker-compose"
        fi

        echo -e "${CYAN}Building GHRMS container image...${RESET}"
        ${DOCKER_CMD} build --pull
        echo -e "${CYAN}Launching containers in daemon mode...${RESET}"
        ${DOCKER_CMD} up -d

        echo -e "\n${GREEN}[OK] Container stack successfully launched!${RESET}"
        ${DOCKER_CMD} ps
        exit 0
    fi
fi

# Native Host Deployment
echo -e "\n${CYAN}[2/4] Verifying native PHP runtime and extensions...${RESET}"
if ! command -v php &>/dev/null; then
    echo -e "${RED}[FATAL] PHP 8.2+ is required but not installed.${RESET}"
    echo "Install via: sudo apt install php8.3-cli php8.3-mbstring php8.3-curl php8.3-gd php8.3-zip"
    exit 1
fi

echo -e "\n${CYAN}[3/4] Running preflight system diagnostics...${RESET}"
php check_system.php || {
    echo -e "${RED}[FATAL] System diagnostics failed. Address errors before continuing.${RESET}"
    exit 1
}

echo -e "\n${CYAN}[4/4] Generating systemd unit service template...${RESET}"
SERVICE_FILE="/etc/systemd/system/ghrms.service"
cat <<EOF > ghrms.service.example
[Unit]
Description=Global Hero Registration Authority (GHRMS) Web Service
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=${SCRIPT_DIR}
ExecStart=/usr/bin/php -S 0.0.0.0:8000 -t ${SCRIPT_DIR} router.php
Restart=always
RestartSec=5s
Environment=APP_ENV=production
Environment=PORT=8000

# Hardening
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

echo -e "${GREEN}[OK] systemd template generated at ghrms.service.example${RESET}"
echo -e "To activate systemd service:"
echo -e "  sudo cp ghrms.service.example /etc/systemd/system/ghrms.service"
echo -e "  sudo systemctl daemon-reload && sudo systemctl enable --now ghrms"
echo -e "\n${BOLD}${GREEN}================================================================================${RESET}"
echo -e "${BOLD}${GREEN}   DEPLOYMENT READY // GHRMS IS READY FOR ACTIVE SERVICE${RESET}"
echo -e "${BOLD}${GREEN}================================================================================${RESET}\n"
