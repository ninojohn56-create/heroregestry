# GHRA Document Security & Lifecycle Specification

## 1. Document Lifecycle Pipeline

In compliance with the Superhuman Registration Accords, all operative documentation—including government identification, metahuman combat training credentials, psychological evaluations, and agency authorizations—is governed by an audited, zero-trust lifecycle:

```
[ HERO / APPLICANT ]                                 [ INTAKE REGISTRAR ]
        │                                                     │
1. UPLOAD FILE                                                │
   - Binary & Type Post                                       │
        │                                                     │
2. PERIMETER INSPECTION                                       │
   - Null-byte check (\0, %00)                                │
   - Script masquerade / double-extension                     │
   - finfo MIME / magic-byte verification                     │
   - 12MB size ceiling validation                             │
        │                                                     │
3. ISOLATED PERSISTENCE                                       │
   - Stored in backend/data/documents/                        │
   - Non-executable randomized doc_<hex> name                 │
   - Version incremented (version: n+1)                       │
   - Audit event: DOCUMENT_UPLOADED                           │
        │                                                     │
4. COMPLIANCE REVIEW ─────────────────────────────────────────┤
                                                              │
5. FORMAL VERIFICATION                                        │
   - Server-derived reviewer identity                         │
   - Identity match against vault                             │
   - Status updated: Verified / Rejected                      │
   - Audit event: DOCUMENT_VERIFIED                           │
                                                              │
6. IMMUTABILITY LOCK ─────────────────────────────────────────┤
   - Verified documents become locked compliance records      │
   - Deletion prohibited (VERIFIED_RECORD_PROTECTED)          │
   - Historical revisions preserved                           │
```

---

## 2. Permitted Document Categories

Operative files are categorized into five official document types:

| Document Type | Purpose | Primary Reviewer Role | Verification Effect |
| :--- | :--- | :--- | :--- |
| **Official ID** | Federal passport, state driver's license, or national identity card. | `REGISTRAR` | Updates hero identity verification status in sync. |
| **Hero Certification** | Academy diploma, superhuman combat accreditation, or power containment certificate. | `ASSESSOR` / `REGISTRAR` | Required for threat tier classification and licensing. |
| **Training Certificate** | Defensive driving, tactical evasion, or collateral mitigation training. | `ASSESSOR` | Unlocks municipal tactical deployments. |
| **Authorization Document** | Agency letter of sponsorship or municipal accord clearance. | `SUPER_ADMIN` / `ADMIN` | Required for multi-jurisdictional operating licenses. |
| **Other Supporting Documents** | Medical records, incident discharge summaries, or legal name change decrees. | `REGISTRAR` | Auxiliary compliance records. |

---

## 3. Upload Security Controls

### 3.1 MIME & Magic-Byte Validation
The server uses PHP's `finfo` engine to inspect the raw file binary signatures (magic bytes) on disk rather than trusting client-supplied `Content-Type` headers:
- `application/pdf` (`%PDF-`)
- `image/png` (`\x89PNG\r\n\x1a\n`)
- `image/jpeg` (`\xFF\xD8\xFF`)
- `image/webp` (`RIFF....WEBP`)

### 3.2 Double-Extension & Script Masquerade Defense
Uploaded filenames are inspected for multiple extensions and executable suffixes:
- Any filename containing `.php`, `.phtml`, `.phar`, `.cgi`, `.pl`, `.exe`, `.sh`, `.bat`, or `.cmd` in any segment is immediately rejected with `400 Bad Request`.
- Disallowed primary extensions return `415 Unsupported Media Type`.

### 3.3 Storage Isolation
- Uploaded files are moved outside the webroot into `backend/data/documents/`.
- Files are saved as `<docId>.<extension>` (e.g., `doc_83f19a02ce11.png`) where `<docId>` is generated from cryptographically secure random bytes (`bin2hex(random_bytes(6))`).
- Original filenames are sanitized and stored solely in metadata for display purposes.

---

## 4. Access Control & Authorization (IDOR Defense)

### 4.1 Download & Preview (`GET /api/heroes/{id}/documents/{docId}`)
Access is strictly gated at the server boundary:
- **Staff**: `SUPER_ADMIN`, `ADMIN`, `REGISTRAR`, and `ASSESSOR` can inspect any operative document.
- **Hero**: Operatives may only download documents belonging to their own verified `hero_id`. Cross-hero requests return `403 Forbidden`.
- **Public**: Public/unauthenticated callers are denied access with `401 Unauthorized` or `403 Forbidden`.
- **Direct Web Access**: Web server configuration explicitly denies direct HTTP access to the `documents/` directory.

### 4.2 Verification (`POST /api/heroes/{id}/documents/{docId}/verify`)
- Hero operatives cannot verify their own documents. Self-verification attempts are rejected with `403 Forbidden`.
- Reviewer identity is automatically extracted from the authenticated session (`$actor['name']`), preventing client forgery of reviewer identity.

---

## 5. Deletion & Immutability Rules

### 5.1 Deletion Protocol (`DELETE /api/heroes/{id}/documents/{docId}`)
- **Unverified Documents**: An operative or registrar may delete an unverified document (e.g., mistaken upload or corrupted scan). Deletion unlinks the physical file from disk, removes the record from `heroes.json`, and records a `DOCUMENT_DELETED` entry in the cryptographic audit ledger.
- **Verified Compliance Records**: Once marked `Verified`, a document is an immutable legal record under the Superhuman Accords. Deletion is explicitly blocked with `403 Forbidden` (`VERIFIED_RECORD_PROTECTED`). To alter or archive a verified record, an administrator must first formally revoke or reject the document with documented justification.

---

## 6. Document Versioning

- Each uploaded document initializes with `version: 1`.
- Subsequent uploads of the same `document_type` for an operative automatically increment the revision version (`version: 2`, `version: 3`).
- Previous versions remain tracked in the operative dossier until administratively archived.
