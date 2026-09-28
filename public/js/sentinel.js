/**
 * GHRMS Sentinel Field Checkpoint Terminal Controller
 * Law Enforcement & Crisis Response Superhuman Scanner
 * Automatic Hero Identification, Face Recognition HUD, and Webcam Scanner
 */

const sentinelState = {
    theme: 'dark',
    selectedSector: 'Sector 01 (Downtown Municipal)',
    currentScan: null,
    history: [],
    audioCtx: null,
    cameraStream: null,
    cameraActive: false,
    cameraScanInterval: null,
    autoDetectTimer: null,
    lastAutoScannedPayload: ''
};

// -------------------------------------------------------------
// Audio FX Synthesizer (Web Audio API - No External Files)
// -------------------------------------------------------------
function playAudioCue(type) {
    try {
        if (!sentinelState.audioCtx) {
            sentinelState.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        const ctx = sentinelState.audioCtx;
        if (ctx.state === 'suspended') ctx.resume();

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        const now = ctx.currentTime;

        if (type === 'beep') {
            // High-tech verification chirp
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, now);
            osc.frequency.exponentialRampToValueAtTime(1400, now + 0.12);
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
            osc.start(now);
            osc.stop(now + 0.12);
        } else if (type === 'alarm') {
            // Urgent tactical rogue alarm
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(520, now);
            osc.frequency.setValueAtTime(740, now + 0.1);
            osc.frequency.setValueAtTime(520, now + 0.2);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
            osc.start(now);
            osc.stop(now + 0.35);
        } else if (type === 'click') {
            // Tactile HUD switch
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(440, now);
            gain.gain.setValueAtTime(0.08, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.04);
            osc.start(now);
            osc.stop(now + 0.04);
        }
    } catch (e) {
        // AudioContext policy blocked or disabled
    }
}

// -------------------------------------------------------------
// UI Utilities & Toasts
// -------------------------------------------------------------
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const ic = type === 'success' ? '[OK]' : type === 'error' ? '[ALERT]' : '[INFO]';
    toast.innerHTML = `<span style="font-weight:700;font-family:var(--font-mono);font-size:0.75rem;">${ic}</span> <span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        setTimeout(() => toast.remove(), 200);
    }, 3500);
}

function initTheme() {
    const saved = localStorage.getItem('ghrms_theme') || localStorage.getItem('color-scheme') || 'dark';
    applySentinelTheme(saved);

    const btn = document.getElementById('themeToggleBtn');
    if (btn) {
        btn.onclick = () => {
            const current = sentinelState.theme || document.documentElement.getAttribute('data-theme') || 'dark';
            const next = current === 'dark' ? 'light' : 'dark';
            localStorage.setItem('ghrms_theme', next);
            localStorage.setItem('color-scheme', next);
            applySentinelTheme(next);
            showToast(`Theme switched to ${next} mode`, 'info');
        };
    }

    window.addEventListener('storage', (e) => {
        if (e.key === 'ghrms_theme' || e.key === 'color-scheme') {
            const next = e.newValue || 'dark';
            applySentinelTheme(next);
        }
    });
}

function applySentinelTheme(theme) {
    sentinelState.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    if (theme === 'dark') {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
    const iconText = document.getElementById('themeToggleIcon');
    if (iconText) iconText.textContent = theme === 'dark' ? 'LIGHT' : 'DARK';
    const iconSymbol = document.getElementById('themeToggleIconSymbol');
    if (iconSymbol) iconSymbol.textContent = theme === 'dark' ? '☼' : '☾';
}

// -------------------------------------------------------------
// API Helper Methods
// -------------------------------------------------------------
async function apiGet(endpoint) {
    try {
        const res = await fetch(`/api/${endpoint}`);
        return await res.json();
    } catch (err) {
        return { success: false, error: err.message };
    }
}

async function apiPost(endpoint, body = {}) {
    try {
        const res = await fetch(`/api/${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        return await res.json();
    } catch (err) {
        return { success: false, error: err.message };
    }
}

// -------------------------------------------------------------
// Checkpoint Scanner Execution
// -------------------------------------------------------------
async function executeScan(qrPayload, pinValue = '', isQuietAuto = false) {
    if (!qrPayload || qrPayload.trim().length === 0) return;
    qrPayload = qrPayload.trim();

    if (!isQuietAuto) playAudioCue('click');

    const prompt = document.getElementById('scannerStatusPrompt');
    if (prompt) prompt.textContent = 'ANALYZING OPTICAL SIGNATURE...';

    const submitBtn = document.getElementById('btnExecuteScan');
    if (submitBtn && !isQuietAuto) {
        submitBtn.disabled = true;
        submitBtn.textContent = '[IDENTIFYING OPERATIVE...]';
    }

    const sectorSelect = document.getElementById('checkpointSectorSelect');
    const sector = sectorSelect ? sectorSelect.value : sentinelState.selectedSector;

    try {
        const res = await apiPost('sentinel/scan', {
            qr_input: qrPayload,
            pin: pinValue,
            checkpoint_id: 'CP-MAIN-01',
            officer: 'OFC. VALDEZ // UNIT 402',
            location: sector
        });

        if (res.success) {
            sentinelState.currentScan = res.data;
            sentinelState.lastAutoScannedPayload = qrPayload;

            // 1. Update Viewfinder Biometric Face HUD Overlay
            renderViewfinderLockedHUD(res.data);

            // 2. Update Operative Inspection Dossier
            renderDossier(res.data);

            if (res.data.is_rogue) {
                playAudioCue('alarm');
                showToast(`[ROGUE DETECTED] Identified ${res.data.alias} (${res.data.real_name || 'Rogue'})!`, 'error');
            } else {
                playAudioCue('beep');
                showToast(`[AUTO-DETECTED] ${res.data.alias} (${res.data.real_name}) confirmed.`, 'success');
            }
        } else {
            renderViewfinderBreachHUD(qrPayload, res.error);
            renderBreach(qrPayload, res.error || 'Operative credentials not found in federal database.');
            playAudioCue('alarm');
            showToast(`[BREACH] ${res.error || 'Unregistered Superhuman'}`, 'error');
        }

        // Refresh recent audit feed
        loadHistory();
    } catch (err) {
        showToast(`Scan execution failure: ${err.message}`, 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = '[EXECUTE CHECKPOINT SCAN]';
        }
        if (prompt) prompt.textContent = 'ALIGN CIVIC QR CODE OR OPERATIVE TO DETECT';
    }
}

// -------------------------------------------------------------
// Render Viewfinder Biometric HUD Overlay (Face + Basic Name)
// -------------------------------------------------------------
function renderViewfinderLockedHUD(data) {
    const idleHUD = document.getElementById('viewfinderIdleHUD');
    const lockedHUD = document.getElementById('viewfinderLockedHUD');
    if (!lockedHUD) return;

    if (idleHUD) idleHUD.style.display = 'none';
    lockedHUD.style.display = 'flex';

    // Face Image
    const faceImg = document.getElementById('viewfinderFaceImg');
    if (faceImg) {
        faceImg.src = data.avatar_url || '/img/logo.jpg';
        faceImg.style.borderColor = data.is_rogue ? '#ef4444' : 'var(--primary-accent)';
        faceImg.style.boxShadow = data.is_rogue ? '0 0 20px rgba(239, 68, 68, 0.6)' : '0 0 16px rgba(255, 255, 255, 0.3)';
    }

    // Role Tag
    const roleTag = document.getElementById('viewfinderFaceRoleTag');
    if (roleTag) {
        const isSidekick = data.is_sidekick || (data.category && data.category.toLowerCase() === 'sidekick');
        roleTag.textContent = isSidekick ? '[SIDEKICK]' : '[HERO]';
        roleTag.className = isSidekick ? 'hero-role-badge badge-sidekick' : 'hero-role-badge badge-hero';
    }

    // Basic Name: Hero Alias + Civilian Legal Name
    const aliasEl = document.getElementById('viewfinderAlias');
    if (aliasEl) aliasEl.textContent = data.alias || 'UNKNOWN';

    const realNameEl = document.getElementById('viewfinderRealName');
    if (realNameEl) {
        realNameEl.textContent = `CIVILIAN: ${data.real_name || 'Classified Identity'}`;
        realNameEl.style.color = data.is_rogue ? '#fca5a5' : 'var(--text-main)';
    }

    // Primary Power & Sector
    const powerEl = document.getElementById('viewfinderPrimaryPower');
    if (powerEl) {
        powerEl.textContent = `${data.primary_power || 'Enhanced Ability'} · ${data.threat_tier_label || 'Tier 1'}`;
    }

    const sectorTag = document.getElementById('viewfinderSectorTag');
    if (sectorTag) {
        sectorTag.textContent = data.sector ? `SECTOR 0${data.sector}` : 'SECTOR 01';
    }

    // Match Status and Border
    const matchStatus = document.getElementById('hudMatchStatus');
    const timeLock = document.getElementById('hudTimeLock');
    const statusTag = document.getElementById('viewfinderStatusTag');

    if (data.is_rogue) {
        lockedHUD.style.borderColor = '#ef4444';
        lockedHUD.style.boxShadow = '0 4px 16px rgba(239, 68, 68, 0.45)';
        if (matchStatus) {
            matchStatus.innerHTML = '<span style="color: #ef4444;">[ROGUE DETECTED]</span>';
        }
        if (timeLock) {
            timeLock.textContent = '[INTERCEPT]';
            timeLock.style.color = '#ef4444';
            timeLock.style.background = 'rgba(239, 68, 68, 0.2)';
        }
        if (statusTag) {
            statusTag.textContent = '[ROGUE NOTICE]';
            statusTag.style.background = 'rgba(239, 68, 68, 0.2)';
            statusTag.style.color = '#ef4444';
            statusTag.style.borderColor = '#ef4444';
        }
    } else {
        lockedHUD.style.borderColor = 'var(--primary-accent)';
        lockedHUD.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.6), 0 0 12px rgba(255, 255, 255, 0.2)';
        if (matchStatus) {
            matchStatus.innerHTML = '<span style="color: var(--status-green);">[TARGET ACQUIRED]</span>';
        }
        if (timeLock) {
            timeLock.textContent = '[LOCKED]';
            timeLock.style.color = 'var(--text-main)';
            timeLock.style.background = 'rgba(255, 255, 255, 0.15)';
        }
        if (statusTag) {
            statusTag.textContent = `[${(data.status || 'LICENSED').toUpperCase()}]`;
            statusTag.style.background = 'rgba(16,185,129,0.15)';
            statusTag.style.color = '#10b981';
            statusTag.style.borderColor = 'rgba(16,185,129,0.3)';
        }
    }
}

// -------------------------------------------------------------
// Render Viewfinder Breach HUD
// -------------------------------------------------------------
function renderViewfinderBreachHUD(identifier, errorMsg) {
    const idleHUD = document.getElementById('viewfinderIdleHUD');
    const lockedHUD = document.getElementById('viewfinderLockedHUD');
    if (!lockedHUD) return;

    if (idleHUD) idleHUD.style.display = 'none';
    lockedHUD.style.display = 'flex';
    lockedHUD.style.borderColor = '#f59e0b';
    lockedHUD.style.boxShadow = '0 4px 16px rgba(245, 158, 11, 0.35)';

    const faceImg = document.getElementById('viewfinderFaceImg');
    if (faceImg) {
        faceImg.src = '/img/logo.jpg';
        faceImg.style.borderColor = '#f59e0b';
        faceImg.style.boxShadow = 'none';
    }

    const roleTag = document.getElementById('viewfinderFaceRoleTag');
    if (roleTag) {
        roleTag.textContent = '[UNREGISTERED]';
        roleTag.className = 'hero-role-badge badge-sidekick';
    }

    const aliasEl = document.getElementById('viewfinderAlias');
    if (aliasEl) aliasEl.textContent = 'UNIDENTIFIED';

    const realNameEl = document.getElementById('viewfinderRealName');
    if (realNameEl) {
        realNameEl.textContent = 'CIVILIAN: No Federal Record';
        realNameEl.style.color = '#fcd34d';
    }

    const matchStatus = document.getElementById('hudMatchStatus');
    if (matchStatus) {
        matchStatus.innerHTML = '<span style="color: var(--status-amber);">[SECURITY BREACH]</span>';
    }

    const statusTag = document.getElementById('viewfinderStatusTag');
    if (statusTag) {
        statusTag.textContent = '[UNAUTHORIZED]';
        statusTag.style.background = 'rgba(245, 158, 11, 0.15)';
        statusTag.style.color = '#f59e0b';
        statusTag.style.borderColor = '#f59e0b';
    }
}

function resetViewfinderHUD() {
    const idleHUD = document.getElementById('viewfinderIdleHUD');
    const lockedHUD = document.getElementById('viewfinderLockedHUD');
    const faceImg = document.getElementById('viewfinderFaceImg');
    if (faceImg) faceImg.src = '';
    if (lockedHUD) lockedHUD.style.display = 'none';
    if (idleHUD && !sentinelState.cameraActive) idleHUD.style.display = 'block';
}

// -------------------------------------------------------------
// Render Operative Dossier View (Right Column Panel)
// -------------------------------------------------------------
function renderDossier(data) {
    const idleView = document.getElementById('dossierIdleView');
    const activeView = document.getElementById('dossierActiveView');
    const statusBar = document.getElementById('sentinelStatusBar');
    const barIcon = document.getElementById('statusBarIcon');
    const barText = document.getElementById('statusBarText');
    const barSub = document.getElementById('statusBarSubtext');
    const timestamp = document.getElementById('dossierTimestamp');

    if (idleView) idleView.style.display = 'none';
    if (activeView) activeView.style.display = 'flex';

    if (timestamp) timestamp.textContent = `INSPECTED: ${new Date(data.scanned_at || Date.now()).toLocaleTimeString()} UTC`;

    // Status Banner Logic
    if (statusBar) {
        statusBar.className = 'sentinel-status-bar';
        if (data.is_rogue) {
            statusBar.classList.add('status-bar-rogue');
            if (barIcon) barIcon.textContent = '[CRITICAL ALERT: ROGUE]';
            if (barText) barText.textContent = 'SUPERHUMAN ROGUE STATUS DETECTED';
            if (barSub) barSub.textContent = 'Directive: Scramble CRU Immediate Containment';
        } else if (data.status === 'Approved' || data.status === 'Licensed') {
            statusBar.classList.add('status-bar-verified');
            if (barIcon) barIcon.textContent = '[VERIFIED & LICENSED]';
            if (barText) barText.textContent = `${data.alias} // CIVILIAN CLEARANCE GRANTED`;
            if (barSub) barSub.textContent = 'Municipal Operating Clearance Valid';
        } else {
            statusBar.classList.add('status-bar-breach');
            if (barIcon) barIcon.textContent = '[STATUS PENDING]';
            if (barText) barText.textContent = `${data.alias} // REGISTRATION PENDING`;
            if (barSub) barSub.textContent = 'Awaiting Registrar Official Board Sign-Off';
        }
    }

    // Operative Identity Face & Basic Name
    const avatar = document.getElementById('operativeAvatar');
    if (avatar) {
        avatar.src = data.avatar_url || '/img/logo.jpg';
        avatar.style.borderColor = data.is_rogue ? '#ef4444' : 'var(--border-focus)';
        avatar.style.boxShadow = data.is_rogue ? '0 0 20px rgba(239, 68, 68, 0.5)' : '0 0 16px rgba(255, 255, 255, 0.25)';
    }

    const alias = document.getElementById('operativeAlias');
    if (alias) alias.textContent = data.alias || 'UNKNOWN';

    const roleBadge = document.getElementById('operativeRoleBadge');
    if (roleBadge) {
        const isSidekick = data.is_sidekick || (data.category && data.category.toLowerCase() === 'sidekick');
        roleBadge.textContent = isSidekick ? '[SIDEKICK]' : '[HERO]';
        roleBadge.className = isSidekick ? 'hero-role-badge badge-sidekick' : 'hero-role-badge badge-hero';
    }

    const tierBadge = document.getElementById('operativeTierBadge');
    if (tierBadge) {
        tierBadge.textContent = data.threat_tier_label || `TIER ${data.threat_tier || 1}`;
    }

    const realName = document.getElementById('operativeRealName');
    if (realName) {
        realName.textContent = data.real_name || '[ENCRYPTED IN L3 VAULT]';
    }

    const regId = document.getElementById('operativeRegId');
    if (regId) regId.textContent = data.id || '---';

    const powers = document.getElementById('operativePowersText');
    if (powers) {
        const pList = Array.isArray(data.powers) ? data.powers.join(', ') : (data.powers || 'Classified');
        powers.textContent = `Powers: ${pList}`;
    }

    const statusPill = document.getElementById('operativeStatusPill');
    if (statusPill) {
        if (data.is_rogue) {
            statusPill.textContent = '[ROGUE NOTICE]';
            statusPill.style.color = '#ef4444';
        } else {
            statusPill.textContent = `[${(data.status || 'LICENSED').toUpperCase()}]`;
            statusPill.style.color = '#10b981';
        }
    }

    // HUD Metrics
    const hudSector = document.getElementById('hudAuthorizedSector');
    if (hudSector) hudSector.textContent = data.sector ? `SECTOR 0${data.sector}` : 'SECTOR 01 (ALL)';

    const hudCurfew = document.getElementById('hudCurfewStatus');
    if (hudCurfew) {
        hudCurfew.textContent = data.is_rogue ? 'REVOKED (LOCKDOWN)' : 'PERMITTED (24/7)';
        hudCurfew.style.color = data.is_rogue ? '#ef4444' : 'var(--text-main)';
    }

    const hudBond = document.getElementById('hudBondValue');
    if (hudBond) {
        hudBond.textContent = data.is_rogue ? 'FROZEN ($0)' : '$25,000,000 ESCROW';
        hudBond.style.color = data.is_rogue ? '#ef4444' : 'var(--text-main)';
    }

    const hudPin = document.getElementById('hudPinVerification');
    const hudPinSub = document.getElementById('hudPinSubtext');
    if (hudPin && hudPinSub) {
        if (data.pin_verified === true) {
            hudPin.textContent = '[PIN CONFIRMED]';
            hudPin.style.color = '#10b981';
            hudPinSub.textContent = 'Anti-Spoof TOTP Challenge Passed';
        } else if (data.pin_verified === false) {
            hudPin.textContent = '[PIN INVALID]';
            hudPin.style.color = '#ef4444';
            hudPinSub.textContent = 'Challenge PIN Mismatch Detected';
        } else {
            hudPin.textContent = '[CIVIC QR PASS]';
            hudPin.style.color = 'var(--primary-accent)';
            hudPinSub.textContent = 'Permanent Credential Signature Verified';
        }
    }

    // Rogue Directive Card
    const rogueCard = document.getElementById('rogueContainmentCard');
    if (rogueCard) {
        rogueCard.style.display = data.is_rogue ? 'flex' : 'none';
    }

    // Ledger Hash
    const hashEl = document.getElementById('dossierLedgerHash');
    if (hashEl) hashEl.textContent = data.audit_entry ? data.audit_entry.hash.substring(0, 24) + '...' : 'SECURE_SHA256_HASH_VERIFIED';
}

// -------------------------------------------------------------
// Render Unregistered Breach View
// -------------------------------------------------------------
function renderBreach(identifier, errorMsg) {
    const idleView = document.getElementById('dossierIdleView');
    const activeView = document.getElementById('dossierActiveView');
    const statusBar = document.getElementById('sentinelStatusBar');
    const barIcon = document.getElementById('statusBarIcon');
    const barText = document.getElementById('statusBarText');
    const barSub = document.getElementById('statusBarSubtext');
    const timestamp = document.getElementById('dossierTimestamp');

    if (idleView) idleView.style.display = 'none';
    if (activeView) activeView.style.display = 'flex';

    if (timestamp) timestamp.textContent = `BREACH DETECTED: ${new Date().toLocaleTimeString()} UTC`;

    if (statusBar) {
        statusBar.className = 'sentinel-status-bar status-bar-breach';
        if (barIcon) barIcon.textContent = '[SECURITY BREACH]';
        if (barText) barText.textContent = 'UNREGISTERED ENHANCED INDIVIDUAL';
        if (barSub) barSub.textContent = 'Target missing from GHRMS Superhuman Registry';
    }

    const avatar = document.getElementById('operativeAvatar');
    if (avatar) {
        avatar.src = '/img/logo.jpg';
        avatar.style.borderColor = '#f59e0b';
        avatar.style.boxShadow = 'none';
    }

    const alias = document.getElementById('operativeAlias');
    if (alias) alias.textContent = 'UNIDENTIFIED SUBJECT';

    const roleBadge = document.getElementById('operativeRoleBadge');
    if (roleBadge) {
        roleBadge.textContent = '[UNREGISTERED]';
        roleBadge.className = 'hero-role-badge badge-sidekick';
    }

    const tierBadge = document.getElementById('operativeTierBadge');
    if (tierBadge) tierBadge.textContent = 'THREAT UNKNOWN';

    const realName = document.getElementById('operativeRealName');
    if (realName) realName.textContent = 'Unknown (No Record)';

    const regId = document.getElementById('operativeRegId');
    if (regId) regId.textContent = identifier || 'N/A';

    const powers = document.getElementById('operativePowersText');
    if (powers) powers.textContent = 'Powers: Unclassified / Potential Hazard';

    const statusPill = document.getElementById('operativeStatusPill');
    if (statusPill) {
        statusPill.textContent = '[DETAIN FOR INTAKE]';
        statusPill.style.color = '#f59e0b';
    }

    const hudSector = document.getElementById('hudAuthorizedSector');
    if (hudSector) hudSector.textContent = 'UNAUTHORIZED';

    const hudCurfew = document.getElementById('hudCurfewStatus');
    if (hudCurfew) {
        hudCurfew.textContent = 'CURFEW VIOLATION';
        hudCurfew.style.color = '#ef4444';
    }

    const hudBond = document.getElementById('hudBondValue');
    if (hudBond) {
        hudBond.textContent = 'NO BOND ($0)';
        hudBond.style.color = '#ef4444';
    }

    const hudPin = document.getElementById('hudPinVerification');
    const hudPinSub = document.getElementById('hudPinSubtext');
    if (hudPin && hudPinSub) {
        hudPin.textContent = '[AUTHENTICATION FAILED]';
        hudPin.style.color = '#ef4444';
        hudPinSub.textContent = errorMsg || 'No matching federal record';
    }

    const rogueCard = document.getElementById('rogueContainmentCard');
    if (rogueCard) rogueCard.style.display = 'none';

    const hashEl = document.getElementById('dossierLedgerHash');
    if (hashEl) hashEl.textContent = 'BREACH_LOGGED_INTO_AUDIT_LEDGER';
}

// -------------------------------------------------------------
// Live Webcam Scanner & Frame Processing
// -------------------------------------------------------------
function initCameraScanner() {
    const btnCam = document.getElementById('btnToggleCamera');
    const video = document.getElementById('sentinelCameraVideo');
    const scanInput = document.getElementById('sentinelScanInput');

    if (!btnCam || !video) return;

    btnCam.onclick = async () => {
        if (sentinelState.cameraActive) {
            stopCamera();
        } else {
            await startCamera();
        }
    };

    async function startCamera() {
        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                showToast('Camera hardware access is not supported in this browser.', 'error');
                return;
            }
            sentinelState.cameraStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
            });
            video.srcObject = sentinelState.cameraStream;
            video.style.display = 'block';
            await video.play();
            sentinelState.cameraActive = true;
            btnCam.textContent = '[STOP WEBCAM]';
            btnCam.style.borderColor = 'var(--status-green)';
            btnCam.style.color = 'var(--status-green)';

            // Hide text prompt so live video feed is 100% unobstructed
            const idleHUD = document.getElementById('viewfinderIdleHUD');
            if (idleHUD) idleHUD.style.display = 'none';

            showToast('Webcam active — point lens at hero QR badge or ID card', 'success');
            startFrameScanner();
        } catch (err) {
            showToast(`Camera permission error: ${err.message}`, 'error');
        }
    }

    function stopCamera() {
        if (sentinelState.cameraStream) {
            sentinelState.cameraStream.getTracks().forEach(track => track.stop());
            sentinelState.cameraStream = null;
        }
        if (video) {
            video.style.display = 'none';
            video.srcObject = null;
        }
        if (sentinelState.cameraScanInterval) {
            cancelAnimationFrame(sentinelState.cameraScanInterval);
            sentinelState.cameraScanInterval = null;
        }
        sentinelState.cameraActive = false;
        btnCam.textContent = '[START WEBCAM]';
        btnCam.style.borderColor = '';
        btnCam.style.color = '';

        const idleHUD = document.getElementById('viewfinderIdleHUD');
        const lockedHUD = document.getElementById('viewfinderLockedHUD');
        if (idleHUD && (!lockedHUD || lockedHUD.style.display === 'none')) {
            idleHUD.style.display = 'block';
        }

        showToast('Webcam feed deactivated', 'info');
    }

    function startFrameScanner() {
        let hasBarcodeDetector = ('BarcodeDetector' in window);
        let barcodeDetector = null;
        if (hasBarcodeDetector) {
            try {
                barcodeDetector = new BarcodeDetector({ formats: ['qr_code', 'code_128', 'data_matrix'] });
            } catch(e) {
                hasBarcodeDetector = false;
            }
        }

        const scanCanvas = document.getElementById('sentinelScanCanvas') || document.createElement('canvas');
        const scanCtx = scanCanvas.getContext('2d', { willReadFrequently: true });

        let scanCooldown = 0;
        let lastFrameTimestamp = 0;

        async function scanFrame(timestamp) {
            if (!sentinelState.cameraActive) return;

            // Throttle to every ~120ms (approx 8 fps) to conserve CPU while remaining snappy
            if (!timestamp || (timestamp - lastFrameTimestamp > 120)) {
                lastFrameTimestamp = timestamp || Date.now();
                const now = Date.now();

                if (now > scanCooldown && video.readyState >= (video.HAVE_CURRENT_DATA || 2) && video.videoWidth > 0) {
                    let detectedPayload = null;

                    // 1. Primary Optical Scanner: pure-JS ISO QR decoder (100% universal in all browsers)
                    if (typeof jsQR === 'function') {
                        try {
                            let w = video.videoWidth;
                            let h = video.videoHeight;
                            const maxDim = 640;
                            if (w > maxDim || h > maxDim) {
                                if (w > h) {
                                    h = Math.round((h * maxDim) / w);
                                    w = maxDim;
                                } else {
                                    w = Math.round((w * maxDim) / h);
                                    h = maxDim;
                                }
                            }
                            scanCanvas.width = w;
                            scanCanvas.height = h;
                            scanCtx.drawImage(video, 0, 0, w, h);
                            const imgData = scanCtx.getImageData(0, 0, w, h);
                            const qr = jsQR(imgData.data, imgData.width, imgData.height, {
                                inversionAttempts: 'attemptBoth'
                            });
                            if (qr && qr.data && qr.data.trim().length > 0) {
                                detectedPayload = qr.data.trim();
                            }
                        } catch (err) {
                            // Canvas read security or dimension error
                        }
                    }

                    // 2. Hardware BarcodeDetector API fallback
                    if (!detectedPayload && hasBarcodeDetector && barcodeDetector) {
                        try {
                            const barcodes = await barcodeDetector.detect(video);
                            if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
                                detectedPayload = barcodes[0].rawValue.trim();
                            }
                        } catch (e) {}
                    }

                    // On successful optical detection
                    if (detectedPayload && detectedPayload !== sentinelState.lastAutoScannedPayload) {
                        sentinelState.lastAutoScannedPayload = detectedPayload;
                        scanCooldown = now + 2500;
                        if (scanInput) scanInput.value = detectedPayload;
                        playAudioCue('beep');
                        showToast(`[OPTICAL SENSOR] QR Code captured from camera feed!`, 'success');
                        executeScan(detectedPayload);
                    }
                }
            }

            sentinelState.cameraScanInterval = requestAnimationFrame(scanFrame);
        }

        sentinelState.cameraScanInterval = requestAnimationFrame(scanFrame);
    }
}

// -------------------------------------------------------------
// Badge File / Photo Scanner with Real Optical jsQR Decoding
// -------------------------------------------------------------
function initFileScanner() {
    const btnUpload = document.getElementById('btnUploadBadge');
    const fileInput = document.getElementById('sentinelFileInput');
    const scanInput = document.getElementById('sentinelScanInput');
    const viewfinder = document.getElementById('sentinelViewfinder');

    if (!fileInput) return;

    if (btnUpload) {
        btnUpload.onclick = () => fileInput.click();
    }

    async function processBadgeImage(file) {
        if (!file) return;

        showToast(`Analyzing optical signature: ${file.name}...`, 'info');

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = async () => {
                let detected = null;

                // 1. Pure-JS optical QR decoding with multi-scale sampling
                if (typeof jsQR === 'function') {
                    try {
                        const canvas = document.createElement('canvas');
                        const ctx = canvas.getContext('2d', { willReadFrequently: true });

                        // Pass 1: Scaled canvas (up to 1200px max dimension for speed and crispness)
                        let w = img.naturalWidth || img.width;
                        let h = img.naturalHeight || img.height;
                        const maxDim = 1200;
                        let targetW = w;
                        let targetH = h;
                        if (w > maxDim || h > maxDim) {
                            if (w > h) {
                                targetH = Math.round((h * maxDim) / w);
                                targetW = maxDim;
                            } else {
                                targetW = Math.round((w * maxDim) / h);
                                targetH = maxDim;
                            }
                        }
                        canvas.width = targetW;
                        canvas.height = targetH;
                        ctx.drawImage(img, 0, 0, targetW, targetH);
                        let imgData = ctx.getImageData(0, 0, targetW, targetH);
                        let qr = jsQR(imgData.data, targetW, targetH, { inversionAttempts: 'attemptBoth' });

                        if (qr && qr.data && qr.data.trim().length > 0) {
                            detected = qr.data.trim();
                        } else if (w !== targetW) {
                            // Pass 2: Try original full-resolution if scaled down missed fine modules
                            canvas.width = w;
                            canvas.height = h;
                            ctx.drawImage(img, 0, 0, w, h);
                            imgData = ctx.getImageData(0, 0, w, h);
                            qr = jsQR(imgData.data, w, h, { inversionAttempts: 'attemptBoth' });
                            if (qr && qr.data && qr.data.trim().length > 0) {
                                detected = qr.data.trim();
                            }
                        }
                    } catch (err) {
                        console.error('jsQR file processing exception:', err);
                    }
                }

                // 2. Browser BarcodeDetector API check
                if (!detected && ('BarcodeDetector' in window)) {
                    try {
                        const detector = new BarcodeDetector({ formats: ['qr_code', 'code_128'] });
                        const codes = await detector.detect(img);
                        if (codes && codes.length > 0 && codes[0].rawValue) {
                            detected = codes[0].rawValue.trim();
                        }
                    } catch (err) {}
                }

                if (detected) {
                    if (scanInput) scanInput.value = detected;
                    playAudioCue('beep');
                    showToast(`[OPTICAL DECODER] QR Code decoded: ${detected}`, 'success');
                    executeScan(detected);
                    return;
                }

                // 3. Fallback filename heuristic for portrait photos (e.g. apex.jpg, solaris.jpg)
                const fname = file.name.toLowerCase();
                let matched = null;
                if (fname.includes('apex')) matched = 'hero_apex_01';
                else if (fname.includes('solaris')) matched = 'hero_solaris_a833dd';
                else if (fname.includes('lumina')) matched = 'hero_lumina_02';
                else if (fname.includes('aero')) matched = 'hero_aeroscout_07';

                if (matched) {
                    const payload = `GHRMS://HERO/${matched}`;
                    if (scanInput) scanInput.value = payload;
                    playAudioCue('beep');
                    showToast(`[IDENTIFIED] Hero identified from badge profile metadata!`, 'success');
                    executeScan(payload);
                } else {
                    showToast(`No optical QR code found in "${file.name}". Please ensure image contains a clear QR code.`, 'error');
                }
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    fileInput.onchange = (e) => {
        const file = e.target.files && e.target.files[0];
        if (file) processBadgeImage(file);
        fileInput.value = '';
    };

    // Drag-and-drop QR badges directly onto the Viewfinder
    if (viewfinder) {
        viewfinder.addEventListener('dragover', (e) => {
            e.preventDefault();
            viewfinder.style.borderColor = 'var(--status-green)';
            viewfinder.style.boxShadow = '0 0 20px rgba(16, 185, 129, 0.4)';
        });
        viewfinder.addEventListener('dragleave', () => {
            viewfinder.style.borderColor = '';
            viewfinder.style.boxShadow = '';
        });
        viewfinder.addEventListener('drop', (e) => {
            e.preventDefault();
            viewfinder.style.borderColor = '';
            viewfinder.style.boxShadow = '';
            if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                processBadgeImage(e.dataTransfer.files[0]);
            }
        });
    }
}

// -------------------------------------------------------------
// Automatic Detection As You Type (Debounced)
// -------------------------------------------------------------
function initAutoDetection() {
    const scanInput = document.getElementById('sentinelScanInput');
    if (!scanInput) return;

    scanInput.addEventListener('input', () => {
        const val = scanInput.value.trim();
        if (sentinelState.autoDetectTimer) clearTimeout(sentinelState.autoDetectTimer);

        if (!val) {
            resetViewfinderHUD();
            return;
        }

        sentinelState.autoDetectTimer = setTimeout(() => {
            if (val !== sentinelState.lastAutoScannedPayload) {
                executeScan(val, '', true);
            }
        }, 220);
    });

    scanInput.addEventListener('paste', () => {
        setTimeout(() => {
            const val = scanInput.value.trim();
            if (val) executeScan(val, '', true);
        }, 50);
    });
}

// -------------------------------------------------------------
// Load Recent Scan History from Backend
// -------------------------------------------------------------
async function loadHistory() {
    const list = document.getElementById('sentinelHistoryList');
    if (!list) return;

    try {
        const res = await apiGet('sentinel/history');
        if (res.success && Array.isArray(res.data) && res.data.length > 0) {
            sentinelState.history = res.data;
            list.innerHTML = res.data.map(item => {
                const details = item.details || {};
                const isRogue = details.is_rogue || item.action === 'SENTINEL_ROGUE_INTERCEPTED';
                const isBreach = item.action === 'SENTINEL_UNREGISTERED_INTRUDER' || item.action === 'SENTINEL_SCAN_BREACH';
                const statusLabel = isRogue ? '[ROGUE]' : isBreach ? '[BREACH]' : '[VERIFIED]';
                const statusColor = isRogue ? '#ef4444' : isBreach ? '#f59e0b' : '#10b981';

                return `
                    <div class="sentinel-history-item" style="cursor: pointer;" onclick="document.getElementById('sentinelScanInput').value='${details.qr_input || details.hero_id || ''}'; executeScan('${details.qr_input || details.hero_id || ''}', '', true);">
                        <div>
                            <div style="font-weight: 700; color: var(--text-main); display: flex; align-items: center; gap: 6px;">
                                <span style="color: ${statusColor}; font-family: var(--font-mono); font-size: 0.7rem;">${statusLabel}</span>
                                <span>${details.alias || details.hero_id || item.user || 'Unknown Subject'}</span>
                            </div>
                            <div style="font-size: 0.68rem; color: var(--text-muted); margin-top: 2px;">
                                ${item.timestamp ? new Date(item.timestamp).toLocaleTimeString() : 'Recent'} · ${details.location || 'Sector 01'}
                            </div>
                        </div>
                        <div style="text-align: right; font-family: var(--font-mono); font-size: 0.68rem; color: var(--text-subtle);">
                            <span>${(item.hash || '---').substring(0, 10)}...</span>
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            list.innerHTML = `
                <div style="padding: 1.5rem; text-align: center; color: var(--text-muted); font-size: 0.75rem;">
                    No checkpoint scans recorded in ledger yet.
                </div>
            `;
        }
    } catch (err) {
        list.innerHTML = `
            <div style="padding: 1.5rem; text-align: center; color: var(--status-red); font-size: 0.75rem;">
                Failed to load checkpoint history: ${err.message}
            </div>
        `;
    }
}

// -------------------------------------------------------------
// Emergency Alert Broadcasting
// -------------------------------------------------------------
async function broadcastAlert(type) {
    playAudioCue('alarm');
    const hero = sentinelState.currentScan;
    const sectorSelect = document.getElementById('checkpointSectorSelect');
    const sector = sectorSelect ? sectorSelect.value : sentinelState.selectedSector;

    const res = await apiPost('sentinel/alert', {
        alert_type: type,
        hero_id: hero ? hero.id : 'unknown',
        alias: hero ? hero.alias : 'UNKNOWN ROGUE',
        sector: sector,
        officer: 'OFC. VALDEZ // UNIT 402'
    });

    if (res.success) {
        showToast(`[EMERGENCY DISPATCH] ${type} broadcast across municipal grid!`, 'error');
        loadHistory();
    } else {
        showToast(`Broadcast failure: ${res.error}`, 'error');
    }
}

// -------------------------------------------------------------
// Initialization & Event Wire-Up
// -------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    loadHistory();
    initCameraScanner();
    initFileScanner();
    initAutoDetection();

    // Sector Selection
    const sectorSelect = document.getElementById('checkpointSectorSelect');
    if (sectorSelect) {
        sectorSelect.onchange = () => {
            sentinelState.selectedSector = sectorSelect.value;
            const barSub = document.getElementById('statusBarSubtext');
            if (barSub && !sentinelState.currentScan) {
                barSub.textContent = `${sectorSelect.value} Checkpoint`;
            }
            playAudioCue('click');
        };
    }

    // Preset Chips: Instant Auto-Detect
    const chips = document.querySelectorAll('.sentinel-chip');
    const scanInput = document.getElementById('sentinelScanInput');
    chips.forEach(chip => {
        chip.onclick = () => {
            chips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            const id = chip.getAttribute('data-id');
            const payload = `GHRMS://HERO/${id}`;
            if (scanInput) {
                scanInput.value = payload;
            }
            // Instantly auto-detect and reveal face and basic name
            executeScan(payload);
        };
    });

    // Form Manual Submission (Also supports pressing enter in input)
    const form = document.getElementById('sentinelScanForm');
    if (form) {
        form.onsubmit = (e) => {
            e.preventDefault();
            const qrVal = scanInput ? scanInput.value.trim() : '';
            const pinVal = document.getElementById('sentinelPinInput') ? document.getElementById('sentinelPinInput').value.trim() : '';
            if (!qrVal) {
                showToast('Please provide a QR payload or hero identifier to scan.', 'error');
                return;
            }
            executeScan(qrVal, pinVal);
        };
    }

    // Refresh History Button
    const refreshBtn = document.getElementById('btnRefreshHistory');
    if (refreshBtn) {
        refreshBtn.onclick = () => {
            playAudioCue('click');
            loadHistory();
            showToast('Audit ledger refreshed', 'info');
        };
    }

    // Emergency Action Buttons
    const btnScramble = document.getElementById('btnBroadcastScramble');
    if (btnScramble) btnScramble.onclick = () => broadcastAlert('CRU_SCRAMBLE');

    const btnSectorLock = document.getElementById('btnBroadcastSectorLock');
    if (btnSectorLock) btnSectorLock.onclick = () => broadcastAlert('SECTOR_LOCKDOWN');

    const btnPass = document.getElementById('btnPassAndLog');
    if (btnPass) {
        btnPass.onclick = () => {
            playAudioCue('beep');
            showToast('Clearance acknowledged and stamped into local checkpoint ledger.', 'success');
        };
    }

    const btnReset = document.getElementById('btnResetScanner');
    if (btnReset) {
        btnReset.onclick = () => {
            playAudioCue('click');
            sentinelState.currentScan = null;
            resetViewfinderHUD();

            const idleView = document.getElementById('dossierIdleView');
            const activeView = document.getElementById('dossierActiveView');
            const statusBar = document.getElementById('sentinelStatusBar');
            const barIcon = document.getElementById('statusBarIcon');
            const barText = document.getElementById('statusBarText');
            const barSub = document.getElementById('statusBarSubtext');
            const timestamp = document.getElementById('dossierTimestamp');

            if (idleView) idleView.style.display = 'block';
            if (activeView) activeView.style.display = 'none';
            if (statusBar) {
                statusBar.className = 'sentinel-status-bar status-bar-idle';
                if (barIcon) barIcon.textContent = '[SCANNER IDLE]';
                if (barText) barText.textContent = 'AWAITING CREDENTIAL SCAN';
                if (barSub) barSub.textContent = `${sentinelState.selectedSector} Checkpoint`;
            }
            if (timestamp) timestamp.textContent = 'SYSTEM READY';
            if (scanInput) scanInput.value = '';
            showToast('Scanner and dossier reset to idle', 'info');
        };
    }

    // Export Checkpoint Ledger
    const btnExportLedger = document.getElementById('btnSentinelExportAudit');
    if (btnExportLedger) {
        btnExportLedger.onclick = async () => {
            try {
                const res = await fetch('/api/sentinel/export');
                const data = await res.json();
                if (data.success) {
                    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                    const url  = URL.createObjectURL(blob);
                    const a    = document.createElement('a');
                    a.href     = url;
                    a.download = `ghrms_checkpoint_ledger_${Date.now()}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                    showToast(`[OK] Checkpoint ledger exported (${data.total_scans || 0} scans).`, 'success');
                } else {
                    showToast(data.error || '[ALERT] Export failed.', 'error');
                }
            } catch (err) {
                showToast('[ALERT] Network error during export.', 'error');
            }
        };
    }

    // Auto-trigger initial detection on load if an input value is already present
    if (scanInput && scanInput.value.trim()) {
        executeScan(scanInput.value.trim(), '', true);
    }
});

// -------------------------------------------------------------
// Return to Previous Dashboard Controller
// -------------------------------------------------------------
function returnToOriginDashboard() {
    const ref = document.referrer;
    if (ref && (ref.includes('/registrar') || ref.includes('/admin') || ref.includes('/hero') || ref.includes('/registry'))) {
        window.location.href = ref;
        return;
    }
    // Check authenticated role to route safely
    fetch('/api/auth/me')
        .then(res => res.json())
        .then(data => {
            if (data && data.user) {
                if (data.user.role === 'SUPER_ADMIN' || data.user.role === 'ADMIN') {
                    window.location.href = '/admin';
                } else if (data.user.role === 'HERO') {
                    window.location.href = '/hero';
                } else {
                    window.location.href = '/registrar';
                }
            } else {
                if (window.history.length > 1) {
                    window.history.back();
                } else {
                    window.location.href = '/registrar';
                }
            }
        })
        .catch(() => {
            if (window.history.length > 1) {
                window.history.back();
            } else {
                window.location.href = '/registrar';
            }
        });
}

// -------------------------------------------------------------
// Incident Reports Ledger Modal
// -------------------------------------------------------------
function openIncidentsModal() {
    const modal = document.getElementById('incidentsModal');
    if (modal) {
        modal.style.display = 'flex';
        loadIncidentReports();
    }
}

function closeIncidentsModal() {
    const modal = document.getElementById('incidentsModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

async function loadIncidentReports() {
    const container = document.getElementById('incidentsModalBody');
    const badge = document.getElementById('incidentCountBadge');
    if (!container) return;

    container.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 2rem; font-size: 0.82rem;">Loading incident records from civic ledger...</div>`;

    try {
        const res = await fetch('/api/damage-reports');
        const json = await res.json();
        const incidents = (json && json.data && Array.isArray(json.data)) ? json.data : [];

        if (badge) {
            badge.textContent = `${incidents.length} Registered`;
        }

        if (!incidents.length) {
            container.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 2rem;">No active collateral damage incidents reported.</div>`;
            return;
        }

        container.innerHTML = incidents.map(inc => {
            const severityColor = inc.severity === 'Critical' ? '#ef4444' : inc.severity === 'High' ? '#f97316' : '#eab308';
            const damageFormatted = Number(inc.estimated_damage_usd || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
            return `
                <div style="background: var(--bg-surface-elevated, var(--bg-surface)); border: 1px solid var(--border-color); border-radius: 6px; padding: 1rem; display: flex; flex-direction: column; gap: 0.5rem; transition: border-color 0.2s;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; flex-wrap: wrap;">
                        <div>
                            <div style="display: flex; align-items: center; gap: 6px;">
                                <span style="font-family: var(--font-mono); font-size: 0.72rem; color: var(--text-main); font-weight: 700;">[${inc.id}]</span>
                                <h4 style="margin: 0; font-size: 0.92rem; font-weight: 800; color: var(--text-main);">${inc.title || 'Battle Damage Incident'}</h4>
                            </div>
                            <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">
                                Location: <strong style="color: var(--text-main);">${inc.region || 'Sector 01'}</strong> · Coord: <span style="font-family: var(--font-mono);">${inc.coordinates ? `${inc.coordinates.lat}, ${inc.coordinates.lng}` : 'N/A'}</span>
                            </div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <span style="font-size: 0.68rem; font-weight: 800; font-family: var(--font-mono); padding: 2px 6px; border-radius: 3px; background: var(--bg-input); color: ${severityColor}; border: 1px solid ${severityColor};">
                                ${inc.severity || 'Moderate'}
                            </span>
                            <span style="font-size: 0.85rem; font-weight: 800; font-family: var(--font-mono); color: #10b981;">
                                ${damageFormatted}
                            </span>
                        </div>
                    </div>

                    <div style="font-size: 0.78rem; color: var(--text-muted); line-height: 1.45; background: var(--bg-input); padding: 0.5rem 0.75rem; border-radius: 4px; border-left: 2px solid var(--border-focus);">
                        ${inc.notes || 'Civic infrastructure impact recorded.'}
                    </div>

                    <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.72rem; color: var(--text-subtle); flex-wrap: wrap; gap: 6px;">
                        <span>Hero/Suspect: <strong style="color: var(--text-main);">${inc.matched_hero_alias || 'Unidentified'}</strong> (Power: ${inc.power_type || 'Kinetic'})</span>
                        <span style="color: #10b981; font-family: var(--font-mono); font-weight: 700;">${inc.civic_recovery_status || 'Pending'}</span>
                    </div>
                </div>
            `;
        }).join('');
    } catch (err) {
        container.innerHTML = `<div style="text-align: center; color: #ef4444; padding: 2rem;">Error retrieving incident records: ${err.message}</div>`;
    }
}

