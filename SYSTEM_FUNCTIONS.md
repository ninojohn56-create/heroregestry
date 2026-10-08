# Global Hero Registration Authority (GHRMS)
## Comprehensive System Functions Specification & Operations Manual

---

## 1. System Overview & Architecture

The **Global Hero Registration Authority Management System (GHRMS)** (also operating as the **Hunters Association Management System - HAMS**) is an enterprise-grade, role-based superhuman management, compliance, and field telemetry platform.

### Core Technology Stack
- **Server Environment**: Native PHP 8.2+ with zero mandatory external framework dependencies.
- **Routing & Perimeter Engine**: [router.php](file:///c:/Users/Nino/Documents/scene2%20final2%20%281%29/router.php) with strict Content-Security-Policy, anti-traversal defenses, and Apache `.htaccess` rewrite parity.
- **Frontend Architecture**: Modern Vanilla HTML5, CSS3 design tokens (`app.css`), and JavaScript ES2022.
- **Database & Data Store**: Structured JSON document stores backed by an AES-256-CBC encrypted vault (`backend/data/vault.json`).
- **Cryptographic Security**: Authenticated Encrypt-then-MAC (`AES-256-CBC + HMAC-SHA256`), chained SHA-256 audit ledger, and TOTP-style signed QR badge tokens.

---

## 2. Clearance Levels & Role Hierarchy

| Clearance Level | Role Identifier | Primary Responsibilities | Default Landing |
| :--- | :--- | :--- | :--- |
| **Clearance 5** | `SUPER_ADMIN` | Supreme Commander / Association Chairman; full system directives, user provisioning, cryptographic ledger audit, emergency broadcast. | `/admin` |
| **Clearance 4** | `ADMIN` | Tactical Administrator; incident assessment, regional threat radar oversight, registrar supervisor. | `/admin` |
| **Clearance 3** | `REGISTRAR` | Intake Review Officer; identity verification, civilian vault access, document certification, license issuance. | `/registrar` |
| **Clearance 1** | `HERO` | Registered Operative; intake registration, dynamic badge QR display, profile maintenance, battle incident reporting. | `/hero` |
| **Field Access** | `SENTINEL` | Checkpoint Guards & Police Officers; rapid badge QR scanning, identity verification, containment directive lookup. | `/sentinel` |

---

## 3. User-Facing Portals & Interface Functions

### 3.1 Central Gateway & Portal Dispatcher (`/`)
- **[FN-GW-01] Role-Based Route Dispatch**: Automatically inspects active session cookies and routes users to their authorized operational dashboard (`/admin`, `/registrar`, or `/hero`).
- **[FN-GW-02] Terminal Access Grid**: Provides visual portal cards to access Self-Registration, Security Clearance Login, Public Directory, and Field Sentinel Checkpoint.
- **[FN-GW-03] System Heartbeat Telemetry**: Live indicators confirming database connectivity, registry synchronization, and server health.
- **[FN-GW-04] Unified Theme Mode Toggle**: Global Light/Dark mode switcher with cross-tab persistence.

---

### 3.2 Awakened Hunter Registration Wizard (`/register`)
A guided 4-step wizard designed for hero applicants:
- **[FN-REG-01] Step 1: Civilian & Account Identification**:
  - Enrolls unique Hunter Callsign / Username, password, email, and real civilian name.
  - **Live WebRTC Camera / Snapshot Capture**: Captures face portraits directly through the browser with oval HUD guidelines, front/rear camera flip, and mobile device camera fallback.
  - **Tactical OpenStreetMap Geolocation Picker**: Leaflet-powered interactive map allowing candidates to pinpoint their safehouse coordinates and auto-assign municipal sector grids (`SF-POB`, `SF-HUB`, etc.).
  - Emergency Handler & Next-of-Kin contact details.
- **[FN-REG-02] Step 2: Combat Class & Awakened Skills**:
  - Classification selection (Striker, Elementalist, Tanker, Assassin, Ranger, Support, Mentalist).
  - Combat style, primary abilities, secondary powers, and tactical limitations/weaknesses.
  - Training background and equipment/gear manifest.
- **[FN-REG-03] Step 3: Threat Tier & Power Calibrator**:
  - Interactive Power Output slider (1–100) and Combat Rating slider (1–100).
  - Power control proficiency rating (Novice, Competent, Mastered, Absolute).
  - Self-assessed Hunter Rank from E-Rank up to National-Level Hunter.
- **[FN-REG-04] Step 4: Identity Verification & Accord Declaration**:
  - Upload official government credentials (National ID, Passport, Driver's License) with expiration dates.
  - Mandatory acknowledgment of the Philippine Hunters Association Accords.
  - **Save as Draft Function (`saveDraft`)**: Allows incomplete applications to be stored securely and resumed at any time.
  - **Packet Submission (`submitRegistration`)**: Encrypts secret identity details into the AES-256 vault and transitions status to `Submitted`.

---

### 3.3 Hunter Operative Portal (`/hero`)
- **[FN-HERO-01] Dynamic Anti-Counterfeit QR Badge**:
  - Generates a cryptographically signed QR code using HMAC-SHA256 tokens that refresh every 30 seconds.
  - Animated visual countdown ring preventing screenshot replication.
- **[FN-HERO-02] Live Application Status Tracker**:
  - Visual status stepper tracking: `Draft` → `Submitted` → `Under Review` → `Verified` → `Approved`.
- **[FN-HERO-03] Correction Resolution Banner**:
  - If a file is set to `Returned for Correction`, displays an amber banner with the reviewing officer's exact instructions.
  - Allows one-click re-entry into `/register` with pre-filled fields to amend documents and resubmit.
- **[FN-HERO-04] Battle Incident & Damage Reporting**:
  - Slide-over drawer allowing operatives to report post-mission property damage, civilian collateral impact, and sustained injuries.
- **[FN-HERO-05] Hunter Profile & Credential Card**:
  - Displays official Hunter ID, municipal license number (when approved), assigned threat tier, and accredited abilities.

---

### 3.4 Registrar Assessment Terminal (`/registrar`)
- **[FN-REGIS-01] Multi-Stage Intake Queue**:
  - Filterable tabs: Pending Intake (`Submitted`, `Under Review`), `Returned for Correction`, `Verified`, `Approved`, and `Rejected`.
- **[FN-REGIS-02] Split-Screen Document & File Inspection**:
  - In-browser document viewer for high-resolution inspection and zoom of uploaded PDF/image credentials without leaving the desk.
- **[FN-REGIS-03] Confidential Identity Vault Decryption**:
  - On-demand button to decrypt and view the applicant's real name and safehouse address.
  - **Mandatory Audit Logging**: Every vault access generates a permanent, cryptographically signed ledger entry recording the reviewing officer's ID, timestamp, and target hero.
- **[FN-REGIS-04] 4-Stage Verification Workflow**:
  - Stage 1: Document & Credential Certification (`Verified` / `Rejected` with mandatory reviewer notes).
  - Stage 2: Civilian Identity Confirmation (checks face portrait against government ID).
  - Stage 3: Threat Tier & Power Output Calibration (adjusts rating and combat rank).
  - Stage 4: License Issuance (`GHRMS-LIC-YYYY-XXXX`) and status transition to `Approved`.
- **[FN-REGIS-05] Request Correction Function**:
  - Returns applications to the hero with specific corrective instructions (e.g., "ID photo blurry; please re-upload").

---

### 3.5 Sentinel Field Checkpoint Terminal (`/sentinel`)
- **[FN-SENT-01] Real-Time WebRTC QR Code Scanner**:
  - Continuously scans QR badges presented on hero smartphones via camera feed.
- **[FN-SENT-02] Manual Callsign & License Lookup**:
  - Fast-lookup input field supporting Callsigns, Hunter IDs (`hero_apex_01`), Government Codes (`9GH-8430`), and License Numbers.
- **[FN-SENT-03] Sub-Second Clearance Triage Verdicts**:
  - **Active Green**: Operative is certified, licensed, and approved for active sector deployment.
  - **Amber Notice**: Provisional Intake; operative is under review or draft and lacks field deployment clearance.
  - **Red Alert**: Suspended or Revoked; triggers immediate rogue operative alarm and containment directives.
- **[FN-SENT-04] Medical Vulnerability & Safety Directives**:
  - Displays known weaknesses, combat limitations, and emergency medical precautions to field first-responders.

---

### 3.6 Command Center & System Admin Matrix (`/admin`)
- **[FN-ADM-01] Executive Telemetry & Citywide Readiness**:
  - Live counts of total operatives, active licenses, pending intake queues, and active incidents.
- **[FN-ADM-02] Regional Threat Radar & Interactive Sector Map**:
  - Geographical distribution of active heroes across municipal defense sectors.
- **[FN-ADM-03] Staff User Administration**:
  - Provision, modify, suspend, or reactivate Registrar and Administrator accounts.
  - Immediate revocation of active sessions upon account suspension.
- **[FN-ADM-04] Cryptographic Audit Ledger Inspector**:
  - Chronological inspection of all security actions.
  - **Ledger Verification**: One-click hash chain recalculation ensuring zero tampering or deleted events.
  - CSV Export with formula injection sanitization (CWE-1236 defense).
- **[FN-ADM-05] Emergency Directive Broadcaster**:
  - Citywide broadcast of rogue operative containment alerts, sector lockdowns, and disaster levels.
- **[FN-ADM-06] System Backup & Factory Reset**:
  - Download complete encrypted database snapshots.
  - Factory reset protected by dual confirmation tokens.

---

## 4. Backend Architecture & Service Functions

### 4.1 Authentication Service (`backend/auth.php`)
- `AuthService::initSession()`: Initializes hardened session cookies (`HttpOnly`, `SameSite=Lax`, strict cookie lifetime).
- `AuthService::login($username, $password)`: Verifies credentials via `password_verify` with bcrypt timing-safe comparisons.
- `AuthService::logout()`: Destroys session data and expires authentication cookies.
- `AuthService::getCurrentUser()`: Returns authenticated session identity; enforces immediate revocation if account is suspended.
- `AuthService::requireRole($allowedRoles)`: Enforces role boundaries; emits HTTP 403 upon privilege escalation attempts.
- `AuthService::seedUsers()`: Guarantees baseline administrative accounts exist on fresh installations.

### 4.2 Storage Service (`backend/storage.php`)
- `StorageService::getHeroes()`: Retrieves all hero operative records.
- `StorageService::getHeroById($id)`: Fetches a single operative record by primary key or alias.
- `StorageService::saveHero($data)`: Persists updates to hero JSON document store with file locking (`LOCK_EX`).
- `StorageService::getIncidents()` / `saveIncident($data)`: Manages battle damage and incident reports.
- `StorageService::logAudit($action, $details)`: Records entries into the chained SHA-256 audit ledger.
- `StorageService::verifyAuditChain()`: Validates that each block's `prev_hash` matches the preceding block's hash.

### 4.3 Cryptographic Service (`backend/crypto.php`)
- `CryptoService::encryptVault($plaintext)`: Encrypts confidential fields using AES-256-CBC and attaches HMAC-SHA256 signature (Encrypt-then-MAC).
- `CryptoService::decryptVault($ciphertext)`: Verifies HMAC signature before decrypting; returns null if payload has been tampered with.
- `CryptoService::generateBadgeToken($heroId, $status)`: Generates time-window signed tokens for QR verification.
- `CryptoService::verifyBadgeToken($token)`: Validates badge token authenticity and freshness.

### 4.4 Workflow Engine (`backend/workflow.php`)
- `WorkflowService::transitionStatus($heroId, $newStatus, $actor, $notes)`: Validates legal state transitions (e.g., prevents direct jumps from `Rejected` to `Approved`).
- `WorkflowService::verifyDocument($heroId, $docId, $decision, $notes)`: Records document certification decisions.
- `WorkflowService::issueLicense($heroId)`: Generates unique accredited municipal license identifier (`GHRMS-LIC-YYYY-XXXX`).

### 4.5 Security & Rate Limiting (`backend/rate_limiter.php`)
- `RateLimiter::check($key, $maxAttempts, $windowSeconds)`: File-based token bucket rate limiter defending login endpoints against brute-force attacks.

---

## 5. REST API Endpoint Catalog

| HTTP Method | Route | Description | Clearance Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Authenticate user credentials and establish session | Public |
| `GET` | `/api/auth/me` | Fetch active user identity and clearance level | Session |
| `POST` | `/api/auth/logout` | Terminate session and invalidate auth cookies | Session |
| `GET` | `/api/heroes` | List all operative records (filtered by clearance) | Staff / Hero (Self) |
| `GET` | `/api/heroes/{id}` | Inspect operative record by ID | Staff / Hero (Self) |
| `POST` | `/api/heroes/register` | Self-register new hero candidate (Draft or Submit) | Public / Hero |
| `PUT` | `/api/heroes/{id}` | Update operative record / draft | Hero (Owner) / Staff |
| `GET` | `/api/heroes/{id}/token` | Generate dynamic 30s QR badge token | Hero (Owner) / Staff |
| `POST` | `/api/heroes/{id}/decrypt-vault` | Decrypt civilian name & address (logged to audit) | Registrar / Admin |
| `POST` | `/api/heroes/{id}/documents` | Upload credential file (ID, certificate, diploma) | Hero (Owner) / Staff |
| `POST` | `/api/heroes/{id}/documents/{docId}/verify` | Reviewer decision on uploaded document | Registrar / Admin |
| `POST` | `/api/sentinel/scan` | Field lookup by QR token, Callsign, ID, or License | Public / Sentinel |
| `GET` | `/api/admin/audit` | Fetch cryptographic chained audit ledger | Super Admin |
| `GET` | `/api/admin/audit/verify` | Verify cryptographic integrity of entire audit log | Super Admin |
| `GET` | `/api/admin/users` | List system staff accounts | Super Admin |
| `POST` | `/api/admin/users` | Provision new staff account | Super Admin |
| `POST` | `/api/incidents` | Submit battle damage or mission incident report | Hero / Staff |
| `GET` | `/api/health` | System health probe and liveness check | Public |

---

## 6. How to Share and Run with Friends Online

### Method 1: Permanent 24/7 Web Hosting (InfinityFree / FreePage)
The system is ready for 24/7 web hosting at **`http://heroregestry.freepage.cc/`**.

1. Locate the prepared upload folder: [htdocs_upload/](file:///c:/Users/Nino/Documents/scene2%20final2%20%281%29/htdocs_upload) or archive [htdocs_upload/.zip](file:///c:/Users/Nino/Documents/scene2%20final2%20%281%29/htdocs_upload/.zip).
2. Open your hosting control panel / File Manager.
3. Upload the **contents** of `htdocs_upload/` directly into your web server's **`htdocs/`** root directory.
4. Anyone worldwide can visit:
   - **Self-Registration**: `http://heroregestry.freepage.cc/register`
   - **Staff & Hero Login**: `http://heroregestry.freepage.cc/login`
   - **Public Registry**: `http://heroregestry.freepage.cc/registry`
   - **Sentinel Field Scanner**: `http://heroregestry.freepage.cc/sentinel`

---

### Method 2: Instant Public Tunnel from Your PC (Zero-Install)
If you want your friends to connect directly to the system running on your computer right now:

1. Double-click [share_online.bat](file:///c:/Users/Nino/Documents/scene2%20final2%20%281%29/share_online.bat) in the project directory.
2. It automatically starts your local PHP server and opens an encrypted Cloudflare Tunnel.
3. It will print a public link ending in **`.trycloudflare.com`** (e.g. `https://random-words.trycloudflare.com`).
4. Send that link to your friends. They can open it on their mobile phone or PC from anywhere in the world!
