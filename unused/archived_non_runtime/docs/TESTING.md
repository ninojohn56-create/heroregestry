# GHRA Automated Test Suite & Quality Assurance Guide

## 1. Testing Philosophy & Strategy

GHRA employs a defense-in-depth automated test strategy that treats the application as an adversary would. The automated test runner (`tests/test_suite.php`) executes end-to-end HTTP requests and cryptographic unit checks across multiple security clearance identities, verifying server-side boundaries, input sanitization, workflow transitions, and ledger integrity.

---

## 2. Executing the Test Suite

### Standard Local Execution
Ensure the local server is running on port 8000:
```bash
# Terminal 1: Start local server
php -S 127.0.0.1:8000 router.php

# Terminal 2: Run test suite
php tests/test_suite.php
```

### Running Against Custom or Staging Endpoints
You can override the target endpoint using the `TEST_BASE_URL` environment variable:
```bash
TEST_BASE_URL="http://192.168.1.50:8000" php tests/test_suite.php
```

---

## 3. Test Groups & Coverage Breakdown (66 Assertions across 26 Categories)

| Group | Category | Assertions | Key Protections Tested |
| :---: | :--- | :---: | :--- |
| **1** | System Health & Liveness Probe | 2 | `/api/health` HTTP 200 and healthy status response. |
| **2** | Authentication - Valid Login | 3 | Login establishes session, verifies role, sets session cookie. |
| **3** | Authentication - Invalid Credentials | 2 | Wrong password and nonexistent username rejected with 401. |
| **4** | Account Suspension Defense | 4 | Suspension prevents login; reactivation restores access. |
| **5** | Session Termination & Revocation | 2 | `/api/auth/logout` invalidates session and revokes clearances. |
| **6** | IDOR / Horizontal Privilege Boundary | 3 | Operative views own record; cross-hero record view returns 403; staff can inspect any operative. |
| **7** | Private Document Access Control | 1 | Cross-hero document download returns 403 Forbidden. |
| **8** | Privilege Escalation: Self-Verification | 1 | Hero operative self-verification of documents returns 403. |
| **9** | Hero Self-Promotion & Threat Tampering | 2 | Hero updating record cannot elevate threat tier or class. |
| **10**| Registration State Machine Transitions | 5 | Rejection, illegal transition `Rejected -> Approved` blocked with 422, legal reopen, verification, approval. |
| **11**| Workflow Lifecycle State Validation | 3 | Registrar transitions: Draft -> Under Review -> Verified -> Licensed. |
| **12**| Admin Boundary: Provision Super Admin | 1 | Standard Admin provisioning Super Admin account blocked with 403. |
| **13**| Admin Boundary: Reset Super Admin Passkey | 1 | Standard Admin resetting Super Admin passkey blocked with 403. |
| **14**| User Suspension Lifecycle | 1 | Root account `commander` cannot be suspended (protected). |
| **15**| CSV Formula Injection (CWE-1236) | 3 | neutralizes `=`, `+`, `-`, `@`, `\t`, `\r` formula prefixes. |
| **16**| Cryptographic Audit Ledger Chaining | 2 | 100% SHA-256 chain integrity verification. |
| **17**| Rate Limiter Security | 1 | Sliding-window rate limiter responsiveness. |
| **18**| Path Traversal & Static Perimeter | 3 | Traversal attempts (`..`), `.env`, and `/backend/` blocked. |
| **19**| Active Session Immediate Revocation | 4 | Account suspended while session active; next request returns 401. |
| **20**| Damage Report IDOR Impersonation | 2 | Hero damage claim attribution forced to authenticated operative ID. |
| **21**| Factory Reset Safety Token | 3 | Unconfirmed reset returns 400; valid confirmation reset succeeds. |
| **22**| Cross-Origin Request Forgery (CSRF) | 1 | State-changing request from untrusted origin blocked with 403. |
| **23**| Document Deletion & Immutability | 5 | Upload versioning (`version: 1`), cross-hero deletion blocked (403), verified document deletion blocked (403), owner deletion of unverified doc succeeds (200). |
| **24**| Upload Perimeter & Double-Extension | 2 | Double-extension `backdoor.php.png` rejected with 400; raw executable `.php` rejected with 415. |
| **25**| Authenticated Encryption (Encrypt-then-MAC) | 5 | HMAC tag generation, algorithm verification, valid decryption, ciphertext bit-flip tamper rejection, MAC forgery rejection. |
| **26**| Security Headers & Content-Security-Policy | 4 | `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Content-Security-Policy`, and `Permissions-Policy`. |
| **TOTAL** | **Enterprise Test Suite** | **66** | **100% Pass Rate** |

---

## 4. Writing Additional Tests

When implementing tests, always adhere to the following principles:

1. **Test Both Positive and Negative Conditions**:
   A test that only verifies successful 200 responses is inadequate. Always verify that unauthorized or malformed requests fail with the appropriate 4xx status code.
2. **Multi-Identity Testing**:
   Authenticate as at least two distinct operative roles (e.g., `lumina` and `apex`) to verify horizontal isolation (IDOR).
3. **Assert Concrete Payload Properties**:
   Do not merely assert HTTP status codes; assert that returned JSON contains expected fields and that privileged attributes were not mutated.
