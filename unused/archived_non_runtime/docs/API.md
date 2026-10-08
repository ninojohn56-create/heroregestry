# GHRA / GHRMS RESTful API Specification

**Base URL**: `/api`  
**Protocol**: HTTP/1.1 or HTTP/2 over TLS  
**Standard Response Formats**: JSON (`Content-Type: application/json; charset=utf-8`) or CSV (`text/csv`)  
**Security Requirements**: State-changing requests (`POST`, `PUT`, `DELETE`) enforce Origin matching and session cookie authentication.

---

## Error Handling Standard

All error responses adhere to the following schema:
```json
{
  "success": false,
  "error": "Descriptive human-readable error message",
  "code": 403
}
```

Standard Status Codes:
- `200 OK`: Request succeeded.
- `201 Created`: Resource successfully created.
- `400 Bad Request`: Malformed payload, invalid syntax, or missing required parameter.
- `401 Unauthorized`: Authentication required or invalid credentials / session expired.
- `403 Forbidden`: Clearance level insufficient, cross-origin request rejected, or IDOR violation.
- `404 Not Found`: Resource does not exist.
- `413 Payload Too Large`: Uploaded file exceeds size ceiling (12MB for documents, 8MB for avatars).
- `415 Unsupported Media Type`: Prohibited file extension or MIME type.
- `422 Unprocessable Entity`: Illegal state machine transition or semantic business rule violation.
- `429 Too Many Requests`: Rate limit threshold exceeded.
- `500 Internal Server Error`: Unexpected server exception.

---

## 1. Authentication & Identity Management

### `POST /api/auth/login`
Authenticates an operative or administrative officer.

- **Access**: Public (Subject to sliding-window rate limit: 15 req/60s).
- **Request Body**:
  ```json
  {
    "username": "commander",
    "password": "admin123"
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "user": {
      "username": "commander",
      "role": "SUPER_ADMIN",
      "name": "Commander Vance",
      "clearance_level": 5,
      "avatar": "/img/logo.jpg"
    }
  }
  ```
- **Response Headers**: Sets `Set-Cookie: ghra_session=...; Path=/; HttpOnly; SameSite=Lax`.

---

### `POST /api/auth/logout`
Terminates the active session and invalidates all session cookies.

- **Access**: Authenticated.
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "message": "Logged out successfully."
  }
  ```

---

### `GET /api/auth/me`
Retrieves current authenticated caller profile and clearance level.

- **Access**: Authenticated.
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "user": {
      "username": "sarah.chen",
      "role": "REGISTRAR",
      "name": "Sarah Chen",
      "clearance_level": 3
    }
  }
  ```

---

## 2. Hero Operative Registry

### `GET /api/heroes`
Retrieves list of registered heroes. Output is filtered by caller role (public callers receive sanitized tactical summaries; staff receive complete packets).

- **Access**: Public / Authenticated.
- **Query Parameters**:
  - `status`: Filter by status (`REGISTERED`, `REVIEWING`, `VERIFIED`, `LICENSED`, `REJECTED`, `SUSPENDED`).
  - `threat_tier`: Filter by threat tier (`1` to `5`).
  - `search`: Keyword search matching alias, legal name, or power type.
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "hero_apex_01",
        "alias": "APEX",
        "status": "LICENSED",
        "threat_tier": 2,
        "threat_class": "A-Class",
        "primary_power": "Enhanced Strength"
      }
    ]
  }
  ```

---

### `GET /api/heroes/{id}`
Retrieves complete operative file.

- **Access**: Staff (`SUPER_ADMIN`, `ADMIN`, `REGISTRAR`, `ASSESSOR`) or Applicant Hero matching `{id}`.
- **IDOR Protection**: Hero operatives attempting to access another hero's record receive `403 Forbidden`.
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "data": {
      "id": "hero_apex_01",
      "alias": "APEX",
      "real_name": "Samuel Wright",
      "threat_tier": 2,
      "status": "LICENSED",
      "supporting_documents": [...]
    }
  }
  ```

---

### `POST /api/heroes`
Submits initial hero registration packet.

- **Access**: Public or Authenticated Hero.
- **Request Body**:
  ```json
  {
    "alias": "SOLARIS",
    "real_name": "Helena Ross",
    "primary_power": "Photonic Manipulation",
    "region": "Sector 4",
    "emergency_contacts": [
      { "name": "Marcus Ross", "relation": "Brother", "phone": "+1-555-0199" }
    ]
  }
  ```
- **Response `201 Created`**:
  ```json
  {
    "success": true,
    "data": {
      "id": "hero_solaris_a833dd",
      "status": "REVIEWING"
    }
  }
  ```

---

### `PUT /api/heroes/{id}`
Updates operative dossier or registration workflow state.

- **Access**: Staff or Owner Hero.
- **Security Control**: Workflow and review fields (`status`, `license_number`, `verification_status`, reviewer attribution, approval/rejection timestamps) cannot be set through profile editing; use authorized workflow/document review routes.
- **Workflow State Machine**: Illegal state jumps (e.g., `Rejected -> Approved`) are rejected with `422 Unprocessable Entity`.

---

## 3. Supporting Documents Management

### `POST /api/heroes/{id}/documents`
Uploads a supporting legal or biometric document (Official ID, Certification, Clearance).

- **Access**: Staff or Owner Hero.
- **Payload**: `multipart/form-data`
  - `document`: File binary (PDF, PNG, JPG, WEBP; max 12MB).
  - `document_type`: String (`Official ID`, `Hero Certification`, `Training Certificate`, `Authorization Document`).
- **Security Validations**:
  - Rejects null bytes in filename.
  - Rejects double extensions (e.g., `exploit.php.png`).
  - Verifies magic bytes / MIME type using `finfo`.
  - Automatically initializes and increments revision version (`version: 1`, `version: 2`).
  - Every new upload is stored as `Pending`; enrollee uploads are never trusted as verified.
- **Response `201 Created`**:
  ```json
  {
    "success": true,
    "message": "Document uploaded successfully.",
    "data": {
      "id": "doc_a7f920bc",
      "version": 1,
      "document_type": "Official ID",
      "original_name": "passport.png",
      "verification_status": "Pending"
    }
  }
  ```

---

### `GET /api/heroes/{id}/documents/{docId}`
Downloads or previews a private document.

- **Access**: Staff or Owner Hero.
- **IDOR Protection**: Cross-hero access is rejected with `403 Forbidden`.
- **Response `200 OK`**: File stream with `Content-Type` matching verified file MIME and `Cache-Control: private`.

---

### `POST /api/heroes/{id}/documents/{docId}/verify`
Staff verification of submitted operative document.

- **Access**: `SUPER_ADMIN`, `ADMIN`, `REGISTRAR`, `ASSESSOR`.
- **Security Control**: Hero self-verification is blocked with `403 Forbidden`.
- **Request Body**:
  ```json
  {
    "status": "Verified",
    "notes": "Describe the actual checks performed against the submitted document."
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "document": {
      "id": "doc_a7f920bc",
      "verification_status": "Verified",
      "verified_by": "Sarah Chen (REGISTRAR)",
      "verification_date": "2026-10-04T16:00:00Z"
    }
  }
  ```
- A decision must explicitly be `Verified` or `Rejected`; unknown/missing values return `400`. Reviewer notes are mandatory for either decision. The response records the reviewer account and timestamp.
- Verifying an Official ID or Hero Certification checks that the stored file exists, matches its recorded MIME type, and is not expired. Replacing a required document or rejecting a required document invalidates prior identity/license review.
- Identity verification requires a valid, reviewed, unexpired Official ID and Hero Certification plus accessible encrypted identity-vault data. Approval and FTF licensure require that identity review to be complete. Missing evidence returns `422`.

---

### `DELETE /api/heroes/{id}/documents/{docId}`
Permanently deletes an unverified supporting document from registration packet and storage.

- **Access**: Staff (`SUPER_ADMIN`, `ADMIN`, `REGISTRAR`) or Owner Hero.
- **Compliance Lock**: Verified documents are immutable compliance records. Attempts to delete a document with `verification_status: "Verified"` return `403 Forbidden` (`VERIFIED_RECORD_PROTECTED`).
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "message": "Document 'passport.png' successfully deleted.",
    "doc_id": "doc_a7f920bc"
  }
  ```

---

## 4. Checkpoint Verification & Sentinels

### `POST /api/sentinel/verify-badge`
Street-level validation of hero holographic badge QR codes by field Sentinels.

- **Access**: Public / Field Sentinel (Rate limited: 30 req/60s).
- **Request Body**:
  ```json
  {
    "badge_data": "APEX:9GH-8430:e7b0c9f1a238..."
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "valid": true,
    "hero": {
      "alias": "APEX",
      "gov_code": "9GH-8430",
      "status": "LICENSED",
      "threat_tier": 2
    }
  }
  ```

---

## 5. Post-Battle Damage Reporting

### `POST /api/damage-report`
Submits collateral damage and municipal incident claims following a metahuman engagement.

- **Access**: Authenticated Hero.
- **IDOR Protection**: The server forces `reported_by_hero` to the authenticated caller's verified `hero_id`. Attempts to forge another operative ID are overridden.
- **Request Body**:
  ```json
  {
    "power_type": "Photonic",
    "severity": "Moderate",
    "estimated_damage_usd": 15000,
    "title": "Perimeter Wall Breach"
  }
  ```
- **Response `201 Created`**:
  ```json
  {
    "success": true,
    "data": {
      "id": "inc_71829a",
      "reported_by_hero": "hero_lumina_02",
      "status": "PENDING_TRIAGE"
    }
  }
  ```

---

## 6. Administrative Management & Audit

### `GET /api/audit-ledger`
Retrieves cryptographically chained tamper-evident audit records.

- **Access**: `SUPER_ADMIN`, `ADMIN`.
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "chain_intact": true,
    "entries": [...]
  }
  ```

---

### `POST /api/admin/system/reset-data`
Performs a factory data reset restoring default seeds.

- **Access**: `SUPER_ADMIN` only.
- **Protection**: Requires confirmation token in request payload (`{"confirm": "CONFIRM_FACTORY_RESET"}`). Unconfirmed or malformed calls return `400 Bad Request`.
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "message": "System datastores successfully reset to clean baseline."
  }
  ```

---

## 7. System Health & Liveness

### `GET /api/health`
Probes datastore integrity, directory permissions, and encryption subsystem status.

- **Access**: Public / Monitoring.
- **Response `200 OK`**:
  ```json
  {
    "status": "healthy",
    "timestamp": "2026-10-04T16:30:00Z",
    "php_version": "8.3.33",
    "datastores": {
      "heroes": 11,
      "vault": 262,
      "users": 26
    }
  }
  ```
