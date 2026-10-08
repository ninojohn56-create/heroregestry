# GHRA Operations & Troubleshooting Guide

This guide details resolutions for operational issues, security blocks, session behaviors, and environment configurations encountered during development and production deployments.

---

## 1. Authentication & Session Issues

### Symptom: Unexpected HTTP 401 on API Calls
- **Probable Cause 1: Session Idle Timeout**:
  - By default, sessions expire after 30 minutes (1800s) of user inactivity.
  - *Resolution*: Log in again. Configure `SESSION_IDLE_TIMEOUT` in `.env` if longer idle periods are required for command center monitoring screens.
- **Probable Cause 2: Account Suspension**:
  - When an administrator sets an account status to `suspended`, all active sessions are immediately revoked server-side on the next request.
  - *Resolution*: Inspect `backend/data/users.json` or check with Super Admin.
- **Probable Cause 3: Untrusted Origin Header (CSRF Block)**:
  - State-changing requests (`POST`, `PUT`, `DELETE`) with an `Origin` header that does not match the server host return `403 Forbidden`.
  - *Resolution*: Ensure requests originate from the same host or configure trusted reverse proxy headers.

---

## 2. File Storage & Concurrency Issues

### Symptom: `Failed to acquire lock on datastore` or Process Hanging
- **Probable Cause: Stale Lock Handle**:
  - If a PHP process was killed abruptly with `SIGKILL` or power loss while holding an exclusive lock, a stale lock file may persist.
- **Resolution**:
  1. Verify no lingering PHP processes are running:
     ```bash
     # Linux / macOS:
     ps aux | grep php
     # Windows:
     tasklist | findstr php
     ```
  2. Safely remove stale `.lock` files in `backend/data/`:
     ```bash
     rm backend/data/*.lock
     ```

### Symptom: Permission Denied on `backend/data`
- **Probable Cause: Incorrect Directory Permissions**:
  - The web server user (e.g., `www-data` or `nginx`) lacks write permissions to `backend/data/`.
- **Resolution**:
  ```bash
  chmod -R 775 backend/data frontend/uploads
  chown -R www-data:www-data backend/data frontend/uploads
  ```

---

## 3. Rate Limiting Issues

### Symptom: HTTP 429 Too Many Requests
- **Probable Cause: Exceeded Sliding-Window Rate Limit**:
  - Login endpoint: 15 req/60s
  - Sentinel scan endpoint: 60 req/60s
  - Badge verification: 30 req/60s
- **Resolution**:
  - Wait 60 seconds for the sliding window to clear.
  - For automated testing or recovery, flush rate limit bucket files:
    ```bash
    rm -rf backend/data/ratelimit/*
    ```

---

## 4. Document Upload Issues

### Symptom: HTTP 415 Unsupported Media Type
- **Cause**: The uploaded file extension or detected MIME magic bytes are not in the permitted allowlist (`pdf`, `png`, `jpg`, `jpeg`, `webp`).
- **Resolution**: Ensure documents are genuine PDFs or PNG/JPEG/WEBP images. Disguised files or files with altered extensions will be rejected by `finfo`.

### Symptom: HTTP 400 Bad Request ("Multiple extensions or script masquerade")
- **Cause**: Filename contains multiple extensions (e.g., `report.php.png`) or null bytes (`%00`).
- **Resolution**: Rename file to a standard single extension (e.g., `report.png`).

### Symptom: HTTP 403 Forbidden ("PROTECTED RECORD: Verified compliance documents...")
- **Cause**: Attempted to delete a supporting document that has already been verified by a registrar or administrator.
- **Resolution**: Verified documents cannot be deleted. If a record must be revoked, an administrator must formally reject or update the document status first.

---

## 5. Cryptography & Vault Issues

### Symptom: `decryptVault returns null`
- **Probable Cause 1: Encryption Key Mismatch**:
  - The `HRS_MASTER_KEY` environment variable does not match the key used to encrypt the records.
  - *Resolution*: Verify `.env` configuration. Ensure the original encryption key is preserved across server restarts and upgrades.
- **Probable Cause 2: Data Tampering (HMAC Failure)**:
  - The vault record's ciphertext or IV has been mutated, triggering the Encrypt-then-MAC tamper detection.
  - *Resolution*: Restore the affected record or datastore from a verified backup (`php backend/backup.php restore`).

---

## 6. Backup & Restore Diagnostics

### Symptom: Backup Verification Fails (`SHA-256 hash mismatch`)
- **Cause**: One or more datastores within the backup archive was modified after creation or corrupted in transit.
- **Resolution**: Do not restore corrupted archives. Use an earlier verified archive listed via `php backend/backup.php list`.
