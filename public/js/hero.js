/**
 * GHRMS Hero Portal Logic — Dedicated to /hero
 */

const heroState = {
    heroId: null,   // set from server session via auth/me
    hero: null,
    badgeTokenData: null,
    countdownInterval: null,
    theme: 'dark',
    hasPending: false
};

function initTheme() {
    const saved = localStorage.getItem('ghrms_theme') || localStorage.getItem('color-scheme') || 'dark';
    applyHeroTheme(saved);

    const btn = document.getElementById('themeToggleBtn');
    if (btn) {
        btn.onclick = () => {
            const current = heroState.theme || document.documentElement.getAttribute('data-theme') || 'dark';
            const next = current === 'dark' ? 'light' : 'dark';
            localStorage.setItem('ghrms_theme', next);
            localStorage.setItem('color-scheme', next);
            applyHeroTheme(next);
            showToast(`Theme switched to ${next} mode`, 'info');
        };
    }

    // Sync live when theme is changed in Admin (Role 3), Registrar (Role 2), or other tabs
    window.addEventListener('storage', (e) => {
        if (e.key === 'ghrms_theme' || e.key === 'color-scheme') {
            const next = e.newValue || 'dark';
            applyHeroTheme(next);
        }
    });
}

function applyHeroTheme(theme) {
    heroState.theme = theme;
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

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const ic = type === 'success' ? '[OK]' : type === 'error' ? '[ALERT]' : '[INFO]';
    toast.innerHTML = `<span style="font-weight: 700; font-size: 0.75rem;">${ic}</span> <span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        setTimeout(() => toast.remove(), 200);
    }, 3500);
}

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
// Auth — get session hero ID
// -------------------------------------------------------------
async function checkAuth() {
    try {
        const res = await apiGet('auth/me');
        if (res.success && res.authenticated && res.user) {
            heroState.heroId = res.user.hero_id || res.user.id || 'hero_apex_01';
            const headerAlias = document.getElementById('headerHeroAlias');
            if (headerAlias) headerAlias.textContent = res.user.name || res.user.alias || 'APEX';
            return;
        }
    } catch (e) {}
    window.location.href = '/login?redirect=' + encodeURIComponent(window.location.pathname);
}

// -------------------------------------------------------------
// View Mode vs. Edit Mode Toggler
// -------------------------------------------------------------
function setHeroEditMode(isEditing) {
    const viewEl = document.getElementById('heroInfoViewMode');
    const editEl = document.getElementById('heroUpdateForm');
    const toggleBtn = document.getElementById('btnToggleHeroEdit');
    if (isEditing) {
        if (viewEl) viewEl.style.display = 'none';
        if (editEl) editEl.style.display = 'block';
        if (toggleBtn) toggleBtn.textContent = 'VIEW RECORD';
    } else {
        if (viewEl) viewEl.style.display = 'block';
        if (editEl) editEl.style.display = 'none';
        if (toggleBtn) toggleBtn.textContent = 'EDIT RECORD';
    }
}

// -------------------------------------------------------------
// Load hero data
// -------------------------------------------------------------
async function loadHeroData() {
    if (!heroState.heroId) return;
    const res = await apiGet(`heroes/${heroState.heroId}`);
    if (res.success) {
        heroState.hero = res.data;
        updateHeroUI();
        await checkPendingUpdates();
    }
}

const TIER_LABELS = [
    'Tier 0 — Cosmic',
    'Tier 1 — Extreme',
    'Tier 2 — High',
    'Tier 3 — Moderate',
    'Tier 4 — Low',
    'Tier 5 — Street'
];

function updateHeroUI() {
    const hero = heroState.hero;
    if (!hero) return;

    const thumb       = document.getElementById('heroThumbAvatar');
    const title       = document.getElementById('heroAliasTitle');
    const subId       = document.getElementById('heroSubId');
    const headerAlias = document.getElementById('headerHeroAlias');

    const avatarUrl = hero.avatar || hero.profile_picture || '/img/apex.jpg';
    if (thumb) thumb.src = avatarUrl;
    const vwFaceImg = document.getElementById('vwHeroFaceImg');
    if (vwFaceImg) vwFaceImg.src = avatarUrl;
    const editFaceImg = document.getElementById('fldEditFacePreview');
    if (editFaceImg) editFaceImg.src = avatarUrl;
    const headerUserAvatar = document.querySelector('.header-user-badge .user-avatar-circle');
    if (headerUserAvatar) headerUserAvatar.src = avatarUrl;

    if (title) title.textContent = hero.alias;
    if (subId) {
        const licText = hero.status === 'Approved' || hero.status === 'Licensed'
            ? ` · [ACCREDITED: ${hero.license_number || 'Active'}]`
            : (hero.status === 'Revoked' ? ' · [LICENSE REVOKED]' : ` · [STATUS: ${hero.status?.toUpperCase() || 'UNKNOWN'}]`);
        subId.textContent = `${hero.alias} · ID: ${hero.id || hero.gov_code || ''}${licText}`;
    }
    if (headerAlias && !headerAlias.textContent) headerAlias.textContent = hero.alias;

    // Division & Mentorship Badge
    const roleBadgeEl = document.getElementById('heroRoleBadge');
    if (roleBadgeEl) {
        const isSidekick = (hero.role_tag === 'Sidekick') || !!hero.mentor;
        if (isSidekick) {
            roleBadgeEl.innerHTML = `
                <span style="font-size:0.68rem;padding:2px 8px;border-radius:4px;background:rgba(167,139,250,0.18);border:1px solid rgba(167,139,250,0.45);color:#c084fc;font-weight:800;letter-spacing:0.04em;">
                    [REGISTERED APPRENTICE / SIDEKICK]
                </span>
                <span style="font-size:0.72rem;color:var(--text-muted);">Supervised by: <strong style="color:var(--text-main);">${hero.mentor || 'Assigned Mentor'}</strong></span>
            `;
        } else {
            const sidekicksCount = (hero.sidekicks || []).length;
            const sidekicksTag = sidekicksCount > 0
                ? `<span style="font-size:0.72rem;color:var(--text-muted);">Sponsoring: <strong style="color:#34d399;">${hero.sidekicks.join(', ')}</strong></span>`
                : '';
            roleBadgeEl.innerHTML = `
                <span style="font-size:0.68rem;padding:2px 8px;border-radius:4px;background:rgba(255,255,255,0.1);border:1px solid var(--border-color);color:var(--text-main);font-weight:800;letter-spacing:0.04em;">
                    [PRIMARY HERO - INDEPENDENT]
                </span>
                ${sidekicksTag}
            `;
        }
    }

    // ─────────────────────────────────────────────────────────────
    // 7-Status Workflow Stepper & Registration Status Banner
    // ─────────────────────────────────────────────────────────────
    const track = document.getElementById('stepperProgressLine');
    const st1 = document.getElementById('stNode1');
    const st2 = document.getElementById('stNode2');
    const st3 = document.getElementById('stNode3');
    const st4 = document.getElementById('stNode4');
    const st5 = document.getElementById('stNode5');

    const statusBanner = document.getElementById('registrationStatusBanner');
    const resubmitBtn = document.getElementById('btnResubmitHeroApp');

    const currentStatus = hero.status || 'Submitted';

    // Reset nodes
    [st1, st2, st3, st4, st5].forEach(n => {
        if (n) n.className = 'stepper-step';
    });

    if (currentStatus === 'Draft') {
        if (track) track.style.width = '10%';
        if (st1) st1.className = 'stepper-step active';
        if (statusBanner) {
            statusBanner.style.display = 'block';
            statusBanner.style.background = 'rgba(59, 130, 246, 0.12)';
            statusBanner.style.border = '1px solid rgba(59, 130, 246, 0.4)';
            statusBanner.style.color = '#93c5fd';
            statusBanner.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                    <div>
                        <strong style="font-size: 0.88rem; display: block; margin-bottom: 2px;">📝 Application Saved as Draft</strong>
                        <span style="font-size: 0.78rem; color: var(--text-main);">Your hero registration intake is incomplete. Please finish adding your details and upload required credentials to submit for review.</span>
                    </div>
                    <a href="/register" class="btn-confirm-final" style="text-decoration: none; padding: 6px 14px; font-size: 0.75rem;">
                        Continue Registration Intake →
                    </a>
                </div>
            `;
        }
    } else if (currentStatus === 'Submitted') {
        if (track) track.style.width = '35%';
        if (st1) st1.className = 'stepper-step completed';
        if (st2) st2.className = 'stepper-step active';
        if (statusBanner) {
            statusBanner.style.display = 'block';
            statusBanner.style.background = 'rgba(234, 179, 8, 0.12)';
            statusBanner.style.border = '1px solid rgba(234, 179, 8, 0.4)';
            statusBanner.style.color = '#fde047';
            statusBanner.innerHTML = `
                <div style="display: flex; align-items: center; gap: 12px;">
                    <span style="font-size: 1.2rem;">⏳</span>
                    <div>
                        <strong style="font-size: 0.88rem; display: block; margin-bottom: 2px;">Application Submitted — Awaiting Registrar Intake</strong>
                        <span style="font-size: 0.78rem; color: var(--text-main);">Your registration packet is safely queued. An authorized Registrar Officer will evaluate your identity vault and superhuman specs shortly.</span>
                    </div>
                </div>
            `;
        }
    } else if (currentStatus === 'Under Review') {
        if (track) track.style.width = '55%';
        if (st1) st1.className = 'stepper-step completed';
        if (st2) st2.className = 'stepper-step completed';
        if (st3) st3.className = 'stepper-step active';
        if (statusBanner) {
            statusBanner.style.display = 'block';
            statusBanner.style.background = 'rgba(245, 158, 11, 0.12)';
            statusBanner.style.border = '1px solid rgba(245, 158, 11, 0.4)';
            statusBanner.style.color = '#fbbf24';
            statusBanner.innerHTML = `
                <div style="display: flex; align-items: center; gap: 12px;">
                    <span style="font-size: 1.2rem;">🔍</span>
                    <div>
                        <strong style="font-size: 0.88rem; display: block; margin-bottom: 2px;">Registration Under Active Review</strong>
                        <span style="font-size: 0.78rem; color: var(--text-main);">Clearance assessor is actively reviewing your civilian vault identity, threat tier calibration, and supporting documents.</span>
                    </div>
                </div>
            `;
        }
    } else if (currentStatus === 'Returned for Correction') {
        if (track) track.style.width = '50%';
        if (st1) st1.className = 'stepper-step completed';
        if (st2) st2.className = 'stepper-step completed';
        if (st3) st3.className = 'stepper-step active';
        if (st3) st3.style.borderColor = '#f59e0b';
        if (statusBanner) {
            statusBanner.style.display = 'block';
            statusBanner.style.background = 'rgba(245, 158, 11, 0.15)';
            statusBanner.style.border = '1px solid rgba(245, 158, 11, 0.5)';
            statusBanner.style.color = '#fbbf24';
            const notes = hero.correction_notes || hero.verification_notes || 'The registrar desk requested corrections to your submission details or documents.';
            statusBanner.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px;">
                    <div>
                        <strong style="font-size: 0.9rem; color: #fbbf24; display: block; margin-bottom: 3px;">⚠ Registration Returned for Correction</strong>
                        <div style="font-size: 0.8rem; color: var(--text-main); margin-bottom: 6px; background: rgba(0,0,0,0.25); padding: 8px 12px; border-radius: 4px; border-left: 3px solid #f59e0b;">
                            <strong>Registrar Notes:</strong> ${escapeHtml(notes)}
                        </div>
                        <span style="font-size: 0.72rem; color: var(--text-muted);">Please review the requested changes, update your profile or documents below, and click Resubmit Registration.</span>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <a href="/register" class="btn-mini btn-mini-assess" style="text-decoration: none; padding: 6px 14px; font-size: 0.75rem;">
                            Open Full Stepper
                        </a>
                        <button type="button" class="btn-confirm-final" onclick="resubmitRegistration()" style="padding: 6px 14px; font-size: 0.75rem;">
                            Resubmit Registration
                        </button>
                    </div>
                </div>
            `;
        }
        if (resubmitBtn) resubmitBtn.style.display = 'inline-block';
    } else if (currentStatus === 'Verified') {
        if (track) track.style.width = '75%';
        if (st1) st1.className = 'stepper-step completed';
        if (st2) st2.className = 'stepper-step completed';
        if (st3) st3.className = 'stepper-step completed';
        if (st4) st4.className = 'stepper-step active';
        if (statusBanner) {
            statusBanner.style.display = 'block';
            statusBanner.style.background = 'rgba(6, 182, 212, 0.12)';
            statusBanner.style.border = '1px solid rgba(6, 182, 212, 0.4)';
            statusBanner.style.color = '#67e8f9';
            statusBanner.innerHTML = `
                <div style="display: flex; align-items: center; gap: 12px;">
                    <span style="font-size: 1.2rem;">🛡️</span>
                    <div>
                        <strong style="font-size: 0.88rem; display: block; margin-bottom: 2px;">Identity Credentials &amp; Documents Verified</strong>
                        <span style="font-size: 0.78rem; color: var(--text-main);">Your official identity and superhuman classification have been validated. Awaiting final Commander accreditation signature.</span>
                    </div>
                </div>
            `;
        }
    } else if (currentStatus === 'Approved' || currentStatus === 'Licensed') {
        if (track) track.style.width = '100%';
        [st1, st2, st3, st4, st5].forEach(n => n && (n.className = 'stepper-step completed'));
        if (statusBanner) {
            statusBanner.style.display = 'block';
            statusBanner.style.background = 'rgba(16, 185, 129, 0.12)';
            statusBanner.style.border = '1px solid rgba(16, 185, 129, 0.4)';
            statusBanner.style.color = '#34d399';
            statusBanner.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <span style="font-size: 1.2rem;">🎖️</span>
                        <div>
                            <strong style="font-size: 0.88rem; display: block; margin-bottom: 2px;">Officially Accredited Hero Operative</strong>
                            <span style="font-size: 0.78rem; color: var(--text-main);">License Number: <strong>${hero.license_number || 'ACTIVE-HERO'}</strong> · Verified civic credentials active across all municipal sectors.</span>
                        </div>
                    </div>
                    <button type="button" class="btn-mini btn-mini-assess" onclick="document.getElementById('btnExpandQrBadge').click()" style="padding: 6px 14px; font-size: 0.75rem;">
                        View Field QR Badge
                    </button>
                </div>
            `;
        }
    } else if (currentStatus === 'Rejected') {
        if (track) track.style.width = '50%';
        if (statusBanner) {
            statusBanner.style.display = 'block';
            statusBanner.style.background = 'rgba(239, 68, 68, 0.12)';
            statusBanner.style.border = '1px solid rgba(239, 68, 68, 0.4)';
            statusBanner.style.color = '#f87171';
            const notes = hero.verification_notes || hero.rejection_reason || 'Application did not meet Superhuman Accord regulatory standards.';
            statusBanner.innerHTML = `
                <div style="display: flex; align-items: flex-start; gap: 12px;">
                    <span style="font-size: 1.2rem;">❌</span>
                    <div>
                        <strong style="font-size: 0.88rem; display: block; margin-bottom: 2px;">Registration Application Rejected</strong>
                        <div style="font-size: 0.8rem; color: var(--text-main); margin-bottom: 4px; background: rgba(0,0,0,0.25); padding: 8px 12px; border-radius: 4px; border-left: 3px solid #ef4444;">
                            <strong>Rejection Findings:</strong> ${escapeHtml(notes)}
                        </div>
                        <span style="font-size: 0.72rem; color: var(--text-muted);">Contact your municipal registrar officer for formal appeals or reapplication protocols.</span>
                    </div>
                </div>
            `;
        }
    }

    // ─────────────────────────────────────────────────────────────
    // Populate All Target Structure Display Elements
    // ─────────────────────────────────────────────────────────────

    // 1. Hero Identity & Licensure
    const elAccBadge = document.getElementById('vwAccountStatusBadge');
    if (elAccBadge) {
        elAccBadge.textContent = `STATUS: ${currentStatus.toUpperCase()}`;
        elAccBadge.style.color = currentStatus === 'Approved' || currentStatus === 'Licensed' ? '#34d399' : (currentStatus === 'Returned for Correction' ? '#fbbf24' : '#93c5fd');
    }
    const elHeroId = document.getElementById('vwHeroId');
    const elHeroIdNote = document.getElementById('vwHeroIdNote');
    if (elHeroId) {
        if (hero.id) {
            elHeroId.textContent = hero.id;
            if (elHeroIdNote) elHeroIdNote.textContent = 'Official GHRMS federal registry identifier';
        } else {
            elHeroId.textContent = 'Pending Official Accreditation';
            if (elHeroIdNote) elHeroIdNote.textContent = 'Official ID assigned upon registrar verification';
        }
    }
    const elUsername = document.getElementById('vwHeroUsername');
    if (elUsername) elUsername.textContent = hero.callsign || hero.alias || '—';
    const elDates = document.getElementById('vwHeroDates');
    if (elDates) {
        const regDate = hero.registered_at || hero.created_at ? new Date(hero.registered_at || hero.created_at).toLocaleDateString() : 'N/A';
        const lastLogin = hero.last_login ? new Date(hero.last_login).toLocaleString() : 'Recent Active';
        elDates.textContent = `Registered: ${regDate} · Active: ${lastLogin}`;
    }

    // License Status Badge and Number
    const licBadge = document.getElementById('vwHeroLicenseBadge');
    const licNum = document.getElementById('vwHeroLicenseNumber');
    if (licBadge && licNum) {
        if (currentStatus === 'Approved' || currentStatus === 'Licensed') {
            licBadge.textContent = '[LICENSED / ACCREDITED]';
            licBadge.style.color = '#34d399';
            licBadge.style.background = 'rgba(16,185,129,0.15)';
            licBadge.style.borderColor = 'rgba(16,185,129,0.4)';
            licNum.textContent = '#' + (hero.license_number || 'ACTIVE-CIVIC-HERO');
            licNum.style.color = 'var(--text-main)';
        } else if (currentStatus === 'Under Review') {
            licBadge.textContent = '[UNDER REVIEW]';
            licBadge.style.color = '#fbbf24';
            licBadge.style.background = 'rgba(245,158,11,0.15)';
            licBadge.style.borderColor = 'rgba(245,158,11,0.4)';
            licNum.textContent = 'Pending Registrar Accreditation';
            licNum.style.color = 'var(--text-muted)';
        } else if (currentStatus === 'Returned for Correction') {
            licBadge.textContent = '[RETURNED FOR CORRECTION]';
            licBadge.style.color = '#f59e0b';
            licBadge.style.background = 'rgba(245,158,11,0.15)';
            licBadge.style.borderColor = 'rgba(245,158,11,0.5)';
            licNum.textContent = 'Action Required';
            licNum.style.color = '#f59e0b';
        } else if (currentStatus === 'Verified') {
            licBadge.textContent = '[CREDENTIALS VERIFIED]';
            licBadge.style.color = '#67e8f9';
            licBadge.style.background = 'rgba(6,182,212,0.15)';
            licBadge.style.borderColor = 'rgba(6,182,212,0.4)';
            licNum.textContent = 'Awaiting Final Commander Signature';
            licNum.style.color = 'var(--text-muted)';
        } else if (currentStatus === 'Submitted') {
            licBadge.textContent = '[AWAITING INTAKE]';
            licBadge.style.color = '#fde047';
            licBadge.style.background = 'rgba(234,179,8,0.15)';
            licBadge.style.borderColor = 'rgba(234,179,8,0.4)';
            licNum.textContent = 'Queued for Assessment';
            licNum.style.color = 'var(--text-muted)';
        } else if (currentStatus === 'Draft') {
            licBadge.textContent = '[DRAFT INTAKE]';
            licBadge.style.color = '#93c5fd';
            licBadge.style.background = 'rgba(59,130,246,0.15)';
            licBadge.style.borderColor = 'rgba(59,130,246,0.4)';
            licNum.textContent = 'Not Yet Licensed';
            licNum.style.color = 'var(--text-muted)';
        } else if (currentStatus === 'Rejected' || currentStatus === 'Revoked') {
            licBadge.textContent = `[${currentStatus.toUpperCase()}]`;
            licBadge.style.color = '#f87171';
            licBadge.style.background = 'rgba(239,68,68,0.15)';
            licBadge.style.borderColor = 'rgba(239,68,68,0.4)';
            licNum.textContent = 'Unaccredited';
            licNum.style.color = '#f87171';
        } else {
            licBadge.textContent = `[${currentStatus.toUpperCase()}]`;
            licNum.textContent = hero.license_number || 'Pending';
        }
    }

    // Compatibility references
    const vwAlias = document.getElementById('vwHeroAlias');
    if (vwAlias) vwAlias.textContent = hero.alias || '—';
    const vwRealName = document.getElementById('vwHeroRealName');
    if (vwRealName) {
        const real = hero.real_name || (hero.vault_info && hero.vault_info.real_name) || '';
        vwRealName.textContent = real ? `${real} (Civilian Profile Vaulted)` : '[VAULT PROTECTED / AES-256]';
    }

    // 2. Registered Powers & Specs
    const vwPrimaryPower = document.getElementById('vwHeroPrimaryPower');
    if (vwPrimaryPower) vwPrimaryPower.textContent = hero.primary_power || 'None Declared';
    const vwPowerDesc = document.getElementById('vwHeroPowerDesc');
    if (vwPowerDesc) vwPowerDesc.textContent = hero.power_description || 'Detailed energetic and physiological mechanics on official file.';
    const powerLvl = hero.power_level || 70;
    const pBar = document.getElementById('vwPowerLevelBar');
    const pText = document.getElementById('vwPowerLevelText');
    if (pBar) pBar.style.width = `${powerLvl}%`;
    if (pText) pText.textContent = `${powerLvl}/100`;

    // 3. Secondary Abilities & Non-Powered Skills
    const vwSecondaryPower = document.getElementById('vwHeroSecondaryPower');
    if (vwSecondaryPower) vwSecondaryPower.textContent = hero.secondary_powers || hero.secondary_power || 'None Filed';
    const vwStyle = document.getElementById('vwHeroCombatStyle');
    if (vwStyle) vwStyle.textContent = hero.combat_style || 'Tactical Field Engagement';
    const vwAbilitiesSkills = document.getElementById('vwHeroAbilitiesSkills');
    if (vwAbilitiesSkills) {
        vwAbilitiesSkills.textContent = `Abilities: ${hero.abilities || 'Standard tactical proficiency'} · Skills: ${hero.skills || 'Field proficient'}`;
    }
    const vwStrengthsWeaknesses = document.getElementById('vwHeroStrengthsWeaknesses');
    if (vwStrengthsWeaknesses) {
        const str = hero.strengths || 'High resilience';
        const wkn = hero.limitations_weaknesses || hero.weaknesses || 'Standard human vulnerabilities';
        vwStrengthsWeaknesses.textContent = `Strengths: ${str} | Limitations: ${wkn}`;
    }

    // 4. Power & Threat Assessment
    const vwThreatTier = document.getElementById('vwHeroThreatTier');
    if (vwThreatTier) {
        const tierIdx = parseInt(hero.threat_tier ?? hero.self_threat_rating, 10);
        const tierName = TIER_LABELS[tierIdx] || TIER_LABELS[3];
        vwThreatTier.innerHTML = `
            <span style="font-family: var(--font-mono); font-weight: 800; font-size: 0.8rem; padding: 2px 8px; border-radius: 4px; background: rgba(245,158,11,0.15); border: 1px solid rgba(245,158,11,0.4); color: #fbbf24;">
                ${tierName}
            </span>
        `;
    }
    const vwControlLevel = document.getElementById('vwHeroControlLevel');
    if (vwControlLevel) vwControlLevel.textContent = hero.power_control_level || 'Competent (Operational Under Stress)';
    const combatRtg = hero.combat_rating || 75;
    const cBar = document.getElementById('vwCombatRatingBar');
    const cText = document.getElementById('vwCombatRatingText');
    if (cBar) cBar.style.width = `${combatRtg}%`;
    if (cText) cText.textContent = `${combatRtg}/100`;
    const vwSectorGear = document.getElementById('vwHeroSectorGear');
    if (vwSectorGear) {
        const gear = Array.isArray(hero.gear_manifest) ? hero.gear_manifest.join(', ') : (hero.gear_manifest || 'Standard Field Issue');
        vwSectorGear.textContent = `Sector: ${hero.region || 'Sector 1'} · Gear: ${gear}`;
    }
    const vwNotes = document.getElementById('vwHeroAssessmentNotes');
    if (vwNotes) vwNotes.textContent = hero.assessment_notes || 'Collateral risk protocols calibrated by intake assessor.';

    // 5. Certifications & Training Records
    const elCerts = document.getElementById('vwHeroCertifications');
    if (elCerts) {
        const certBadges = [];
        certBadges.push(`
            <span style="font-size:0.75rem;font-family:var(--font-mono);font-weight:700;padding:4px 10px;border-radius:4px;background:rgba(59,130,246,0.12);border:1px solid rgba(59,130,246,0.35);color:#93c5fd;">
                ✓ Superhuman Accord Article 4 Compliant
            </span>
        `);

        if (currentStatus === 'Approved' || currentStatus === 'Licensed') {
            const isSidekick = (hero.role_tag === 'Sidekick') || !!hero.mentor;
            if (isSidekick) {
                certBadges.push(`
                    <span style="font-size:0.75rem;font-family:var(--font-mono);font-weight:700;padding:4px 10px;border-radius:4px;background:rgba(167,139,250,0.15);border:1px solid rgba(167,139,250,0.4);color:#c084fc;">
                        ✓ Certified Apprentice Operative
                    </span>
                `);
            } else {
                certBadges.push(`
                    <span style="font-size:0.75rem;font-family:var(--font-mono);font-weight:700;padding:4px 10px;border-radius:4px;background:rgba(16,185,129,0.15);border:1px solid rgba(16,185,129,0.4);color:#34d399;">
                        ✓ Class-A Active Field Operative
                    </span>
                `);
            }
            certBadges.push(`
                <span style="font-size:0.75rem;font-family:var(--font-mono);font-weight:700;padding:4px 10px;border-radius:4px;background:rgba(16,185,129,0.12);border:1px solid rgba(16,185,129,0.35);color:#6ee7b7;">
                    ✓ Civic Rescue &amp; Crisis Mitigation Level 2
                </span>
            `);
        }

        const docs = hero.supporting_documents || [];
        docs.forEach(doc => {
            if (doc.verification_status === 'Verified' && (doc.document_type === 'Hero Certification' || doc.document_type === 'Training Certificate')) {
                certBadges.push(`
                    <span style="font-size:0.75rem;font-family:var(--font-mono);font-weight:700;padding:4px 10px;border-radius:4px;background:rgba(6,182,212,0.12);border:1px solid rgba(6,182,212,0.35);color:#67e8f9;">
                        ✓ ${escapeHtml(doc.original_name || doc.document_type)}
                    </span>
                `);
            }
        });

        elCerts.innerHTML = certBadges.join('');
    }

    const vwTraining = document.getElementById('vwHeroTraining');
    if (vwTraining) {
        vwTraining.textContent = hero.training_experience || hero.training_records || 'Civic Defense Academy standard certification & supervised field combat training.';
    }

    // 6. Supporting Documents List
    renderSupportingDocuments(hero);

    // 7. Authorization Status & Badge Verification
    const vwAuthStatus = document.getElementById('vwHeroAuthorizationStatus');
    if (vwAuthStatus) {
        const isSidekick = (hero.role_tag === 'Sidekick') || !!hero.mentor;
        if (currentStatus === 'Approved' || currentStatus === 'Licensed') {
            if (isSidekick) {
                vwAuthStatus.innerHTML = `
                    <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                        <span style="font-family:var(--font-mono);font-weight:800;font-size:0.75rem;color:#c084fc;background:rgba(167,139,250,0.15);border:1px solid rgba(167,139,250,0.4);padding:2px 8px;border-radius:4px;">[APPRENTICE CLEARANCE]</span>
                        <span style="font-size:0.8rem;color:var(--text-main);">Authorized for tactical deployment strictly in direct coordination with mentor <strong style="color:#c084fc;">${escapeHtml(hero.mentor || 'Assigned Primary')}</strong>.</span>
                    </div>
                `;
            } else {
                vwAuthStatus.innerHTML = `
                    <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                        <span style="font-family:var(--font-mono);font-weight:800;font-size:0.75rem;color:#34d399;background:rgba(16,185,129,0.15);border:1px solid rgba(16,185,129,0.4);padding:2px 8px;border-radius:4px;">[AUTONOMOUS CLEARANCE]</span>
                        <span style="font-size:0.8rem;color:var(--text-main);">Level ${hero.clearance_level || 1} Clearance · Full tactical jurisdiction for independent emergency response across Sector ${escapeHtml(hero.region || '1')}.</span>
                    </div>
                `;
            }
        } else if (currentStatus === 'Verified') {
            vwAuthStatus.innerHTML = `
                <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                    <span style="font-family:var(--font-mono);font-weight:800;font-size:0.75rem;color:#67e8f9;background:rgba(6,182,212,0.15);border:1px solid rgba(6,182,212,0.4);padding:2px 8px;border-radius:4px;">[FINAL SIGN-OFF PENDING]</span>
                    <span style="font-size:0.8rem;color:var(--text-main);">Identity and superhuman capabilities validated. Awaiting final civic license issuance.</span>
                </div>
            `;
        } else if (currentStatus === 'Under Review') {
            vwAuthStatus.innerHTML = `
                <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                    <span style="font-family:var(--font-mono);font-weight:800;font-size:0.75rem;color:#fbbf24;background:rgba(245,158,11,0.15);border:1px solid rgba(245,158,11,0.4);padding:2px 8px;border-radius:4px;">[PROVISIONAL RESTRAINT]</span>
                    <span style="font-size:0.8rem;color:var(--text-main);">Application under active assessor evaluation. Field interventions restricted to urgent civilian self-defense.</span>
                </div>
            `;
        } else if (currentStatus === 'Returned for Correction') {
            vwAuthStatus.innerHTML = `
                <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                    <span style="font-family:var(--font-mono);font-weight:800;font-size:0.75rem;color:#f59e0b;background:rgba(245,158,11,0.15);border:1px solid rgba(245,158,11,0.4);padding:2px 8px;border-radius:4px;">[SUSPENDED FOR REVISIONS]</span>
                    <span style="font-size:0.8rem;color:var(--text-main);">Registration returned for required corrections. Please submit corrections to resume assessment.</span>
                </div>
            `;
        } else if (currentStatus === 'Submitted') {
            vwAuthStatus.innerHTML = `
                <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                    <span style="font-family:var(--font-mono);font-weight:800;font-size:0.75rem;color:#fde047;background:rgba(234,179,8,0.15);border:1px solid rgba(234,179,8,0.4);padding:2px 8px;border-radius:4px;">[QUEUED FOR INTAKE]</span>
                    <span style="font-size:0.8rem;color:var(--text-main);">Application received. Field deployment not yet authorized.</span>
                </div>
            `;
        } else if (currentStatus === 'Draft') {
            vwAuthStatus.innerHTML = `
                <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                    <span style="font-family:var(--font-mono);font-weight:800;font-size:0.75rem;color:#93c5fd;background:rgba(59,130,246,0.15);border:1px solid rgba(59,130,246,0.4);padding:2px 8px;border-radius:4px;">[UNACCREDITED DRAFT]</span>
                    <span style="font-size:0.8rem;color:var(--text-main);">Registration intake incomplete. No operational authority.</span>
                </div>
            `;
        } else {
            vwAuthStatus.innerHTML = `
                <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                    <span style="font-family:var(--font-mono);font-weight:800;font-size:0.75rem;color:#f87171;background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.4);padding:2px 8px;border-radius:4px;">[UNACCREDITED]</span>
                    <span style="font-size:0.8rem;color:var(--text-main);">Superhuman activities without active license constitute municipal violations.</span>
                </div>
            `;
        }
    }

    const vwVerStatus = document.getElementById('vwHeroVerificationStatus');
    if (vwVerStatus) {
        const vStatus = hero.verification_status || (hero.status === 'Approved' ? 'Verified' : 'Pending');
        const vBy = hero.verified_by || 'Registrar Evaluation Desk';
        const vDate = hero.verification_date ? ` on ${new Date(hero.verification_date).toLocaleDateString()}` : '';
        const badgeColor = vStatus === 'Verified' ? '#34d399' : (vStatus === 'Rejected' ? '#f87171' : '#fbbf24');
        vwVerStatus.innerHTML = `
            <span style="font-weight: 800; color: ${badgeColor}; font-family: var(--font-mono); font-size: 0.75rem;">[${vStatus.toUpperCase()}]</span>
            <span style="font-size: 0.75rem; color: var(--text-muted); margin-left: 6px;">by ${escapeHtml(vBy)}${vDate}</span>
        `;
    }

    const vwBadgeStatus = document.getElementById('vwHeroBadgeStatus');
    if (vwBadgeStatus) {
        if (currentStatus === 'Approved' || currentStatus === 'Licensed') {
            vwBadgeStatus.innerHTML = `
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span style="width: 8px; height: 8px; border-radius: 50%; background: #34d399; box-shadow: 0 0 8px #34d399;"></span>
                  <div>
                    <span style="font-size: 0.82rem; font-weight: 800; color: #34d399; font-family: var(--font-mono);">[CRYPTOGRAPHICALLY VERIFIED]</span>
                    <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 1px;">30s Rotating Anti-Spoof PIN &amp; Permanent Civic QR Credential Active</div>
                  </div>
                </div>
                <button type="button" class="btn-mini btn-mini-assess" onclick="document.getElementById('btnExpandQrBadge').click()" style="padding: 6px 14px; font-size: 0.75rem; font-weight: 700;">
                  [VIEW FIELD QR BADGE]
                </button>
            `;
        } else if (currentStatus === 'Under Review' || currentStatus === 'Verified' || currentStatus === 'Submitted') {
            vwBadgeStatus.innerHTML = `
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span style="width: 8px; height: 8px; border-radius: 50%; background: #fbbf24; box-shadow: 0 0 8px #fbbf24;"></span>
                  <div>
                    <span style="font-size: 0.82rem; font-weight: 800; color: #fbbf24; font-family: var(--font-mono);">[PROVISIONAL BADGE ACTIVE]</span>
                    <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 1px;">Temporary QR credential active for registrar audit and identity inspection</div>
                  </div>
                </div>
                <button type="button" class="btn-mini btn-mini-assess" onclick="document.getElementById('btnExpandQrBadge').click()" style="padding: 6px 14px; font-size: 0.75rem; font-weight: 700;">
                  [VIEW FIELD QR BADGE]
                </button>
            `;
        } else {
            vwBadgeStatus.innerHTML = `
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span style="width: 8px; height: 8px; border-radius: 50%; background: #94a3b8;"></span>
                  <div>
                    <span style="font-size: 0.82rem; font-weight: 800; color: #94a3b8; font-family: var(--font-mono);">[BADGE INACTIVE]</span>
                    <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 1px;">Cryptographic field badge generated upon official registration submission</div>
                  </div>
                </div>
                <button type="button" class="btn-mini" disabled style="padding: 6px 14px; font-size: 0.75rem; opacity: 0.5;">
                  [BADGE LOCKED]
                </button>
            `;
        }
    }

    const vwVerNotes = document.getElementById('vwHeroVerificationNotes');
    if (vwVerNotes) {
        vwVerNotes.textContent = hero.verification_notes || hero.correction_notes || 'Official verification audit clean. No infractions or flags noted.';
    }

    // Populate editable inputs for Quick Edit form
    const fAlias     = document.getElementById('fldEditAlias');
    const fPrimary   = document.getElementById('fldPrimaryPower');
    const fSecondary = document.getElementById('fldSecondaryPower');
    const fRegion    = document.getElementById('fldRegion');
    const fGear      = document.getElementById('fldGearManifest');
    const fContacts  = document.getElementById('fldEmergencyContacts');
    const fPowerDesc = document.getElementById('fldPowerDesc');
    const fStrengths = document.getElementById('fldStrengths');
    const fWeaknesses= document.getElementById('fldWeaknesses');

    if (fAlias)     fAlias.value     = hero.alias || '';
    if (fPrimary)   fPrimary.value   = hero.primary_power || '';
    if (fSecondary) fSecondary.value = hero.secondary_powers || hero.secondary_power || '';
    if (fRegion)    fRegion.value    = hero.region || '';
    if (fGear)      fGear.value      = Array.isArray(hero.gear_manifest) ? hero.gear_manifest.join(', ') : (hero.gear_manifest || '');
    if (fContacts)  fContacts.value  = hero.emergency_contact_name ? `${hero.emergency_contact_name} - ${hero.emergency_contact_number || ''}` : '';
    if (fPowerDesc) fPowerDesc.value = hero.power_description || '';
    if (fStrengths) fStrengths.value = hero.strengths || '';
    if (fWeaknesses)fWeaknesses.value= hero.limitations_weaknesses || hero.weaknesses || '';
}

// ─────────────────────────────────────────────────────────────
// Supporting Documents Rendering & Upload
// ─────────────────────────────────────────────────────────────
function renderSupportingDocuments(hero) {
    const list = document.getElementById('supportingDocsList');
    if (!list) return;

    const docs = hero.supporting_documents || [];
    if (!Array.isArray(docs) || docs.length === 0) {
        list.innerHTML = `
            <div style="font-size: 0.75rem; color: var(--text-muted); font-style: italic; padding: 6px 0;">
                No supporting documents uploaded yet. Please attach your Required Official ID and Hero Certification.
            </div>
        `;
        return;
    }

    list.innerHTML = docs.map(doc => {
        const status = doc.verification_status || 'Pending';
        const statusColor = status === 'Verified' ? 'rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.4);'
            : (status === 'Rejected' ? 'rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.4);'
            : 'rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.4);');
        
        const uploadDate = doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleDateString() : 'N/A';
        const expDate = doc.expiration_date ? ` · Exp: ${doc.expiration_date}` : '';
        const verifiedBy = doc.verified_by ? ` (Audit: ${doc.verified_by})` : '';

        return `
            <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.04); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 8px 12px; font-size: 0.78rem;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 1.1rem;">📄</span>
                    <div>
                        <strong style="color: var(--text-main);">${escapeHtml(doc.document_type || 'Document')}</strong>: 
                        <a href="/api/heroes/${encodeURIComponent(hero.id)}/documents/${encodeURIComponent(doc.doc_id)}" target="_blank" style="color: #93c5fd; text-decoration: underline; font-family: var(--font-mono); font-size: 0.75rem;">
                            ${escapeHtml(doc.original_name || 'View Attached File')}
                        </a>
                        <div style="font-size: 0.68rem; color: var(--text-muted); margin-top: 1px;">
                            Uploaded: ${uploadDate}${expDate}${verifiedBy}
                        </div>
                    </div>
                </div>
                <div>
                    <span style="font-family: var(--font-mono); font-size: 0.68rem; font-weight: 800; padding: 2px 8px; border-radius: 4px; background: ${statusColor}">
                        ${status.toUpperCase()}
                    </span>
                </div>
            </div>
        `;
    }).join('');
}

// Upload Single Document
async function uploadSingleDocument() {
    const heroId = heroState.heroId;
    if (!heroId) return;

    const fileEl = document.getElementById('newDocFile');
    const typeEl = document.getElementById('newDocType');
    const expEl = document.getElementById('newDocExp');

    if (!fileEl || !fileEl.files || !fileEl.files[0]) {
        alert('Please choose a document file (PDF, PNG, JPG, WEBP) to upload.');
        return;
    }

    const file = fileEl.files[0];
    const docType = typeEl ? typeEl.value : 'Other Supporting Documents';
    const expDate = expEl ? expEl.value : '';

    const fd = new FormData();
    fd.append('document_file', file);
    fd.append('document_type', docType);
    if (expDate) fd.append('expiration_date', expDate);

    showToast('Uploading supporting document...', 'info');

    try {
        const res = await fetch(`/api/heroes/${encodeURIComponent(heroId)}/documents`, {
            method: 'POST',
            body: fd
        });
        const data = await res.json();
        if (data.success) {
            showToast(`Document [${docType}] uploaded successfully!`, 'success');
            fileEl.value = '';
            document.getElementById('docUploadDrawer').style.display = 'none';
            await loadHeroData();
        } else {
            showToast(`Upload Error: ${data.error || 'Failed to upload document.'}`, 'error');
        }
    } catch (err) {
        showToast(`Connection error: ${err.message}`, 'error');
    }
}

// Resubmit Registration after corrections
async function resubmitRegistration() {
    const heroId = heroState.heroId;
    if (!heroId) return;

    if (!confirm('Are you sure you want to resubmit your registration packet for review? The Registrar Desk will be notified.')) {
        return;
    }

    showToast('Transmitting resubmission packet...', 'info');

    try {
        const res = await fetch(`/api/heroes/${encodeURIComponent(heroId)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ resubmit: true })
        });
        const data = await res.json();
        if (data.success) {
            showToast('Registration resubmitted! Status updated to Under Review.', 'success');
            await loadHeroData();
        } else {
            showToast(`Error: ${data.error || 'Failed to resubmit'}`, 'error');
        }
    } catch (err) {
        showToast(`Connection error: ${err.message}`, 'error');
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

async function checkPendingUpdates() {
    const heroId = (heroState && heroState.currentHero) ? heroState.currentHero.id : (heroState ? heroState.heroId : null);
    if (!heroId) return;

    let res = { success: false, pending: [] };
    try {
        const fetchRes = await fetch(`/api/heroes/${encodeURIComponent(heroId)}/updates`);
        res = await fetchRes.json();
    } catch (e) {
        console.warn('Could not fetch pending updates:', e);
        return;
    }

    let banner = document.getElementById('pendingUpdateBanner');
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'pendingUpdateBanner';
        banner.style.cssText = `
            display:none; align-items:center; gap:10px;
            background: rgba(245,158,11,0.12);
            border: 1px solid rgba(245,158,11,0.4);
            border-radius: 6px; padding: 0.65rem 1rem;
            font-size: 0.78rem; color: #fbbf24; font-weight:600;
            margin-bottom: 0.75rem;
        `;
        // Insert above the basic information card view
        const form = document.getElementById('heroInfoViewMode');
        if (form) form.parentElement.insertBefore(banner, form);
    }

    if (res.success && res.pending && res.pending.length > 0) {
        const upd = res.pending[0];
        const fields = Object.keys(upd.proposed).join(', ');
        banner.style.display = 'flex';
        banner.innerHTML = `
            <span style="font-weight:800;font-size:0.75rem;background:#f59e0b;color:#000;padding:2px 6px;border-radius:3px;">[PENDING REVIEW]</span>
            <span>You have an active <strong>amendment request</strong> awaiting Registrar approval —
            Fields: <em>${fields}</em>.<br>
            <span style="font-weight:400;color:var(--text-muted);">Submitted ${new Date(upd.submitted_at).toLocaleString()}. Changes will appear after verification.</span>
            </span>`;
        heroState.hasPending = true;

        // Disable form fields that are already pending
        Object.keys(upd.proposed).forEach(field => {
            const fieldMap = {
                alias: 'fldEditAlias', primary_power: 'fldPrimaryPower',
                secondary_power: 'fldSecondaryPower', region: 'fldRegion',
                gear_manifest: 'fldGearManifest', emergency_contacts: 'fldEmergencyContacts'
            };
            const el = document.getElementById(fieldMap[field]);
            if (el) { el.disabled = true; el.style.opacity = '0.5'; }
        });
    } else {
        banner.style.display = 'none';
        heroState.hasPending = false;
    }
}

// -------------------------------------------------------------
// Submit Hero Update Request
// -------------------------------------------------------------
async function submitHeroUpdates(e) {
    if (e) e.preventDefault();

    const fAlias     = document.getElementById('fldEditAlias');
    const fPrimary   = document.getElementById('fldPrimaryPower');
    const fSecondary = document.getElementById('fldSecondaryPower');
    const fRegion    = document.getElementById('fldRegion');
    const fGear      = document.getElementById('fldGearManifest');
    const fContacts  = document.getElementById('fldEmergencyContacts');

    const hero = heroState.hero;
    const proposed = {};

    // Only include fields that actually changed
    if (fAlias     && fAlias.value.trim()     !== (hero?.alias || ''))          proposed.alias = fAlias.value.trim();
    if (fPrimary   && fPrimary.value.trim()   !== (hero?.primary_power || ''))  proposed.primary_power = fPrimary.value.trim();
    if (fSecondary && fSecondary.value.trim() !== (hero?.secondary_power || '')) proposed.secondary_power = fSecondary.value.trim();
    if (fRegion    && fRegion.value.trim()    !== (hero?.region || ''))          proposed.region = fRegion.value.trim();
    if (fGear && !fGear.disabled) {
        const gearVal = fGear.value.split(',').map(s => s.trim()).filter(Boolean);
        const origGear = Array.isArray(hero?.gear_manifest) ? hero.gear_manifest : [];
        if (JSON.stringify(gearVal) !== JSON.stringify(origGear)) {
            proposed.gear_manifest = gearVal;
        }
    }
    if (fContacts && !fContacts.disabled) {
        const rawContacts = fContacts.value.split(',').map(s => s.trim()).filter(Boolean);
        const parsedContacts = rawContacts.map(entry => {
            const parts = entry.split(/[-:]/).map(p => p.trim());
            if (parts.length >= 2) {
                return { name: parts[0], relation: 'Emergency Contact', phone: parts.slice(1).join('-').trim() };
            }
            return { name: entry, relation: 'Emergency Contact', phone: '' };
        });

        const origContactsFormatted = Array.isArray(hero?.emergency_contacts)
            ? hero.emergency_contacts.map(c => typeof c === 'object' && c !== null ? `${c.name || ''} - ${c.phone || ''}` : String(c)).join(', ')
            : (hero?.emergency_contacts || '');
        if (fContacts.value.trim() !== origContactsFormatted.trim()) {
            proposed.emergency_contacts = parsedContacts;
        }
    }

    const fPowerDesc = document.getElementById('fldPowerDesc');
    const fStrengths = document.getElementById('fldStrengths');
    const fWeaknesses= document.getElementById('fldWeaknesses');
    if (fPowerDesc && fPowerDesc.value.trim() !== (hero?.power_description || '')) {
        proposed.power_description = fPowerDesc.value.trim();
    }
    if (fStrengths && fStrengths.value.trim() !== (hero?.strengths || '')) {
        proposed.strengths = fStrengths.value.trim();
    }
    if (fWeaknesses && fWeaknesses.value.trim() !== (hero?.limitations_weaknesses || hero?.weaknesses || '')) {
        proposed.limitations_weaknesses = fWeaknesses.value.trim();
    }

    if (Object.keys(proposed).length === 0) {
        showToast('No changes detected.', 'info');
        return;
    }

    const submitBtn = document.getElementById('btnSubmitHeroUpdate');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Saving Updates...'; }

    // If Draft or Returned for Correction, update directly on hero registration
    if (hero?.status === 'Draft' || hero?.status === 'Returned for Correction') {
        try {
            const isReturned = hero?.status === 'Returned for Correction';
            const payload = {
                ...proposed,
                resubmit: isReturned
            };
            const res = await fetch(`/api/heroes/${encodeURIComponent(heroState.heroId)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.success) {
                showToast(isReturned ? 'Registration updated and resubmitted for review!' : 'Draft registration saved!', 'success');
                await loadHeroData();
                setHeroEditMode(false);
            } else {
                showToast(`Update error: ${data.error || 'Failed to save changes.'}`, 'error');
            }
        } catch (err) {
            showToast(`Connection error: ${err.message}`, 'error');
        } finally {
            if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'SAVE & SUBMIT UPDATES'; }
        }
        return;
    }

    const res = await apiPost(`heroes/${heroState.heroId}/request-update`, proposed);

    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'SAVE & SUBMIT UPDATES'; }

    if (res.success) {
        if (res.requires_approval) {
            showToast('Update request submitted — awaiting Registrar/Admin approval.', 'success');
        } else {
            showToast('Information updated successfully.', 'success');
            await loadHeroData();
        }
        setHeroEditMode(false);
        await checkPendingUpdates();
    } else {
        showToast(`Error: ${res.error}`, 'error');
    }
}

// -------------------------------------------------------------
// QR Badge
// -------------------------------------------------------------
async function refreshBadgeToken() {
    const res = await apiGet(`heroes/${heroState.heroId}/badge-token`);
    if (!res.success) return;
    heroState.badgeTokenData = res.data;

    const canvas = document.getElementById('heroBadgeQrCanvas');
    if (canvas) {
        SimpleQR.renderToCanvas(canvas, res.data.qr_payload, {
            size: 160, foreground: '#0f172a', background: '#ffffff'
        });
    }
    const tokenDisplay = document.getElementById('dynamicTokenDisplay');
    if (tokenDisplay) tokenDisplay.textContent = res.data.token;

    const aliasModal = document.getElementById('modalBadgeAlias');
    const metaModal  = document.getElementById('modalBadgeMeta');
    if (aliasModal) aliasModal.textContent = res.data.alias;
    if (metaModal)  metaModal.textContent  = `${res.data.alias} · ${res.data.threat_tier_label} · Token Verified`;

    let remaining = res.data.expires_in;
    const totalStep = res.data.time_step || 30;
    const bar  = document.getElementById('tokenTimerProgress');
    const text = document.getElementById('tokenExpiryText');

    if (heroState.countdownInterval) clearInterval(heroState.countdownInterval);
    heroState.countdownInterval = setInterval(() => {
        remaining--;
        if (bar)  bar.style.width = `${(remaining / totalStep) * 100}%`;
        if (text) text.textContent = `Rotating in ${remaining}s (Anti-Spoofing Active)`;
        if (remaining <= 0) { clearInterval(heroState.countdownInterval); refreshBadgeToken(); }
    }, 1000);
}

function renderPermanentQr() {
    const heroId = (heroState.heroData && heroState.heroData.id) ? heroState.heroData.id : heroState.heroId;
    if (!heroId) return;
    const permPayload = `GHRMS://HERO/${heroId}`;
    const permCanvas = document.getElementById('heroPermanentQrCanvas');
    if (permCanvas) {
        SimpleQR.renderToCanvas(permCanvas, permPayload, {
            size: 160, foreground: '#0f172a', background: '#ffffff'
        });
    }
    const permDisplay = document.getElementById('permanentLicenseDisplay');
    if (permDisplay) {
        permDisplay.textContent = permPayload;
    }
}

function initQrModal() {
    const openBtn    = document.getElementById('btnExpandQrBadge');
    const navOpenBtn = document.getElementById('navOpenQrBadge');
    const modal      = document.getElementById('qrBadgeModal');
    const closeBtn   = document.getElementById('closeQrBadgeModalBtn');

    const tabPerm  = document.getElementById('tabBadgePermanent');
    const tabDyn   = document.getElementById('tabBadgeDynamic');
    const panePerm = document.getElementById('badgePermanentPane');
    const paneDyn  = document.getElementById('badgeDynamicPane');

    function switchTab(mode) {
        if (mode === 'perm') {
            if (panePerm) panePerm.style.display = 'block';
            if (paneDyn)  paneDyn.style.display = 'none';
            if (tabPerm) {
                tabPerm.classList.add('active');
                tabPerm.style.color = 'var(--primary-accent)';
                tabPerm.style.borderBottom = '2px solid var(--primary-accent)';
            }
            if (tabDyn) {
                tabDyn.classList.remove('active');
                tabDyn.style.color = 'var(--text-muted)';
                tabDyn.style.borderBottom = '2px solid transparent';
            }
        } else {
            if (panePerm) panePerm.style.display = 'none';
            if (paneDyn)  paneDyn.style.display = 'block';
            if (tabDyn) {
                tabDyn.classList.add('active');
                tabDyn.style.color = 'var(--primary-accent)';
                tabDyn.style.borderBottom = '2px solid var(--primary-accent)';
            }
            if (tabPerm) {
                tabPerm.classList.remove('active');
                tabPerm.style.color = 'var(--text-muted)';
                tabPerm.style.borderBottom = '2px solid transparent';
            }
        }
    }

    if (tabPerm) tabPerm.onclick = () => switchTab('perm');
    if (tabDyn)  tabDyn.onclick  = () => switchTab('dyn');

    const open = () => { 
        modal.classList.add('active'); 
        renderPermanentQr();
        refreshBadgeToken(); 
    };
    if (openBtn)    openBtn.onclick    = open;
    if (navOpenBtn) navOpenBtn.onclick = open;
    if (closeBtn)   closeBtn.onclick   = () => modal.classList.remove('active');
}

// -------------------------------------------------------------
// Damage Report
// -------------------------------------------------------------
function initDamageDrawer() {
    const openBtn    = document.getElementById('btnOpenDamageDrawerHero');
    const navOpenBtn = document.getElementById('navOpenDamageDrawer');
    const modal      = document.getElementById('damageDrawerModal');
    const closeBtn   = document.getElementById('closeDamageDrawerModalBtn');
    const gpsBtn     = document.getElementById('btnTagGps');
    const form       = document.getElementById('damageReportForm');

    const open = () => modal.classList.add('active');
    if (openBtn)    openBtn.onclick    = open;
    if (navOpenBtn) navOpenBtn.onclick = open;
    if (closeBtn)   closeBtn.onclick   = () => modal.classList.remove('active');

    if (gpsBtn) {
        gpsBtn.onclick = () => {
            const input = document.getElementById('dmgCoords');
            const lat = (40.7128 + (Math.random() - 0.5) * 0.02).toFixed(4);
            const lng = (-74.0060 + (Math.random() - 0.5) * 0.02).toFixed(4);
            if (input) input.value = `${lat}, ${lng} (Auto-Tagged)`;
            showToast('GPS coordinates locked onto municipal grid.', 'success');
        };
    }

    if (form) {
        form.onsubmit = async (e) => {
            e.preventDefault();
            const power  = document.getElementById('dmgPowerType').value;
            const amount = parseInt(document.getElementById('dmgAmount').value) || 85000;
            const notes  = document.getElementById('dmgNotes').value;
            const res = await apiPost('damage-report', {
                hero_id: heroState.heroId,
                title: 'Post-Battle Civic Collateral Assessment',
                power_type: power, estimated_damage_usd: amount,
                notes, lat: 40.7128, lng: -74.0060
            });
            if (res.success) {
                showToast('Damage claim dispatched to Municipal Civic Recovery!', 'success');
                modal.classList.remove('active');
                form.reset();
            }
        };
    }
}

// -------------------------------------------------------------
// Wire update form & mode toggles
// -------------------------------------------------------------
function initUpdateForm() {
    const form = document.getElementById('heroUpdateForm');
    if (form) form.onsubmit = submitHeroUpdates;

    const btnToggle = document.getElementById('btnToggleHeroEdit');
    if (btnToggle) {
        btnToggle.onclick = () => {
            const editEl = document.getElementById('heroUpdateForm');
            const isCurrentlyEditing = editEl && editEl.style.display !== 'none';
            setHeroEditMode(!isCurrentlyEditing);
        };
    }

    const btnTrigger = document.getElementById('btnTriggerEditMode');
    if (btnTrigger) {
        btnTrigger.onclick = () => {
            setHeroEditMode(true);
            const formEl = document.getElementById('heroUpdateForm');
            if (formEl) formEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        };
    }

    const btnCancel = document.getElementById('btnCancelHeroEdit');
    if (btnCancel) {
        btnCancel.onclick = () => setHeroEditMode(false);
    }
}

// -------------------------------------------------------------
// Face Photo Upload Modal & Handlers
// -------------------------------------------------------------
let pendingHeroFaceFile = null;

function openFacePhotoUploadModal() {
    const modal = document.getElementById('modalFacePhotoUpload');
    if (!modal) return;
    const hero = heroState.hero;
    const currentAvatar = hero?.avatar || hero?.profile_picture || '/img/apex.jpg';
    const previewImg = document.getElementById('modalFacePreviewImg');
    if (previewImg) previewImg.src = currentAvatar;
    const statusText = document.getElementById('modalFacePhotoStatusText');
    if (statusText) statusText.textContent = 'PNG, JPG, or WEBP (Max 8MB)';
    pendingHeroFaceFile = null;
    modal.style.display = 'flex';
}

function closeFacePhotoUploadModal() {
    const modal = document.getElementById('modalFacePhotoUpload');
    if (modal) modal.style.display = 'none';
    pendingHeroFaceFile = null;
}

function handleHeroFacePhotoSelected(input) {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];

    if (file.size > 8 * 1024 * 1024) {
        showToast('Photo size exceeds 8MB limit.', 'error');
        input.value = '';
        return;
    }

    pendingHeroFaceFile = file;
    const previewImg = document.getElementById('modalFacePreviewImg');
    if (previewImg) previewImg.src = URL.createObjectURL(file);

    const statusText = document.getElementById('modalFacePhotoStatusText');
    if (statusText) {
        statusText.textContent = `Selected: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
        statusText.style.color = '#38bdf8';
    }
}

async function saveHeroFacePhoto() {
    if (!pendingHeroFaceFile) {
        showToast('Please select a face photo file first.', 'error');
        return;
    }

    const btn = document.getElementById('btnSaveHeroFacePhoto');
    if (btn) {
        btn.disabled = true;
        btn.textContent = '[UPLOADING BIOMETRICS...]';
    }

    const fd = new FormData();
    fd.append('avatar', pendingHeroFaceFile);

    try {
        const heroId = heroState.heroId;
        const res = await fetch(`/api/heroes/${encodeURIComponent(heroId)}/avatar`, {
            method: 'POST',
            body: fd
        });
        const data = await res.json();

        if (data.success && data.url) {
            if (heroState.hero) {
                heroState.hero.avatar = data.url;
                heroState.hero.profile_picture = data.url;
            }
            updateHeroUI();
            closeFacePhotoUploadModal();
            showToast('Biometric face photo updated successfully!', 'success');
        } else {
            showToast(data.error || 'Failed to update face photo.', 'error');
        }
    } catch (err) {
        showToast('Network error updating face photo: ' + err.message, 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = '[CONFIRM & SAVE FACE PHOTO]';
        }
    }
}

// ──────────────────────────────────────────────
// Hero Notifications & Tactical Alerts
// ──────────────────────────────────────────────
let heroNotificationsList = [];

async function fetchHeroNotifications() {
    try {
        const res = await fetch('/api/notifications');
        const data = await res.json();
        if (!data.success) return;

        const info = data.data;

        // 1. Sync Rogue Emergency Alert Banner
        const alertBanner = document.getElementById('rogueBroadcastBanner');
        const alertMsgEl = document.getElementById('rogueBroadcastMessage');
        if (alertBanner) {
            if (info.rogue_broadcast_active) {
                alertBanner.classList.add('active');
                if (alertMsgEl) {
                    alertMsgEl.textContent = info.rogue_broadcast_message || 'EMERGENCY BROADCAST ACTIVE: Rogue alert in Sectors 2 & 4.';
                }
            } else {
                alertBanner.classList.remove('active');
            }
        }

        // 2. Render Notifications Popover
        heroNotificationsList = info.notifications || [];
        renderHeroNotifications(heroNotificationsList, info.unread_count);
    } catch (err) {
        console.error('Failed to sync hero notifications:', err);
    }
}

function renderHeroNotifications(items, unreadCount) {
    const listEl = document.getElementById('heroNotifList');
    const pill = document.getElementById('heroNotifPill');

    const readIds = JSON.parse(localStorage.getItem('ghrms_read_hero_notifs') || '[]');
    let effectiveUnread = 0;

    if (!items || items.length === 0) {
        if (listEl) {
            listEl.innerHTML = '<div class="notif-empty">No active sector alerts or directives.</div>';
        }
        if (pill) pill.style.display = 'none';
        return;
    }

    if (listEl) {
        listEl.innerHTML = items.map(n => {
            const isRead = readIds.includes(n.id);
            if (!isRead && n.unread) effectiveUnread++;

            const tagClass = n.type === 'urgent' ? 'tag-urgent' :
                             n.type === 'warning' ? 'tag-warning' :
                             n.type === 'success' ? 'tag-success' : 'tag-info';
            const itemClass = n.type === 'urgent' ? 'urgent' : (!isRead && n.unread ? 'unread' : '');

            return `
                <div class="notif-item ${itemClass}" onclick="handleHeroNotifClick('${escapeHtml(n.link || '/hero')}', '${n.id}')">
                    <div class="notif-item-top">
                        <span class="notif-tag ${tagClass}">${escapeHtml(n.tag || '[ALERT]')}</span>
                        <span class="notif-time">${formatNotifTime(n.created_at)}</span>
                    </div>
                    <div style="font-weight:700;font-size:0.8rem;color:var(--text-main);">${escapeHtml(n.title || '')}</div>
                    <p class="notif-msg">${escapeHtml(n.message || '')}</p>
                </div>
            `;
        }).join('');
    }

    if (pill) {
        if (effectiveUnread > 0) {
            pill.textContent = effectiveUnread > 9 ? '9+' : effectiveUnread;
            pill.style.display = 'inline-flex';
        } else {
            pill.style.display = 'none';
        }
    }
}

function formatNotifTime(isoString) {
    if (!isoString) return 'Just now';
    try {
        const d = new Date(isoString);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
        return 'Recent';
    }
}

function handleHeroNotifClick(link, id) {
    const readIds = JSON.parse(localStorage.getItem('ghrms_read_hero_notifs') || '[]');
    if (!readIds.includes(id)) {
        readIds.push(id);
        localStorage.setItem('ghrms_read_hero_notifs', JSON.stringify(readIds));
    }
    const panel = document.getElementById('heroNotifPanel');
    if (panel) panel.style.display = 'none';
    if (link && link !== window.location.pathname) {
        window.location.href = link;
    } else {
        renderHeroNotifications(heroNotificationsList, 0);
    }
}

function toggleHeroNotifications(e) {
    if (e) e.stopPropagation();
    const panel = document.getElementById('heroNotifPanel');
    const btn = document.getElementById('heroNotifBtn');
    if (!panel) return;

    const isHidden = panel.style.display === 'none' || !panel.style.display;
    panel.style.display = isHidden ? 'flex' : 'none';
    if (btn) btn.setAttribute('aria-expanded', isHidden ? 'true' : 'false');
}

function markHeroNotificationsRead() {
    const ids = heroNotificationsList.map(n => n.id);
    localStorage.setItem('ghrms_read_hero_notifs', JSON.stringify(ids));
    renderHeroNotifications(heroNotificationsList, 0);
    showToast('All alerts & directives marked as read.', 'info');
}

function initHeroNotifications() {
    const btn = document.getElementById('heroNotifBtn');
    if (btn) {
        btn.addEventListener('click', toggleHeroNotifications);
    }

    // Dismiss on click outside
    document.addEventListener('click', (e) => {
        const panel = document.getElementById('heroNotifPanel');
        const btn = document.getElementById('heroNotifBtn');
        if (panel && panel.style.display !== 'none') {
            if (!panel.contains(e.target) && !btn.contains(e.target)) {
                panel.style.display = 'none';
                if (btn) btn.setAttribute('aria-expanded', 'false');
            }
        }
    });

    // Dismiss on Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const panel = document.getElementById('heroNotifPanel');
            if (panel) panel.style.display = 'none';
        }
    });

    fetchHeroNotifications();
    // Poll for emergency alerts every 15 seconds
    setInterval(fetchHeroNotifications, 15000);
}

// -------------------------------------------------------------
// Hero Access Control & Smooth Section Navigation
// -------------------------------------------------------------
window.scrollToHeroSection = function(sectionId) {
    const el = document.getElementById(sectionId);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const origBoxShadow = el.style.boxShadow;
    const origBorderColor = el.style.borderColor;
    el.style.transition = 'box-shadow 0.3s ease, border-color 0.3s ease';
    el.style.boxShadow = '0 0 16px rgba(56, 189, 248, 0.4)';
    el.style.borderColor = 'rgba(56, 189, 248, 0.7)';
    setTimeout(() => {
        el.style.boxShadow = origBoxShadow;
        el.style.borderColor = origBorderColor;
    }, 1400);
};

function checkAccessDeniedNotice() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('denied') === 'registry' || params.get('access_denied') === 'registry') {
        const notice = document.getElementById('heroAccessDeniedNotice');
        if (notice) {
            notice.style.display = 'block';
            notice.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        showToast('Access to Superhuman Operative Directory is restricted to Registrar personnel.', 'error');
        // Clean up URL query parameter without triggering page reload
        window.history.replaceState({}, '', window.location.pathname);
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    checkAccessDeniedNotice();
    initQrModal();
    initDamageDrawer();
    initUpdateForm();
    initHeroNotifications();
    await checkAuth();
    await loadHeroData();
});

