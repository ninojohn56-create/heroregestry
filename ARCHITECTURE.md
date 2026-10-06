# GHRA / GHRMS System Architecture & Engineering Blueprint

## 1. System Overview

The **Global Superhuman Registration Authority (GHRA) / Global Hero Registration & Management System (GHRMS)** is an enterprise-grade administrative and tactical control application designed to manage superhuman onboarding, threat tier classification, identity security, dynamic checkpoint verification, and incident management.

The system is built on a clean, hardened PHP 8.3 backend paired with a vanilla modern JavaScript/HTML5 frontend. It operates with zero third-party framework overhead, relying on native, secure system primitives for storage, cryptography, and HTTP request routing.

---

## 2. Component Topology & Architecture Diagram

```
                                      [ CLIENT / BROWSER ]
                                                │
                          HTTPS / TLS 1.3 (Strict Port 443 in Prod)
                                                │
                                    ┌───────────▼───────────┐
                                    │      NGINX PROXY      │
                                    │ (Rate Limiting, CSP,  │
                                    │  Dotfile/Upload Deny) │
                                    └───────────┬───────────┘
                                                │
                                    ┌───────────▼───────────┐
                                    │       ROUTER.PHP      │
                                    │ (Perimeter Defense,   │
                                    │  Static File Handler, │
                                    │  API Gateway Dispatch)│
                                    └───────────┬───────────┘
                                                │
                        ┌───────────────────────┴───────────────────────┐
                        ▼                                               ▼
         ┌──────────────────────────────┐                ┌──────────────────────────────┐
         │     STATIC ASSET FRONTEND    │                │       BACKEND REST API       │
         │  - Command Console (/admin)  │                │        (backend/api.php)     │
         │  - Registrar Desk (/registrar│                └──────────────┬───────────────┘
         │  - Hero Portal (/hero)       │                               │
         │  - Sentinel Scanner (/sentine│                ┌──────────────┼───────────────┐
         │  - Intake Wizard (/register) │                ▼              ▼               ▼
         └──────────────────────────────┘         ┌────────────┐ ┌────────────┐ ┌─────────────┐
                                                  │AuthService │ │CryptoServ. │ │RateLimiter  │
                                                  │(RBAC, Sess)│ │(Vault,Ledg)│ │(Bucket IPC) │
                                                  └─────┬──────┘ └─────┬──────┘ └─────────────┘
                                                        │              │
                                                        ▼              ▼
                                                ┌─────────────────────────────┐
                                                │  JSON STORAGE ENGINE        │
                                                │  (backend/storage.php)      │
                                                │  - Exclusive File Locking   │
                                                │  - Atomic Temp-Write-Rename │
                                                └──────────────┬──────────────┘
                                                               │
                                         ┌─────────────────────┴─────────────────────┐
                                         ▼                                           ▼
                            ┌─────────────────────────┐                 ┌─────────────────────────┐
                            │   CANONICAL DATASTORES  │                 │    ENCRYPTED VAULT      │
                            │  - heroes.json          │                 │  - vault.json           │
                            │  - users.json           │                 │    (AES-256-CBC + HMAC) │
                            │  - incidents.json       │                 │  - documents/           │
                            │  - audit_ledger.json    │                 │    (Isolated off-webroot│
                            │  - settings.json        │                 └─────────────────────────┘
                            └─────────────────────────┘
```

---

## 3. Core Subsystems & Responsibilities

### 3.1 Perimeter & Router (`router.php`)
- Serves as the web front-controller when running the PHP CLI server or fallback gateway.
- Enforces strict perimeter checks:
  - Denies access to dotfiles (`.env`, `.git`) and internal directories (`/backend/`, `/tests/`).
  - Sets baseline security headers (`Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`).
  - Routes REST API requests to `backend/api.php` and static resources (`/js/`, `/css/`, `/img/`) to public roots.

### 3.2 Authentication & Session Management (`backend/auth.php`)
- **Password Security**: Passwords hashed using bcrypt (`PASSWORD_BCRYPT`).
- **Session Fixation Resistance**: Sessions regenerated (`session_regenerate_id(true)`) upon successful authentication.
- **Session Lifecycle & Invalidation**:
  - Idle timeout enforced at 1800 seconds (30 minutes).
  - Absolute session lifetime enforced at 86400 seconds (24 hours).
  - Cookie security: `HttpOnly`, `SameSite=Lax`, and `Secure` (in HTTPS environments).
  - Immediate server-side session termination upon account suspension or deactivation.

### 3.3 Authorization & Role-Based Access Control (RBAC)
Five hierarchical roles govern all operations:
- `SUPER_ADMIN` (Clearance Level 5): Unrestricted administrative power, root user management, factory data reset, audit ledger export, threat tier override.
- `ADMIN` (Clearance Level 4): Sector operative management, status updates, personnel review. Protected from modifying `SUPER_ADMIN` accounts.
- `REGISTRAR` (Clearance Level 3): Intake queue processing, official document review and verification, civilian vault decryption, hero licensing.
- `ASSESSOR` (Clearance Level 3): Tactical power assessment, combat rating review, threat calibration.
- `HERO` (Clearance Level 1): Self-service operative portal, personal profile view/edit, document upload/deletion (unverified only), dynamic badge generation. Blocked from viewing or modifying other heroes (IDOR defense).

### 3.4 Cryptography & Civilian Vault Engine (`backend/crypto.php`)
- **Authenticated Encryption (Encrypt-then-MAC)**:
  - Civilian identities (real names, SSNs, DNA profiles, safehouses, emergency contacts) are isolated in `vault.json`.
  - Cipher: `AES-256-CBC` with cryptographically secure 16-byte random IVs (`random_bytes(16)`).
  - Authentication: `HMAC-SHA256` computed over `IV || Ciphertext` using a derived key (`hash_hmac('sha256', 'GHRA_VAULT_HMAC_AUTHENTICATION_KEY', AES_KEY, true)`).
  - Tamper detection: Verifies HMAC via constant-time comparison (`hash_equals()`) prior to decryption, rejecting tampered or corrupted records.
- **Chained Audit Ledger**:
  - Implements a linear cryptographic hash chain:
    $$H_n = \text{SHA-256}(H_{n-1} \parallel \text{Timestamp} \parallel \text{Actor} \parallel \text{Role} \parallel \text{Action} \parallel \text{Target} \parallel \text{Details})$$
  - Each entry references the previous entry's SHA-256 hash. Any tampering or deletion of historical audit entries breaks the cryptographic chain and is detected during audits.
- **Dynamic TOTP Checkpoint Badges**:
  - Generates time-decaying 30-second HMAC tokens for street-level QR verification by field Sentinels.

### 3.5 Datastore Persistence Engine (`backend/storage.php`)
- Flat-file JSON architecture eliminating external SQL database dependencies.
- **Atomic Concurrency Controls**:
  - File locking using `flock($fp, LOCK_EX)` to prevent race conditions during concurrent reads and writes.
  - Temporary file staging: New JSON contents are written to a unique temporary file (`$targetPath . '.' . bin2hex(random_bytes(8)) . '.tmp'`).
  - Atomic swap: Uses `rename()` to atomically replace the target datastore file, preventing partial writes or file corruption in case of unexpected process termination.

### 3.6 Document Lifecycle Management
- Secure upload processing validating file size (12MB limit), MIME type via `finfo`, and extension allowlists.
- Defenses against script execution:
  - Rejecting null-byte filenames (`%00`, `\0`).
  - Rejecting double extensions and masquerading scripts (e.g., `image.php.png`).
  - Storing uploaded files using randomized IDs outside the web root (`backend/data/documents/`).
- Document versioning tracking incrementing revisions per document type.
- Legal immutability: Documents marked `Verified` are legally locked compliance records and cannot be deleted.

### 3.7 Backup & Disaster Recovery Subsystem (`backend/backup.php`)
- Standalone CLI utility for creating, listing, cryptographically verifying, and restoring system datastores and uploaded documents.
- Includes automated pre-restore safety snapshots before restoring any archive.
- Generates `manifest.json` containing SHA-256 hashes of every datastore in the backup.
