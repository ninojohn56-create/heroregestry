# GHRA / GHRMS Changelog

All notable changes to the Global Superhuman Registration Authority codebase are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.2.0] - 2026-10-04 (Final Master Production Hardening & Audit)

### Added
- **Authenticated Encryption (Encrypt-then-MAC)**:
  - Upgraded `CryptoService` (`backend/crypto.php`) to combine `AES-256-CBC` with `HMAC-SHA256` authentication tags.
  - Derived isolated HMAC signing key via `hash_hmac('sha256', ...)`.
  - Replaced `openssl_random_pseudo_bytes` with cryptographically secure `random_bytes(16)` for IV generation.
  - Implemented tamper detection rejecting mutated ciphertexts via constant-time comparison (`hash_equals()`).
  - Added automated vault migration routine `CryptoService::migrateVaultHmac()` upgrading legacy records in `vault.json`.
- **Session Lifecycle & Inactivity Timeout**:
  - Implemented 30-minute (1800s) idle session timeout tracking `last_activity` in `backend/auth.php`.
  - Implemented 24-hour (86400s) absolute session expiration tracking `logged_in_at`.
  - Added `destroySessionCookies()` ensuring complete client cookie invalidation upon logout or expiration.
- **Secure Document Deletion & Compliance Immutability**:
  - Implemented `DELETE /api/heroes/{id}/documents/{docId}` endpoint.
  - Enforced strict compliance immutability: verified documents cannot be deleted (`VERIFIED_RECORD_PROTECTED`, HTTP 403).
  - Enforced horizontal IDOR authorization ensuring hero operatives cannot delete other applicants' documents.
  - Added physical file unlinking and audit logging (`DOCUMENT_DELETED`).
- **Document Version Tracking**:
  - Implemented automated version tracking (`version: 1`, `version: 2`) per document type during upload.
- **Upload Perimeter & Script Masquerade Defense**:
  - Added null-byte detection (`\0`, `%00`) in uploaded filenames for documents and avatars.
  - Added double-extension blocking rejecting dangerous extensions (`.php`, `.phtml`, `.exe`, `.cgi`, etc.) anywhere in filename.
- **Security Headers & CSP**:
  - Enforced Content-Security-Policy on API and static routes (`default-src 'none'; frame-ancestors 'none';`).
  - Added `Permissions-Policy: camera=(), microphone=(), geolocation=()`.
- **Expanded Automated Test Suite**:
  - Expanded `tests/test_suite.php` to 66 automated assertions across 26 test categories with 100% pass rate.
  - Added tests for document versioning, deletion protection, double-extension upload rejection, Encrypt-then-MAC tamper detection, and CSP headers.
- **Comprehensive Documentation**:
  - Created `ARCHITECTURE.md`, `API.md`, `DATABASE.md`, `DOCUMENTS.md`, `DEVELOPMENT.md`, `TESTING.md`, `TROUBLESHOOTING.md`, `RUNBOOK.md`, `CONTRIBUTING.md`, and updated `README.md`, `SECURITY.md`, and `DEPLOYMENT.md`.

---

## [1.1.0] - 2026-10-02 (Perimeter & Authentication Hardening)

### Added
- Immediate active session revocation upon account suspension in `backend/auth.php`.
- Strict Origin validation for state-changing HTTP requests (`POST`, `PUT`, `DELETE`).
- Factory reset confirmation safety token (`CONFIRM_FACTORY_RESET`).
- Hero damage report attribution enforcement overriding forged hero IDs.
- Sliding-window rate limiting on login, badge verification, and sentinel scans.

### Fixed
- Sanitized production exception responses to prevent filesystem path disclosure.
- Neutralized CSV spreadsheet formula injection (CWE-1236) by quoting dangerous leading characters.
- Fixed `escapeHtml()` helper dependency in Sentinel scanner interface.

---

## [1.0.0] - 2026-09-20 (Initial Release)

### Added
- Core superhuman registration workflow (Draft, Reviewing, Verified, Licensed, Rejected).
- Multi-step guided intake wizard (`/register`).
- Registrar assessment desk with split-screen document review (`/registrar`).
- Tactical command console with live radar and audit ledger (`/admin`).
- Street-level Sentinel checkpoint QR code scanner (`/sentinel`).
- Isolated civilian identity vault using AES-256 encryption.
- Chained SHA-256 tamper-evident audit ledger.
- Standalone datastore backup and restore CLI (`backend/backup.php`).
