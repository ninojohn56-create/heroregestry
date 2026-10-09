# Global Hero Registration Authority (GHRMS)
## Comprehensive System Functions Specification & Operations Manual
**Accord Classification: Restricted // Standard GHRMS-701A // Release 2.5 // Philippine Hunters Association (HAMS)**

---

## 1. System Overview & Architecture

The **Global Hero Registration & Management System (GHRMS)** (also operating as the **Hunters Association Management System - HAMS**) is an enterprise-grade administrative, compliance, and tactical platform built to license, evaluate, and monitor superhuman operatives for public safety.

Operating under the **Philippine Hunters Association** in the **San Francisco, Agusan del Sur Jurisdiction**, GHRMS enforces strict identity verification, power calibration, threat tier classification, secret identity vault encryption, and instant street-level checkpoint verification.

### Core Technology Stack
- **Server Environment**: Native PHP 8.2+ with zero mandatory external framework dependencies.
- **Routing & Perimeter Engine**: [router.php](file:///c:/Users/Nino/Documents/scene2%20final2%20%281%29/router.php) with strict Content-Security-Policy, anti-traversal defenses, and Apache `.htaccess` rewrite parity.
- **Frontend Architecture**: Modern Vanilla HTML5, CSS3 design tokens (`app.css`), and JavaScript ES2022.
- **Database & Data Store**: Flat-file JSON document stores backed by an AES-256-CBC encrypted vault (`backend/data/vault.json`).
- **Cryptographic Security**: Authenticated Encrypt-then-MAC (`AES-256-CBC + HMAC-SHA256`), chained SHA-256 audit ledger, and TOTP-style signed QR badge tokens.

---

## 2. Clearance Levels & Role Hierarchy

| Clearance Level | Role Identifier | Callsign / Username | Demo Passkey | Default Landing | Operational Scope |
| :---: | :--- | :--- | :--- | :--- | :--- |
| **Clearance 5** | `SUPER_ADMIN` | `commander` | `admin123` *(Dev/Demo only)* | `/admin` | Supreme Commander / Association Chairman; full system directives, user provisioning, cryptographic ledger audit, emergency broadcast. |
| **Clearance 4** | `ADMIN` | `admin` | `admin123` *(Dev/Demo only)* | `/admin` | Tactical Administrator; incident assessment, regional threat radar oversight, registrar supervisor. |
| **Clearance 3** | `REGISTRAR` | `sarah.chen` | `registrar123` *(Dev/Demo only)* | `/registrar` | Intake Review Officer; identity verification, civilian vault access, document certification, license issuance. |
| **Clearance 1** | `HERO` | `apex` | `hero123` | `/hero` | Registered Operative; intake registration, dynamic badge QR display, profile maintenance, battle incident reporting. |
| **Field Access** | `SENTINEL` | *(Direct)* | *(No login)* | `/sentinel` | Checkpoint Guards & Police Officers; rapid badge QR scanning, identity verification, containment directive lookup. |

> [!IMPORTANT]
> **Production Credential Defense Policy**: On live production deployments (`APP_ENV=production`), well-known factory starter passkeys (`admin123`, `registrar123`) are strictly blocked at the authentication gateway (`DEFAULT_CREDENTIALS_PROHIBITED`) with security audit entries recorded. Default passwords require setting `ALLOW_DEFAULT_ADMIN_CREDENTIALS=true` in the private `.env` file during local evaluation and demonstration.

---

## 3. 10-State Lifecycle Machine (`RegistrationWorkflow`)

The system implements a deterministic 10-state lifecycle engine:
- `Draft`: Initial self-registration saved without formal compliance submission.
- `Submitted`: Application submitted by candidate and awaiting intake review.
- `Under Review`: Assigned registrar is actively evaluating credentials and bio-data.
- `Returned for Correction`: Reviewer flagged issues; applicant must amend fields and resubmit.
- `Verified`: Official government ID and biometric face portrait authenticated by staff.
- `Approved`: Review complete; municipal license issued (`GHRMS-LIC-YYYY-XXXX`).
- `Licensed`: Active accredited hero permitted for field combat deployment.
- `Suspended`: Temporary administrative hold; field deployment privileges revoked.
- `Rejected`: Application disqualified due to security hazards or fraudulent declarations.
- `Revoked`: Hero license permanently canceled due to criminal or rogue violations.

### State Transition Invariants:
1. Direct jumps from `Rejected` or `Revoked` to `Approved` or `Licensed` are strictly forbidden (HTTP 422).
2. Only `SUPER_ADMIN` can reinstate a `Revoked` operative back to `Under Review`.
3. Only `SUPER_ADMIN` and `ADMIN` can reinstate a `Suspended` operative.
4. `HERO` role can only advance their own record: `Draft` &rarr; `Submitted`, or `Returned for Correction` &rarr; `Submitted`.
5. An applicant's identity **cannot** be marked `Verified` until a required `Official ID` is certified by authorized staff.

---

## 4. User-Facing Portals & Interface Functions

### 4.1 Central Gateway & Portal Dispatcher (`/`)
- **[FN-GW-01] Role-Based Route Dispatch**: Automatically inspects active session cookies and routes users to their authorized operational dashboard (`/admin`, `/registrar`, or `/hero`).
- **[FN-GW-02] Terminal Access Grid**: Provides visual portal cards to access Self-Registration, Security Clearance Login, Public Directory, and Field Sentinel Checkpoint.
- **[FN-GW-03] System Heartbeat Telemetry**: Live indicators confirming database connectivity, registry synchronization, and server health.
- **[FN-GW-04] Unified Theme Mode Toggle**: Global Light/Dark mode switcher with cross-tab persistence.

### 4.2 Awakened Hunter Registration Wizard (`/register`)
- **[FN-REG-01] Step 1: Account Information & Civilian Identity**:
  - Enrolls Callsign / Username, password, email address, and real civilian legal name.
  - **Live WebRTC Camera / Snapshot Capture**: Real-time camera feed with oval facial HUD guidelines, front/rear camera flip, and mobile fallback.
  - **Tactical OpenStreetMap Geolocation Picker**: Leaflet interactive map allowing candidates to select their safehouse coordinates and auto-assign municipal sector grids (`SF-POB`, `SF-HUB`, `SF-KAR`, `SF-BIT`, `SF-CAI`).
  - Emergency Handler & Next-of-Kin contact details (Name, Relationship, Phone).
- **[FN-REG-02] Step 2: Combat Class & Tactical Capabilities**:
  - Combat class taxonomy (Fighter, Mage, Tank, Assassin, Ranger, Healer).
  - Combat style, primary abilities, secondary powers, and tactical limitations/weaknesses.
  - Training background and equipment/gear manifest.
- **[FN-REG-03] Step 3: Power & Hero Tier Assessment**:
  - Interactive Power Output slider (1–100) and Combat Effectiveness slider (1–100).
  - Power control level rating (Novice, Competent, Mastered, Absolute).
  - Evaluated Hero Tier / Rank slider from E-Rank (Tier 6) up to National-Level (Tier 0).
  - Standing selection: Official Licensed Hero vs Guild Apprentice / Sidekick.
- **[FN-REG-04] Step 4: Official Hunter Verification & Supporting Credentials**:
  - Upload official government credentials (PhilSys National ID, Passport, Driver's License, Guild Clearance) with serial numbers and expiration dates.
  - Mandatory acknowledgment of the Philippine Hunters Association Accords.
  - **Save as Draft (`saveDraft`)**: Allows incomplete applications to be stored securely and resumed at any time.
  - **Packet Submission (`submitRegistration`)**: Encrypts secret identity details into the AES-256 vault and transitions status to `Submitted`.

### 4.3 Hunter Operative Portal (`/hero`)
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
  - Downloadable PNG ID Card for physical credential production.
- **[FN-HERO-06] Profile Modification Request Workflow**:
  - Operatives can submit proposed profile updates, queued in `backend/data/pending_updates.json` for registrar approval.

### 4.4 Registrar Assessment Desk (`/registrar`)
- **[FN-REGIS-01] Multi-Mode Intake Queue**:
  - Mode 1: Intake Queue (`[1] INTAKE QUEUE`) - `Submitted`, `Under Review`, `Returned for Correction`.
  - Mode 2: Hero Roster (`[2] HERO ROSTER`) - Verified and Approved heroes.
  - Mode 3: Revoked Licenses (`[3] REVOKED LICENSES`) - Suspended and revoked operatives.
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
- **[FN-REGIS-06] Sidekick Management & Promotion**:
  - Enroll sidekicks under accredited mentors and graduate veteran sidekicks to full Hero standing.
- **[FN-REGIS-07] Operative Passkey Reset**:
  - Generates secure random passkeys for hero operatives who have lost their credentials.

### 4.5 Sentinel Field Checkpoint Terminal (`/sentinel`)
- **[FN-SENT-01] Real-Time WebRTC QR Code Scanner**:
  - Continuously scans QR badges presented on hero smartphones via camera feed with optical targeting HUD and audio cues.
- **[FN-SENT-02] Manual Callsign & License Lookup**:
  - Fast-lookup input field supporting Callsigns, Hunter IDs (`hero_apex_01`), Government Codes (`9GH-8430`), and License Numbers.
- **[FN-SENT-03] Sub-Second Clearance Triage Verdicts**:
  - **Active Green**: Operative is certified, licensed, and approved for active sector deployment.
  - **Amber Notice**: Provisional Intake; operative is under review or draft and lacks field deployment clearance.
  - **Red Alert**: Suspended or Revoked; triggers immediate rogue operative alarm and containment directives.
- **[FN-SENT-04] Medical Vulnerability & Safety Directives**:
  - Displays known weaknesses, combat limitations, and emergency medical precautions to field first-responders.
- **[FN-SENT-05] Preset Field Test Chips**:
  - Instant one-click test simulation for APEX, LUMINA, SOLARIS (Rogue), AERO SCOUT, and UNKNOWN Vigilante.

### 4.6 Supreme Command Center & System Admin (`/admin`)
- **[FN-ADM-01] Executive Telemetry & Citywide Readiness**:
  - Live counts of total operatives, active licenses, pending intake queues, and active incidents.
- **[FN-ADM-02] Regional Threat Radar & Interactive Sector Map**:
  - Geographical distribution of active heroes across municipal defense sectors with satellite and street layers.
- **[FN-ADM-03] Staff User Administration**:
  - Provision, modify, suspend, or reactivate Registrar and Administrator accounts.
  - Immediate revocation of active sessions upon account suspension.
- **[FN-ADM-04] Cryptographic Audit Ledger Inspector**:
  - Chronological inspection of all security actions.
  - **Ledger Verification**: One-click hash chain recalculation ensuring zero tampering or deleted events.
  - CSV Export with formula injection sanitization (CWE-1236 defense).
- **[FN-ADM-05] Emergency Directive Broadcaster**:
  - Citywide broadcast of rogue operative containment alerts, sector lockdowns, and disaster levels (`NORMAL - GREEN`, `ELEVATED - YELLOW`, `HIGH - ORANGE`, `CRITICAL - RED`).
- **[FN-ADM-06] System Backup & Factory Reset**:
  - Download complete encrypted database snapshots.
  - Factory reset protected by dual confirmation tokens.

---

## 5. Complete REST API Catalog (49 Endpoints & Actions)

| # | HTTP Method | Route / Endpoint | Description | Clearance Required |
| :-: | :--- | :--- | :--- | :--- |
| 1 | `GET` | `/api/health` | Health probe & liveness check (file stores & OpenSSL) | Public |
| 2 | `POST` | `/api/auth/login` | Authenticate callsign and passkey; start session | Public (Rate Limited) |
| 3 | `POST` | `/api/auth/logout` | Terminate session and invalidate auth cookies | Session |
| 4 | `GET` | `/api/auth/me` | Fetch active user identity and clearance level | Session |
| 5 | `GET` | `/api/notifications` | Universal tactical notifications & rogue alerts | Session |
| 6 | `GET` | `/api/heroes` | List all operative records (filtered by role) | Staff (`REGISTRAR`, `ADMIN`) |
| 7 | `GET` | `/api/heroes/{id}` | Inspect operative profile (IDOR protected) | Staff / Hero (Self) |
| 8 | `GET` | `/api/heroes/{id}/review` | Comprehensive review packet with document metadata | Registrar / Admin |
| 9 | `PUT` | `/api/heroes/{id}` | Edit hero record information | Registrar / Admin |
| 10 | `POST` | `/api/heroes/{id}/ftf-interview` | Submit face-to-face interview assessment data | Registrar / Admin |
| 11 | `DELETE` | `/api/heroes/{id}` | Permanently delete operative record | Super Admin (Level 5) |
| 12 | `POST` | `/api/heroes/{id}/enroll-sidekick` | Enroll applicant as sidekick under a mentor | Registrar / Admin |
| 13 | `POST` | `/api/heroes/{id}/promote-to-hero` | Graduate sidekick to full licensed hero | Registrar / Admin |
| 14 | `POST` | `/api/heroes/register` | Self-register new hero candidate (Draft or Submit) | Public / Hero |
| 15 | `POST` | `/api/heroes/{id}/documents` | Upload credential file (ID, Certificate, etc.) | Hero (Owner) / Staff |
| 16 | `GET` | `/api/heroes/{id}/documents/{docId}` | Secure credential file preview / download | Hero (Owner) / Staff |
| 17 | `DELETE` | `/api/heroes/{id}/documents/{docId}` | Delete document (blocked if already verified) | Hero (Owner) / Staff |
| 18 | `POST` | `/api/heroes/{id}/documents/{docId}/verify` | Reviewer decision (`Verified` / `Rejected` + notes) | Registrar / Admin |
| 19 | `POST` | `/api/upload-avatar` | Intake face photo upload | Public / Hero |
| 20 | `POST` | `/api/heroes/{id}/avatar` | Update operative face photo | Hero (Owner) / Staff |
| 21 | `GET` | `/api/heroes/{id}/badge-token` | Generate dynamic 30s HMAC-SHA256 badge token | Hero (Owner) / Staff |
| 22 | `POST` | `/api/verify-badge` | Verify dynamic badge token authenticity | Sentinel / Staff |
| 23 | `POST` | `/api/heroes/{id}/decrypt-vault` | Decrypt civilian name & address (logged to audit) | Registrar / Admin |
| 24 | `POST` | `/api/heroes/{id}/assess [APPROVE_LICENSE]` | Issue accredited license and advance to `Approved` | Registrar / Admin |
| 25 | `POST` | `/api/heroes/{id}/assess [REQUEST_CORRECTIONS]` | Return application with feedback notes | Registrar / Admin |
| 26 | `POST` | `/api/heroes/{id}/assess [RESUBMIT]` | Resubmit application after correcting issues | Hero (Owner) / Staff |
| 27 | `POST` | `/api/heroes/{id}/assess [MOVE_TO_REVIEW]` | Advance application status to `Under Review` | Registrar / Admin |
| 28 | `POST` | `/api/heroes/{id}/assess [VERIFY_IDENTITY]` | Verify civilian identity against official ID | Registrar / Admin |
| 29 | `POST` | `/api/heroes/{id}/assess [REJECT_REGISTRATION]` | Reject application with justification | Registrar / Admin |
| 30 | `POST` | `/api/heroes/{id}/assess [REVOKE_LICENSE]` | Revoke hero license for accord breaches | Registrar / Admin |
| 31 | `POST` | `/api/heroes/{id}/assess [SUSPEND_OPERATIVE]` | Temporarily suspend operative deployment | Registrar / Admin |
| 32 | `POST` | `/api/heroes/{id}/assess [REINSTATE]` | Reinstate suspended or revoked operative | Admin / Super Admin |
| 33 | `POST` | `/api/heroes/{id}/assess [REQUEST_POWER_AUDIT]` | Flag hero profile for power recalibration | Registrar / Admin |
| 34 | `POST` | `/api/heroes/{id}/assess [SET_THREAT_TIER]` | Calibrate threat tier / power output rating | Registrar / Admin |
| 35 | `POST` | `/api/heroes/{id}/assess [SET_ASSESSMENT]` | Update reviewer assessment scores & notes | Registrar / Admin |
| 36 | `POST` | `/api/heroes/{id}/assess [MAP_SIDEKICKS]` | Link sidekicks to mentor operative | Registrar / Admin |
| 37 | `POST` | `/api/damage-report` | Submit post-battle damage report | Hero / Staff |
| 38 | `POST` | `/api/heroes/{id}/request-update` | Hero submits proposed profile changes | Hero (Owner) |
| 39 | `GET` | `/api/pending-updates` | List all pending hero profile edit requests | Registrar / Admin |
| 40 | `GET` | `/api/heroes/{id}/pending-update` | Hero inspects status of own pending edit | Hero (Owner) |
| 41 | `POST` | `/api/pending-updates/{id}/approve` | Approve and commit hero profile update | Registrar / Admin |
| 42 | `POST` | `/api/pending-updates/{id}/reject` | Reject hero profile update with reason | Registrar / Admin |
| 43 | `GET` | `/api/damage-reports` | List all battle damage incident reports | Registrar / Admin |
| 44 | `POST` | `/api/damage-reports/{id}/match` | Match incident report to responsible hero | Registrar / Admin |
| 45 | `GET` | `/api/admin/metrics` | Executive readiness metrics & queue telemetry | Staff (`ADMIN`, `L5`) |
| 46 | `GET` | `/api/admin/map-data` | Tactical radar operative & incident coordinates | Staff (`ADMIN`, `L5`) |
| 47 | `POST` | `/api/admin/emergency-action` | Broadcast rogue containment alerts / lockouts | Admin / Super Admin |
| 48 | `GET` | `/api/sentinel/scan` | Checkpoint scan by QR token, Callsign, ID, License | Sentinel / Staff |
| 49 | `GET` | `/api/tactical-weather` | OpenWeatherMap meteorological radar telemetry | Staff (`ADMIN`, `L5`) |

---

## 6. How to Run Locally & Share Worldwide

### Running Locally
```bash
# Windows
start.bat
# Linux / macOS
chmod +x start.sh && ./start.sh
# Manual
php -S 127.0.0.1:8000 router.php
```

### Remote Sharing Worldwide (Cloudflare Tunnel)
```bat
share_online.bat
```
Launches your local server and prints a public HTTPS URL ending in `.trycloudflare.com` accessible from any smartphone or PC worldwide.

### Permanent 24/7 Web Hosting (InfinityFree / FreePage)
Upload the contents of `htdocs_upload/` directly into your web hosting server's `htdocs/` folder.
Website stays online 24/7 at: **`http://heroregestry.freepage.cc/`**.

---

## 7. System Defense & Cryptographic Integrity Standards

During system defense and security review, the following five core security gates are rigorously enforced across both local instances and live production deployments:

1. **Master Encryption Key Isolation**:
   - In production (`APP_ENV=production`), the system strictly rejects the public fallback key or placeholder.
   - If an external environment key is absent, an isolated, uncommitted high-entropy 256-bit key (`DATA_DIR/.vault_master_key`) is generated and protected by web server perimeter blocks.
   - Dual-key fallback rotation (`AES_FALLBACK_KEY`) enables seamless, zero-downtime re-encryption of existing datastore records.

2. **Privileged Account Credential Hardening**:
   - Privileged roles (`SUPER_ADMIN`, `ADMIN`, `REGISTRAR`) cannot log into live production systems using default starter passkeys (`admin123`, `registrar123`).
   - Unauthorized attempts trigger HTTP 403 `DEFAULT_CREDENTIALS_PROHIBITED` and record a `DEFAULT_CREDENTIAL_BLOCKED` audit violation.
   - Demo access requires explicit activation via `ALLOW_DEFAULT_ADMIN_CREDENTIALS=true` in the non-committed `.env`.

3. **Confidential Identity RBAC & Cryptographic Access Logging**:
   - Operative secret real names and biometric vault data are strictly classified under Clearance Level 4+ (`ADMIN`, `SUPER_ADMIN`) or the verified profile owner.
   - Standard profile inspections (`GET /api/heroes/{id}`) by non-admin staff mask civilian identities (`[CONFIDENTIAL // LEVEL 4+ CLEARANCE REQUIRED]`) and omit raw vault blobs.
   - Every disclosure of confidential civilian identity is permanently logged to the SHA-256 chained audit ledger (`CONFIDENTIAL_IDENTITY_ACCESSED`).

4. **Enforced Profile Update Workflow**:
   - Approved, Verified, Licensed, and Under Review operatives are blocked from directly mutating their live records via `PUT /api/heroes/{id}` (HTTP 403 `PENDING_UPDATE_REQUIRED`).
   - All proposed profile modifications must flow through the pending-update approval workflow (`POST /api/heroes/{id}/request-update`) into `pending_updates.json`, requiring formal Registrar/Admin approval before taking effect.

5. **Legacy Ciphertext Authenticated Encryption (Encrypt-then-MAC)**:
   - Every identity vault record strictly requires a valid HMAC-SHA256 authentication tag (`AES-256-CBC+HMAC-SHA256`).
   - Any record lacking a valid MAC is immediately rejected by `CryptoService::decryptVault()` as a `VAULT_INTEGRITY_VIOLATION`.
   - The automated migration routine `CryptoService::migrateVaultHmac()` automatically detects legacy unauthenticated records during bootstrap and equips them with valid authentication tags prior to query execution.
