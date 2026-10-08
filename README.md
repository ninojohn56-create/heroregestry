# Global Hero Registration & Management System (GHRMS)
### Accord Classification: Restricted // Standard GHRMS-701A

The **Global Hero Registration & Management System (GHRMS)** is an enterprise-grade administrative and tactical infrastructure designed to enforce the provisions of the municipal and international **Superhuman Accords**. It provides secure identity onboarding, cryptographic biometrics isolation, threat tier classification, real-time tactical radar, and street-level checkpoint verification.

---

## 🚀 Quick Start (Local Startup)

**Requirements:** PHP 8.2+ with `openssl`, `mbstring`, `curl`, `fileinfo`, `json`, `session`, and `gd` enabled.

### On Windows
To launch the system with automatic dependency validation, diagnostic checks, and browser launch:
```bat
# Double-click or run from command prompt:
start.bat

# Or run via PowerShell:
.\start.ps1
```

### On Linux / macOS / WSL
```bash
# Start the local application:
chmod +x start.sh
./start.sh
```
Use `share.sh` only when you want its optional network/tunnel sharing behavior.

### Manual Command
```bash
# Verify system readiness:
php check_system.php

# Start PHP built-in web server:
php -S 127.0.0.1:8000 router.php
```
Open **[http://localhost:8000/login](http://localhost:8000/login)** in your browser.
For local testing, the default demo accounts are listed below. Replace them before any public deployment.

---

## 🔑 Default Test Accounts & Clearance Credentials

| Role | Clearance Level | Callsign / Username | Passkey / Password | Target Terminal |
| :--- | :---: | :--- | :--- | :--- |
| **Supreme Commander** | Level 5 | `commander` | `admin123` | `/admin` |
| **Administrative Officer** | Level 4 | `admin` | `admin123` | `/admin` |
| **Intake Registrar** | Level 3 | `sarah.chen` | `registrar123` | `/registrar` |
| **Hero Operative (Apex)** | Level 1 | `apex` | `hero123` | `/hero` |
| **Hero Operative (Lumina)**| Level 1 | `lumina` | `hero123` | `/hero` |
| **Hero Operative (Solaris)**| Level 1 | `solaris` | `hero123` | `/hero` |
| **Field Sentinel / Police**| Field Access | *(Direct Checkpoint Access)* | *(No login required)* | `/sentinel` |

---

## 🖥️ System Portals & Navigation

- **Security Clearance Gateway:** `http://localhost:8000/login`
- **Hero Self-Service Onboarding:** `http://localhost:8000/register` (4-step guided intake with draft saving)
- **Hero Operative Dashboard:** `http://localhost:8000/hero` (Personal file, badge QR code, post-battle damage claims)
- **Intake Registrar Desk:** `http://localhost:8000/registrar` (Split-screen intake queue, document verification, licensing)
- **Sentinel Checkpoint Scanner:** `http://localhost:8000/sentinel` (Mobile-optimized camera/manual badge scanner)
- **Supreme Command Center:** `http://localhost:8000/admin` (Live tactical radar, audit ledger, user management)
- **Operative Directory:** `http://localhost:8000/registry` (Classified superhuman registry)
- **Health Check & Diagnostics:** `http://localhost:8000/api/health`

---

## 📦 Production Deployment

For InfinityFree setup and its compatibility/security limits, see [INFINITYFREE_DEPLOYMENT.md](INFINITYFREE_DEPLOYMENT.md). InfinityFree is suitable only for a small demo if the account supports the required PHP extensions, rewrites, sessions, and writable JSON storage; do not put real identity or biometric data on free shared hosting.

### Option 1: Docker & Docker Compose (Recommended)
The system includes a production-ready, multi-stage Alpine Linux container with all required PHP extensions (`openssl`, `mbstring`, `curl`, `fileinfo`, `gd`, `zip`).

```bash
# 1. Configure environment:
cp .env.example .env

# 2. Build and start containers in detached mode:
docker compose up -d --build

# 3. Check container status:
docker compose ps

# 4. View logs:
docker compose logs -f
```
Persistent data is mounted into `./backend/data` and `./frontend/uploads`.

### Option 2: Linux Host with Systemd & Nginx
Use the automated deployment engine:
```bash
chmod +x deploy.sh
sudo ./deploy.sh --native
```
This script validates dependencies, generates a cryptographically secure 48-byte master key, configures permissions, runs diagnostics, and generates a `ghrms.service` systemd unit template.

### Option 3: Network Sharing for Mobile / Field Sentinel Testing
To test the Sentinel Checkpoint Scanner from a smartphone, tablet, or secondary laptop on the same local network:
```bash
# On Windows:
.\share.ps1

# On Linux / macOS:
./share.sh
```
The script auto-detects your LAN IP (e.g. `http://192.168.1.50:8000`) and displays the QR / direct links for mobile testing.

---

## 🛡️ Security Architecture & Hardening

1. **AES-256 Biometric Identity Vault:**
   Civilian identities (legal names, safehouse addresses, emergency contacts) are strictly encrypted with AES-256-CBC and stored separately in `backend/data/vault.json`. Each record uses a cryptographically random 16-byte initialization vector (IV).
2. **SHA-256 Cryptographic Audit Ledger:**
   Every administrative lifecycle action (vault unlocks, licensing, document reviews) is committed to an append-only, chained cryptographic hash ledger (`backend/data/audit_ledger.json`).
3. **Sliding-Window Rate Limiting:**
   Built-in sliding-window rate limiter (`backend/rate_limiter.php`) protects authentication endpoints (`15/min`), avatar uploads (`20/5min`), and registrations (`15/10min`) against brute-force and Denial-of-Service attacks.
4. **Crash-Safe Atomic File Storage:**
   All flat-file transactional operations (`backend/storage.php`) employ exclusive POSIX kernel locks (`flock`), serialization verification, and safe truncation to prevent 0-byte database wipes during unexpected power outages or server crashes.
5. **Strict Web Perimeter:**
   The front controller (`router.php`) and Nginx configuration enforce strict directory isolation, forbidding web access to `.env`, dotfiles, `/backend/`, `/unused/`, Dockerfiles, and administrative scripts.
6. **Hardened HTTP Headers:**
   All responses include `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and `X-XSS-Protection: 1; mode=block`.
7. **Detailed Specifications**: See [SECURITY.md](SECURITY.md) and [DEPLOYMENT.md](DEPLOYMENT.md).

---

## 🧪 Automated Testing & Regression Test Suite

Run the full end-to-end automated test runner (40 verification assertions across Auth, RBAC, IDOR, State Machine, CSV Injection, and Cryptography):

```bash
php tests/test_suite.php
```

Sample test output:
```
=================================================================
GHRA GLOBAL SUPERHUMAN REGISTRATION AUTHORITY - TEST SUITE
Target Endpoint: http://127.0.0.1:8000
PHP Version: 8.3.33
=================================================================
  [PASS] Health endpoint returns HTTP 200
  [PASS] Super Admin login succeeds
  [PASS] Role is SUPER_ADMIN
  [PASS] Session established via /api/auth/me
  [PASS] Invalid password rejected with HTTP 401
  [PASS] Admin can set account status to 'suspended'
  [PASS] Suspended account login blocked (HTTP 401)
  [PASS] Operative can view own record (HTTP 200)
  [PASS] IDOR BLOCKED: Hero viewing another operative record gets HTTP 403 Forbidden
  [PASS] Staff (Registrar) can inspect any operative record (HTTP 200)
  [PASS] Document theft BLOCKED: Cross-hero document access returns HTTP 403
  [PASS] Hero self-verification BLOCKED with HTTP 403 Forbidden
  [PASS] Threat tier tampering PREVENTED (tier remains un-escalated)
  [PASS] Illegal transition Rejected -> Approved BLOCKED with HTTP 422 Unprocessable Entity
  [PASS] Standard Admin provisioning Super Admin BLOCKED with HTTP 403
  [PASS] Standard Admin resetting Super Admin passkey BLOCKED with HTTP 403
  [PASS] CSV contains 0 unescaped formula characters (CWE-1236 neutralized)
  [PASS] Audit chain integrity verified: 100% untampered
  [PASS] Path traversal attempt blocked with HTTP 404
  [PASS] Active session IMMEDIATELY revoked upon account suspension (HTTP 401)
  [PASS] Damage report attribution forced to authenticated operative ID (hero_lumina_02)
  [PASS] Factory reset safety confirmation token enforced (HTTP 400 without token)
  [PASS] Untrusted cross-origin request BLOCKED with HTTP 403 Forbidden
  [PASS] Document version tracking initialized on upload
  [PASS] Cross-hero document deletion BLOCKED with HTTP 403
  [PASS] Deletion of VERIFIED compliance document BLOCKED with HTTP 403
  [PASS] Double-extension upload backdoor.php.png REJECTED with HTTP 400
  [PASS] Executable PHP file upload webshell.php REJECTED with HTTP 415
  [PASS] Ciphertext bit-flip tampering detected by HMAC (returns null)
  [PASS] Security headers (CSP, nosniff, DENY, Permissions-Policy) enforced
=================================================================
TOTAL PASSED: 66 | TOTAL FAILED: 0 (100% PASS RATE)
=================================================================
```

---

## 📚 Technical Documentation Index

Detailed architectural, engineering, and operational specifications are available in the repository root:

- **[ARCHITECTURE.md](ARCHITECTURE.md)**: Architectural blueprint, component topology, trust boundaries, session lifecycle, and data flow.
- **[API.md](API.md)**: Complete REST API reference, request/response formats, status codes, and RBAC rules.
- **[DATABASE.md](DATABASE.md)**: JSON flat-file storage engine, atomic concurrency (`flock` & `rename`), and schema definitions.
- **[DOCUMENTS.md](DOCUMENTS.md)**: Document lifecycle, MIME verification, versioning, deletion protection, and retention.
- **[SECURITY.md](SECURITY.md)**: Security policy, threat model, Encrypt-then-MAC, CSRF defense, and rate limiting.
- **[DEVELOPMENT.md](DEVELOPMENT.md)**: Developer onboarding, prerequisites, local setup, coding standards, and adding endpoints.
- **[TESTING.md](TESTING.md)**: Automated test suite runner guide, test groups breakdown, and QA assertions.
- **[DEPLOYMENT.md](DEPLOYMENT.md)**: Production deployment instructions, Nginx, Systemd, Docker, and reverse proxy setup.
- **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)**: Common operational issues, lock file handling, permission fixes, and error codes.
- **[RUNBOOK.md](RUNBOOK.md)**: SRE incident response playbooks (key rotation, account compromise, disaster recovery).
- **[CONTRIBUTING.md](CONTRIBUTING.md)**: Code contribution workflow, security checklist, and pull request rules.
- **[CHANGELOG.md](CHANGELOG.md)**: Historical changelog of features, security fixes, and version audits.

---

## 💾 Disaster Recovery & Datastore Backups

GHRA includes a standalone backup, verification, and restore CLI (`backend/backup.php`):

```bash
# Create timestamped datastore backup with SHA-256 manifest:
php backend/backup.php create

# List available backup archives:
php backend/backup.php list

# Verify cryptographic archive integrity:
php backend/backup.php verify backend/data/backups/ghra_datastore_backup_YYYYMMDD_HHMMSS.zip

# Restore datastores (with automatic pre-restore safety snapshot):
php backend/backup.php restore backend/data/backups/ghra_datastore_backup_YYYYMMDD_HHMMSS.zip
```

---

## 🔍 System Diagnostics & Verification

Run the diagnostics suite at any time to verify system health:
```bash
php check_system.php
```

All subsystems report `[ PASS ]` and `DIAGNOSTIC SCORECARD: ALL SYSTEMS OPERATIONAL (100% READY FOR SERVICE)`.
