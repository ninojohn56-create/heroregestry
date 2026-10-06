# GHRA Site Reliability Engineering (SRE) & Incident Response Runbook

**Audience**: System Administrators, SREs, Incident Commanders, Security Officers  
**Clearance Level**: Level 4+ Restricted Operations  
**System**: Global Superhuman Registration Authority (GHRA / GHRMS)

---

## 1. Operational Objectives & SLAs

- **Target Uptime**: 99.9% availability
- **Recovery Point Objective (RPO)**: $\le 1\text{ hour}$ (Maximum allowable data loss window)
- **Recovery Time Objective (RTO)**: $\le 15\text{ minutes}$ (Maximum duration to restore service)
- **Backup Frequency**: Automated hourly datastore snapshots; daily offsite archive sync.

---

## 2. Standard Maintenance Operations

### 2.1 Daily Backup Execution
Run the backup CLI to capture canonical JSON datastores and uploaded documents:
```bash
php backend/backup.php create
```
Verify the integrity of the generated archive:
```bash
# List backups to identify latest file
php backend/backup.php list

# Verify SHA-256 manifest
php backend/backup.php verify backend/data/backups/ghra_datastore_backup_YYYYMMDD_HHMMSS.zip
```

### 2.2 System Health Probe
Execute the automated diagnostic audit:
```bash
php check_system.php
```

---

## 3. Incident Response Playbooks

### Playbook IR-01: Suspected Credential Compromise / Account Hijacking
1. **Immediate Session & Account Revocation**:
   - As `SUPER_ADMIN`, access `/admin` or edit `backend/data/users.json` directly.
   - Set the compromised account status to `suspended`:
     ```bash
     # In users.json: "status": "suspended"
     ```
   - *Impact*: Active sessions for this user are invalidated immediately on the next request.
2. **Reset Passkey**:
   - Generate a high-entropy temporary passkey and update the user record.
3. **Audit Inspection**:
   - Inspect recent actions performed by the compromised actor in `backend/data/audit_ledger.json`.
4. **Log Incident**:
   - Record an incident entry in `backend/data/incidents.json` detailing scope and remediation.

---

### Playbook IR-02: Cryptographic Master Key Rotation (`HRS_MASTER_KEY`)
When rotating `HRS_MASTER_KEY`:
1. **Freeze Application Writes**:
   - Place system into maintenance mode or stop web workers.
2. **Create Full Datastore Backup**:
   ```bash
   php backend/backup.php create
   ```
3. **Decrypt Existing Vault with Old Key**:
   - Read all records in `backend/data/vault.json` using the current key.
4. **Re-encrypt Vault with New Key**:
   - Update `HRS_MASTER_KEY` in `.env` with a newly generated 64-character hex key:
     ```bash
     # Generate new key:
     php -r "echo bin2hex(random_bytes(32)) . PHP_EOL;"
     ```
   - Execute re-encryption script using `CryptoService::updateVault()`.
5. **Verify Decryption & Run Test Suite**:
   ```bash
   php check_system.php
   php tests/test_suite.php
   ```
6. **Resume Production Service**.

---

### Playbook IR-03: Datastore Corruption or Rollback
1. **Inspect Safety Snapshot**:
   Every restore operation automatically creates a safety snapshot in `backend/data/backups/pre_restore_snapshot_*.zip`.
2. **Execute Disaster Recovery Restore**:
   ```bash
   php backend/backup.php restore backend/data/backups/ghra_datastore_backup_<STABLE_DATE>.zip
   ```
3. **Verify Restored Hash Consistency**:
   ```bash
   php check_system.php
   ```

---

### Playbook IR-04: Audit Ledger Tamper Alarm
If `check_system.php` or `testAuditChainIntegrity()` reports an audit chain mismatch:
1. **Isolate Environment**:
   - Immediately capture memory and image filesystem for forensic analysis.
2. **Locate Divergence Point**:
   - Run verification script to identify the specific block index where `hash !== SHA-256(prev_hash || ...)`.
3. **Identify Discrepancy**:
   - Compare compromised ledger block against offsite immutable backup.
4. **Restore Ledger Integrity**:
   - Reconstruct canonical chain from secure backup and document the incident.

---

### Playbook IR-05: Emergency Hard Shutdown
In case of catastrophic physical perimeter breach or coordinated adversary assault:
```bash
# Terminate PHP web workers immediately
pkill -9 -f "php"

# On Windows:
taskkill /F /IM php.exe

# Deny incoming network connections at firewall level
sudo iptables -A INPUT -p tcp --dport 8000 -j DROP
sudo iptables -A INPUT -p tcp --dport 443 -j DROP
```
