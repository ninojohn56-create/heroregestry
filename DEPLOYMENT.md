# GHRA Production Deployment & Operations Runbook

**Platform**: Global Superhuman Registration Authority (GHRA)  
**Target Environment**: Linux Enterprise Server (Ubuntu 22.04 / Debian 12 / RHEL 9) / Containerized Docker Stack  

---

## 1. System Prerequisites

- **Operating System**: Linux (Ubuntu 22.04 LTS recommended)
- **PHP Version**: 8.2 or 8.3 (with CLI, FPM, and extensions)
- **Required Extensions**:
  - `php-openssl` (AES-256-CBC + HMAC-SHA256 vault encryption & audit chaining)
  - `php-mbstring` (multibyte character handling)
  - `php-curl` (external radar telemetry & test suite)
  - `php-fileinfo` (MIME validation for documents and avatars)
  - `php-gd` (avatar thumbnail processing)
  - `php-zip` (automated backup compression)
- **Web Server**: Nginx 1.22+ or Docker 24+ & Docker Compose v2+
- **Network**: Port 80 (HTTP redirect), Port 443 (HTTPS), Port 8000 (Internal backend)

---

## 2. Deployment Options

### Option A: Docker Deployment (Containerized)
The repository includes a production multi-stage Alpine Dockerfile and `docker-compose.yml`:
```bash
git clone <repository_url> /opt/ghra
cd /opt/ghra
docker compose up -d --build
```
> **Environment Verification Notice**: On host environments lacking a local Docker daemon (e.g., bare Windows environments without Docker Desktop), Docker runtime builds cannot be executed locally. If deploying via containerization, ensure the deployment host or CI runner has a functional Docker engine installed.

### Option B: Native Linux Systemd Deployment (Recommended for Bare-Metal/VMs)
```bash
git clone <repository_url> /opt/ghra
cd /opt/ghra
chmod +x deploy.sh
sudo ./deploy.sh --native
```

---

## 3. Manual Step-by-Step Production Setup

### Step 1: Install System Packages (Ubuntu/Debian)
```bash
sudo apt update && sudo apt install -y \
    nginx \
    php8.3-cli \
    php8.3-fpm \
    php8.3-mbstring \
    php8.3-curl \
    php8.3-fileinfo \
    php8.3-gd \
    php8.3-zip \
    curl \
    git \
    certbot \
    python3-certbot-nginx
```

### Step 2: Configure Environment & Secrets
```bash
cd /opt/ghra
cp .env.example .env

# Generate a high-entropy 64-character hex Master Vault Key
NEW_KEY=$(php -r "echo bin2hex(random_bytes(32));")
sed -i "s/^HRS_MASTER_KEY=.*/HRS_MASTER_KEY=${NEW_KEY}/" .env

# Generate high-entropy Session Secret
NEW_SESSION=$(php -r "echo bin2hex(random_bytes(32));")
sed -i "s/^SESSION_SECRET=.*/SESSION_SECRET=${NEW_SESSION}/" .env

# Set production flags
sed -i "s/^APP_ENV=.*/APP_ENV=production/" .env
sed -i "s/^APP_DEBUG=.*/APP_DEBUG=false/" .env
```

### Step 3: Configure Storage & File Permissions
```bash
sudo chown -R www-data:www-data /opt/ghra/backend/data /opt/ghra/public/uploads
sudo chmod -R 775 /opt/ghra/backend/data /opt/ghra/public/uploads
```

### Step 4: Reverse Proxy Trust Configuration (`TRUST_PROXIES`)
In `.env`:
- If GHRA is deployed directly behind Nginx on `127.0.0.1`, leave `TRUST_PROXIES=false` (or configure `TRUSTED_PROXY_IPS=127.0.0.1`).
- If deployed behind Cloudflare, AWS ALB, or GCP Cloud Load Balancing, set `TRUST_PROXIES=true` and specify proxy CIDR blocks to ensure client IP rate limiting cannot be spoofed.

### Step 5: Systemd Service Configuration
Create `/etc/systemd/system/ghra.service`:
```ini
[Unit]
Description=Global Superhuman Registration Authority Daemon
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/opt/ghra
ExecStart=/usr/bin/php -d variables_order=EGPCS -S 127.0.0.1:8000 router.php
Restart=always
RestartSec=3
LimitNOFILE=65536
EnvironmentFile=/opt/ghra/.env

[Install]
WantedBy=multi-user.target
```

Reload and activate:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now ghra.service
sudo systemctl status ghra.service
```

### Step 6: Nginx Reverse Proxy Setup
Link the hardened configuration:
```bash
sudo cp /opt/ghra/nginx.conf /etc/nginx/sites-available/ghra.conf
sudo ln -sf /etc/nginx/sites-available/ghra.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### Step 7: Enable Production HTTPS / SSL
```bash
sudo certbot --nginx -d ghra.yourdomain.com
```

---

## 4. Disaster Recovery, Backup & Verification

### Create Timestamped Backup Archive
```bash
php backend/backup.php create
```
*Creates a SHA-256 verified ZIP snapshot in `backend/data/backups/ghra_datastore_backup_YYYYMMDD_HHMMSS.zip`.*

### Verify Cryptographic Integrity of Backup
```bash
php backend/backup.php verify backend/data/backups/ghra_datastore_backup_YYYYMMDD_HHMMSS.zip
```

### Restore Datastores from Backup
```bash
php backend/backup.php restore backend/data/backups/ghra_datastore_backup_YYYYMMDD_HHMMSS.zip
```
*Automatically generates a safety pre-restore rollback snapshot before overwriting active data.*

### Recommended Backup Schedule (Cron)
Add to `/etc/cron.d/ghra-backup`:
```cron
# Backup GHRA datastores every 6 hours
0 */6 * * * www-data /usr/bin/php /opt/ghra/backend/backup.php create > /var/log/ghra-backup.log 2>&1
```

---

## 5. Verification & Health Monitoring

### Diagnostic Preflight Check
```bash
php check_system.php
```

### Execute Full Automated Regression Test Suite
```bash
php tests/test_suite.php
```

### Liveness Health Check Probe
```bash
curl -i http://127.0.0.1:8000/api/health
```
Expected HTTP 200 response:
```json
{
  "status": "healthy",
  "app_env": "production",
  "php_version": "8.3.33",
  "datastores": {
    "heroes": 11,
    "vault": 262,
    "users": 26
  }
}
```
