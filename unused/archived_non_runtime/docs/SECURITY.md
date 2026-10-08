# GHRA Security Policy & Architectural Hardening Specification

**System**: Global Superhuman Registration Authority (GHRA)  
**Security Level**: Classified Federal Defense Standard (Level 5 Clearance Architecture)  
**Classification**: Unclassified / Official Use Only  

---

## 1. Security Architecture & Threat Model

The GHRA platform operates under an assumed zero-trust environment designed for public internet deployment while safeguarding classified biometric identities and superhuman threat registries.

```
                    [ TLS 1.3 / HTTPS Gateway ]
                                ↓
               [ Nginx Hardened Perimeter Filter ]
        (Strict MIME, Dotfile Deny, Body Limits, GeoIP)
                                ↓
                  [ PHP 8.3 Front Controller ]
         (Session Fixation Defense, Rate Limiter Sliding Window)
                                ↓
         ┌──────────────────────┴──────────────────────┐
         ↓                                             ↓
[ Public Registry / Portal ]              [ Role-Based Access Control ]
 (Sanitized Operative Specs)              (Super Admin / Registrar / Hero)
                                                       ↓
                                    ┌──────────────────┴──────────────────┐
                                    ↓                                     ↓
                     [ Chained Audit Ledger ]             [ Isolated Identity Vault ]
                     (SHA-256 Merkle-Style Chain)         (AES-256-CBC + HMAC-SHA256)
```

---

## 2. Authentication & Session Management

- **Password Hashing**: Passwords are saved strictly using salted BCrypt (`PASSWORD_BCRYPT`) with modern work factors. Plaintext credentials are never persisted or logged.
- **Session Fixation Defense**: Successful authentication invokes `session_regenerate_id(true)` to terminate pre-authenticated session identifiers.
- **Cookie Security**: Sessions enforce `HttpOnly`, `SameSite=Lax`, and `Secure` (in HTTPS/production environments).
- **Session Inactivity & Absolute Lifetimes**:
  - Idle timeout enforced at 1800 seconds (30 minutes of inactivity).
  - Absolute session lifetime enforced at 86400 seconds (24 hours).
  - Calling `logout()` or encountering expired sessions triggers complete cookie deletion (`destroySessionCookies()`).
- **Immediate Server-Side Revocation on Suspension**: When an account is suspended or deactivated by an administrator, any active sessions are revoked immediately on the very next request (`AuthService::getCurrentUser()`).
- **Brute Force Protection**: IP sliding-window rate limiting isolates authentication attempts to 15 requests per 60 seconds (`RateLimiter::check`).

---

## 3. Role-Based Access Control (RBAC) & Clearances

Access permissions are enforced strictly server-side through `AuthService::requireRole()` and granular resource ownership checks:

| Role | Clearance Level | Permissions |
| :--- | :---: | :--- |
| `SUPER_ADMIN` | Level 5 | Root administrative control, account provisioning, passkey resets, data factory reset, threat tier overrides, audit ledger export. |
| `ADMIN` | Level 4 | Sector operative administration, day-to-day personnel status management, document verification, incident triage. Blocked from modifying Super Admin records. |
| `REGISTRAR` | Level 3 | Hero registration packet inspection, civilian vault decryption, document verification, FTF interview assessment, license issuance. |
| `ASSESSOR` | Level 3 | Power output evaluation, combat rating audit, threat calibration review. |
| `HERO` | Level 1 | Operative personal portal, viewing and editing own registration packet, submitting update requests, viewing own dynamic TOTP QR badge. Blocked from viewing other hero records (IDOR). |
| `PUBLIC` | Level 0 | Read-only public registry queries. Zero access to civilian vault data, supporting documents, or administrative consoles. |

---

## 4. Insecure Direct Object Reference (IDOR) Defenses

- **Hero Profile Access (`GET /api/heroes/{id}`)**: Operative callers (`HERO`) are strictly confined to their own designated service record (`$viewer['hero_id'] === $heroId`). Cross-hero lookups return `403 Forbidden`.
- **Private Document Retrieval (`GET /api/heroes/{id}/documents/{docId}`)**: Document downloads require clearance as staff or confirmed ownership as the hero applicant.
- **Document Verification (`POST /api/heroes/{id}/documents/{docId}/verify`)**: Document verification is strictly limited to staff (`ADMIN`, `SUPER_ADMIN`, `REGISTRAR`). Operatives attempting to self-verify credentials are explicitly blocked with `403 Forbidden`.
- **Document Deletion (`DELETE /api/heroes/{id}/documents/{docId}`)**: Operatives may only delete their own unverified documents. Cross-hero deletions return `403 Forbidden`.
- **Verified Record Immutability**: Documents marked `Verified` are legally locked compliance records and cannot be deleted (`VERIFIED_RECORD_PROTECTED`, `403 Forbidden`).
- **Post-Battle Damage Claims (`POST /api/damage-report`)**: The server forces `reported_by_hero` to the authenticated caller's identity, preventing operative impersonation.
- **Threat Classification Integrity (`PUT /api/heroes/{id}`)**: Administrative fields (`threat_tier`, `threat_class`, `license_number`, `assessment_notes`, `combat_rating`) are stripped from operative update payloads to prevent self-elevation of threat ratings.

---

## 5. Cryptography & Vault Security

### Civilian Identity Vault
- **Algorithm**: Authenticated Encryption using **`AES-256-CBC` + `HMAC-SHA256`** (Encrypt-then-MAC).
- **IV & Key Generation**: Cryptographically secure 16-byte initialization vectors generated using `random_bytes(16)`. Isolated HMAC authentication key derived using `hash_hmac('sha256', 'GHRA_VAULT_HMAC_AUTHENTICATION_KEY', AES_KEY, true)`.
- **Tamper Detection**: Every decryption verifies the HMAC authentication tag via constant-time comparison (`hash_equals()`). Any modification to the ciphertext or IV causes decryption to return `null` and rejects tampered data.
- **Key Isolation**: Master vault encryption key (`HRS_MASTER_KEY`) is injected via environment variables and never hardcoded in production source files.
- **Data Segregation**: Real names, civilian SSNs, residential safehouses, biometric DNA references, and emergency contacts are encrypted in `vault.json` and decoupled from public hero specifications.

### Chained Tamper-Evident Audit Ledger
- **Algorithm**: `SHA-256` continuous linear blockchain-style hashing:
  $$\text{Hash}_n = \text{SHA256}(\text{Hash}_{n-1} \parallel \text{Timestamp} \parallel \text{Actor} \parallel \text{Role} \parallel \text{Action} \parallel \text{Target} \parallel \text{Details})$$
- **Verification**: `CryptoService::verifyAuditChain()` verifies the hash linkage of every historical ledger event to prove zero data manipulation.

### Dynamic TOTP Badges
- Time-decaying 30-second HMAC-SHA256 tokens tolerance-checked within $\pm 1$ window drift for law enforcement checkpoint badge verification.

---

## 6. Input Sanitization & Web Security

- **Cross-Origin Request Forgery (CSRF)**: State-changing requests (`POST`, `PUT`, `DELETE`) require Origin matching against trusted server domains.
- **CSV Formula Injection (CWE-1236)**: Registry exports to CSV neutralize formula execution by escaping leading characters (`=`, `+`, `-`, `@`, `\t`, `\r`) with single quotes.
- **File Upload Protection**:
  - Enforces MIME inspection via PHP's `finfo` engine.
  - Extension allowlist (`pdf`, `png`, `jpg`, `jpeg`, `webp`).
  - Size ceiling: 12MB for documents, 8MB for avatars.
  - Defenses against null bytes (`\0`, `%00`) and double extensions (e.g., `image.php.png`).
  - Randomized storage filenames outside webroot (`backend/data/documents/`).
- **Security Headers & CSP**:
  - `Content-Security-Policy: default-src 'none'; frame-ancestors 'none';` on API routes.
  - `X-Content-Type-Options: nosniff`.
  - `X-Frame-Options: DENY`.
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`.
  - `Referrer-Policy: strict-origin-when-cross-origin`.
- **Path Traversal**: Nginx perimeter and `router.php` reject traversal attempts (`..`), dotfiles, and direct directory listings.

---

## 7. Reporting a Vulnerability

Security issues should be reported confidentially to the GHRA Cyber Defense Command:
- Email: `security@ghra.agency.gov`
- PGP Fingerprint: `4A9F 82B1 093C 78E2 C519  3490 GHRA SEC2 2026`
