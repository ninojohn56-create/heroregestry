# GHRA Developer Onboarding & Engineering Handbook

Welcome to the **Global Superhuman Registration Authority (GHRA)** engineering team. This handbook will guide you through local environment setup, architecture concepts, coding standards, and common development workflows.

---

## 1. Prerequisites & Tooling

To run and develop GHRA locally, you need:
- **PHP 8.2 or 8.3** CLI runtime.
- The following built-in PHP extensions:
  - `openssl` (AES-256 vault encryption and HMAC verification)
  - `mbstring` (Multibyte UTF-8 string handling)
  - `curl` (GIS and weather service integrations)
  - `fileinfo` (MIME type inspection)
  - `json` (Datastore serialization)
  - `session` (RBAC session handling)
  - `gd` (Badge rendering and avatar processing)
  - `zip` (Datastore backup archives and restore snapshots)
- A modern web browser (Chrome, Edge, Firefox, or Safari).

---

## 2. Quick Setup (5 Minutes)

### Step 1: Clone and Configure Environment
```bash
# Clone the repository and enter the directory
cd "scene2 final2 (1)"

# Create local environment configuration
cp .env.example .env
```

### Step 2: Seed Initial Datastores
Run the database seed script to populate canonical hero profiles, encrypted biometric vault records, default users, and system settings:
```bash
php backend/seed.php
```

### Step 3: Run System Diagnostics
Verify that all PHP extensions, writable directories, and encryption keys are operational:
```bash
php check_system.php
```
All checks should report `[ PASS ]` with the summary `ALL SYSTEMS OPERATIONAL`.

### Step 4: Launch Local Development Server
Start the built-in PHP web server with the security router:
```bash
php -S 127.0.0.1:8000 router.php
```
Open your browser at **`http://localhost:8000/login`**.

### Step 5: Execute Automated Test Suite
Confirm that all 66 test assertions across 26 security categories pass:
```bash
php tests/test_suite.php
```

---

## 3. Seed Credentials for Local Testing

| Role | Username | Password | Intended Portal | Clearance Level |
| :--- | :--- | :--- | :--- | :---: |
| **Super Admin** | `commander` | `admin123` | `/admin` | Level 5 |
| **Admin** | `admin` | `admin123` | `/admin` | Level 4 |
| **Registrar** | `sarah.chen` | `registrar123` | `/registrar` | Level 3 |
| **Hero Operative** | `apex` | `hero123` | `/hero` | Level 1 |
| **Hero Operative** | `lumina` | `hero123` | `/hero` | Level 1 |
| **Hero Operative** | `solaris` | `hero123` | `/hero` | Level 1 |
| **Sentinel Checkpoint** | *(Public Scanner)* | *(None)* | `/sentinel` | Level 0 |

---

## 4. Coding Standards & Architectural Conventions

### 4.1 Strict Typing
Every PHP script must begin with:
```php
<?php
declare(strict_types=1);
```

### 4.2 Security-First API Endpoints
When creating a new endpoint in `backend/api.php`:
1. **Require Authentication & Role Clearance**:
   ```php
   // Require any authenticated user
   $actor = AuthService::requireAuth();

   // OR require specific clearance roles
   $actor = AuthService::requireRole(['ADMIN', 'SUPER_ADMIN']);
   ```
2. **Rate Limit Expensive Operations**:
   ```php
   RateLimiter::check('custom_action', 30, 60); // 30 requests per 60s
   ```
3. **Prevent Insecure Direct Object References (IDOR)**:
   Never trust client-supplied hero IDs or user IDs. Verify ownership if caller role is `HERO`.
4. **Use Atomic Datastore Transactions**:
   Always use `JsonStorage::transaction()` for file writes:
   ```php
   JsonStorage::transaction(FILE_HEROES, function(&$heroes) use ($targetId, $newData) {
       if (!isset($heroes[$targetId])) return false;
       $heroes[$targetId]['field'] = $newData;
       $heroes[$targetId]['updated_at'] = date('c');
       return true;
   });
   ```
5. **Log Security Events to Audit Ledger**:
   ```php
   CryptoService::appendAudit($actor['name'], $actor['role'], 'OPERATIVE_UPDATED', $targetId, [
       'fields_changed' => ['field']
   ]);
   ```
6. **Return Consistent JSON Responses**:
   ```php
   jsonResponse(['success' => true, 'data' => $result], 200);
   // OR
   jsonError("Descriptive error message", 400);
   ```

---

## 5. Adding New Tests

All automated tests are located in `tests/test_suite.php`. When implementing a new feature or security fix:
1. Add a test method to `GhraTestRunner` (e.g., `testMyFeature()`).
2. Use `$this->assert($condition, "Assertion description")`.
3. Add `$this->testMyFeature();` to the `run()` execution sequence.
4. Run `php tests/test_suite.php` and verify a 100% pass rate.
