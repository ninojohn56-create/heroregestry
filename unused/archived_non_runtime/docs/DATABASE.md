# GHRA Datastore Architecture & Schema Specification

## 1. Storage Paradigm

GHRA employs a **hardened, flat-file JSON datastore architecture** located in `backend/data/`. This decoupled architecture eliminates external database daemon dependencies (such as MySQL or PostgreSQL), ensuring zero-overhead portability and instant disaster recovery.

All read and write operations are routed through the centralized abstraction layer `JsonStorage` (`backend/storage.php`).

---

## 2. Concurrency Control & Atomic Transactions

To prevent race conditions, lost updates, and file corruption during simultaneous client access, `JsonStorage` enforces a strict three-tier transaction protocol:

```
[ Process A ]                                            [ File System ]
      │                                                         │
      ├───── 1. Open Lock File (.lock) ─────────────────────────┤
      ├───── 2. Acquire Exclusive Lock (flock LOCK_EX) ─────────┤ (Process B blocks here)
      ├───── 3. Read Current File State ────────────────────────┤
      ├───── 4. Execute Mutator Callback in Memory ─────────────┤
      ├───── 5. Write New State to Unique Temp File (.tmp) ─────┤
      ├───── 6. Atomic Replacement via rename() ────────────────┤ (Zero partial writes)
      └───── 7. Release Exclusive Lock & Close Handle ──────────┤
                                                                │ (Process B acquires lock)
```

1. **Exclusive Lock (`flock`)**: Every write operation acquires an exclusive OS lock (`LOCK_EX`) on a dedicated lock handle before reading or modifying the datastore.
2. **Temporary Staging**: Serialized JSON data is written to a unique temporary file (`<target>.tmp.<random>`) and flushed to disk.
3. **Atomic Replacement (`rename`)**: The POSIX/Windows atomic file replacement operation `rename()` replaces the production datastore instantly. If the process crashes mid-write, the existing datastore remains completely intact.

---

## 3. Canonical Datastore Schemas

### 3.1 `heroes.json` — Hero Dossiers & Public Registry
Maps operative ID (`hero_id`) to the public and tactical hero dossier.
```json
{
  "hero_apex_01": {
    "id": "hero_apex_01",
    "alias": "APEX",
    "avatar": "/img/apex.jpg",
    "gov_code": "9GH-8430",
    "primary_power": "Enhanced Strength",
    "primary_level": "Level 8/10",
    "primary_pct": 80,
    "secondary_power": "Flight",
    "threat_class": "A-Class",
    "threat_tier": 2,
    "threat_tier_label": "A-Class (Continental)",
    "region": "Sector 1 - Metro Downtown",
    "status": "LICENSED",
    "license_number": "GHRMS-LIC-9GH-8430",
    "registration_step": 4,
    "badge_secret": "6af678798775587dfc46d9ec8b2d0ced",
    "badge_color": "green",
    "sidekicks": ["Aero Scout"],
    "mentor": null,
    "coordinates": {
      "lat": 40.7128,
      "lng": -74.006,
      "grid": "MTR-8430"
    },
    "created_at": "2026-10-02T16:27:54+00:00",
    "emergency_contacts": [
      { "name": "Dr. Karen Wright", "relation": "Spouse", "phone": "+1-555-012-9844" }
    ],
    "real_name": "Samuel Wright",
    "vault_id": "vlt_c966be6f1867c399",
    "supporting_documents": [
      {
        "id": "doc_hero_apex_01_id",
        "version": 1,
        "document_type": "Official ID",
        "original_name": "apex_official_id.png",
        "file_name": "doc_hero_apex_01_id.png",
        "file_size": 8697,
        "mime_type": "image/png",
        "upload_date": "2026-09-19T16:27:54+00:00",
        "expiration_date": "2035-12-31",
        "verification_status": "Verified",
        "verified_by": "Commander Vance (SUPER_ADMIN)",
        "verification_date": "2026-09-20T16:27:54+00:00",
        "verification_notes": "Federal biometric identity confirmed authentic against vault"
      }
    ]
  }
}
```

---

### 3.2 `vault.json` — Isolated Civilian Identity Vault
Stores sensitive biometric, legal, and residential data protected by Authenticated Encryption (Encrypt-then-MAC).
```json
{
  "vlt_c966be6f1867c399": {
    "vault_id": "vlt_c966be6f1867c399",
    "ciphertext": "p7dK...[base64 ciphertext]...",
    "iv": "3fG...[16-byte base64 IV]...",
    "mac": "a7b8c9d0e1f2...[64-char hex HMAC-SHA256 tag]...",
    "algo": "AES-256-CBC+HMAC-SHA256",
    "created_at": "2026-10-02T16:27:54+00:00",
    "updated_at": "2026-10-04T16:00:00+00:00"
  }
}
```
**Decrypted Bio-Data Payload**:
```json
{
  "legal_name": "Samuel Wright",
  "civilian_ssn": "XXX-XX-9844",
  "residential_safehouse": "Safehouse Delta-9, Sector 1",
  "biometric_dna_sequence": "DNA-SEQ-788192-MUTANT-A",
  "emergency_contact": "Dr. Karen Wright (+1-555-012-9844)"
}
```

---

### 3.3 `users.json` — Personnel Accounts & Security Clearances
Tracks administrative and operative credentials for authentication.
```json
{
  "commander": {
    "username": "commander",
    "password_hash": "$2y$10$WpP90mZ88k8y...",
    "role": "SUPER_ADMIN",
    "name": "Commander Vance",
    "hero_id": null,
    "avatar": "/img/logo.jpg",
    "clearance_level": 5,
    "status": "active",
    "created_at": "2026-10-02T16:27:54+00:00"
  },
  "apex": {
    "username": "apex",
    "password_hash": "$2y$10$O0FfA8...",
    "role": "HERO",
    "name": "Samuel Wright (APEX)",
    "hero_id": "hero_apex_01",
    "avatar": "/img/apex.jpg",
    "clearance_level": 1,
    "status": "active",
    "created_at": "2026-10-02T16:27:54+00:00"
  }
}
```

---

### 3.4 `audit_ledger.json` — Chained Cryptographic Ledger
Provides an append-only, tamper-evident audit history.
```json
[
  {
    "index": 1,
    "timestamp": "2026-10-02T16:27:54+00:00",
    "actor": "Commander Vance",
    "role": "SUPER_ADMIN",
    "action": "SYSTEM_INITIALIZED",
    "target": "SYSTEM",
    "details": {},
    "prev_hash": "0000000000000000000000000000000000000000000000000000000000000000",
    "hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
  }
]
```

---

### 3.5 `incidents.json` — Tactical Engagements & Damage Claims
Records metahuman engagements, civilian collateral damage, and claim statuses.
```json
[
  {
    "id": "inc_71829a",
    "title": "Perimeter Breach Incident",
    "power_type": "Photonic",
    "severity": "Moderate",
    "estimated_damage_usd": 12000,
    "reported_by_hero": "hero_lumina_02",
    "status": "PENDING_TRIAGE",
    "created_at": "2026-10-04T16:25:00+00:00"
  }
]
```

---

## 4. Scalability & Architectural Limits

- **Read Throughput**: Reads from memory or OS file cache achieve sub-millisecond latencies (<2ms).
- **Concurrency Ceiling**: Under heavy concurrent writes (>500 writes/sec), file-level locking (`flock`) introduces lock contention. For enterprise deployments exceeding 10,000 active concurrent write sessions, migrate the `JsonStorage` adapter to a Redis or PostgreSQL backend while retaining the identical API contract.
