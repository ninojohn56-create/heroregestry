# Contributing to GHRA / GHRMS

Thank you for contributing to the **Global Superhuman Registration Authority (GHRA) / Global Hero Registration & Management System (GHRMS)**. This repository houses critical infrastructure managing superhuman registry data, civilian identity vaults, and tactical checkpoint verifications.

---

## 1. Code of Conduct & Clearance Standards

All contributors are expected to uphold the highest standards of software engineering, operational security, and data integrity. Because this codebase handles classified and sensitive identity records, security and strict validation are first-class architectural concerns.

---

## 2. Development Setup

Before submitting contributions, ensure your local development environment meets the minimum requirements:

1. **PHP 8.2+** (PHP 8.3 recommended) with extensions:
   - `openssl`, `mbstring`, `curl`, `fileinfo`, `json`, `session`, `gd`, `zip`
2. **Environment Configuration**:
   - Copy `.env.example` to `.env`
   - Run `php backend/seed.php` to generate initial datastores and verify schema
   - Start the local development server:
     ```bash
     php -S 127.0.0.1:8000 router.php
     ```
3. Run diagnostic checks:
   ```bash
   php check_system.php
   ```
4. Run the automated test suite:
   ```bash
   php tests/test_suite.php
   ```

---

## 3. Pull Request Process & Security Checklist

Every Pull Request must satisfy the following criteria:

- [ ] **Strict Typing**: All new or modified PHP files must declare `declare(strict_types=1);`.
- [ ] **Zero Trust Input Validation**:
  - Never trust client-supplied IDs, roles, clearance levels, threat classifications, or verification states.
  - All input must be strictly typed, sanitized, and bounds-checked.
- [ ] **Server-Side Authorization**:
  - Validate caller identity and role server-side via `AuthService::requireAuth()` or `AuthService::requireRole()`.
  - Enforce horizontal access control (IDOR prevention) on all hero profiles, damage reports, and documents.
- [ ] **Cryptographic Integrity**:
  - Never log plaintext secrets, credentials, or unencrypted biometric data.
  - Any modifications to civilian identity data must use `CryptoService::encryptVault()` with Encrypt-then-MAC (`AES-256-CBC + HMAC-SHA256`).
  - Security-sensitive actions must be logged to the chained audit ledger via `CryptoService::appendAudit()`.
- [ ] **Datastore Concurrency**:
  - All writes to JSON datastores must use `JsonStorage::transaction()` to ensure atomic temporary writes with exclusive file locking (`flock(LOCK_EX)`).
- [ ] **Test Coverage**:
  - Add positive, negative, and adversarial test assertions to `tests/test_suite.php`.
  - All tests must pass with zero failures: `php tests/test_suite.php`.
- [ ] **Documentation**:
  - Update relevant architecture, API, database, and runbook documentation if endpoints or schemas are altered.

---

## 4. Branching & Commit Conventions

- Use feature branches branched from `main`:
  - `feat/feature-name`
  - `fix/security-issue-name`
  - `docs/documentation-update`
- Format commit messages cleanly:
  - `fix(auth): enforce idle session timeout and cookie invalidation`
  - `feat(docs): add document deletion endpoint with compliance protection`
  - `test(security): add test for Encrypt-then-MAC tamper detection`

---

## 5. Security Vulnerability Reporting

If you discover a potential security vulnerability, do NOT open a public issue. Report details privately to the GHRA Cyber Defense Command at `security@ghra.agency.gov`.
