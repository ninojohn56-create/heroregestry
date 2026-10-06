# System Presentation Guide: Hero Registry & Management System (GHRMS)

This guide provides a comprehensive checklist and script for presenting your software system to a panel, client, or evaluator.

---

## 1. Executive Summary & Problem Statement
* **The Problem**: Enhanced individuals (superheroes) operate in public, but there is no standardized, audited municipal process to verify their combat tier, issue authorized field credentials, or protect their civilian real identities from being leaked or hacked.
* **The Solution**: The **Global Hero Registration & Management System (GHRMS)** provides a secure, role-governed platform for hero intake, registrar accreditation, police checkpoint QR scanning, and administrative audit logging.

---

## 2. System Personas & User Roles (RBAC)
Explain the 4 user types and their boundaries:
1. **Hero Operative (Level 1)**: Self-registers, provides tactical specifications, uploads biometric face photo, tracks application status, and displays dynamic QR field badge.
2. **Police Sentinel (Level 2)**: Operates checkpoint scanners in the field; scans hero QR codes for 1-second verification; triggers rogue containment alerts.
3. **Registrar Officer (Level 3)**: Vets incoming applications; verifies supporting medical/power documents; decrypts civilian real names only after entering an audited justification; issues licenses (`GHRMS-LIC-...`).
4. **Super Admin (Level 5)**: Supreme oversight; provisions user accounts; inspects the immutable SHA-256 chained audit ledger; configures system parameters.

---

## 3. Technology Stack & Technical Justifications
Be prepared to explain why each technology was selected:
* **Backend**: Native **PHP 8.2+** with strict typing (`declare(strict_types=1);`). *Why*: High-performance, zero framework bloat, fast response times (<15ms).
* **Cryptography**: **OpenSSL AES-256-CBC** with unique Initialization Vectors (IV) per record. *Why*: Military-grade privacy ensuring civilian names cannot be cracked even if the database is stolen.
* **Integrity**: **SHA-256 Chained Cryptographic Ledger**. *Why*: Each audit entry hashes the previous entry's hash, making retroactive log falsification mathematically impossible.
* **Persistence**: **Transactional JSON Flat-Files with Kernel POSIX Locks (`flock`)**. *Why*: Zero database server overhead; eliminates race conditions during concurrent saves without complex SQL configuration.
* **Frontend UI**: **Semantic HTML5, Vanilla ES6+ JavaScript, CSS Custom Properties**. *Why*: Lightweight, responsive, zero external CDN dependencies (air-gap capable).

---

## 4. The Live Demo Walkthrough (The 4-Act Presentation)

### Act 1: Hero Applicant Self-Service (`/register` → `/hero`)
1. Show the **4-stage registration stepper** (Identity, Powers, Threat Tier, Supporting Documents).
2. Upload a biometric face photo and show live validation.
3. Submit the registration and show the hero operative dashboard with their status bar.
4. Click **[PRINT / SAVE OFFICIAL ID CARD]**: Showcase the physical wallet-sized Superhuman Accreditation Credential featuring the shimmering rainbow holographic Accord seal, security microprint lines, Gov ID, Threat Tier badge, and scannable QR code. Demonstrate both **[PRINT ID CARD / SAVE PDF]** and **[DOWNLOAD BADGE (PNG)]**.

### Act 2: Registrar Desk & Privileged Decryption (`/registrar`)
1. Switch to the Registrar Desk and show the applicant queue filtered by Threat Tier (Tiers 0–5).
2. Open the applicant's dossier. Point out that the civilian real name is **masked (`[CLASSIFIED // ENCRYPTED VAULT]`)**.
3. Click **Decrypt Vault**: Show the modal requiring the officer to type an official reason (e.g., *"Identity verification for municipal license issuance"*).
4. Reveal the decrypted name, verify the documents, and click **Approve License** to generate `GHRMS-LIC-...`.
5. Click **[PRINT ACCREDITED ID CARD & HOLOGRAM]** directly from the Registrar desk to issue the official field badge.

### Act 3: Sentinel Field Checkpoint (`/sentinel`)
1. Switch to the Sentinel Police Scanner.
2. Demonstrate the **Live Webcam Scanner** running smoothly in **Mozilla Firefox**: Click **[START WEBCAM]** to activate the camera with auto-detection reticle and real-time optical frame scanning.
3. Show that scanning any hero's QR code (e.g. Lumina, Apex, Solaris, Atlas) immediately resolves to that specific hero with their accurate face photo, callsign, and clearances—completely eliminating misattribution or default fallbacks.
4. Show the immediate (<1s) optical verification displaying authorized operative status, power mechanisms, and active municipal sector clearances (or Scramble CRU Rogue alert for rogue operatives like Specter Zero).

### Act 4: Super Admin Oversight & Audit Chain (`/admin`)
1. Open the Admin Command Center.
2. Navigate to the **Audit Ledger**: Show the permanently recorded vault decryption and licensing events with timestamps, actor IDs, and hash chains.
3. Show the **Sidebar Drag-Resizer** in action: Drag the sidebar border to resize, collapse to rail, and double-click to reset.

---

## 5. Security & Defense Highlights (What Panelists Look For)
* **Identity Privacy**: Civilian names are air-gapped in `vault.json`, encrypted with AES-256.
* **Insider Threat Protection**: Even staff cannot peek at real names without typing a reason that is permanently recorded in the audit ledger.
* **Session Integrity**: Role-based redirection in `router.php` prevents unauthenticated access to restricted portals.
* **Zero External Leaks**: No third-party Google Fonts or external CDNs; runs self-contained.

---

## 6. Project Timeline & Delivery
* Display the **Gantt Chart** starting on **September 9** (initial baseline check) through **October 2** (containerization, authentic verification documents, document lightbox, full field editability, and cryptographic audit ledger attribution).
* Highlight that all work was executed **solo** with clear step-by-step milestones.
