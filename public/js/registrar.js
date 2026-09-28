/**
 * GHRMS Registrar Desk Controller — Dedicated to /registrar
 */

const registrarState = {
    heroes: [],
    selectedHeroId: null,
    selectedHero: null,
    theme: 'dark',
    currentUser: null,
    activeDivision: 'all',
    viewMode: 'profiles'
};

function initTheme() {
    const saved = localStorage.getItem('ghrms_theme') || localStorage.getItem('color-scheme') || 'dark';
    applyRegistrarTheme(saved);

    const btn = document.getElementById('themeToggleBtn');
    if (btn) {
        btn.onclick = () => {
            const current = registrarState.theme || document.documentElement.getAttribute('data-theme') || 'dark';
            const next = current === 'dark' ? 'light' : 'dark';
            localStorage.setItem('ghrms_theme', next);
            localStorage.setItem('color-scheme', next);
            applyRegistrarTheme(next);
            showToast(`Theme switched to ${next} mode`, 'info');
        };
    }

    window.addEventListener('storage', (e) => {
        if (e.key === 'ghrms_theme' || e.key === 'color-scheme') {
            const next = e.newValue || 'dark';
            applyRegistrarTheme(next);
        }
    });
}

function applyRegistrarTheme(theme) {
    registrarState.theme = theme;
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
    toast.innerHTML = `<span style="font-weight:700;font-family:var(--font-mono);font-size:0.75rem;">${ic}</span> <span>${message}</span>`;
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

async function apiPut(endpoint, body = {}) {
    try {
        const res = await fetch(`/api/${endpoint}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        return await res.json();
    } catch (err) {
        return { success: false, error: err.message };
    }
}

async function loadHeroes() {
    const res = await apiGet('heroes');
    if (res.success && Array.isArray(res.data)) {
        registrarState.heroes = res.data;

        // Check URL parameter ?hero=... for direct deep-linking from Admin or Sentinel
        const urlParams = new URLSearchParams(window.location.search);
        const paramHeroId = urlParams.get('hero');
        if (paramHeroId) {
            const foundHero = res.data.find(h => h.id === paramHeroId);
            if (foundHero) {
                registrarState.selectedHero = foundHero;
                registrarState.selectedHeroId = foundHero.id;
                if (foundHero.status === 'Under Review' || foundHero.status === 'Pending' || foundHero.status === 'Submitted') {
                    registrarState.viewMode = 'queue';
                    const btnQueue = document.getElementById('btnModeQueue');
                    const btnProfiles = document.getElementById('btnModeProfiles');
                    if (btnQueue && btnProfiles) {
                        btnQueue.classList.add('active');
                        btnProfiles.classList.remove('active');
                    }
                }
            }
        }

        if (!registrarState.selectedHeroId && res.data.length > 0) {
            registrarState.selectedHero   = res.data[0];
            registrarState.selectedHeroId = res.data[0].id;
        } else if (registrarState.selectedHeroId && !paramHeroId) {
            registrarState.selectedHero = res.data.find(h => h.id === registrarState.selectedHeroId) || res.data[0];
        }
        renderQueueTable();
    } else {
        const tbody = document.getElementById('registrarTableBody');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2.5rem 1rem;color:#f87171;">
                <div style="font-size:0.9rem;font-weight:800;margin-bottom:0.35rem;">[ACCESS RESTRICTED]</div>
                <div style="font-size:0.78rem;color:var(--text-muted);">${res.error || 'Clearance Level 3+ required to view registration queue.'}</div>
                <a href="/login" style="display:inline-block;margin-top:0.75rem;font-size:0.75rem;color:var(--text-main);text-decoration:none;border:1px solid var(--border-color);padding:0.3rem 0.75rem;border-radius:4px;">Log In with Registrar / Admin Clearance</a>
            </td></tr>`;
        }
        showToast(res.error || 'Failed to load hero queue', 'error');
    }
}

function renderQueueTable() {
    const tbody = document.getElementById('registrarTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const pendingHeroes  = registrarState.heroes.filter(h => h.status === 'Under Review' || h.status === 'Pending' || h.status === 'Submitted');
    const licensedHeroes = registrarState.heroes.filter(h => h.status !== 'Under Review' && h.status !== 'Pending' && h.status !== 'Submitted');

    // Update dynamic navigation & toolbar badges
    const elPendingQueue   = document.getElementById('countPendingQueue');
    const elActiveProfiles = document.getElementById('countActiveProfiles');
    const elNavQueue       = document.getElementById('countQueuePendingBadge');
    const elNavProfiles    = document.getElementById('navHeroProfilesCount');

    if (elPendingQueue)   elPendingQueue.textContent   = pendingHeroes.length;
    if (elActiveProfiles) elActiveProfiles.textContent = licensedHeroes.length;
    if (elNavProfiles)    elNavProfiles.textContent    = licensedHeroes.length || registrarState.heroes.length;
    if (elNavQueue) {
        elNavQueue.textContent = pendingHeroes.length;
        if (pendingHeroes.length === 0) {
            elNavQueue.style.background  = 'rgba(52,211,153,0.18)';
            elNavQueue.style.borderColor = 'rgba(52,211,153,0.4)';
            elNavQueue.style.color       = '#34d399';
        } else {
            elNavQueue.style.background  = 'rgba(245,158,11,0.2)';
            elNavQueue.style.borderColor = 'rgba(245,158,11,0.5)';
            elNavQueue.style.color       = '#fbbf24';
        }
    }

    const emptyNotice   = document.getElementById('emptyQueueNotice');
    const rosterHeading = document.getElementById('currentRosterHeading');

    let baseList = [];
    if (registrarState.viewMode === 'queue') {
        if (pendingHeroes.length === 0) {
            // "if there are no hero regestration queue put it in hrto profiles"
            if (emptyNotice)   emptyNotice.style.display = 'flex';
            if (rosterHeading) rosterHeading.innerHTML   = `HERO PROFILES <span style="color:var(--text-subtle);font-weight:400;">| QUEUE CLEAR &middot; ACTIVE ROSTER</span>`;
            baseList = licensedHeroes;
        } else {
            if (emptyNotice)   emptyNotice.style.display = 'none';
            if (rosterHeading) rosterHeading.innerHTML   = `REGISTRATION QUEUE <span style="color:var(--text-subtle);font-weight:400;">| PENDING ASSESSMENT</span>`;
            baseList = pendingHeroes;
        }
    } else {
        if (emptyNotice)   emptyNotice.style.display = 'none';
        if (rosterHeading) rosterHeading.innerHTML   = `HERO PROFILES <span style="color:var(--text-subtle);font-weight:400;">| VERIFIED ROSTER</span>`;
        baseList = licensedHeroes;
    }

    // Count operands by classification in the displayed list
    const allCount      = baseList.length;
    const heroesCount   = baseList.filter(h => (h.role_tag || (h.mentor ? 'Sidekick' : 'Hero')) === 'Hero').length;
    const sidekickCount = baseList.filter(h => (h.role_tag || (h.mentor ? 'Sidekick' : 'Hero')) === 'Sidekick').length;

    const elAll = document.getElementById('countRegAll');
    const elH   = document.getElementById('countRegHeroes');
    const elS   = document.getElementById('countRegSidekicks');
    if (elAll) elAll.textContent = allCount;
    if (elH)   elH.textContent   = heroesCount;
    if (elS)   elS.textContent   = sidekickCount;

    const searchTerm = (document.getElementById('queueSearchInput')?.value || '').toLowerCase();
    let filtered = baseList.filter(h => {
        if (!searchTerm) return true;
        return h.alias.toLowerCase().includes(searchTerm) ||
               (h.primary_power && h.primary_power.toLowerCase().includes(searchTerm));
    });

    // Apply division filter
    if (registrarState.activeDivision && registrarState.activeDivision !== 'all') {
        filtered = filtered.filter(h => {
            const role = h.role_tag || (h.mentor ? 'Sidekick' : 'Hero');
            return role === registrarState.activeDivision;
        });
    }

    const badge = document.getElementById('queueCounterBadge');
    if (badge) badge.textContent = `${filtered.length} Operatives`;

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2.5rem 1rem;color:var(--text-muted);">
            <div style="font-weight:700;font-size:0.85rem;margin-bottom:0.35rem;color:var(--text-main);">[NO OPERATIVES MATCH CURRENT FILTER]</div>
            <div style="font-size:0.75rem;">Clear search terms or switch division filter to view all profiles.</div>
        </td></tr>`;
        return;
    }

    // Ensure selectedHero is in the active list
    if (!baseList.find(h => h.id === registrarState.selectedHeroId) && baseList.length > 0) {
        registrarState.selectedHeroId = baseList[0].id;
        registrarState.selectedHero   = baseList[0];
    }

    filtered.forEach(h => {
        const tr = document.createElement('tr');
        if (h.id === registrarState.selectedHeroId) tr.classList.add('selected');

        const isSidekick  = (h.role_tag === 'Sidekick') || !!h.mentor;
        const divBadge    = isSidekick
            ? `<span style="font-size:0.6rem;padding:2px 6px;border-radius:4px;background:rgba(167,139,250,0.18);border:1px solid rgba(167,139,250,0.4);color:#c084fc;font-weight:700;">[SIDEKICK]</span>`
            : `<span style="font-size:0.6rem;padding:2px 6px;border-radius:4px;background:rgba(255,255,255,0.1);border:1px solid var(--border-color);color:var(--text-main);font-weight:700;">[HERO]</span>`;

        const threatLabel = h.threat_tier_label || 'Unknown';
        const tierCode    = threatLabel.match(/\(([^)]+)\)/)?.[1] || 'UNK';
        const tierClass   = tierCode.toLowerCase().replace(/[^a-z0-9]/g, '-');
        const mentorTag   = h.mentor ? `<span style="font-size:0.62rem;color:#c084fc;display:block;">↳ Mentor: <strong>${h.mentor}</strong></span>` : '';
        const sidekicks   = (h.sidekicks || []).length > 0
            ? `<span style="font-size:0.62rem;color:var(--text-muted);display:block;">Sidekicks: <strong>${h.sidekicks.join(', ')}</strong></span>` : '';

        tr.innerHTML = `
            <td>
                <div class="table-hero-cell">
                    <img src="${h.avatar || '/img/apex.jpg'}" alt="${h.alias}" class="table-hero-avatar">
                    <div class="table-hero-text">
                        <div style="display:flex;align-items:center;gap:0.35rem;">
                            <span class="table-hero-alias">${h.alias}</span>
                            ${divBadge}
                        </div>
                        <span class="table-hero-sub">${mentorTag || sidekicks || 'ID: ' + h.id.substring(0,12)}</span>
                    </div>
                </div>
            </td>
            <td><span style="color:var(--text-muted);font-size:0.75rem;">${h.region || '—'}</span></td>
            <td><span style="color:var(--text-main);font-weight:600;">${h.primary_power}</span></td>
            <td><span class="threat-badge ${tierClass}">${tierCode}</span></td>
            <td>
                <span class="${h.status === 'Licensed' ? 'status-pill-licensed' : h.status === 'Rogue' ? 'status-pill-rogue' : 'status-pill-reviewing'}">
                    ${h.status || 'REVIEWING'}
                </span>
            </td>
            <td>
                <div class="table-actions-cell" onclick="event.stopPropagation();">
                    <button class="btn-mini btn-mini-assess"  onclick="assessHero('${h.id}')">Assess</button>
                    <button class="btn-mini btn-mini-approve" onclick="approveHero('${h.id}')">Approve</button>
                    <button class="btn-mini"                  onclick="openEditModal('${h.id}')" style="background:rgba(99,102,241,0.18);border:1px solid rgba(99,102,241,0.4);color:#a5b4fc;font-weight:700;">[EDIT RECORD]</button>
                </div>
            </td>
        `;

        tr.onclick = () => {
            registrarState.selectedHeroId = h.id;
            registrarState.selectedHero   = h;
            renderQueueTable();
            updateDetailsPanel(h);
            if (window.innerWidth <= 1024) {
                document.querySelector('.right-details-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        };

        tbody.appendChild(tr);
    });

    if (registrarState.selectedHero) updateDetailsPanel(registrarState.selectedHero);
}

function updateDetailsPanel(hero) {
    const title    = document.getElementById('detailsHeaderTitle');
    const avatar   = document.getElementById('detailsAvatarImg');
    const realName = document.getElementById('detailsRealNameText');
    const alias    = document.getElementById('detailsAliasText');
    const age      = document.getElementById('detailsAgeText');
    const dob      = document.getElementById('detailsDobText');
    const loc      = document.getElementById('detailsLocationText');
    const pLabel   = document.getElementById('primaryPowerLabel');
    const pLevel   = document.getElementById('primaryPowerLevel');
    const pFill    = document.getElementById('primaryMeterFill');
    const sLabel   = document.getElementById('secondaryPowerLabel');
    const sLevel   = document.getElementById('secondaryPowerLevel');
    const sFill    = document.getElementById('secondaryMeterFill');

    // Sidekick/mentor info area
    let sidekickInfoEl = document.getElementById('sidekickInfoArea');
    if (!sidekickInfoEl) {
        sidekickInfoEl = document.createElement('div');
        sidekickInfoEl.id = 'sidekickInfoArea';
        sidekickInfoEl.style.cssText = 'font-size:0.72rem;margin-top:0.4rem;display:flex;flex-direction:column;gap:3px;';
        const metaBlock = document.querySelector('.applicant-profile-meta');
        if (metaBlock) metaBlock.appendChild(sidekickInfoEl);
    }

    const rName = hero.real_name || (hero.vault_info && hero.vault_info.real_name) || 'Classified Bio';
    if (title)    title.innerHTML = `APPLICANT DETAILS: ${hero.alias} <span style="font-weight:400;color:var(--text-muted);">(${hero.region || 'Unknown Region'})</span>`;
    if (avatar)   avatar.src = hero.avatar || '/img/apex.jpg';
    if (realName) realName.textContent = hero.real_name ? `${hero.alias} (${hero.real_name})` : (hero.alias + ' (Vault Protected)');
    if (alias)    alias.textContent = hero.alias;
    if (age)      age.textContent = hero.vault_info?.age || '34';
    if (dob)      dob.textContent = hero.vault_info?.dob || 'Aug. 21, 1983';
    if (loc)      loc.textContent = hero.region ? hero.region.split(' - ')[0] : 'Sector 1';

    if (pLabel)   pLabel.textContent = `Primary Power: ${hero.primary_power}`;
    if (pLevel)   pLevel.textContent = hero.threat_tier_label || '—';
    if (pFill)    pFill.style.width  = `${Math.min(100, (hero.threat_tier || 3) * 20)}%`;
    if (sLabel)   sLabel.textContent = hero.secondary_power || 'None';
    if (sLevel)   sLevel.textContent = hero.status || '—';
    if (sFill)    sFill.style.width  = hero.status === 'Licensed' ? '100%' : '40%';

    // Division Badge & Mentorship Card
    const divBadge   = document.getElementById('regDivisionBadge');
    const mentorSub  = document.getElementById('regMentorshipSubtext');
    const promoteBtn = document.getElementById('btnRegPromoteSidekick');
    const isSidekick = (hero.role_tag === 'Sidekick') || !!hero.mentor;

    if (divBadge) {
        if (isSidekick) {
            divBadge.innerHTML = '[SIDEKICK DIVISION]';
            divBadge.style.color = '#c084fc';
        } else {
            divBadge.innerHTML = '[PRIMARY HERO DIVISION]';
            divBadge.style.color = 'var(--text-main)';
        }
    }

    if (mentorSub) {
        if (isSidekick) {
            mentorSub.innerHTML = `Supervising Mentor: <strong style="color:var(--text-main);">${hero.mentor || 'None Assigned'}</strong>`;
        } else {
            const sidekicksList = Array.isArray(hero.sidekicks) && hero.sidekicks.length > 0
                ? hero.sidekicks.join(', ')
                : 'None Assigned';
            mentorSub.innerHTML = `Attached Sidekicks: <strong style="color:var(--text-main);">${sidekicksList}</strong>`;
        }
    }

    if (promoteBtn) {
        if (isSidekick) {
            promoteBtn.style.display = 'inline-block';
            promoteBtn.onclick = async () => {
                if (!confirm(`Graduate operative "${hero.alias}" from Sidekick to full Primary Hero? This grants independent operational clearance.`)) return;
                const res = await apiPost(`heroes/${hero.id}/promote-to-hero`, {});
                if (res.success) {
                    showToast(`Operative ${hero.alias} graduated to Primary Hero!`, 'success');
                    registrarState.selectedHeroId = hero.id;
                    await loadHeroes();
                } else {
                    showToast(res.error || 'Failed to graduate sidekick', 'error');
                }
            };
        } else {
            promoteBtn.style.display = 'none';
            promoteBtn.onclick = null;
        }
    }

    // Sidekick / mentor display
    sidekickInfoEl.innerHTML = '';
    if (hero.mentor) {
        sidekickInfoEl.innerHTML += `<span style="color:var(--text-main);">Mentor: <strong>${hero.mentor}</strong></span>`;
    }
    if (hero.sidekicks && hero.sidekicks.length > 0) {
        sidekickInfoEl.innerHTML += `<span style="color:#34d399;">Sidekicks: <strong>${hero.sidekicks.join(', ')}</strong></span>`;
    }
    if (hero.role_tag === 'Sidekick') {
        sidekickInfoEl.innerHTML += `<span style="color:#a78bfa;font-weight:700;">[SIDEKICK DIVISION]</span>`;
    }

    // Dynamic Approve / Revoke License button toggle
    const finalBtn  = document.getElementById('btnFinalRegistration');
    const revBanner = document.getElementById('registrarRevocationBanner');
    const revText   = document.getElementById('registrarRevocationReasonText');

    if (hero.status === 'Licensed') {
        if (finalBtn) {
            finalBtn.innerHTML = '[REVOKE LICENSE]';
            finalBtn.style.background = 'rgba(239, 68, 68, 0.15)';
            finalBtn.style.borderColor = 'rgba(239, 68, 68, 0.45)';
            finalBtn.style.color = '#f87171';
        }
        if (revBanner) revBanner.style.display = 'none';
    } else {
        if (finalBtn) {
            finalBtn.innerHTML = '[APPROVE / LICENSE OPERATIVE]';
            finalBtn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
            finalBtn.style.borderColor = '#34d399';
            finalBtn.style.color = '#ffffff';
        }
        if (hero.status === 'Revoked') {
            if (revBanner) {
                revBanner.style.display = 'block';
                if (revText) {
                    revText.textContent = hero.revocation_confidential
                        ? '[CLASSIFIED SECURITY DIRECTIVE · CLEARANCE L5]'
                        : (hero.revocation_reason || 'License suspended by directive');
                }
            }
        } else {
            if (revBanner) revBanner.style.display = 'none';
        }
    }
}

// ──────────────────────────────────────────────
// Edit Modal
// ──────────────────────────────────────────────
function openEditModal(heroId) {
    const hero = registrarState.heroes.find(h => h.id === heroId);
    if (!hero) return;
    registrarState.selectedHeroId = heroId;
    registrarState.selectedHero   = hero;

    // Populate mentor dropdown
    const mentorSel = document.getElementById('editMentorSelect');
    if (mentorSel) {
        mentorSel.innerHTML = '<option value="">— None —</option>';
        registrarState.heroes
            .filter(h => h.id !== heroId)
            .forEach(h => {
                const opt = document.createElement('option');
                opt.value = h.id;
                opt.textContent = h.alias;
                if (h.alias === hero.mentor) opt.selected = true;
                mentorSel.appendChild(opt);
            });
    }

    const realNameEl = document.getElementById('editHeroRealName');
    const govIdEl    = document.getElementById('editHeroGovId');
    const gearEl     = document.getElementById('editHeroGear');

    if (realNameEl) realNameEl.value = hero.real_name || (hero.vault_info && hero.vault_info.real_name) || '';
    if (govIdEl)    govIdEl.value    = hero.gov_code || hero.license_number || '';
    if (gearEl)     gearEl.value     = Array.isArray(hero.gear_manifest) ? hero.gear_manifest.join(', ') : (hero.gear_manifest || '');

    document.getElementById('editHeroAlias').value         = hero.alias || '';
    document.getElementById('editPrimaryPower').value      = hero.primary_power || '';
    document.getElementById('editSecondaryPower').value    = hero.secondary_power || '';
    document.getElementById('editRegion').value            = hero.region || '';
    document.getElementById('editStatus').value            = hero.status || 'Under Review';
    document.getElementById('editThreatTier').value        = hero.threat_tier ?? 3;
    document.getElementById('editHeroModalTitle').textContent = `[EDIT: ${hero.alias}]`;

    document.getElementById('heroEditModal').classList.add('active');
}

async function submitEditHero(e) {
    e.preventDefault();
    const hero = registrarState.selectedHero;
    if (!hero) return;

    const mentorSelectEl = document.getElementById('editMentorSelect');
    const mentorHeroId   = mentorSelectEl?.value || '';
    const mentorHero     = registrarState.heroes.find(h => h.id === mentorHeroId);

    const gearRaw = document.getElementById('editHeroGear')?.value.trim() || '';
    const gearManifest = gearRaw ? gearRaw.split(',').map(s => s.trim()).filter(Boolean) : [];

    const payload = {
        real_name:       document.getElementById('editHeroRealName')?.value.trim() || '',
        gov_id:          document.getElementById('editHeroGovId')?.value.trim() || '',
        alias:           document.getElementById('editHeroAlias').value.trim(),
        primary_power:   document.getElementById('editPrimaryPower').value.trim(),
        secondary_power: document.getElementById('editSecondaryPower').value.trim(),
        region:          document.getElementById('editRegion').value.trim(),
        status:          document.getElementById('editStatus').value,
        threat_tier:     parseInt(document.getElementById('editThreatTier').value, 10),
        gear_manifest:   gearManifest,
        mentor:          mentorHero ? mentorHero.alias : (hero.mentor || null)
    };

    const saveBtn = document.getElementById('btnSaveEditHero');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving...'; }

    const res = await apiPut(`heroes/${hero.id}`, payload);

    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '[SAVE ALL CHANGES]'; }

    if (res.success) {
        showToast(`Operative ${res.data.alias} updated successfully. All changes saved.`, 'success');
        document.getElementById('heroEditModal').classList.remove('active');

        // If there's a mentor selected and it's different, enroll as sidekick too
        if (mentorHeroId && mentorHeroId !== '') {
            const skRes = await apiPost(`heroes/${hero.id}/enroll-sidekick`, { mentor_hero_id: mentorHeroId });
            if (skRes.success) showToast(skRes.message, 'success');
        }

        registrarState.selectedHeroId = hero.id;
        await loadHeroes();
        const updated = registrarState.heroes.find(h => h.id === hero.id);
        if (updated) {
            registrarState.selectedHero = updated;
            updateDetails(updated);
        }
    } else {
        showToast(`Save failed: ${res.error}`, 'error');
    }
}

// ──────────────────────────────────────────────
// Quick action buttons
// ──────────────────────────────────────────────
async function approveHero(heroId) {
    const res = await apiPost(`heroes/${heroId}/assess`, { action: 'APPROVE_LICENSE' });
    if (res.success) {
        showToast(`Field License granted to ${res.data.alias}! Status updated to Licensed.`, 'success');
        registrarState.selectedHeroId = heroId;
        await loadHeroes();
    } else {
        showToast(res.error || 'Approve failed', 'error');
    }
}

function openRevokeModal(hero) {
    if (!hero) return;
    registrarState.selectedHeroId = hero.id;
    registrarState.selectedHero = hero;

    const titleEl = document.getElementById('revokeModalAliasTitle');
    if (titleEl) titleEl.textContent = hero.alias;

    const catSel = document.getElementById('revokeReasonCategory');
    const reasonText = document.getElementById('revokeReasonText');
    const confCheck = document.getElementById('revokeConfidentialCheck');

    if (catSel) catSel.value = 'Accord Violation (Code 104 - Collateral Threat)';
    if (reasonText) reasonText.value = 'Accord Violation (Code 104 - Collateral Threat): Operative exceeded permissible municipal force threshold during active deployment.';
    if (confCheck) confCheck.checked = false;

    document.getElementById('revokeLicenseModal')?.classList.add('active');
}

function onRevokeCategoryChange(cat) {
    const reasonText = document.getElementById('revokeReasonText');
    const confCheck  = document.getElementById('revokeConfidentialCheck');
    if (!reasonText) return;

    if (cat === 'Accord Violation (Code 104 - Collateral Threat)') {
        reasonText.value = 'Accord Violation (Code 104 - Collateral Threat): Operative exceeded permissible municipal force threshold during active deployment.';
        if (confCheck) confCheck.checked = false;
    } else if (cat === 'Power Volatility & Containment Breach') {
        reasonText.value = 'Tactical power volatility detected during sector patrol. Containment limiter required before field reinstatement.';
        if (confCheck) confCheck.checked = false;
    } else if (cat === 'Failure of Mandatory Face-to-Face Evaluation') {
        reasonText.value = 'Operative failed or refused mandatory Face-to-Face evaluation and psychological accords screening.';
        if (confCheck) confCheck.checked = false;
    } else if (cat === 'Civic Misconduct / Criminal Allegation') {
        reasonText.value = 'Active civic misconduct inquiry initiated by municipal registry. License suspended pending investigation.';
        if (confCheck) confCheck.checked = false;
    } else if (cat === 'Classified Security Directive') {
        reasonText.value = 'Clearance Directive L5: Operative status suspended pursuant to confidential national security accords.';
        if (confCheck) confCheck.checked = true;
    } else {
        reasonText.value = '';
    }
}

async function submitRevokeLicense(e) {
    if (e) e.preventDefault();
    const hero = registrarState.selectedHero;
    if (!hero) return;

    const reason = document.getElementById('revokeReasonText')?.value?.trim() || 'License revoked by directive.';
    const confidential = !!document.getElementById('revokeConfidentialCheck')?.checked;

    const res = await apiPost(`heroes/${hero.id}/assess`, {
        action: 'REVOKE_LICENSE',
        reason: reason,
        confidential: confidential
    });

    if (res.success) {
        showToast(`License REVOKED for ${hero.alias}. Reason logged to audit ledger.`, 'error');
        document.getElementById('revokeLicenseModal')?.classList.remove('active');
        await loadHeroes();
    } else {
        showToast(res.error || 'Failed to revoke license', 'error');
    }
}

async function denyHero(heroId) {
    const hero = registrarState.heroes.find(h => h.id === heroId);
    if (hero) {
        openRevokeModal(hero);
    }
}

async function assessHero(heroId) {
    const res = await apiPost(`heroes/${heroId}/assess`, { action: 'REQUEST_POWER_AUDIT' });
    if (res.success) {
        showToast(`Power audit scheduled for ${res.data.alias}.`, 'info');
        registrarState.selectedHeroId = heroId;
        await loadHeroes();
    }
}

// ──────────────────────────────────────────────
// Modals & misc wiring
// ──────────────────────────────────────────────
function initActions() {
    // Primary Roster Mode Tabs: [1] REGISTRATION QUEUE vs [2] HERO PROFILES
    const btnModeQueue    = document.getElementById('btnModeQueue');
    const btnModeProfiles = document.getElementById('btnModeProfiles');
    const navLinkRegQueue = document.getElementById('navLinkRegQueue');

    const setRosterMode = (mode) => {
        registrarState.viewMode = mode;
        if (btnModeQueue && btnModeProfiles) {
            const isQueue = mode === 'queue';
            btnModeQueue.classList.toggle('active', isQueue);
            btnModeQueue.style.background  = isQueue ? 'var(--primary)' : 'rgba(255,255,255,0.05)';
            btnModeQueue.style.borderColor = isQueue ? 'var(--border-focus)' : 'var(--border-color)';
            btnModeQueue.style.color       = isQueue ? 'var(--bg-app)' : 'var(--text-muted)';

            btnModeProfiles.classList.toggle('active', !isQueue);
            btnModeProfiles.style.background  = !isQueue ? 'var(--primary)' : 'rgba(255,255,255,0.05)';
            btnModeProfiles.style.borderColor = !isQueue ? 'var(--border-focus)' : 'var(--border-color)';
            btnModeProfiles.style.color       = !isQueue ? 'var(--bg-app)' : 'var(--text-muted)';
        }
        renderQueueTable();
    };

    if (btnModeQueue)    btnModeQueue.onclick    = () => setRosterMode('queue');
    if (btnModeProfiles) btnModeProfiles.onclick = () => setRosterMode('profiles');
    if (navLinkRegQueue) {
        navLinkRegQueue.onclick = (e) => {
            e.preventDefault();
            setRosterMode('queue');
        };
    }

    // Division Tab Filter wiring
    const tabAll       = document.getElementById('btnRegTabAll');
    const tabHeroes    = document.getElementById('btnRegTabHeroes');
    const tabSidekicks = document.getElementById('btnRegTabSidekicks');

    const setDivisionTab = (div) => {
        registrarState.activeDivision = div;
        [tabAll, tabHeroes, tabSidekicks].forEach(btn => {
            if (!btn) return;
            const isMatch = btn.getAttribute('data-division') === div;
            btn.classList.toggle('active', isMatch);
            btn.style.background  = isMatch ? 'var(--primary)' : 'rgba(255,255,255,0.05)';
            btn.style.borderColor = isMatch ? 'var(--border-focus)' : 'var(--border-color)';
            btn.style.color       = isMatch ? 'var(--bg-app)' : 'var(--text-muted)';
        });
        renderQueueTable();
    };

    if (tabAll)       tabAll.onclick       = () => setDivisionTab('all');
    if (tabHeroes)    tabHeroes.onclick    = () => setDivisionTab('Hero');
    if (tabSidekicks) tabSidekicks.onclick = () => setDivisionTab('Sidekick');

    // Search input wiring
    const searchInput = document.getElementById('queueSearchInput');
    if (searchInput) searchInput.oninput = () => renderQueueTable();

    // Vault decrypt
    const decryptBtn = document.getElementById('btnDecryptBioVault');
    const vaultModal = document.getElementById('vaultBioModal');
    const vaultContent = document.getElementById('vaultModalContent');
    const closeVault   = document.getElementById('closeVaultModalBtn');

    if (decryptBtn && vaultModal) {
        decryptBtn.onclick = async () => {
            const hero = registrarState.selectedHero;
            if (!hero) return;
            decryptBtn.textContent = 'Decrypting...';
            const res = await apiPost(`heroes/${hero.id}/decrypt-vault`);
            decryptBtn.textContent = '[DECRYPT BIO]';
            if (res.success) {
                const bio = res.bio_data;
                vaultContent.innerHTML = `
                    <div style="background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.35);padding:0.65rem;border-radius:4px;font-size:0.75rem;color:var(--text-main);font-weight:700;">
                        [PRIVILEGED AUDIT RECORDED]: Vault ${res.vault_id} decrypted.
                    </div>
                    <div style="display:flex;flex-direction:column;gap:0.5rem;font-size:0.8rem;margin-top:0.65rem;">
                        <div><strong style="color:var(--text-muted);">Legal Name:</strong> <span style="font-family:var(--font-mono);color:var(--text-main);">${bio.real_name}</span></div>
                        <div><strong style="color:var(--text-muted);">Federal ID:</strong> <span style="font-family:var(--font-mono);">${bio.gov_id}</span></div>
                        <div><strong style="color:var(--text-muted);">DNA Marker:</strong> <span style="font-family:var(--font-mono);">${bio.biometric_dna_ref}</span></div>
                        <div><strong style="color:var(--text-muted);">Safehouse:</strong> <span>${bio.safehouse_address}</span></div>
                        <div><strong style="color:var(--text-muted);">Handler:</strong> <span>${bio.handler_contact}</span></div>
                    </div>`;
                vaultModal.classList.add('active');
                showToast('AES-256 Vault decrypted. Logged to audit ledger.', 'success');
            } else {
                showToast(`Decrypt error: ${res.error}`, 'error');
            }
        };
    }
    if (closeVault && vaultModal) closeVault.onclick = () => vaultModal.classList.remove('active');

    // Final registration confirm / Revoke License toggle
    const finalBtn = document.getElementById('btnFinalRegistration');
    if (finalBtn) {
        finalBtn.onclick = async () => {
            const hero = registrarState.selectedHero;
            if (!hero) {
                showToast('Please select an operative first.', 'error');
                return;
            }
            if (hero.status === 'Licensed') {
                openRevokeModal(hero);
            } else {
                const res = await apiPost(`heroes/${hero.id}/assess`, { action: 'APPROVE_LICENSE' });
                if (res.success) {
                    showToast(`LICENSING APPROVED for ${hero.alias}! Status is now Licensed.`, 'success');
                    await loadHeroes();
                } else {
                    showToast(res.error || 'Approval failed', 'error');
                }
            }
        };
    }

    // Revoke license modal handlers
    const revokeModal   = document.getElementById('revokeLicenseModal');
    const closeRevoke   = document.getElementById('closeRevokeModalBtn');
    const cancelRevoke  = document.getElementById('cancelRevokeBtn');
    const revokeForm    = document.getElementById('revokeLicenseForm');
    const revokeCatSel  = document.getElementById('revokeReasonCategory');

    if (closeRevoke && revokeModal)  closeRevoke.onclick  = () => revokeModal.classList.remove('active');
    if (cancelRevoke && revokeModal) cancelRevoke.onclick = () => revokeModal.classList.remove('active');
    if (revokeForm)   revokeForm.onsubmit = submitRevokeLicense;
    if (revokeCatSel) revokeCatSel.onchange = e => onRevokeCategoryChange(e.target.value);

    // Edit modal
    const editModal   = document.getElementById('heroEditModal');
    const closeEdit   = document.getElementById('closeEditModalBtn');
    const editForm    = document.getElementById('heroEditForm');
    if (closeEdit && editModal)  closeEdit.onclick = () => editModal.classList.remove('active');
    if (editForm)                editForm.onsubmit  = submitEditHero;

    // Sidekick quick-enroll from details panel
    const sidekickBtn = document.getElementById('btnEnrollSidekick');
    if (sidekickBtn) {
        sidekickBtn.onclick = () => {
            const hero = registrarState.selectedHero;
            if (!hero) return;
            openEditModal(hero.id);
            showToast('Select a mentor in the Edit modal to enroll as sidekick.', 'info');
        };
    }

    // Audit ledger modal (registrar view)
    const auditBtn   = document.getElementById('navOpenAuditLedger');
    const auditModal = document.getElementById('auditLedgerModal');
    const closeAudit = document.getElementById('closeAuditModalBtn');

    if (auditBtn && auditModal) {
        auditBtn.onclick = async () => {
            auditModal.classList.add('active');
            const res = await apiGet('audit-ledger');
            if (res.success) {
                const tbody = document.getElementById('auditTableBodyReg');
                if (!tbody) return;
                tbody.innerHTML = '';
                res.data.slice(0, 15).forEach(item => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${new Date(item.timestamp).toLocaleTimeString()}</td>
                        <td><strong>${item.actor}</strong></td>
                        <td><span class="threat-badge b-class">${item.action}</span></td>
                        <td>${item.target_id}</td>
                        <td style="font-family:var(--font-mono);color:var(--primary-accent);">${item.hash.substring(0,12)}...</td>
                    `;
                    tbody.appendChild(tr);
                });
            }
        };
    }
    if (closeAudit && auditModal) closeAudit.onclick = () => auditModal.classList.remove('active');

    // Badge verifier
    const verifyBtn   = document.getElementById('navOpenVerifyModal');
    const closeVerify = document.getElementById('closeVerifyModalBtn');
    const verifyModal = document.getElementById('verifierModal');
    if (verifyBtn) verifyBtn.onclick = openBadgeVerifierModal;
    if (closeVerify && verifyModal) closeVerify.onclick = () => verifyModal.classList.remove('active');

    // Hero Passkey Reset
    const btnChangePassReg  = document.getElementById('btnChangeHeroPasskeyReg');
    const navHeroPassReg    = document.getElementById('navOpenHeroPasskeysReg');
    const passkeyModal      = document.getElementById('heroPasskeyResetModal');
    const closePasskeyBtn   = document.getElementById('closePasskeyModalBtn');
    const cancelPasskeyBtn  = document.getElementById('cancelPasskeyResetBtn');
    const passkeyForm       = document.getElementById('heroPasskeyResetForm');
    const btnGenPass        = document.getElementById('btnGenTempPasskey');

    if (btnChangePassReg) btnChangePassReg.onclick = () => openHeroPasskeyModal(registrarState.selectedHero);
    if (navHeroPassReg)   navHeroPassReg.onclick   = () => openHeroPasskeyModal();
    if (closePasskeyBtn && passkeyModal)  closePasskeyBtn.onclick  = () => passkeyModal.classList.remove('active');
    if (cancelPasskeyBtn && passkeyModal) cancelPasskeyBtn.onclick = () => passkeyModal.classList.remove('active');
    if (passkeyForm)      passkeyForm.onsubmit     = submitHeroPasskeyReset;
    if (btnGenPass) {
        btnGenPass.onclick = () => {
            const passInput = document.getElementById('newHeroPasskeyInput');
            if (passInput) passInput.value = generateRandomHeroPasskey();
        };
    }
}

// ──────────────────────────────────────────────
// Hero Passkey Reset Logic (Registrar & Admin Desk)
// ──────────────────────────────────────────────
function openHeroPasskeyModal(hero = null) {
    const modal = document.getElementById('heroPasskeyResetModal');
    if (!modal) return;

    const select = document.getElementById('passkeyHeroSelect');
    const heroes = registrarState.heroes || [];

    if (select) {
        select.innerHTML = '';
        heroes.forEach(h => {
            const opt = document.createElement('option');
            opt.value = h.id;
            opt.textContent = `${h.alias} (${h.real_name || 'Classified'}) [${h.id}]`;
            select.appendChild(opt);
        });

        const target = hero || registrarState.selectedHero || heroes[0];
        if (target) {
            select.value = target.id;
        }

        select.onchange = () => {
            const chosen = heroes.find(h => h.id === select.value);
            if (chosen) updatePasskeyModalHeroDisplay(chosen);
        };
    }

    const targetHero = hero || registrarState.selectedHero || heroes[0];
    if (targetHero) {
        updatePasskeyModalHeroDisplay(targetHero);
    }

    const passInput = document.getElementById('newHeroPasskeyInput');
    if (passInput) {
        passInput.value = generateRandomHeroPasskey();
    }

    modal.classList.add('active');
}

function updatePasskeyModalHeroDisplay(hero) {
    const avatarImg  = document.getElementById('passkeyHeroAvatar');
    const nameEl     = document.getElementById('passkeyHeroDisplayName');
    const userTag    = document.getElementById('passkeyHeroUsernameTag');
    const statusTag  = document.getElementById('passkeyHeroStatusTag');

    if (avatarImg) avatarImg.src = hero.avatar || '/img/apex.jpg';
    if (nameEl) nameEl.textContent = `${hero.alias} (${hero.real_name || 'Civilian Identity Protected'})`;
    
    // Determine username: lowercase alphanumeric alias or hero id
    const candidateUser = (hero.alias || hero.id).toLowerCase().replace(/[^a-z0-9._-]/g, '');
    if (userTag) userTag.textContent = candidateUser;
    if (statusTag) {
        statusTag.textContent = hero.status || 'Registered';
        statusTag.style.color = hero.status === 'Licensed' ? '#34d399' : '#f59e0b';
    }
}

function generateRandomHeroPasskey() {
    const specials = ['!', '@', '#', '$', '%'];
    const spec = specials[Math.floor(Math.random() * specials.length)];
    const num = Math.floor(1000 + Math.random() * 9000);
    const hero = registrarState.selectedHero;
    const prefix = hero && hero.alias ? hero.alias.replace(/[^a-zA-Z]/g, '') : 'Hero';
    return `${prefix}${spec}${num}`;
}

async function submitHeroPasskeyReset(e) {
    e.preventDefault();
    const heroId = document.getElementById('passkeyHeroSelect')?.value || registrarState.selectedHero?.id;
    const hero = (registrarState.heroes || []).find(h => h.id === heroId) || registrarState.selectedHero;
    const newPass = document.getElementById('newHeroPasskeyInput')?.value?.trim();

    if (!newPass || newPass.length < 4) {
        showToast('Passkey must be at least 4 characters long.', 'error');
        return;
    }

    const userTag = document.getElementById('passkeyHeroUsernameTag')?.textContent?.trim();
    const targetUsername = userTag || (hero ? hero.alias.toLowerCase().replace(/[^a-z0-9._-]/g, '') : '');

    const res = await apiPut(`admin/users/${encodeURIComponent(targetUsername)}/reset-password`, {
        new_password: newPass
    });

    if (res.success) {
        showToast(`[SUCCESS] Passkey for hero '${res.username || targetUsername}' updated successfully!`, 'success');
        document.getElementById('heroPasskeyResetModal')?.classList.remove('active');
    } else {
        showToast(`[FAILED] ${res.error || 'Could not reset hero passkey.'}`, 'error');
    }
}

// ──────────────────────────────────────────────
// Field Badge Verifier
// ──────────────────────────────────────────────
function openBadgeVerifierModal() {
    const modal = document.getElementById('verifierModal');
    if (!modal) return;

    const select = document.getElementById('verifyHeroSelect');
    const heroes = registrarState.heroes || [];
    if (select) {
        select.innerHTML = '';
        heroes.forEach(h => {
            const opt = document.createElement('option');
            opt.value = h.id;
            opt.textContent = `${h.alias} (${h.real_name || 'Classified'}) [${h.id}]`;
            select.appendChild(opt);
        });

        if (registrarState.selectedHero) {
            select.value = registrarState.selectedHero.id;
        }

        select.onchange = () => prefillVerifierToken(select.value);
    }

    const resBox = document.getElementById('verificationResultBox');
    if (resBox) {
        resBox.style.display = 'none';
        resBox.textContent = '';
    }

    const activeHeroId = select ? select.value : (registrarState.selectedHero?.id);
    if (activeHeroId) {
        prefillVerifierToken(activeHeroId);
    }

    modal.classList.add('active');
}

async function prefillVerifierToken(heroId) {
    try {
        const res = await apiGet(`heroes/${heroId}/badge-token`);
        if (res.success && res.data && res.data.token) {
            const tokenInput = document.getElementById('verifyTokenInput');
            if (tokenInput) tokenInput.value = res.data.token;
        }
    } catch (e) {}
}

async function executeRegistrarVerification() {
    const heroId = document.getElementById('verifyHeroSelect')?.value;
    const token = document.getElementById('verifyTokenInput')?.value?.trim();
    const resultBox = document.getElementById('verificationResultBox');
    if (!resultBox) return;

    try {
        const res = await apiPost('verify-badge', { hero_id: heroId, token });
        resultBox.style.display = 'block';

        if (res.success && res.valid) {
            resultBox.style.background = 'rgba(16,185,129,0.15)';
            resultBox.style.border = '1px solid #10b981';
            resultBox.style.color = '#6ee7b7';
            resultBox.innerHTML = `
                <strong>[VALID FIELD BADGE CONFIRMED]</strong><br>
                Operative: ${res.alias} (${res.hero_id})<br>
                License Status: ${res.status}<br>
                Threat Class: ${res.threat_tier_label}<br>
                Verification: 30s HMAC-SHA256 Token Synchronized
            `;
        } else if (res.status === 'ROGUE_ALERT') {
            resultBox.style.background = 'rgba(239,68,68,0.15)';
            resultBox.style.border = '1px solid #ef4444';
            resultBox.style.color = '#fca5a5';
            resultBox.innerHTML = `
                <strong>[ROGUE ALERT: IMMEDIATE CONTAINMENT ORDER]</strong><br>
                ${res.message || 'Operative credentials revoked.'}<br>
                Subject: ${res.alias} (${res.hero_id})
            `;
        } else {
            resultBox.style.background = 'rgba(239,68,68,0.15)';
            resultBox.style.border = '1px solid #ef4444';
            resultBox.style.color = '#fca5a5';
            resultBox.innerHTML = `
                <strong>[VERIFICATION FAILED]</strong><br>
                Token Expired or Invalid Anti-Spoof Signature.
            `;
        }
    } catch (err) {
        resultBox.style.display = 'block';
        resultBox.style.background = 'rgba(239,68,68,0.15)';
        resultBox.style.border = '1px solid #ef4444';
        resultBox.style.color = '#fca5a5';
        resultBox.textContent = `Verification error: ${err.message}`;
    }
}

async function checkAuth() {
    try {
        const res = await apiGet('auth/me');
        if (res.success && res.authenticated && res.user) {
            registrarState.currentUser = res.user;
            const nameEl   = document.getElementById('headerUserName');
            const roleEl   = document.getElementById('headerUserRole');
            const avatarEl = document.getElementById('headerUserAvatar');
            if (nameEl)   nameEl.textContent   = res.user.name;
            if (roleEl)   roleEl.textContent   = `Clearance L${res.user.clearance_level} · ${res.user.role}`;
            if (avatarEl && res.user.avatar) avatarEl.src = res.user.avatar;

            // Show return to Main Super Admin Command Center if user has Admin or Super Admin authority
            if (res.user.role === 'SUPER_ADMIN' || res.user.role === 'ADMIN' || (res.user.clearance_level && res.user.clearance_level >= 4)) {
                const btnReturn = document.getElementById('btnReturnAdmin');
                if (btnReturn) btnReturn.style.display = 'inline-flex';
                const sidebarAdmin = document.getElementById('sidebarAdminSection');
                if (sidebarAdmin) sidebarAdmin.style.display = 'block';
                const adminBadge = document.getElementById('sidebarAdminBadge');
                if (adminBadge) adminBadge.textContent = `L${res.user.clearance_level || 5}`;
            }
            return;
        }
    } catch (e) {}
    window.location.href = '/login?redirect=' + encodeURIComponent(window.location.pathname);
}

// ──────────────────────────────────────────────
// Pending Update Approvals
// ──────────────────────────────────────────────
async function loadPendingApprovals(openModal = false) {
    const res = await apiGet('pending-updates');
    const countBadge = document.getElementById('pendingApprovalsCount');
    if (!res.success) return;

    const items = res.data || [];
    if (countBadge) countBadge.textContent = items.length;

    const list  = document.getElementById('pendingApprovalsList');
    const empty = document.getElementById('pendingApprovalsEmpty');
    if (!list || !empty) return;

    list.innerHTML = '';
    if (items.length === 0) {
        empty.style.display = 'block';
        list.style.display  = 'none';
    } else {
        empty.style.display = 'none';
        list.style.display  = 'flex';
        items.forEach(upd => renderPendingItem(list, upd));
    }

    if (openModal) document.getElementById('pendingApprovalsModal')?.classList.add('active');
}

function renderPendingItem(list, upd) {
    const el = document.createElement('div');
    el.style.cssText = `
        border-bottom: 1px solid var(--border-color);
        padding: 0.85rem 1.1rem;
        display: flex; flex-direction: column; gap: 0.5rem;
    `;

    const fieldRows = Object.entries(upd.proposed).map(([field, val]) => {
        const current = upd.current?.[field] ?? '—';
        return `<div style="font-size:0.72rem;color:var(--text-muted);">
            <strong style="color:var(--text-main);">${field.replace(/_/g,' ')}</strong>:
            <span style="color:#ef4444;text-decoration:line-through;">${Array.isArray(current) ? current.join(', ') : current}</span>
            → <span style="color:#34d399;">${Array.isArray(val) ? val.join(', ') : val}</span>
        </div>`;
    }).join('');

    el.innerHTML = `
        <div style="display:flex;align-items:center;gap:0.65rem;">
            <img src="${upd.hero_avatar || '/img/apex.jpg'}"
                 style="width:34px;height:34px;border-radius:50%;object-fit:cover;">
            <div>
                <div style="font-weight:700;font-size:0.82rem;">${upd.hero_alias}</div>
                <div style="font-size:0.68rem;color:var(--text-muted);">
                    Submitted by <strong>${upd.submitted_by}</strong> ·
                    ${new Date(upd.submitted_at).toLocaleString()}
                </div>
            </div>
            <span class="threat-badge b-class" style="margin-left:auto; font-size:0.65rem; padding:0.15rem 0.5rem; font-weight:700;">[PENDING]</span>
        </div>
        <div style="background:var(--bg-surface);border-radius:4px;padding:0.5rem 0.75rem;display:flex;flex-direction:column;gap:3px;">
            ${fieldRows}
        </div>
        <div style="display:flex;gap:0.5rem;justify-content:flex-end;">
            <button class="btn-mini btn-mini-approve"
                onclick="approvePending('${upd.id}')">[APPROVE CHANGES]</button>
            <button class="btn-mini btn-mini-deny"
                onclick="rejectPending('${upd.id}')">[REJECT]</button>
        </div>
    `;
    list.appendChild(el);
}

async function approvePending(pendingId) {
    const res = await apiPost(`pending-updates/${pendingId}/approve`);
    if (res.success) {
        showToast(res.message, 'success');
        await loadPendingApprovals();
        await loadHeroes();
    } else {
        showToast(res.error || 'Approve failed', 'error');
    }
}

async function rejectPending(pendingId) {
    const reason = prompt('Reason for rejection (optional):') ?? '';
    const res = await apiPost(`pending-updates/${pendingId}/reject`, { reason });
    if (res.success) {
        showToast('Update request rejected.', 'info');
        await loadPendingApprovals();
    } else {
        showToast(res.error || 'Reject failed', 'error');
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    initActions();

    // Wire pending approvals nav + close
    const navPending   = document.getElementById('navOpenPendingApprovals');
    const pendingModal = document.getElementById('pendingApprovalsModal');
    const closeModal   = document.getElementById('closePendingModalBtn');
    if (navPending)   navPending.onclick   = () => loadPendingApprovals(true);
    if (closeModal)   closeModal.onclick   = () => pendingModal?.classList.remove('active');

    initRegistrarNotifications();

    await checkAuth();
    await loadHeroes();
    await loadPendingApprovals();   // load count badge silently on startup

    // Handle incoming deep-link parameters (e.g. from Hero Profiles directory /registry)
    const urlParams = new URLSearchParams(window.location.search);
    const editHeroId = urlParams.get('edit');
    const targetHeroId = editHeroId || urlParams.get('hero');
    if (targetHeroId && Array.isArray(registrarState.heroes)) {
        const found = registrarState.heroes.find(h => h.id === targetHeroId || h.alias?.toLowerCase() === targetHeroId.toLowerCase());
        if (found) {
            registrarState.selectedHeroId = found.id;
            registrarState.selectedHero   = found;
            renderQueueTable();
            updateDetailsPanel(found);
            if (editHeroId) {
                openEditModal(found.id);
            }
        }
    }
});

// ──────────────────────────────────────────────
// Registrar Notifications & Queue Alerts
// ──────────────────────────────────────────────
let registrarNotificationsList = [];

async function fetchRegistrarNotifications() {
    try {
        const res = await fetch('/api/notifications');
        const data = await res.json();
        if (!data.success) return;

        registrarNotificationsList = data.data.notifications || [];
        renderRegistrarNotifications(registrarNotificationsList, data.data.unread_count);
    } catch (err) {
        console.error('Failed to sync registrar notifications:', err);
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

function renderRegistrarNotifications(items, unreadCount) {
    const listEl = document.getElementById('registrarNotifList');
    const pill = document.getElementById('registrarNotifPill');

    const readIds = JSON.parse(localStorage.getItem('ghrms_read_reg_notifs') || '[]');
    let effectiveUnread = 0;

    if (!items || items.length === 0) {
        if (listEl) {
            listEl.innerHTML = '<div class="notif-empty">Queue clear. No pending alerts.</div>';
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
                <div class="notif-item ${itemClass}" onclick="handleRegistrarNotifClick('${escapeHtml(n.link || '/registrar')}', '${n.id}')">
                    <div class="notif-item-top">
                        <span class="notif-tag ${tagClass}">${escapeHtml(n.tag || '[NOTIF]')}</span>
                        <span class="notif-time">${formatRegistrarNotifTime(n.created_at)}</span>
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

function formatRegistrarNotifTime(isoString) {
    if (!isoString) return 'Just now';
    try {
        const d = new Date(isoString);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
        return 'Recent';
    }
}

function handleRegistrarNotifClick(link, id) {
    const readIds = JSON.parse(localStorage.getItem('ghrms_read_reg_notifs') || '[]');
    if (!readIds.includes(id)) {
        readIds.push(id);
        localStorage.setItem('ghrms_read_reg_notifs', JSON.stringify(readIds));
    }
    const panel = document.getElementById('registrarNotifPanel');
    if (panel) panel.style.display = 'none';

    if (id === 'queue-pending-updates') {
        loadPendingApprovals(true);
    } else if (link && link !== window.location.pathname) {
        window.location.href = link;
    } else {
        renderRegistrarNotifications(registrarNotificationsList, 0);
    }
}

function toggleRegistrarNotifications(e) {
    if (e) e.stopPropagation();
    const panel = document.getElementById('registrarNotifPanel');
    const btn = document.getElementById('registrarNotifBtn');
    if (!panel) return;

    const isHidden = panel.style.display === 'none' || !panel.style.display;
    panel.style.display = isHidden ? 'flex' : 'none';
    if (btn) btn.setAttribute('aria-expanded', isHidden ? 'true' : 'false');
}

function markRegistrarNotificationsRead() {
    const ids = registrarNotificationsList.map(n => n.id);
    localStorage.setItem('ghrms_read_reg_notifs', JSON.stringify(ids));
    renderRegistrarNotifications(registrarNotificationsList, 0);
    showToast('All registrar notifications marked as read.', 'info');
}

function initRegistrarNotifications() {
    const btn = document.getElementById('registrarNotifBtn');
    if (btn) {
        btn.addEventListener('click', toggleRegistrarNotifications);
    }

    // Dismiss on click outside
    document.addEventListener('click', (e) => {
        const panel = document.getElementById('registrarNotifPanel');
        const btn = document.getElementById('registrarNotifBtn');
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
            const panel = document.getElementById('registrarNotifPanel');
            if (panel) panel.style.display = 'none';
        }
    });

    fetchRegistrarNotifications();
    setInterval(fetchRegistrarNotifications, 15000);
}
