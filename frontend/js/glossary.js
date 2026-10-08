/**
 * GHRA / GHRMS — Glossary & Tooltip Engine  v1.0
 * ─────────────────────────────────────────────────
 * Hover tooltips on any .ghra-term[data-term] element.
 * Populates #glossary-grid in the Version History tab.
 */
'use strict';

/* ══ GLOSSARY DATA ═══════════════════════════════════════ */
const GHRA_GLOSSARY = {
  'aes256': {
    title: 'AES-256',
    body: 'Advanced Encryption Standard with a 256-bit key. The strongest symmetric block cipher used in GHRMS to protect the civilian identity vault. Industry-standard for government and financial data.'
  },
  'aesgcm': {
    title: 'AES-256-CBC + HMAC-SHA256',
    body: 'AES-256-CBC provides confidentiality; HMAC-SHA256 adds integrity. GHRMS uses this "Encrypt-then-MAC" pattern so ciphertext tampering is detected before decryption.'
  },
  'encrypt-then-mac': {
    title: 'Encrypt-then-MAC',
    body: 'Encrypt first, then compute a MAC over the ciphertext. Prevents padding-oracle and ciphertext-manipulation attacks. Used in GHRMS CryptoService since v1.2.0.'
  },
  'sha256': {
    title: 'SHA-256',
    body: 'Secure Hash Algorithm (256-bit digest). Every audit ledger entry includes the SHA-256 hash of the previous entry — changing any entry breaks the chain and is immediately detectable.'
  },
  'hmac': {
    title: 'HMAC',
    body: 'Hash-based Message Authentication Code. Combines a hash function with a secret key to provide data integrity and authenticity. GHRMS uses HMAC-SHA256 for audit signatures and rotating field badges.'
  },
  'csp': {
    title: 'Content-Security-Policy (CSP)',
    body: 'HTTP header restricting resource origins. GHRMS sets: default-src \'none\'; frame-ancestors \'none\'; — preventing XSS, clickjacking, and data-injection.'
  },
  'session-timeout': {
    title: 'Session Timeout',
    body: 'GHRMS enforces: (1) Idle timeout — 30 minutes of inactivity destroys the session; (2) Absolute timeout — 24-hour hard limit. Both prevent session-hijacking.'
  },
  'idor': {
    title: 'IDOR (Insecure Direct Object Reference)',
    body: 'Vulnerability where a user accesses another user\'s objects by guessing IDs. GHRMS verifies hero ID ownership before any document deletion or retrieval — HTTP 403 on mismatch.'
  },
  'rate-limiting': {
    title: 'Rate Limiting',
    body: 'Sliding-window throttle preventing brute-force attacks. GHRMS limits login, badge verify, and sentinel scans per time window, returning HTTP 429 when exceeded.'
  },
  'origin-validation': {
    title: 'Origin Validation (CSRF Defense)',
    body: 'Every state-changing request (POST/PUT/DELETE) has its Origin or Referer header verified. Prevents Cross-Site Request Forgery (CSRF) attacks from third-party pages.'
  },
  'csv-injection': {
    title: 'CSV Formula Injection (CWE-1236)',
    body: 'Attack where =CMD(...), +, -, @ values execute as spreadsheet formulas when CSV is opened in Excel. Fixed in v1.1.0 by quoting dangerous leading characters.'
  },
  'cwe-1236': {
    title: 'CWE-1236: Formula Injection',
    body: 'Common Weakness Enumeration entry for spreadsheet formula injection via exported CSV. GHRMS neutralizes by quoting or prefixing dangerous field values.'
  },
  'immutability': {
    title: 'Compliance Immutability',
    body: 'Verified documents in GHRMS cannot be deleted by anyone — even Super Admins — returning HTTP 403 VERIFIED_RECORD_PROTECTED. Satisfies regulatory evidence-preservation requirements.'
  },
  'audit-ledger': {
    title: 'SHA-256 Chained Audit Ledger',
    body: 'Append-only JSON ledger where each entry stores the SHA-256 hash of the previous entry. Every login, status change, document upload, and passkey reset is logged. Retroactive falsification is cryptographically detectable.'
  },
  'radar': {
    title: 'Tactical Radar / GIS Map',
    body: 'Leaflet.js interactive map displaying operative positions, sector containment zones, and weather telemetry. Supports street-view and satellite-recon layers across 5 municipal sectors.'
  },
  'qr': {
    title: 'QR Field Badge (HMAC-Rotating)',
    body: 'A rotating 30-second HMAC-SHA256-signed QR code encoding operative identity and timestamp. Sentinel terminals scan this in real time. Expired or forged badges fail signature validation.'
  },
  'canon': {
    title: 'Canon / Factory Baseline',
    body: 'Predefined seed users, heroes, and configuration representing the "official" GHRMS story state. Factory Reset (L5 only) re-seeds the system to this baseline, wiping all custom entries.'
  },
  'changelog': {
    title: 'Changelog / Version History',
    body: 'Chronological log of all notable changes, bug fixes, and security patches. GHRMS follows Semantic Versioning (MAJOR.MINOR.PATCH) and Keep-a-Changelog conventions.'
  },
  'clearance-l5': {
    title: 'Clearance Level 5 — Supreme Commander',
    body: 'Highest access tier. Grants factory reset, Super Admin provisioning, emergency mode, and full system override. Canon: commander.'
  },
  'clearance-l4': {
    title: 'Clearance Level 4 — Standard Admin',
    body: 'Day-to-day administration: hero management, passkey resets, record editing, queue review. Cannot modify Super Admin accounts or trigger factory resets.'
  },
  'clearance-l3': {
    title: 'Clearance Level 3 — Registrar',
    body: 'Intake assessment desk: document review, application approval/rejection, hero passkey resets. Cannot access system settings or danger-zone functions.'
  },
  'clearance-l1': {
    title: 'Clearance Level 1 — Registered Hero',
    body: 'Self-service portal: view own profile, submit update requests, generate rotating field badge, file damage reports. Cannot access other heroes\' data.'
  },
  'glossary-example': {
    title: 'Glossary Terms',
    body: 'Terms with a dashed underline have inline definitions. Hover to see. Visit the Version History tab for the full system glossary reference.'
  }
};

/* ══ TOOLTIP ENGINE ══════════════════════════════════════ */
(function () {
  const tooltip = document.getElementById('ghra-tooltip');
  const ttTitle = document.getElementById('ghra-tt-title');
  const ttBody  = document.getElementById('ghra-tt-body');
  if (!tooltip) return;

  const MARGIN = 12;
  let activeEl = null;

  function pos(x, y) {
    const tw = tooltip.offsetWidth  || 260;
    const th = tooltip.offsetHeight || 70;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = x + MARGIN;
    let top  = y + MARGIN;
    if (left + tw > vw - 8) left = x - tw - MARGIN;
    if (top  + th > vh - 8) top  = y - th - MARGIN;
    tooltip.style.left = Math.max(8, left) + 'px';
    tooltip.style.top  = Math.max(8, top)  + 'px';
  }

  function show(el, e) {
    const entry = GHRA_GLOSSARY[el.dataset.term];
    if (!entry) return;
    ttTitle.textContent = entry.title;
    ttBody.textContent  = entry.body;
    tooltip.classList.add('visible');
    tooltip.setAttribute('aria-hidden', 'false');
    pos(e.clientX, e.clientY);
    activeEl = el;
  }

  function hide() {
    tooltip.classList.remove('visible');
    tooltip.setAttribute('aria-hidden', 'true');
    activeEl = null;
  }

  document.addEventListener('mouseover',  e => { const el = e.target.closest('.ghra-term'); if (el && el !== activeEl) show(el, e); });
  document.addEventListener('mouseout',   e => { if (e.target.closest('.ghra-term')) hide(); });
  document.addEventListener('mousemove',  e => { if (activeEl) pos(e.clientX, e.clientY); });
  window .addEventListener('scroll', hide, true);
})();

/* ══ GLOSSARY GRID ══════════════════════════════════════ */
function populateGlossaryGrid() {
  const grid = document.getElementById('glossary-grid');
  if (!grid || grid._populated) return;
  grid._populated = true;

  const keys = [
    'aes256','sha256','hmac','csp','idor',
    'rate-limiting','session-timeout','origin-validation',
    'audit-ledger','encrypt-then-mac','immutability',
    'csv-injection','radar','qr','canon',
    'clearance-l5','clearance-l4','clearance-l3'
  ];

  function esc(s) {
    return String(s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  grid.innerHTML = keys.map(k => {
    const e = GHRA_GLOSSARY[k];
    if (!e) return '';
    return `<div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/60 hover:border-cyan-500/40 transition-colors">
      <p class="text-[10px] font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider mb-1">${esc(e.title)}</p>
      <p class="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">${esc(e.body)}</p>
    </div>`;
  }).join('');
}

// Populate on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', populateGlossaryGrid);
} else {
  populateGlossaryGrid();
}

// Wrap switchTab to populate grid when changelog tab opens
document.addEventListener('DOMContentLoaded', function () {
  const orig = window.switchTab;
  if (typeof orig === 'function') {
    window.switchTab = function (tab) {
      orig.call(this, tab);
      if (tab === 'changelog') {
        // allow DOM to show, then populate
        setTimeout(populateGlossaryGrid, 50);
      }
    };
  }
});
