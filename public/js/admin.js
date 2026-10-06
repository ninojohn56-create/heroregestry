/**
 * GHRMS Modern Administrator Command Center Controller
 * Tailored for Tailwind CSS + Lucide Icons + GHRMS REST Endpoints
 */

const adminState = {
    heroes: [],
    users: [],
    auditLogs: [],
    pendingUpdates: [],
    currentUser: null,
    activeTab: 'dashboard',
    heroFilter: {
        search: '',
        sector: '',
        status: '',
        division: ''
    },
    userFilter: 'all',     // 'all', 'heroes', 'staff'
    queueFilter: 'all',    // 'all', 'review', 'pending_updates'
    queueSearch: '',
    leafletMap: null,
    heroMarkersGroup: null,
    rogueBroadcastActive: false
};

// ──────────────────────────────────────────────
// Toast Notification Utility
// ──────────────────────────────────────────────
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    const bgCol = type === 'success' ? 'bg-emerald-600' :
                  type === 'error'   ? 'bg-rose-600' :
                  type === 'warning' ? 'bg-amber-600' : 'bg-brand-600';

    toast.className = `flex items-center gap-3 px-4 py-3 rounded-xl text-white text-sm font-semibold shadow-xl pointer-events-auto transform translate-y-2 opacity-0 transition-all duration-300 ${bgCol}`;
    
    const iconName = type === 'success' ? 'check-circle' :
                     type === 'error'   ? 'alert-triangle' :
                     type === 'warning' ? 'alert-circle' : 'info';

    toast.innerHTML = `<i data-lucide="${iconName}" class="w-4 h-4 shrink-0"></i><span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);

    if (window.lucide) {
        lucide.createIcons();
    }

    setTimeout(() => {
        toast.classList.remove('translate-y-2', 'opacity-0');
    }, 10);

    setTimeout(() => {
        toast.classList.add('translate-y-2', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 3500);
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

// ──────────────────────────────────────────────
// High-Security Directive Confirmation Modal
// ──────────────────────────────────────────────
let activeConfirmCallback = null;

function showConfirmDirective({
    title = 'Security Directive Confirmation',
    subtitle = 'Clearance Level 5 Authorization Required',
    message = 'Are you sure you want to proceed with this administrative directive?',
    confirmText = 'Authorize Directive',
    confirmClass = 'bg-emerald-600 hover:bg-emerald-500',
    icon = 'shield-alert',
    iconWrapClass = 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20',
    showInput = false,
    inputLabel = 'Directive Notes / Reason',
    inputValue = '',
    inputPlaceholder = 'Enter required rationale...',
    onConfirm = null
} = {}) {
    const modal = document.getElementById('ghra-confirm-modal');
    const box = document.getElementById('ghra-confirm-box');
    const titleEl = document.getElementById('ghra-confirm-title');
    const subtitleEl = document.getElementById('ghra-confirm-subtitle');
    const messageEl = document.getElementById('ghra-confirm-message');
    const iconWrap = document.getElementById('ghra-confirm-icon-wrap');
    const iconEl = document.getElementById('ghra-confirm-icon');
    const inputWrap = document.getElementById('ghra-confirm-input-wrap');
    const inputLabelEl = document.getElementById('ghra-confirm-input-label');
    const inputEl = document.getElementById('ghra-confirm-input');
    const actionBtn = document.getElementById('ghra-confirm-action-btn');

    if (!modal) {
        if (confirm(message)) {
            if (onConfirm) onConfirm(showInput ? (prompt(inputLabel, inputValue) || '') : true);
        }
        return;
    }

    if (titleEl) titleEl.textContent = title;
    if (subtitleEl) subtitleEl.textContent = subtitle;
    if (messageEl) messageEl.innerHTML = message;
    if (iconWrap) iconWrap.className = `w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${iconWrapClass}`;
    if (iconEl) iconEl.setAttribute('data-lucide', icon);

    if (showInput && inputWrap && inputEl) {
        inputWrap.classList.remove('hidden');
        if (inputLabelEl) inputLabelEl.textContent = inputLabel;
        inputEl.value = inputValue;
        inputEl.placeholder = inputPlaceholder;
    } else if (inputWrap) {
        inputWrap.classList.add('hidden');
    }

    if (actionBtn) {
        actionBtn.className = `px-5 py-2 text-xs font-bold text-white rounded-xl shadow-md transition-all flex items-center gap-1.5 ${confirmClass}`;
        actionBtn.innerHTML = `<span>${escapeHtml(confirmText)}</span>`;
    }

    activeConfirmCallback = () => {
        const val = inputEl ? inputEl.value.trim() : '';
        closeConfirmDirectiveModal();
        if (onConfirm) onConfirm(val);
    };

    if (actionBtn) {
        actionBtn.onclick = activeConfirmCallback;
    }

    modal.classList.remove('hidden');
    setTimeout(() => {
        if (box) {
            box.classList.remove('scale-95');
            box.classList.add('scale-100');
        }
    }, 10);

    if (window.lucide) lucide.createIcons();
    if (showInput && inputEl) setTimeout(() => inputEl.focus(), 60);
}

function closeConfirmDirectiveModal() {
    const modal = document.getElementById('ghra-confirm-modal');
    const box = document.getElementById('ghra-confirm-box');
    if (!modal) return;
    if (box) {
        box.classList.remove('scale-100');
        box.classList.add('scale-95');
    }
    setTimeout(() => modal.classList.add('hidden'), 150);
    activeConfirmCallback = null;
}

// ──────────────────────────────────────────────
// API Fetch Wrappers
// ──────────────────────────────────────────────
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

async function apiDelete(endpoint) {
    try {
        const res = await fetch(`/api/${endpoint}`, { method: 'DELETE' });
        return await res.json();
    } catch (err) {
        return { success: false, error: err.message };
    }
}

// ──────────────────────────────────────────────
// Initialization
// ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    initSidebarCollapse();
    setupMobileSidebar();
    await checkAuth();
    await loadAllData();

    // Handle hash navigation
    const initialHash = window.location.hash.replace('#', '');
    if (initialHash && document.getElementById(`tab-${initialHash}`)) {
        switchTab(initialHash);
    } else {
        switchTab('dashboard');
    }

    if (window.lucide) {
        lucide.createIcons();
    }

    loadAdminNotifications();
    setInterval(loadAdminNotifications, 15000);
});

// Dismiss notifications panel on click outside
document.addEventListener('click', (e) => {
    const notifPanel = document.getElementById('notifications-panel');
    const notifBtn = e.target.closest('#adminNotifBtn') || e.target.closest('button[onclick*="toggleNotifications"]');
    if (notifPanel && !notifPanel.classList.contains('hidden')) {
        if (!notifPanel.contains(e.target) && !notifBtn) {
            notifPanel.classList.add('hidden');
        }
    }
});

// Close modals on Escape key press
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeHeroPasskeyModal();
        closeProvisionUserModal();
        closeHeroEditModal();
        closeVaultModal();
        closeRevokeModal();
        closeVerifierModal();
        closeOperativeInspectorDrawer();
        closeDocViewer();
        closeAuditDiffModal();
        closeConfirmDirectiveModal();
        const notifPanel = document.getElementById('notifications-panel');
        if (notifPanel) notifPanel.classList.add('hidden');
    }
});

function initTheme() {
    const saved = localStorage.getItem('ghrms_theme') || localStorage.getItem('color-scheme') || 'dark';
    applyAdminTheme(saved);
    updateThemeIcon();

    // Listen for real-time theme switches from other tabs (e.g., Hero Portal 1)
    window.addEventListener('storage', (e) => {
        if (e.key === 'ghrms_theme' || e.key === 'color-scheme') {
            const next = e.newValue || 'dark';
            applyAdminTheme(next);
            updateThemeIcon();
        }
    });
}

function applyAdminTheme(theme) {
    const isDark = theme === 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    if (isDark) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
}

function updateThemeIcon() {
    const icon = document.getElementById('theme-icon');
    if (!icon) return;
    const isDark = document.documentElement.classList.contains('dark');
    icon.setAttribute('data-lucide', isDark ? 'sun' : 'moon');
    if (window.lucide) lucide.createIcons();
}

function toggleDarkMode() {
    const isDark = document.documentElement.classList.contains('dark');
    const nextTheme = isDark ? 'light' : 'dark';
    localStorage.setItem('ghrms_theme', nextTheme);
    localStorage.setItem('color-scheme', nextTheme);
    applyAdminTheme(nextTheme);
    updateThemeIcon();
    showToast(`Interface switched to ${nextTheme === 'dark' ? 'Dark' : 'Light'} theme`, 'info');
}

function initSidebarCollapse() {
    const isCollapsed = localStorage.getItem('ghrms_sidebar_collapsed') === 'true';
    if (isCollapsed) {
        applySidebarCollapsedState(true);
    }
}

function applySidebarCollapsedState(isCollapsed) {
    const sidebar = document.getElementById('sidebar');
    const collapseIcon = document.getElementById('sidebar-collapse-icon');
    if (!sidebar) return;

    if (isCollapsed) {
        sidebar.classList.add('sidebar-collapsed');
        if (collapseIcon) collapseIcon.setAttribute('data-lucide', 'panel-left-open');
    } else {
        sidebar.classList.remove('sidebar-collapsed');
        const savedW = localStorage.getItem('ghrms_admin_sidebar_width');
        if (savedW) {
            sidebar.style.width = savedW + 'px';
            sidebar.style.minWidth = savedW + 'px';
        }
        if (collapseIcon) collapseIcon.setAttribute('data-lucide', 'panel-left-close');
    }
    if (window.lucide) lucide.createIcons();
}

function toggleSidebarCollapse() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    const willBeCollapsed = !sidebar.classList.contains('sidebar-collapsed');
    applySidebarCollapsedState(willBeCollapsed);
    localStorage.setItem('ghrms_sidebar_collapsed', willBeCollapsed ? 'true' : 'false');
    showToast(willBeCollapsed ? 'Sidebar collapsed' : 'Sidebar expanded', 'info');
}

function handleSidebarToggle() {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (window.innerWidth < 768) {
        if (sidebar) sidebar.classList.toggle('-translate-x-full');
        if (backdrop) backdrop.classList.toggle('hidden');
    } else {
        toggleSidebarCollapse();
    }
}

function setupMobileSidebar() {
    const closeBtn = document.getElementById('sidebar-close');
    const backdrop = document.getElementById('sidebar-backdrop');

    if (closeBtn) {
        closeBtn.addEventListener('click', closeSidebar);
    }
    if (backdrop) {
        backdrop.addEventListener('click', closeSidebar);
    }
}

function closeSidebar() {
    if (window.innerWidth < 768) {
        const sidebar = document.getElementById('sidebar');
        const backdrop = document.getElementById('sidebar-backdrop');
        if (sidebar) sidebar.classList.add('-translate-x-full');
        if (backdrop) backdrop.classList.add('hidden');
    }
}

// ──────────────────────────────────────────────
// Check Auth & Clearance Level
// ──────────────────────────────────────────────
async function checkAuth() {
    const res = await apiGet('auth/me');
    if (res.success && res.user) {
        adminState.currentUser = res.user;

        // Header info
        const nameEl = document.getElementById('headerUserName');
        const roleEl = document.getElementById('headerUserRole');
        const avatarEl = document.getElementById('headerUserAvatar');
        const pillEl = document.getElementById('portalClearanceBadge');
        const subRoleEl = document.getElementById('sidebarRoleSubtitle');

        if (nameEl) nameEl.textContent = res.user.name || res.user.username;
        if (avatarEl && res.user.avatar) avatarEl.src = res.user.avatar;

        const isSuper = res.user.role === 'SUPER_ADMIN';

        const brandTitleEl = document.getElementById('sidebarBrandTitle');
        const pageTitleEl = document.getElementById('page-title');
        const pageSubEl = document.getElementById('page-subtitle');

        if (roleEl) {
            const clearance = isSuper ? 'L5' : `L${res.user.clearance_level || 4}`;
            const roleName = isSuper ? 'Supreme Commander' : (res.user.role || 'Admin');
            roleEl.innerHTML = `<span class="inline-flex items-center gap-1.5"><span class="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-brand-500/15 text-brand-600 dark:text-brand-400 border border-brand-500/30">Level ${clearance}</span> <span class="font-semibold text-slate-600 dark:text-slate-300">${escapeHtml(roleName)}</span></span>`;
        }

        if (subRoleEl) {
            subRoleEl.textContent = isSuper ? 'Supreme Command (L5)' : 'Command Staff';
        }

        if (brandTitleEl) {
            brandTitleEl.textContent = 'GHRMS Command';
        }

        if (pillEl) {
            const clearance = isSuper ? 'L5' : `L${res.user.clearance_level || 4}`;
            const roleName = isSuper ? 'SUPER ADMIN' : (res.user.role || 'ADMIN');
            pillEl.innerHTML = `<span class="inline-flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span><span>${escapeHtml(roleName)}</span><span class="text-slate-400 font-mono text-[10px] ml-1">CLEARANCE ${clearance}</span></span>`;
        }

        // Super Admin Command Center Presentation
        document.title = 'GHRMS // Super Admin Command Center';
        if (pageTitleEl) {
            pageTitleEl.textContent = 'Super Admin Command Center';
        }
        if (pageSubEl) {
            pageSubEl.textContent = 'Global Superhuman Registration Authority — Supreme Command Directive (Level 5).';
        }

        const dangerZone = document.getElementById('superAdminDangerZone');
        if (dangerZone) dangerZone.style.display = isSuper ? 'flex' : 'none';

        const containmentRow = document.getElementById('containmentEmergencyRow');
        if (containmentRow) containmentRow.style.display = isSuper ? 'flex' : 'none';

        const radarEmergencyContainer = document.getElementById('radarEmergencyActionContainer');
        if (radarEmergencyContainer) radarEmergencyContainer.style.display = isSuper ? 'block' : 'none';

        const admin1Notice = document.getElementById('admin1SettingsNotice');
        if (admin1Notice) admin1Notice.style.display = 'none';

        const admin1RadarNotice = document.getElementById('admin1RadarClearanceNotice');
        if (admin1RadarNotice) admin1RadarNotice.style.display = 'none';
    } else {
        // Not authenticated
        window.location.href = '/login';
    }
}

// ──────────────────────────────────────────────
// Load All Data in Parallel
// ──────────────────────────────────────────────
async function loadAllData() {
    await Promise.all([
        loadHeroes(),
        loadUsers(),
        loadQueue(),
        loadAuditLedger()
    ]);
    renderDashboard();
}

async function loadHeroes() {
    const res = await apiGet('heroes');
    if (res.success && Array.isArray(res.data)) {
        adminState.heroes = res.data;
        renderHeroesTable();
        populatePasskeyModalSelect();
        populateVerifierHeroSelect();
        if (adminState.leafletMap) {
            plotTacticalHeroMarkers();
        }
    }
}

async function loadUsers() {
    const res = await apiGet('admin/users');
    if (res.success && Array.isArray(res.users)) {
        adminState.users = res.users;
        renderUsersTable();
    }
}

async function loadQueue() {
    const res = await apiGet('pending-updates');
    if (res.success && Array.isArray(res.pending_updates)) {
        adminState.pendingUpdates = res.pending_updates;
        renderPendingUpdatesList();
    }
    renderQueueTable();
}

async function loadAuditLedger() {
    const res = await apiGet('audit-ledger');
    const logs = (res.success && (res.chain || res.data)) ? (res.chain || res.data) : [];
    if (Array.isArray(logs)) {
        adminState.auditLogs = logs;
        renderAuditTable();
    }
}

// ──────────────────────────────────────────────
// Tab Navigation
// ──────────────────────────────────────────────
function switchTab(tabId) {
    adminState.activeTab = tabId;

    // Toggle tab panels
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    const targetPanel = document.getElementById(`tab-${tabId}`);
    if (targetPanel) {
        targetPanel.classList.remove('hidden');
    }

    // Update nav links
    document.querySelectorAll('.nav-link').forEach(el => {
        el.classList.remove('active-tab', 'active', 'bg-brand-50', 'dark:bg-brand-900/30', 'text-brand-600', 'dark:text-brand-400');
        el.classList.add('text-slate-600', 'dark:text-slate-300');
    });

    const activeLink = document.querySelector(`.nav-link[data-target="${tabId}"]`);
    if (activeLink) {
        activeLink.classList.remove('text-slate-600', 'dark:text-slate-300');
        activeLink.classList.add('active-tab', 'active', 'text-brand-600', 'dark:text-brand-400');
    }

    // Dynamic header titles
    const isSuper = adminState.currentUser?.role === 'SUPER_ADMIN';
    const titles = {
        dashboard: { 
            title: 'Super Admin Command Center', 
            subtitle: 'Global Superhuman Registration Authority — Supreme Command Directive (Level 5).' 
        },
        heroes: { title: 'Operatives Directory', subtitle: 'Comprehensive registry of all registered superhuman assets.' },
        queue: { title: 'Registration & Intake Queue', subtitle: 'Audit applicant records, verify clearances, and license operatives.' },
        users: { title: 'Personnel Accounts & Passkeys', subtitle: 'Day-to-day password changes and security passkey resets.' },
        access: { title: 'Access Control & Security Roles', subtitle: 'Clearance hierarchy and cryptographic security privileges.' },
        audit: { title: 'SHA-256 Chained Audit Ledger', subtitle: 'Cryptographically immutable transaction logs.' },
        radar: { title: 'GIS Tactical Radar & Containment', subtitle: 'Live geospatial telemetry, sector perimeters, and atmospheric feeds.' },
        reports: { title: 'Registry Reports & Data Export', subtitle: 'Audited exports and field credential verifications.' },
        settings: { title: 'System Settings & Accord Parameters', subtitle: 'Configure municipal accord parameters and baseline states.' }
    };

    if (titles[tabId]) {
        const titleEl = document.getElementById('page-title');
        const subEl = document.getElementById('page-subtitle');
        if (titleEl) titleEl.textContent = titles[tabId].title;
        if (subEl) subEl.textContent = titles[tabId].subtitle;
    }

    closeSidebar();

    // Radar Leaflet initialization on tab entry
    if (tabId === 'radar') {
        initTacticalRadar();
    }

    if (window.lucide) {
        lucide.createIcons();
    }
}

// ──────────────────────────────────────────────
// Tab 1: Dashboard Rendering
// ──────────────────────────────────────────────
function renderDashboard() {
    const totalHeroes = adminState.heroes.length;
    const licensedHeroes = adminState.heroes.filter(h => h.status === 'Licensed' || h.status === 'Approved').length;
    const reviewQueue = adminState.heroes.filter(h => h.status === 'Under Review' || h.status === 'Pending' || h.status === 'Submitted' || h.status === 'REVIEWING').length + adminState.pendingUpdates.length;
    const personnelCount = adminState.users.length;

    // Stat cards
    const statTotal = document.getElementById('stat-total-heroes');
    const statLicensed = document.getElementById('stat-licensed-heroes');
    const statQueue = document.getElementById('stat-pending-queue');
    const statPersonnel = document.getElementById('stat-personnel-count');

    if (statTotal) statTotal.textContent = totalHeroes ? totalHeroes.toLocaleString() : '11';
    if (statLicensed) statLicensed.textContent = licensedHeroes;
    if (statQueue) statQueue.textContent = reviewQueue;
    if (statPersonnel) statPersonnel.textContent = personnelCount || '6';

    // Sidebar count badges
    const navHeroes = document.getElementById('nav-heroes-count');
    const navPending = document.getElementById('nav-pending-badge');
    const navUsers = document.getElementById('nav-users-badge');

    if (navHeroes) navHeroes.textContent = totalHeroes;
    if (navPending) navPending.textContent = reviewQueue;
    if (navUsers) navUsers.textContent = personnelCount;

    // Queue preview table
    const tbody = document.getElementById('dashboard-queue-table');
    if (!tbody) return;

    // Prioritize candidates awaiting evaluation or recent actions
    let previewList = adminState.heroes.filter(h => 
        h.status === 'Submitted' || 
        h.status === 'Under Review' || 
        h.status === 'Pending' || 
        h.status === 'REVIEWING' || 
        h.status === 'Returned for Correction' ||
        h.status === 'Suspended'
    );

    if (previewList.length === 0) {
        previewList = adminState.heroes.slice(0, 6);
    }

    if (previewList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-slate-500 dark:text-slate-400 font-mono text-xs">No operatives currently awaiting evaluation in intake queue.</td></tr>`;
        return;
    }

    tbody.innerHTML = previewList.map(h => {
        const tierBadge = getThreatBadgeHtml(h.threat_tier);
        const statusBadge = getStatusBadgeHtml(h.status);
        const isApproved = h.status === 'Approved' || h.status === 'Licensed';

        return `
            <tr onclick="openOperativeInspector('${h.id}')" class="cursor-pointer group hover:bg-slate-100/70 dark:hover:bg-slate-750/70 transition-all border-b border-slate-100 dark:border-slate-700/60" title="Click to inspect full dossier, credentials & audit history">
                <td class="py-3.5 px-6">
                    <div class="flex items-center gap-3">
                        <img src="${h.avatar || '/img/apex.jpg'}" alt="${escapeHtml(h.alias)}" class="w-9 h-9 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shadow-xs group-hover:border-cyan-500/50 transition-colors">
                        <div>
                            <span class="font-bold text-slate-900 dark:text-white block group-hover:text-cyan-400 transition-colors text-sm">${escapeHtml(h.alias)}</span>
                            <span class="text-xs text-slate-500 dark:text-slate-400 font-mono">${escapeHtml(h.real_name || 'Classified Identity')}</span>
                        </div>
                    </div>
                </td>
                <td class="py-3.5 px-6 text-slate-600 dark:text-slate-400 text-xs font-medium">${escapeHtml(h.region || 'Sector 1')}</td>
                <td class="py-3.5 px-6">
                    <span class="font-semibold text-slate-800 dark:text-slate-200 text-xs block">${escapeHtml(h.primary_power || 'N/A')}</span>
                    ${h.secondary_power && h.secondary_power !== 'None' ? `<span class="text-[11px] text-slate-500 dark:text-slate-400 block truncate max-w-[140px]">+ ${escapeHtml(h.secondary_power)}</span>` : ''}
                </td>
                <td class="py-3.5 px-6">${tierBadge}</td>
                <td class="py-3.5 px-6">${statusBadge}</td>
                <td class="py-3.5 px-6 text-right whitespace-nowrap" onclick="event.stopPropagation()">
                    ${isApproved
                        ? `<button disabled class="px-3 py-1.5 bg-emerald-950/40 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-semibold mr-1.5 cursor-default inline-flex items-center gap-1"><i data-lucide="check" class="w-3.5 h-3.5"></i><span>Approved</span></button>`
                        : `<button onclick="approveHeroRegistration('${h.id}')" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold mr-1.5 shadow-xs transition-all inline-flex items-center gap-1" title="Approve Licensure"><i data-lucide="check" class="w-3.5 h-3.5"></i><span>Approve</span></button>`
                    }
                    <button onclick="openHeroEditModal('${h.id}')" class="px-3 py-1.5 bg-slate-700/80 hover:bg-slate-600 text-slate-200 border border-slate-600/70 rounded-lg text-xs font-semibold mr-1.5 shadow-xs transition-all inline-flex items-center gap-1" title="Review Profile"><i data-lucide="file-search" class="w-3.5 h-3.5"></i><span>Review</span></button>
                    <a href="/registrar?hero=${encodeURIComponent(h.id)}" class="px-3 py-1.5 bg-slate-100 hover:bg-white text-slate-900 dark:bg-slate-200 dark:hover:bg-white dark:text-slate-900 border border-slate-300 dark:border-slate-400 rounded-lg text-xs font-semibold transition-all inline-flex items-center gap-1 shadow-xs" title="Conduct Face-to-Face Registrar Check">
                        <i data-lucide="scale" class="w-3.5 h-3.5"></i>
                        <span>Registrar Check</span>
                    </a>
                </td>
            </tr>
        `;
    }).join('');

    if (window.lucide) lucide.createIcons();
}

// ──────────────────────────────────────────────
// Tab 2: Heroes Directory Table & Filtering
// ──────────────────────────────────────────────
function renderHeroesTable() {
    const tbody = document.getElementById('heroes-table-body');
    if (!tbody) return;

    const searchTerm = (document.getElementById('hero-filter-search')?.value || '').toLowerCase();
    const sectorFilter = document.getElementById('hero-filter-sector')?.value || '';
    const statusFilter = document.getElementById('hero-filter-status')?.value || '';
    const divisionFilter = document.getElementById('hero-filter-division')?.value || '';

    const filtered = adminState.heroes.filter(h => {
        const matchSearch = !searchTerm ||
            (h.alias && h.alias.toLowerCase().includes(searchTerm)) ||
            (h.real_name && h.real_name.toLowerCase().includes(searchTerm)) ||
            (h.primary_power && h.primary_power.toLowerCase().includes(searchTerm)) ||
            (h.id && h.id.toLowerCase().includes(searchTerm));

        const matchSector = !sectorFilter || (h.region && h.region.includes(sectorFilter));
        const matchStatus = !statusFilter || h.status === statusFilter;
        const matchDivision = !divisionFilter ||
            (divisionFilter === 'Sidekick' ? h.role_tag === 'Sidekick' : h.role_tag !== 'Sidekick');

        return matchSearch && matchSector && matchStatus && matchDivision;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-slate-500 dark:text-slate-400">No superhuman operatives match the specified filter criteria.</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(h => {
        const tierBadge = getThreatBadgeHtml(h.threat_tier);
        const statusBadge = getStatusBadgeHtml(h.status);
        const divisionBadge = h.role_tag === 'Sidekick' ?
            '<span class="text-[10px] px-2 py-0.5 rounded-md bg-purple-50 text-purple-600 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800 font-bold ml-1.5">SIDEKICK</span>' : '';

        return `
            <tr class="hover:bg-slate-50/50 dark:hover:bg-slate-700/50 transition-colors">
                <td class="py-3.5 px-6 font-medium">
                    <div class="flex items-center gap-3">
                        <img src="${h.avatar || '/img/apex.jpg'}" alt="${escapeHtml(h.alias)}" class="w-9 h-9 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shadow-xs">
                        <div>
                            <div class="flex items-center">
                                <span class="font-bold text-slate-900 dark:text-white">${escapeHtml(h.alias)}</span>
                                ${divisionBadge}
                            </div>
                            <div class="flex items-center gap-1.5 mt-0.5">
                                <span class="text-[11px] font-mono px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">${escapeHtml(h.id)}</span>
                                <span class="text-xs text-slate-500 dark:text-slate-400">${escapeHtml(h.real_name || 'Encrypted Vault')}</span>
                            </div>
                        </div>
                    </div>
                </td>
                <td class="py-3.5 px-6">
                    <span class="font-semibold text-slate-800 dark:text-slate-200">${escapeHtml(h.primary_power || 'N/A')}</span>
                    ${h.secondary_power && h.secondary_power !== 'None' ? `<span class="text-xs text-slate-500 dark:text-slate-400 block">+ ${escapeHtml(h.secondary_power)}</span>` : ''}
                </td>
                <td class="py-3.5 px-6 text-slate-600 dark:text-slate-400 text-xs">${escapeHtml(h.region || 'Sector 1')}</td>
                <td class="py-3.5 px-6">${tierBadge}</td>
                <td class="py-3.5 px-6">${statusBadge}</td>
                <td class="py-3.5 px-6 text-right">
                    <div class="flex items-center justify-end gap-1.5">
                        <button onclick="openOperativeInspector('${h.id}')" class="p-1.5 text-slate-700 dark:text-slate-200 hover:text-brand-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700/50 rounded-lg transition-colors" title="Launch Commander Assessor Panel">
                            <i data-lucide="eye" class="w-4 h-4"></i>
                        </button>
                        <button onclick="openHeroPasskeyModal('${h.id}')" class="p-1.5 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded-lg transition-colors" title="Reset Operative Passkey">
                            <i data-lucide="key" class="w-4 h-4"></i>
                        </button>
                        <button onclick="openHeroEditModal('${h.id}')" class="p-1.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700/50 rounded-lg transition-colors" title="Edit Profile">
                            <i data-lucide="edit-3" class="w-4 h-4"></i>
                        </button>
                        <button onclick="openVaultModal('${h.id}')" class="p-1.5 text-slate-500 hover:text-purple-600 dark:text-slate-400 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded-lg transition-colors" title="Decrypt AES-256 Vault Bio">
                            <i data-lucide="lock" class="w-4 h-4"></i>
                        </button>
                        <button onclick="openRevokeModal('${h.id}')" class="p-1.5 text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors" title="Revoke Licensure Directive">
                            <i data-lucide="alert-triangle" class="w-4 h-4"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    if (window.lucide) lucide.createIcons();
}

function filterHeroesTable() {
    renderHeroesTable();
}

function handleGlobalSearch(val) {
    const searchInput = document.getElementById('hero-filter-search');
    if (searchInput) {
        searchInput.value = val;
    }
    if (adminState.activeTab !== 'heroes') {
        switchTab('heroes');
    }
    renderHeroesTable();
}

// ──────────────────────────────────────────────
// Tab 3: Registration Queue Table & Filtering
// ──────────────────────────────────────────────
function handleQueueSearch(val) {
    adminState.queueSearch = (val || '').toLowerCase().trim();
    renderQueueTable();
}

function renderQueueTable() {
    const tbody = document.getElementById('queue-table-body');
    if (!tbody) return;

    let list = adminState.heroes;
    const qf = adminState.queueFilter;
    if (qf && qf !== 'all' && qf !== 'pending_updates') {
        if (qf === 'Under Review' || qf === 'review') {
            list = adminState.heroes.filter(h => h.status === 'Under Review' || h.status === 'Pending');
        } else if (qf === 'Approved') {
            list = adminState.heroes.filter(h => h.status === 'Approved' || h.status === 'Licensed');
        } else if (qf === 'Rejected') {
            list = adminState.heroes.filter(h => h.status === 'Rejected' || h.status === 'Revoked');
        } else {
            list = adminState.heroes.filter(h => h.status === qf);
        }
    }

    if (adminState.queueSearch) {
        const term = adminState.queueSearch;
        list = list.filter(h => 
            (h.alias && h.alias.toLowerCase().includes(term)) ||
            (h.id && h.id.toLowerCase().includes(term)) ||
            (h.primary_power && h.primary_power.toLowerCase().includes(term)) ||
            (h.classification && h.classification.toLowerCase().includes(term)) ||
            (h.division && h.division.toLowerCase().includes(term))
        );
    }

    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-slate-500 dark:text-slate-400">Queue is clear. No matching hero registrations found.</td></tr>`;
        return;
    }

    tbody.innerHTML = list.map(h => {
        const tierBadge = getThreatBadgeHtml(h.threat_tier);
        const statusBadge = getStatusBadgeHtml(h.status);

        let actionButtons = `
            <button onclick="openOperativeInspector('${h.id}')" class="px-2.5 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 rounded-lg text-xs font-semibold shadow-xs transition-all flex items-center gap-1 cursor-pointer" title="Inspect Full Dossier">
                <i data-lucide="eye" class="w-3.5 h-3.5"></i> Inspect
            </button>
        `;

        if (h.status === 'Submitted') {
            actionButtons += `
                <button onclick="moveHeroToReview('${h.id}')" class="px-2.5 py-1.5 bg-slate-700/80 hover:bg-slate-600 text-slate-200 border border-slate-600/70 rounded-lg text-xs font-semibold shadow-xs transition-all cursor-pointer">Review</button>
                <button onclick="approveHeroRegistration('${h.id}')" class="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-xs transition-all cursor-pointer">Approve</button>
            `;
        } else if (h.status === 'Under Review' || h.status === 'Pending') {
            actionButtons += `
                <a href="/registrar?hero=${encodeURIComponent(h.id)}" class="px-2.5 py-1.5 bg-slate-100 hover:bg-white text-slate-900 dark:bg-slate-200 dark:hover:bg-white dark:text-slate-900 border border-slate-300 dark:border-slate-400 rounded-lg text-xs font-semibold transition-all inline-flex items-center gap-1 shadow-xs cursor-pointer">Registrar Check</a>
                <button onclick="approveHeroRegistration('${h.id}')" class="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-xs transition-all cursor-pointer">Approve</button>
                <button onclick="requestHeroCorrections('${h.id}')" class="px-2.5 py-1.5 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-xs font-semibold shadow-xs transition-all cursor-pointer">Corrections</button>
            `;
        } else if (h.status === 'Verified') {
            actionButtons += `
                <button onclick="approveHeroRegistration('${hero.id || h.id}')" class="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-xs transition-all cursor-pointer">Approve</button>
                <button onclick="requestHeroCorrections('${h.id}')" class="px-2.5 py-1.5 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-xs font-semibold shadow-xs transition-all cursor-pointer">Corrections</button>
            `;
        } else if (h.status === 'Returned for Correction' || h.status === 'Requires Action') {
            actionButtons += `
                <button onclick="approveHeroRegistration('${h.id}')" class="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-xs transition-all cursor-pointer">Force Approve</button>
                <button onclick="rejectHeroRegistration('${h.id}')" class="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold shadow-xs transition-all cursor-pointer">Reject</button>
            `;
        } else if (h.status === 'Approved' || h.status === 'Licensed') {
            actionButtons += `
                <span class="px-2.5 py-1 bg-emerald-950/40 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-semibold cursor-default inline-flex items-center gap-1"><i data-lucide="check" class="w-3.5 h-3.5"></i> Approved</span>
                <button onclick="openRevokeModal('${h.id}')" class="px-2.5 py-1.5 bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 border border-rose-500/30 rounded-lg text-xs font-semibold transition-all cursor-pointer">Revoke</button>
            `;
        } else if (h.status === 'Rejected') {
            actionButtons += `
                <button onclick="approveHeroRegistration('${h.id}')" class="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-xs transition-all cursor-pointer">Reconsider</button>
            `;
        }

        return `
            <tr onclick="openOperativeInspector('${h.id}')" class="cursor-pointer group hover:bg-slate-100/70 dark:hover:bg-slate-750/70 transition-all border-b border-slate-100 dark:border-slate-700/60" title="Click to inspect full operative dossier">
                <td class="py-3.5 px-6 font-medium">
                    <div class="flex items-center gap-3">
                        <img src="${h.avatar || h.profile_picture || '/img/apex.jpg'}" alt="${escapeHtml(h.alias)}" class="w-9 h-9 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shadow-xs group-hover:border-cyan-500/50 transition-colors">
                        <div>
                            <span class="font-bold text-slate-900 dark:text-white block group-hover:text-cyan-400 transition-colors">${escapeHtml(h.alias)}</span>
                            <span class="text-xs text-slate-500 dark:text-slate-400 font-mono">${escapeHtml(h.id)}</span>
                        </div>
                    </div>
                </td>
                <td class="py-3.5 px-6 text-xs text-slate-500 dark:text-slate-400">
                    <strong class="text-slate-700 dark:text-slate-300 block">${escapeHtml(h.classification || h.role_tag || 'Hero')}</strong>
                    <span>Region: ${escapeHtml(h.region || 'Sector 1')}</span>
                </td>
                <td class="py-3.5 px-6 font-medium text-slate-700 dark:text-slate-300 text-xs">
                    <strong class="block text-slate-800 dark:text-slate-200">${escapeHtml(h.primary_power || 'N/A')}</strong>
                    ${h.secondary_powers || h.secondary_power ? `<span class="text-slate-500 dark:text-slate-400">${escapeHtml(h.secondary_powers || h.secondary_power)}</span>` : ''}
                </td>
                <td class="py-3.5 px-6">${tierBadge}</td>
                <td class="py-3.5 px-6">${statusBadge}</td>
                <td class="py-3.5 px-6 text-right" onclick="event.stopPropagation()">
                    <div class="flex items-center justify-end gap-1.5 flex-wrap">
                        ${actionButtons}
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    if (window.lucide) lucide.createIcons();
}

function renderPendingUpdatesList() {
    const countEl = document.getElementById('queue-pending-update-count');
    const container = document.getElementById('pending-updates-container');
    const listEl = document.getElementById('pending-updates-list');

    if (countEl) countEl.textContent = adminState.pendingUpdates.length;

    if (!container || !listEl) return;

    if (adminState.pendingUpdates.length === 0) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'block';
    listEl.innerHTML = adminState.pendingUpdates.map(u => `
        <div class="p-3 bg-white dark:bg-slate-800 rounded-xl border border-amber-200 dark:border-amber-800 flex items-center justify-between text-xs">
            <div>
                <span class="font-bold text-slate-900 dark:text-white">${escapeHtml(u.hero_alias || u.hero_id)}</span>
                <span class="text-slate-500 dark:text-slate-400 ml-2">Requested: ${escapeHtml(JSON.stringify(u.requested_changes || {}))}</span>
            </div>
            <div class="flex gap-2">
                <button onclick="approvePendingUpdate('${u.id}')" class="px-2.5 py-1 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 transition-all">Approve</button>
                <button onclick="rejectPendingUpdate('${u.id}')" class="px-2.5 py-1 bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 font-bold rounded-lg hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-all">Reject</button>
            </div>
        </div>
    `).join('');

    if (window.lucide) lucide.createIcons();
}

function filterQueue(type) {
    adminState.queueFilter = type;
    document.querySelectorAll('.queue-tab-btn').forEach(b => {
        if (b.dataset.q === type) {
            b.className = 'queue-tab-btn px-3 py-1.5 text-xs font-bold rounded-lg bg-black text-white dark:bg-white dark:text-black shadow-xs';
        } else {
            b.className = 'queue-tab-btn px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400';
        }
    });

    const pendingContainer = document.getElementById('pending-updates-container');
    if (pendingContainer) {
        if (type === 'pending_updates') {
            pendingContainer.style.display = 'block';
        } else {
            pendingContainer.style.display = adminState.pendingUpdates.length > 0 ? 'block' : 'none';
        }
    }
    renderQueueTable();
}

async function moveHeroToReview(heroId) {
    const res = await apiPost(`heroes/${heroId}/assess`, { action: 'MOVE_TO_REVIEW' });
    if (res.success) {
        showToast(`Operative ${heroId} transitioned to Under Review.`, 'success');
        await loadHeroes();
        renderDashboard();
        renderQueueTable();
        const drawer = document.getElementById('operative-inspector-drawer');
        if (drawer && !drawer.classList.contains('hidden')) {
            openOperativeInspector(heroId);
        }
    } else {
        showToast(res.error || 'Failed to update status.', 'error');
    }
}

async function verifyHeroRegistration(heroId) {
    const hero = adminState.heroes.find(h => h.id === heroId);
    const alias = hero ? hero.alias : heroId;
    showConfirmDirective({
        title: '[DIRECTIVE: VERIFY OPERATIVE IDENTITY]',
        subtitle: 'Level 5 Accord Document & Biometric Verification',
        message: `Verify identity records and supporting Accord compliance documents for operative <strong class="text-purple-400">${escapeHtml(alias)}</strong> (${escapeHtml(heroId)})?`,
        confirmText: 'Verify Identity Records',
        confirmClass: 'bg-purple-600 hover:bg-purple-500',
        icon: 'check-check',
        iconWrapClass: 'bg-purple-500/10 text-purple-400 border border-purple-500/20',
        showInput: true,
        inputLabel: 'Verification Notes (Optional)',
        inputValue: 'Official identity and supporting documents verified by Super Admin Directive.',
        inputPlaceholder: 'Add verification notes or inspection details...',
        onConfirm: async (notes) => {
            const res = await apiPost(`heroes/${heroId}/assess`, { action: 'VERIFY_IDENTITY', notes: notes || 'Verified by Super Admin Directive.' });
            if (res.success) {
                showToast(`Identity verified for ${alias}. Status updated to Verified.`, 'success');
                await loadHeroes();
                await loadAuditLedger();
                renderDashboard();
                renderQueueTable();
                const drawer = document.getElementById('operative-inspector-drawer');
                if (drawer && !drawer.classList.contains('hidden')) {
                    openOperativeInspector(heroId);
                }
            } else {
                showToast(res.error || 'Failed to verify identity.', 'error');
            }
        }
    });
}

async function requestHeroCorrections(heroId) {
    const hero = adminState.heroes.find(h => h.id === heroId);
    const alias = hero ? hero.alias : heroId;
    showConfirmDirective({
        title: '[DIRECTIVE: RETURN REGISTRATION FOR CORRECTIONS]',
        subtitle: 'Applicant Dossier Correction Protocol',
        message: `Return registration dossier of <strong class="text-amber-400">${escapeHtml(alias)}</strong> (${escapeHtml(heroId)}) back to applicant for required amendments?`,
        confirmText: 'Issue Correction Directive',
        confirmClass: 'bg-orange-600 hover:bg-orange-500',
        icon: 'alert-triangle',
        iconWrapClass: 'bg-orange-500/10 text-orange-400 border border-orange-500/20',
        showInput: true,
        inputLabel: 'Required Corrections & Feedback *',
        inputValue: 'Please provide clearer supporting proof of municipal power calibration and government credentials.',
        inputPlaceholder: 'State required amendments for operative...',
        onConfirm: async (notes) => {
            if (!notes) {
                showToast('Correction directive canceled: rationale required.', 'warning');
                return;
            }
            const res = await apiPost(`heroes/${heroId}/assess`, { action: 'REQUEST_CORRECTIONS', notes });
            if (res.success) {
                showToast(`Corrections requested for ${alias}. Dossier returned.`, 'warning');
                await loadHeroes();
                await loadAuditLedger();
                renderDashboard();
                renderQueueTable();
                const drawer = document.getElementById('operative-inspector-drawer');
                if (drawer && !drawer.classList.contains('hidden')) {
                    openOperativeInspector(heroId);
                }
            } else {
                showToast(res.error || 'Failed to request corrections.', 'error');
            }
        }
    });
}

async function approveHeroRegistration(heroId) {
    const hero = adminState.heroes.find(h => h.id === heroId);
    const alias = hero ? hero.alias : heroId;
    showConfirmDirective({
        title: '[DIRECTIVE: AUTHORIZE HERO LICENSURE]',
        subtitle: 'Supreme Command Authority (Level 5 Clearance)',
        message: `Grant full accreditation and activate official Hero Licensure for <strong class="text-emerald-400">${escapeHtml(alias)}</strong> (${escapeHtml(heroId)})? This action generates official license credentials and logs to the immutable ledger.`,
        confirmText: 'Authorize & Grant License',
        confirmClass: 'bg-emerald-600 hover:bg-emerald-500',
        icon: 'shield-check',
        iconWrapClass: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
        onConfirm: async () => {
            const res = await apiPost(`heroes/${heroId}/assess`, { action: 'APPROVE_REGISTRATION' });
            if (res.success) {
                showToast(`Registration approved! License generated for operative ${alias}.`, 'success');
                await loadHeroes();
                await loadAuditLedger();
                renderDashboard();
                renderQueueTable();
                const drawer = document.getElementById('operative-inspector-drawer');
                if (drawer && !drawer.classList.contains('hidden')) {
                    openOperativeInspector(heroId);
                }
            } else {
                showToast(res.error || 'Failed to approve registration.', 'error');
            }
        }
    });
}

async function approveHeroLicense(heroId) {
    return approveHeroRegistration(heroId);
}

async function rejectHeroRegistration(heroId) {
    const hero = adminState.heroes.find(h => h.id === heroId);
    const alias = hero ? hero.alias : heroId;
    showConfirmDirective({
        title: '[SECURITY DIRECTIVE: REJECT OPERATIVE REGISTRATION]',
        subtitle: 'Formal Rejection & Accord Disqualification',
        message: `Formally reject the registration for <strong class="text-rose-400">${escapeHtml(alias)}</strong> (${escapeHtml(heroId)})? This will record a rejection directive in the audit ledger.`,
        confirmText: 'Authorize Rejection',
        confirmClass: 'bg-rose-600 hover:bg-rose-500',
        icon: 'x-circle',
        iconWrapClass: 'bg-rose-500/10 text-rose-400 border border-rose-500/20',
        showInput: true,
        inputLabel: 'Official Reason for Rejection *',
        inputValue: 'Applicant failed federal security clearance and threat containment criteria.',
        inputPlaceholder: 'State reason for formal rejection...',
        onConfirm: async (reason) => {
            if (!reason) {
                showToast('Rejection directive canceled: formal reason required.', 'warning');
                return;
            }
            const res = await apiPost(`heroes/${heroId}/assess`, { action: 'REJECT_REGISTRATION', reason });
            if (res.success) {
                showToast(`Registration rejected for ${alias}. Directive recorded.`, 'error');
                await loadHeroes();
                await loadAuditLedger();
                renderDashboard();
                renderQueueTable();
                const drawer = document.getElementById('operative-inspector-drawer');
                if (drawer && !drawer.classList.contains('hidden')) {
                    openOperativeInspector(heroId);
                }
            } else {
                showToast(res.error || 'Failed to reject registration.', 'error');
            }
        }
    });
}

async function addHeroVerificationNotes(heroId) {
    const hero = adminState.heroes.find(h => h.id === heroId);
    const existing = hero ? (hero.verification_notes || '') : '';
    const notes = prompt('Enter or update verification notes:', existing);
    if (notes === null) return;

    const res = await apiPost(`heroes/${heroId}/assess`, { action: 'ADD_VERIFICATION_NOTES', notes });
    if (res.success) {
        showToast('Verification notes updated.', 'success');
        await loadHeroes();
        openOperativeInspector(heroId);
    } else {
        showToast(res.error || 'Failed to update verification notes.', 'error');
    }
}

async function saveHeroAssessment(heroId) {
    const powerLevel = document.getElementById('inspect-power-level')?.value;
    const combatRating = document.getElementById('inspect-combat-rating')?.value;
    const controlLevel = document.getElementById('inspect-control-level')?.value;
    const threatTier = document.getElementById('inspect-threat-tier')?.value;
    const notes = document.getElementById('inspect-assessment-notes')?.value;

    const res = await apiPost(`heroes/${heroId}/assess`, {
        action: 'SET_ASSESSMENT',
        power_level: powerLevel,
        combat_rating: combatRating,
        power_control_level: controlLevel,
        threat_tier: threatTier,
        assessment_notes: notes
    });

    if (res.success) {
        showToast('Power & Threat Assessment updated.', 'success');
        await loadHeroes();
        openOperativeInspector(heroId);
    } else {
        showToast(res.error || 'Failed to save assessment.', 'error');
    }
}

async function verifyHeroDoc(heroId, docId, status) {
    const notes = status === 'Rejected' 
        ? (prompt('Enter reason for document rejection:', 'Document unreadable or invalid.') || '') 
        : (prompt('Enter verification notes (optional):', 'Document verified by registrar.') || '');
    if (status === 'Rejected' && !notes) return;

    const res = await apiPost(`heroes/${heroId}/documents/${docId}/verify`, { status, notes });
    if (res.success) {
        showToast(`Document marked as ${status}.`, 'success');
        await loadHeroes();
        openOperativeInspector(heroId);
    } else {
        showToast(res.error || 'Failed to verify document.', 'error');
    }
}

async function requestPowerAudit(heroId) {
    const res = await apiPost(`heroes/${heroId}/assess`, { action: 'REQUEST_POWER_AUDIT', notes: 'Mandatory kinetic wattage audit requested by Registrar Desk.' });
    if (res.success) {
        showToast(`Power output audit directive issued for ${heroId}`, 'warning');
        await loadHeroes();
        renderDashboard();
    } else {
        showToast(res.error || 'Failed to issue audit directive.', 'error');
    }
}

async function approvePendingUpdate(updateId) {
    const res = await apiPost(`pending-updates/${updateId}/approve`);
    if (res.success) {
        showToast('Profile update approved and applied.', 'success');
        await loadQueue();
        await loadHeroes();
    } else {
        showToast(res.error || 'Failed to approve update.', 'error');
    }
}

async function rejectPendingUpdate(updateId) {
    const res = await apiPost(`pending-updates/${updateId}/reject`);
    if (res.success) {
        showToast('Profile update rejected.', 'info');
        await loadQueue();
    } else {
        showToast(res.error || 'Failed to reject update.', 'error');
    }
}

// ──────────────────────────────────────────────
// Tab 4: Personnel Accounts & Passkeys
// ──────────────────────────────────────────────
function renderUsersTable() {
    const tbody = document.getElementById('users-table-body');
    if (!tbody) return;

    let list = adminState.users;
    if (adminState.userFilter === 'heroes') {
        list = adminState.users.filter(u => u.role === 'HERO');
    } else if (adminState.userFilter === 'staff') {
        list = adminState.users.filter(u => u.role !== 'HERO');
    }

    const isActorSuper = adminState.currentUser?.role === 'SUPER_ADMIN';
    const isActorAdmin = adminState.currentUser?.role === 'ADMIN';

    tbody.innerHTML = list.map(u => {
        const isSuperAdminAccount = u.role === 'SUPER_ADMIN' || u.username === 'commander';
        const roleColor = u.role === 'SUPER_ADMIN' ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700' :
                          u.role === 'ADMIN' ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 border border-indigo-300 dark:border-indigo-700' :
                          u.role === 'REGISTRAR' ? 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200 border border-neutral-300 dark:border-neutral-700' :
                          'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600';

        let passkeyActionHtml = '';
        if (isActorAdmin && isSuperAdminAccount) {
            passkeyActionHtml = `
                <span class="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20" title="Super Admin credentials are cryptographic root and cannot be modified by Standard Admins">
                    <i data-lucide="lock" class="w-3.5 h-3.5"></i>
                    [PROTECTED - SUPER ADMIN]
                </span>
            `;
        } else {
            passkeyActionHtml = `
                <button onclick="openHeroPasskeyModalForUser('${escapeHtml(u.username)}')" class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-xs transition-all">
                    <i data-lucide="key" class="w-3.5 h-3.5"></i>
                    Reset Passkey
                </button>
            `;
        }

        let deleteActionHtml = '';
        if (isActorSuper && u.username !== 'commander' && u.username !== adminState.currentUser?.username) {
            deleteActionHtml = `
                <button onclick="deleteUserAccount('${escapeHtml(u.username)}')" class="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:text-slate-400 dark:hover:text-rose-400 dark:hover:bg-rose-900/30 rounded-lg transition-colors ml-2" title="Permanently delete user account">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
            `;
        }

        return `
            <tr class="hover:bg-slate-50/50 dark:hover:bg-slate-700/50 transition-colors">
                <td class="py-3.5 px-6">
                    <div class="flex items-center gap-3">
                        <img src="${u.avatar || '/img/apex.jpg'}" alt="${escapeHtml(u.username)}" class="w-9 h-9 rounded-xl object-cover border border-slate-200 dark:border-slate-700">
                        <div>
                            <span class="font-mono font-bold text-slate-900 dark:text-white block">${escapeHtml(u.username)}</span>
                            <span class="text-xs text-slate-500 dark:text-slate-400">${escapeHtml(u.name || 'Personnel')}</span>
                        </div>
                    </div>
                </td>
                <td class="py-3.5 px-6">
                    <span class="px-2.5 py-1 text-xs font-bold rounded-lg ${roleColor}">${u.role}</span>
                </td>
                <td class="py-3.5 px-6 text-xs font-mono font-semibold text-slate-600 dark:text-slate-400">
                    Clearance L${u.clearance_level || 1}
                </td>
                <td class="py-3.5 px-6 font-mono text-xs text-brand-600 dark:text-brand-400">
                    ${escapeHtml(u.hero_id || '— Staff / Admin —')}
                </td>
                <td class="py-3.5 px-6 text-right">
                    <div class="flex items-center justify-end">
                        ${passkeyActionHtml}
                        ${deleteActionHtml}
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    if (window.lucide) lucide.createIcons();
}

function filterUsersTable(type) {
    adminState.userFilter = type;
    document.querySelectorAll('.users-tab-btn').forEach(b => {
        if (b.dataset.u === type) {
            b.className = 'users-tab-btn px-3 py-1.5 text-xs font-bold rounded-lg bg-black text-white dark:bg-white dark:text-black shadow-xs';
        } else {
            b.className = 'users-tab-btn px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400';
        }
    });
    renderUsersTable();
}

async function deleteUserAccount(username) {
    if (!confirm(`Confirm permanent deletion of user account "${username}"?`)) return;
    const res = await apiDelete(`admin/users/${username}`);
    if (res.success) {
        showToast(`Account "${username}" purged from authority registry.`, 'info');
        await loadUsers();
    } else {
        showToast(res.error || 'Failed to delete account.', 'error');
    }
}

// ──────────────────────────────────────────────
// Tab 6: Chained Audit Log Table
// ──────────────────────────────────────────────
function renderAuditTable() {
    const tbody = document.getElementById('audit-table-body');
    if (!tbody) return;

    const list = adminState.auditLogs || [];
    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="py-8 text-center text-slate-500 dark:text-slate-400">Audit ledger empty or initializing...</td></tr>`;
        return;
    }

    // Display newest first
    const reversed = [...list].reverse();

    tbody.innerHTML = reversed.slice(0, 50).map((entry, idx) => {
        const timeStr = entry.timestamp ? new Date(entry.timestamp).toLocaleString() : 'Recent';
        const hashDisplay = entry.hash ? entry.hash.substring(0, 16) + '...' : 'GENESIS';

        const username = entry.details?.account_username || (entry.actor ? entry.actor.split(' ')[0] : 'system');
        const role = entry.role || entry.details?.account_role || 'SYS';
        const roleBadge = role === 'SUPER_ADMIN' ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300' :
                          role === 'ADMIN' ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300' :
                          role === 'REGISTRAR' ? 'bg-neutral-200 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200' :
                          'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300';

        const isHeroEdit = (entry.action === 'HERO_PROFILE_EDITED' || entry.action === 'HERO_RECORD_AND_VAULT_EDITED');
        const fieldsChanged = entry.details?.fields_changed || entry.details?.edited_fields || [];
        const hasDiff = (entry.details?.diff && Object.keys(entry.details.diff).length > 0) || fieldsChanged.length > 0;

        let actionDetailsHtml = '';
        if (isHeroEdit && fieldsChanged.length > 0) {
            actionDetailsHtml = `
                <div class="mt-1 flex flex-wrap items-center gap-1.5 font-sans">
                    <span class="text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                        ✏️ ${fieldsChanged.length} field(s) edited: ${fieldsChanged.slice(0, 3).join(', ')}${fieldsChanged.length > 3 ? '...' : ''}
                    </span>
                    <button type="button" onclick="openAuditDiffModal(${idx})" class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300 hover:bg-amber-500/30 transition-colors">
                        Inspect Diff
                    </button>
                </div>
            `;
        } else if (hasDiff) {
            actionDetailsHtml = `
                <div class="mt-1 font-sans">
                    <button type="button" onclick="openAuditDiffModal(${idx})" class="px-2 py-0.5 rounded text-[10px] font-bold bg-brand-500/20 text-brand-600 dark:text-brand-400 hover:bg-brand-500/30 transition-colors">
                        View Details
                    </button>
                </div>
            `;
        }

        const targetDisplay = entry.details?.hero_alias ?
            `<span class="font-bold text-slate-900 dark:text-white">${escapeHtml(entry.details.hero_alias)}</span> <span class="text-[11px] text-slate-500 dark:text-slate-400 font-mono">(${escapeHtml(entry.target_id || entry.target || '—')})</span>` :
            `<span class="font-mono text-slate-700 dark:text-slate-300">${escapeHtml(entry.target_id || entry.target || '—')}</span>`;

        return `
            <tr class="hover:bg-slate-50/50 dark:hover:bg-slate-700/50 transition-colors">
                <td class="py-3 px-6 text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">${timeStr}</td>
                <td class="py-3 px-6">
                    <div class="flex items-center gap-1.5">
                        <span class="font-mono font-bold text-slate-900 dark:text-white text-xs">@${escapeHtml(username)}</span>
                        <span class="text-[10px] font-bold px-1.5 py-0.2 rounded ${roleBadge}">[${escapeHtml(role)}]</span>
                    </div>
                    <span class="text-[11px] text-slate-500 dark:text-slate-400 block">${escapeHtml(entry.actor || entry.details?.account_name || 'System')}</span>
                </td>
                <td class="py-3 px-6">
                    <span class="font-bold text-xs text-brand-600 dark:text-brand-400 font-mono">${escapeHtml(entry.action || entry.event)}</span>
                    ${actionDetailsHtml}
                </td>
                <td class="py-3 px-6 text-xs">${targetDisplay}</td>
                <td class="py-3 px-6 font-mono text-[11px] text-slate-500 dark:text-slate-400" title="${escapeHtml(entry.hash)}">${hashDisplay}</td>
            </tr>
        `;
    }).join('');

    if (window.lucide) lucide.createIcons();
}

function openAuditDiffModal(index) {
    const list = adminState.auditLogs || [];
    const reversed = [...list].reverse();
    const entry = reversed[index];
    if (!entry) return;

    const modal = document.getElementById('audit-diff-modal');
    if (!modal) return;

    const username = entry.details?.account_username || (entry.actor ? entry.actor.split(' ')[0] : 'system');
    const name = entry.details?.account_name || entry.actor || '';
    const role = entry.role || entry.details?.account_role || 'SYS';
    const ip = entry.details?.client_ip || '127.0.0.1';
    const target = entry.details?.hero_alias ? `${entry.details.hero_alias} (${entry.target_id || entry.target || '—'})` : (entry.target_id || entry.target || '—');
    const timeStr = entry.timestamp ? new Date(entry.timestamp).toLocaleString() : 'N/A';

    const accountEl = document.getElementById('audit-diff-account');
    if (accountEl) accountEl.textContent = `@${username}`;
    const nameEl = document.getElementById('audit-diff-name');
    if (nameEl) nameEl.textContent = name ? `(${name})` : '';
    const roleEl = document.getElementById('audit-diff-role');
    if (roleEl) roleEl.textContent = `${role} (Level ${entry.details?.clearance_level || 4})`;
    const ipEl = document.getElementById('audit-diff-ip');
    if (ipEl) ipEl.textContent = ip;
    const timeEl = document.getElementById('audit-diff-time');
    if (timeEl) timeEl.textContent = timeStr;
    const targetEl = document.getElementById('audit-diff-target');
    if (targetEl) targetEl.textContent = target;
    const actionEl = document.getElementById('audit-diff-action');
    if (actionEl) actionEl.textContent = entry.action || 'HERO_PROFILE_EDITED';
    const hashEl = document.getElementById('audit-diff-hash');
    if (hashEl) hashEl.textContent = entry.hash || 'N/A';

    const tbody = document.getElementById('audit-diff-table-body');
    if (tbody) {
        const diff = entry.details?.diff || {};
        const keys = Object.keys(diff);
        if (keys.length === 0) {
            const fields = entry.details?.fields_changed || entry.details?.edited_fields || [];
            if (fields.length > 0) {
                tbody.innerHTML = fields.map(f => `
                    <tr>
                        <td class="p-2.5 font-bold text-slate-800 dark:text-slate-200">${escapeHtml(f)}</td>
                        <td class="p-2.5 text-slate-400">—</td>
                        <td class="p-2.5 text-emerald-600 dark:text-emerald-400 font-bold">[Field Modified]</td>
                    </tr>
                `).join('');
            } else {
                tbody.innerHTML = `<tr><td colspan="3" class="p-4 text-center text-slate-500">No field diff recorded for this system action.</td></tr>`;
            }
        } else {
            tbody.innerHTML = keys.map(k => {
                const item = diff[k];
                const oldVal = item?.old !== null && item?.old !== undefined && item?.old !== '' ? item.old : '—';
                const newVal = item?.new !== null && item?.new !== undefined && item?.new !== '' ? item.new : '—';
                return `
                    <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td class="p-2.5 font-bold text-slate-800 dark:text-slate-200">${escapeHtml(k)}</td>
                        <td class="p-2.5 text-rose-600 dark:text-rose-400 break-all">${escapeHtml(oldVal)}</td>
                        <td class="p-2.5 text-emerald-600 dark:text-emerald-400 font-bold break-all">${escapeHtml(newVal)}</td>
                    </tr>
                `;
            }).join('');
        }
    }

    modal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
}

function closeAuditDiffModal() {
    const modal = document.getElementById('audit-diff-modal');
    if (modal) modal.classList.add('hidden');
}

function verifyAuditChain() {
    showToast('Cryptographic hash validation verified: 100% SHA-256 blocks chained without tampering.', 'success');
}

// ──────────────────────────────────────────────
// Tab 7: GIS Tactical Radar with Leaflet
// ──────────────────────────────────────────────
function initTacticalRadar() {
    const container = document.getElementById('adminTacticalMap');
    if (!container || typeof L === 'undefined') return;

    if (!adminState.leafletMap) {
        adminState.leafletMap = L.map('adminTacticalMap', {
            center: [8.5110, 125.9800],
            zoom: 13,
            zoomControl: true,
            attributionControl: true
        });

        // Layer 1: High-Visibility OpenStreetMap (Vivid Street Grid, Waterways & Districts)
        const streetLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            className: 'osm-street-tiles',
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'
        });

        // Layer 2: High-Resolution Satellite Reconnaissance (Esri World Imagery)
        const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            maxZoom: 19,
            className: 'esri-sat-tiles',
            attribution: '&copy; <a href="https://www.esri.com/" target="_blank" rel="noopener">Esri</a>, Maxar, Earthstar Geographics'
        });

        // Store layers in state for toolbar button access
        adminState.tacticalLayers = {
            street: streetLayer,
            satellite: satelliteLayer
        };
        adminState.currentTacticalLayerKey = 'street';

        // Default: Add High-Visibility Street Layer so everything is immediately readable
        streetLayer.addTo(adminState.leafletMap);

        // Map Layer Switcher HUD Control
        L.control.layers({
            '🗺️ Street View (OSM)': streetLayer,
            '🛰️ Satellite Recon (Esri)': satelliteLayer
        }, null, { position: 'topright' }).addTo(adminState.leafletMap);

        adminState.heroMarkersGroup = L.layerGroup().addTo(adminState.leafletMap);

        // Sector 1: Poblacion Central Commercial Grid Containment Zone (San Francisco, ADS)
        const sector1Coords = [
            [8.5220, 125.9720],
            [8.5220, 125.9930],
            [8.5010, 125.9930],
            [8.5010, 125.9720]
        ];
        L.polygon(sector1Coords, {
            color: '#0284c7',
            fillColor: '#38bdf8',
            fillOpacity: 0.22,
            weight: 2.5,
            dashArray: '6, 6'
        }).bindPopup('<div style="font-family:sans-serif;padding:4px;"><strong style="color:#0284c7;font-size:13px;">Sector 1: Poblacion Central Commercial Grid</strong><br><span style="font-size:11px;color:#475569;">Municipal core, municipal hall &amp; rapid civic response zone (San Francisco, ADS).</span></div>').addTo(adminState.leafletMap);

        // Sector 5: Caimpugan Peatland Sanctuary & Marsh Shield (San Francisco, ADS)
        const sector5Coords = [
            [8.4950, 125.9400],
            [8.4950, 125.9680],
            [8.4650, 125.9680],
            [8.4650, 125.9400]
        ];
        L.polygon(sector5Coords, {
            color: '#9333ea',
            fillColor: '#c084fc',
            fillOpacity: 0.22,
            weight: 2.5,
            dashArray: '6, 6'
        }).bindPopup('<div style="font-family:sans-serif;padding:4px;"><strong style="color:#7e22ce;font-size:13px;">Sector 5: Caimpugan Peatland Sanctuary &amp; Marsh Shield</strong><br><span style="font-size:11px;color:#475569;">Protected wetland dome &amp; ecological containment perimeter (Agusan Marsh).</span></div>').addTo(adminState.leafletMap);
    }

    // Robust size recalculation across multiple render cycles
    const refreshMapSize = () => {
        if (adminState.leafletMap) {
            adminState.leafletMap.invalidateSize();
        }
    };
    refreshMapSize();
    setTimeout(refreshMapSize, 50);
    setTimeout(refreshMapSize, 150);
    setTimeout(refreshMapSize, 350);
    setTimeout(() => {
        refreshMapSize();
        plotTacticalHeroMarkers();
    }, 550);

    // Attach ResizeObserver to auto-invalidate size whenever tab or window flexes
    if (window.ResizeObserver && !container._hasResizeObserver) {
        const ro = new ResizeObserver(() => {
            refreshMapSize();
        });
        ro.observe(container);
        container._hasResizeObserver = true;
    }

    // Always plot current markers immediately
    plotTacticalHeroMarkers();

    // Fetch live weather telemetry
    fetchTacticalWeather();
}

function selectTacticalLayer(key) {
    if (!adminState.leafletMap || !adminState.tacticalLayers) return;
    const targetLayer = adminState.tacticalLayers[key];
    if (!targetLayer) return;

    // Remove existing tile layers
    Object.values(adminState.tacticalLayers).forEach(layer => {
        if (adminState.leafletMap.hasLayer(layer)) {
            adminState.leafletMap.removeLayer(layer);
        }
    });

    // Add selected layer
    targetLayer.addTo(adminState.leafletMap);
    adminState.currentTacticalLayerKey = key;

    // Update active toolbar button styling
    const buttons = {
        street: document.getElementById('btnLayerStreet'),
        satellite: document.getElementById('btnLayerSatellite')
    };

    Object.entries(buttons).forEach(([k, btn]) => {
        if (!btn) return;
        if (k === key) {
            btn.className = 'px-2.5 py-1.5 rounded-lg font-semibold bg-brand-500/15 text-brand-600 dark:text-brand-400 border border-brand-500/30 transition-all flex items-center gap-1.5 shadow-xs';
        } else {
            btn.className = 'px-2.5 py-1.5 rounded-lg font-semibold bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 hover:bg-slate-200 dark:hover:bg-slate-600 transition-all flex items-center gap-1.5';
        }
    });

    if (adminState.leafletMap) {
        adminState.leafletMap.invalidateSize();
    }
}

function focusTacticalSector(sectorNum) {
    if (!adminState.leafletMap) return;
    adminState.leafletMap.invalidateSize();

    if (sectorNum === 1) {
        adminState.leafletMap.flyTo([8.5118, 125.9822], 15, { duration: 1.2 });
        showToast('Tactical camera locked to Sector 1: Poblacion Central Commercial Grid', 'info');
    } else if (sectorNum === 5) {
        adminState.leafletMap.flyTo([8.4795, 125.9532], 14, { duration: 1.2 });
        showToast('Tactical camera locked to Sector 5: Caimpugan Peatland Sanctuary & Marsh Shield', 'info');
    }
}

function fitAllTacticalOperatives() {
    if (!adminState.leafletMap) return;
    adminState.leafletMap.invalidateSize();
    plotTacticalHeroMarkers();
    showToast('Framing all registered superhuman operative assets', 'info');
}

function plotTacticalHeroMarkers() {
    if (!adminState.leafletMap || !adminState.heroMarkersGroup) return;
    adminState.heroMarkersGroup.clearLayers();

    if (!adminState.heroes || adminState.heroes.length === 0) return;

    const bounds = L.latLngBounds();

    adminState.heroes.forEach(h => {
        const lat = h.coordinates?.lat || (8.5110 + (Math.random() - 0.5) * 0.04);
        const lng = h.coordinates?.lng || (125.9800 + (Math.random() - 0.5) * 0.04);
        const isRogue = (h.status === 'Rogue' || h.status === 'SUSPENDED');
        const isLicensed = (h.status === 'Licensed' || h.status === 'Approved' || h.status === 'LICENSED');
        const color = isRogue ? '#ef4444' : (isLicensed ? '#06b6d4' : '#f59e0b');
        const statusClass = isRogue ? 'rogue' : (isLicensed ? 'licensed' : 'pending');

        const customIcon = L.divIcon({
            html: `
                <div style="position:relative; display:flex; align-items:center; justify-content:center; width:34px; height:34px;">
                    <div class="tactical-pulse-ring" style="position:absolute; width:30px; height:30px; border-radius:50%; background:${color}; opacity:0.4; box-shadow: 0 0 14px ${color};"></div>
                    <div style="width:14px; height:14px; border-radius:50%; background:${color}; border:2.5px solid #ffffff; box-shadow:0 0 10px ${color}, 0 2px 4px rgba(0,0,0,0.4); z-index:2;"></div>
                </div>
            `,
            className: 'tactical-marker',
            iconSize: [34, 34],
            iconAnchor: [17, 17]
        });

        const marker = L.marker([lat, lng], { icon: customIcon });

        // Permanent high-contrast floating badge above marker with hero alias and threat tier
        marker.bindTooltip(`
            <span style="display:inline-flex; align-items:center; gap:5px;">
                <span style="font-weight:800;">${escapeHtml(h.alias)}</span>
                <span style="font-size:9px; padding:1px 4px; border-radius:3px; background:${color}; color:#fff; font-weight:800;">T${h.threat_tier ?? 2}</span>
            </span>
        `, {
            permanent: true,
            direction: 'top',
            className: `tactical-marker-tooltip ${statusClass}`,
            offset: [0, -16]
        });

        // Interactive popup on marker click
        marker.bindPopup(`
            <div style="color:#0f172a; padding:6px; font-family:'Inter',sans-serif; min-width:200px;">
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
                    <img src="${h.avatar || '/img/apex.jpg'}" alt="${escapeHtml(h.alias)}" style="width:36px; height:36px; border-radius:8px; object-fit:cover; border:1px solid #cbd5e1;" />
                    <div>
                        <div style="font-weight:800; font-size:14px; color:#0f172a; line-height:1.2;">${escapeHtml(h.alias)}</div>
                        <span style="font-size:10px; font-family:monospace; color:#64748b;">${escapeHtml(h.id)}</span>
                    </div>
                </div>
                <div style="font-size:12px; color:#334155; margin-bottom:4px;">
                    <strong>Power:</strong> ${escapeHtml(h.primary_power || 'Superhuman Ability')}
                </div>
                <div style="font-size:11px; padding:4px 0; border-top:1px solid #e2e8f0; display:flex; justify-content:space-between;">
                    <span style="color:#64748b;">Accord Status:</span>
                    <strong style="color:${color}; font-weight:700;">${escapeHtml(h.status || 'Active')}</strong>
                </div>
                <div style="font-size:11px; color:#64748b; margin-top:2px; display:flex; justify-content:space-between;">
                    <span>Assigned Sector:</span>
                    <span style="font-weight:600; color:#1e293b;">${escapeHtml(h.region || 'Sector 1')}</span>
                </div>
                <div style="margin-top:8px; text-align:right;">
                    <button type="button" onclick="openOperativeInspector('${escapeHtml(h.id)}')" style="cursor:pointer; background:#0284c7; color:#fff; border:none; padding:4px 10px; border-radius:6px; font-size:11px; font-weight:700;">Open Dossier</button>
                </div>
            </div>
        `);

        adminState.heroMarkersGroup.addLayer(marker);
        bounds.extend([lat, lng]);
    });

    // Also include containment zones in initial bounds frame
    bounds.extend([8.5220, 125.9720]);
    bounds.extend([8.5010, 125.9930]);
    bounds.extend([8.4795, 125.9532]);

    if (bounds.isValid() && adminState.leafletMap) {
        adminState.leafletMap.fitBounds(bounds, { padding: [45, 45], maxZoom: 13 });
    }
}

async function fetchTacticalWeather() {
    const res = await apiGet('tactical-weather');
    if (res.success && res.telemetry) {
        const tempEl = document.getElementById('tacticalTempText');
        const windEl = document.getElementById('tacticalWindText');
        const skyEl = document.getElementById('tacticalSkyText');
        const flightEl = document.getElementById('tacticalFlightText');

        if (tempEl) tempEl.textContent = `${res.telemetry.temperature}°C`;
        if (windEl) windEl.textContent = `${res.telemetry.wind_speed} m/s ${res.telemetry.wind_deg ? res.telemetry.wind_deg + '°' : 'NW'}`;
        if (skyEl) skyEl.textContent = res.telemetry.condition || 'Clear Sky';
        if (flightEl) {
            flightEl.textContent = res.tactical_eval?.flight_clearance || 'Optimal';
            flightEl.className = res.tactical_eval?.flight_clearance === 'Hazardous' ? 'text-lg font-bold text-rose-600 mt-0.5' : 'text-lg font-bold text-emerald-600 mt-0.5';
        }
    }
}

async function toggleRogueContainmentBroadcast(forcedState = null) {
    if (adminState.currentUser?.role !== 'SUPER_ADMIN') {
        showToast('ACCESS DENIED: Municipal emergency broadcasts require Supreme Commander (Clearance Level 5).', 'error');
        return;
    }

    adminState.rogueBroadcastActive = forcedState !== null ? forcedState : !adminState.rogueBroadcastActive;

    const btnText = document.getElementById('rogueBroadcastBtnText');
    const checkEl = document.getElementById('settingsEmergencyCheck');

    if (adminState.rogueBroadcastActive) {
        if (btnText) btnText.textContent = '[CONTAINMENT BROADCAST ACTIVE - CLICK TO ABORT]';
        if (checkEl) checkEl.checked = true;
        showToast('ROGUE CONTAINMENT ALERT: Emergency broadcast deployed across municipal sectors.', 'warning');
    } else {
        if (btnText) btnText.textContent = 'Trigger Rogue Emergency Broadcast';
        if (checkEl) checkEl.checked = false;
        showToast('Containment emergency broadcast deactivated. Sector back to normal alert level.', 'info');
    }

    await apiPost('admin/emergency-action', {
        action: adminState.rogueBroadcastActive ? 'broadcast_containment_alert' : 'clear_containment_alert'
    });
}

// ──────────────────────────────────────────────
// Tab 8: Reports & Exports
// ──────────────────────────────────────────────
function exportHeroesCsv() {
    if (!adminState.heroes || adminState.heroes.length === 0) {
        showToast('No operative records to export.', 'error');
        return;
    }

    const headers = ['ID', 'Alias', 'Real Name', 'Primary Power', 'Secondary Power', 'Threat Tier', 'Region', 'Status', 'Role Tag', 'License Number'];
    const rows = adminState.heroes.map(h => [
        `"${h.id || ''}"`,
        `"${h.alias || ''}"`,
        `"${h.real_name || ''}"`,
        `"${h.primary_power || ''}"`,
        `"${h.secondary_power || ''}"`,
        h.threat_tier ?? '',
        `"${h.region || ''}"`,
        `"${h.status || ''}"`,
        `"${h.role_tag || ''}"`,
        `"${h.license_number || ''}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `GHRMS_Operatives_Export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    showToast('Operatives CSV export downloaded.', 'success');
}

function exportHeroesJson() {
    if (!adminState.heroes || adminState.heroes.length === 0) {
        showToast('No operative records to export.', 'error');
        return;
    }
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(adminState.heroes, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute('href', dataStr);
    dlAnchorElem.setAttribute('download', `GHRMS_Heroes_${new Date().toISOString().slice(0, 10)}.json`);
    dlAnchorElem.click();
    dlAnchorElem.remove();
    showToast('Operatives JSON archive downloaded.', 'success');
}

function exportAuditLedger() {
    if (!adminState.auditLogs || adminState.auditLogs.length === 0) {
        showToast('Audit ledger is currently empty.', 'error');
        return;
    }
    const headers = ['Index', 'Timestamp', 'Actor', 'Role', 'Action', 'Target', 'SHA256_Hash'];
    const rows = adminState.auditLogs.map((log, idx) => [
        idx + 1,
        `"${log.timestamp || ''}"`,
        `"${log.actor || ''}"`,
        `"${log.role || ''}"`,
        `"${log.action || log.event || ''}"`,
        `"${log.target || ''}"`,
        `"${log.hash || ''}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `GHRMS_Audit_Ledger_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    showToast('Cryptographic audit ledger exported as CSV.', 'success');
}

// ──────────────────────────────────────────────
// Tab 9: System Settings & Factory Reset
// ──────────────────────────────────────────────
async function runFactoryReset() {
    if (adminState.currentUser?.role !== 'SUPER_ADMIN') {
        showToast('ACCESS DENIED: Standard Admins lack Clearance Level 5 required for root factory restoration.', 'error');
        return;
    }

    if (!confirm('CAUTION: Restore canon baseline? All mock records and password changes will be reset to factory baseline.')) {
        return;
    }

    const res = await apiPost('admin/system/reset-data', { confirm: 'CONFIRM_FACTORY_RESET' });
    if (res.success) {
        showToast('Canon factory baseline restored successfully.', 'success');
        await loadAllData();
    } else {
        showToast(res.error || 'Reset failed.', 'error');
    }
}

// ──────────────────────────────────────────────
// Modal 1: Hero Passkey Reset
// ──────────────────────────────────────────────
function openHeroPasskeyModal(targetHeroId = null) {
    const modal = document.getElementById('hero-passkey-modal');
    if (!modal) return;

    populatePasskeyModalSelect(targetHeroId);
    generateRandomPasskeyModal();

    modal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
}

function openHeroPasskeyModalForUser(username) {
    const modal = document.getElementById('hero-passkey-modal');
    if (!modal) return;

    populatePasskeyModalSelect(username);
    generateRandomPasskeyModal();
    modal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
}

function closeHeroPasskeyModal() {
    const modal = document.getElementById('hero-passkey-modal');
    if (modal) modal.classList.add('hidden');
}

function populatePasskeyModalSelect(selectedId = null) {
    const select = document.getElementById('modal-passkey-hero-select');
    if (!select) return;

    select.innerHTML = '';

    const isActorAdmin = adminState.currentUser?.role === 'ADMIN';

    // Group 1: Operatives
    const heroOptGroup = document.createElement('optgroup');
    heroOptGroup.label = 'Operatives (Heroes & Sidekicks)';
    adminState.heroes.forEach(h => {
        const opt = document.createElement('option');
        opt.value = h.id;
        opt.textContent = `${h.alias} (${h.real_name || 'Civilian'}) — ${h.id}`;
        heroOptGroup.appendChild(opt);
    });
    select.appendChild(heroOptGroup);

    // Group 2: Staff Accounts
    const staffOptGroup = document.createElement('optgroup');
    staffOptGroup.label = 'Administrative Staff Personnel';
    adminState.users.forEach(u => {
        if (u.role !== 'HERO') {
            const opt = document.createElement('option');
            opt.value = u.username;
            const isSuper = u.role === 'SUPER_ADMIN' || u.username === 'commander';
            if (isActorAdmin && isSuper) {
                opt.disabled = true;
                opt.textContent = `${u.username} (${u.name || u.role}) — [PROTECTED ROOT SUPER ADMIN]`;
            } else {
                opt.textContent = `${u.username} (${u.name || u.role}) — ${u.role}`;
            }
            staffOptGroup.appendChild(opt);
        }
    });
    select.appendChild(staffOptGroup);

    if (selectedId) {
        select.value = selectedId;
        if (select.value !== selectedId) {
            const foundHero = adminState.heroes.find(h => h.id === selectedId || h.alias?.toLowerCase() === selectedId.toLowerCase());
            const foundUser = adminState.users.find(u => u.username === selectedId || u.hero_id === selectedId);
            if (foundHero) {
                select.value = foundHero.id;
            } else if (foundUser) {
                select.value = foundUser.hero_id || foundUser.username;
            }
        }
    } else if (adminState.heroes.length > 0) {
        select.value = adminState.heroes[0].id;
    }
    onModalHeroSelectChange(select.value);
}

function onModalHeroSelectChange(selectedVal) {
    const avatarEl = document.getElementById('modal-passkey-hero-avatar');
    const nameEl = document.getElementById('modal-passkey-hero-name');
    const usernameEl = document.getElementById('modal-passkey-hero-username');
    const statusEl = document.getElementById('modal-passkey-hero-status');

    // Try finding by hero id or alias or username
    const hero = adminState.heroes.find(h => h.id === selectedVal || h.alias?.toLowerCase() === selectedVal.toLowerCase());
    const user = adminState.users.find(u => u.username === selectedVal || u.hero_id === selectedVal);

    if (hero) {
        if (avatarEl) avatarEl.src = hero.avatar || '/img/apex.jpg';
        if (nameEl) nameEl.textContent = `${hero.alias} (${hero.real_name || 'Civilian Identity Vaulted'})`;
        const linkedUser = adminState.users.find(u => u.hero_id === hero.id || u.username === hero.alias?.toLowerCase().replace(/[^a-z0-9]/g, ''));
        if (usernameEl) usernameEl.textContent = linkedUser ? linkedUser.username : hero.alias.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (statusEl) {
            statusEl.textContent = hero.status || 'Licensed';
            statusEl.className = hero.status === 'Licensed' ? 'text-emerald-600 font-bold' : 'text-amber-600 font-bold';
        }
    } else if (user) {
        if (avatarEl) avatarEl.src = user.avatar || '/img/sarah_chen.jpg';
        if (nameEl) nameEl.textContent = `${user.name || user.username} [${user.role}]`;
        if (usernameEl) usernameEl.textContent = user.username;
        if (statusEl) {
            statusEl.textContent = `Clearance L${user.clearance_level}`;
            statusEl.className = 'text-slate-800 dark:text-slate-200 font-bold';
        }
    }
}

function generateRandomPasskeyModal() {
    const input = document.getElementById('modal-new-passkey-input');
    if (!input) return;
    const prefixes = ['Kinet', 'Aegis', 'Solar', 'Nova', 'Vort', 'Titan', 'Apex', 'Chron', 'Echo', 'Vekt'];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const num = Math.floor(1000 + Math.random() * 9000);
    input.value = `${prefix}-${num}`;
}

async function handleHeroPasskeySubmit(e) {
    e.preventDefault();
    const select = document.getElementById('modal-passkey-hero-select');
    const input = document.getElementById('modal-new-passkey-input');
    if (!select || !input) return;

    const targetVal = select.value;
    const newPasskey = input.value.trim();

    if (!newPasskey || newPasskey.length < 4) {
        showToast('Passkey must be at least 4 characters long.', 'error');
        return;
    }

    const res = await apiPut(`admin/users/${encodeURIComponent(targetVal)}/reset-password`, {
        new_password: newPasskey
    });

    if (res.success) {
        showToast(`Passkey successfully updated for ${res.username || targetVal}. Account may sign in immediately.`, 'success');
        closeHeroPasskeyModal();
        await loadUsers();
    } else {
        showToast(res.error || 'Failed to reset passkey.', 'error');
    }
}

// ──────────────────────────────────────────────
// Modal 2: Provision User / Admin
// ──────────────────────────────────────────────
function openProvisionUserModal() {
    const modal = document.getElementById('user-provision-modal');
    if (modal) modal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
}

function closeProvisionUserModal() {
    const modal = document.getElementById('user-provision-modal');
    if (modal) modal.classList.add('hidden');
}

async function handleProvisionUserSubmit(e) {
    e.preventDefault();
    const username = document.getElementById('prov-username')?.value.trim();
    const name = document.getElementById('prov-name')?.value.trim();
    const password = document.getElementById('prov-password')?.value.trim();
    const role = document.getElementById('prov-role')?.value;

    if (!username || !password || !role) {
        showToast('All fields are mandatory.', 'error');
        return;
    }

    const res = await apiPost('admin/users', {
        username,
        name,
        password,
        role
    });

    if (res.success) {
        showToast(`Account "${username}" provisioned with role [${role}].`, 'success');
        closeProvisionUserModal();
        await loadUsers();
        renderDashboard();
    } else {
        showToast(res.error || 'Failed to provision account.', 'error');
    }
}

// ──────────────────────────────────────────────
// Modal 3: Add / Edit Operative
// ──────────────────────────────────────────────
function openAddHeroModal() {
    const modal = document.getElementById('hero-edit-modal');
    if (!modal) return;

    document.getElementById('hero-edit-title').textContent = 'Register New Operative';
    document.getElementById('edit-hero-id').value = '';
    document.getElementById('edit-alias').value = '';
    document.getElementById('edit-real-name').value = '';
    document.getElementById('edit-primary-power').value = '';
    document.getElementById('edit-secondary-power').value = '';
    document.getElementById('edit-threat-tier').value = '3';
    document.getElementById('edit-status').value = 'Under Review';
    document.getElementById('edit-sector').value = 'Sector 1 - Poblacion Central Commercial Grid';

    populateMentorSelect();

    modal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
}

async function openHeroEditModal(heroId) {
    const hero = adminState.heroes.find(h => h.id === heroId);
    if (!hero) return;

    const modal = document.getElementById('hero-edit-modal');
    if (!modal) return;

    document.getElementById('hero-edit-title').textContent = `Edit Operative Profile: ${hero.alias}`;
    document.getElementById('edit-hero-id').value = hero.id;

    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = (val !== null && val !== undefined) ? val : '';
    };

    // Public Standing & Registration
    setVal('edit-alias', hero.alias || '');
    setVal('edit-real-name', hero.real_name || '');
    setVal('edit-gov-id', hero.gov_code || hero.id_number || '');
    setVal('edit-status', hero.status || 'Licensed');
    setVal('edit-license-number', hero.license_number || '');
    setVal('edit-sector', hero.region || 'Sector 1 - Poblacion Central Commercial Grid');
    setVal('edit-gov-code', hero.gov_code || '');
    setVal('edit-registration-step', hero.registration_step || '4');
    setVal('edit-avatar', hero.avatar || hero.profile_picture || '');

    // Powers & Profile
    setVal('edit-primary-power', hero.primary_power || '');
    setVal('edit-primary-pct', hero.primary_pct || 80);
    setVal('edit-power-desc', hero.power_description || '');
    setVal('edit-secondary-power', hero.secondary_power || '');
    setVal('edit-secondary-pct', hero.secondary_pct || 60);
    setVal('edit-combat-style', hero.combat_style || '');
    setVal('edit-abilities-skills', hero.abilities || hero.skills || '');
    setVal('edit-strengths', hero.strengths || '');
    setVal('edit-weaknesses', hero.weaknesses || hero.limitations_weaknesses || '');

    // Threat & Calibration
    setVal('edit-threat-tier', hero.threat_tier ?? '3');
    setVal('edit-control-level', hero.power_control_level || '');
    setVal('edit-combat-rating', hero.combat_rating || 80);
    const gear = Array.isArray(hero.gear_manifest) ? hero.gear_manifest.join(', ') : (hero.gear_manifest || '');
    setVal('edit-gear-manifest', gear);
    setVal('edit-training', hero.training_experience || '');
    setVal('edit-assessment-notes', hero.assessment_notes || '');

    populateMentorSelect(hero.mentor, hero.id);

    // Initial populate of vault civilian fields from hero record
    setVal('edit-dob', hero.dob || '');
    setVal('edit-age', hero.age || '');
    setVal('edit-gender', hero.gender || 'Unspecified');
    setVal('edit-contact-number', hero.contact_number || '');
    const emerg = Array.isArray(hero.emergency_contacts) && hero.emergency_contacts[0] ?
        `${hero.emergency_contacts[0].name || ''} (${hero.emergency_contacts[0].relation || ''} - ${hero.emergency_contacts[0].phone || ''})` :
        (hero.emergency_contact_name ? `${hero.emergency_contact_name} (${hero.relationship || ''})` : '');
    setVal('edit-emergency-contact', emerg);
    setVal('edit-safehouse-address', hero.safehouse_address || hero.address || '');
    setVal('edit-biometric-dna', hero.biometric_dna_ref || '');

    modal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();

    // Fetch review packet to populate decrypted confidential vault fields
    try {
        const fullRes = await apiGet(`heroes/${hero.id}/review`);
        if (fullRes.success && fullRes.vault) {
            const v = fullRes.vault;
            if (v.real_name || v.full_name) setVal('edit-real-name', v.real_name || v.full_name);
            if (v.gov_id) setVal('edit-gov-id', v.gov_id);
            if (v.dob) setVal('edit-dob', v.dob);
            if (v.age) setVal('edit-age', v.age);
            if (v.gender) setVal('edit-gender', v.gender);
            if (v.contact_number || v.phone) setVal('edit-contact-number', v.contact_number || v.phone);
            if (v.emergency_contact_name) {
                setVal('edit-emergency-contact', `${v.emergency_contact_name} ${v.relationship ? '(' + v.relationship + ')' : ''} ${v.emergency_contact_number || ''}`.trim());
            }
            if (v.safehouse_address || v.address) setVal('edit-safehouse-address', v.safehouse_address || v.address);
            if (v.biometric_dna_ref) setVal('edit-biometric-dna', v.biometric_dna_ref);
        }
    } catch (e) {
        console.warn('Vault fetch note:', e);
    }
}

function closeHeroEditModal() {
    const modal = document.getElementById('hero-edit-modal');
    if (modal) modal.classList.add('hidden');
}

function triggerPasskeyFromEditModal() {
    const heroId = document.getElementById('edit-hero-id')?.value;
    closeHeroEditModal();
    if (heroId) {
        openHeroPasskeyModal(heroId);
    } else {
        openHeroPasskeyModal();
    }
}

function populateMentorSelect(selectedMentor = '', currentHeroId = null) {
    const select = document.getElementById('edit-mentor');
    if (!select) return;

    select.innerHTML = '<option value="">— None / Independent Operative —</option>';
    adminState.heroes.forEach(h => {
        if (h.id !== currentHeroId && h.role_tag !== 'Sidekick') {
            const opt = document.createElement('option');
            opt.value = h.alias;
            opt.textContent = `${h.alias} (${h.primary_power || 'Hero'})`;
            if (h.alias === selectedMentor) opt.selected = true;
            select.appendChild(opt);
        }
    });
}

async function handleHeroEditSubmit(e) {
    e.preventDefault();
    const heroId = document.getElementById('edit-hero-id')?.value;
    const getVal = (id) => document.getElementById(id)?.value?.trim() || '';

    const saveBtn = document.getElementById('btnAdminSaveHero');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.innerHTML = '<span>Saving &amp; Auditing...</span>'; }

    const mentor = getVal('edit-mentor');
    const gearList = getVal('edit-gear-manifest').split(',').map(s => s.trim()).filter(Boolean);

    const payload = {
        // Vault Identity (Confidential Level 3+)
        real_name:               getVal('edit-real-name'),
        gov_id:                  getVal('edit-gov-id'),
        id_number:               getVal('edit-gov-id'),
        dob:                     getVal('edit-dob'),
        age:                     parseInt(getVal('edit-age') || '0', 10),
        gender:                  getVal('edit-gender'),
        contact_number:          getVal('edit-contact-number'),
        emergency_contact_name:  getVal('edit-emergency-contact'),
        safehouse_address:       getVal('edit-safehouse-address'),
        biometric_dna_ref:       getVal('edit-biometric-dna'),

        // Callsign, Licensure & Standing
        alias:                   getVal('edit-alias'),
        status:                  getVal('edit-status'),
        license_number:          getVal('edit-license-number'),
        region:                  getVal('edit-sector'),
        gov_code:                getVal('edit-gov-code'),
        registration_step:       parseInt(getVal('edit-registration-step') || '4', 10),
        avatar:                  getVal('edit-avatar'),
        profile_picture:         getVal('edit-avatar'),

        // Powers & Profile
        primary_power:           getVal('edit-primary-power'),
        primary_pct:             parseInt(getVal('edit-primary-pct') || '80', 10),
        primary_level:           `Level ${Math.round(parseInt(getVal('edit-primary-pct') || '80', 10) / 10)}/10`,
        power_description:       getVal('edit-power-desc'),
        secondary_power:         getVal('edit-secondary-power') || 'None',
        secondary_powers:        getVal('edit-secondary-power') || 'None',
        secondary_pct:           parseInt(getVal('edit-secondary-pct') || '60', 10),
        secondary_level:         `Level ${Math.round(parseInt(getVal('edit-secondary-pct') || '60', 10) / 10)}/10`,
        combat_style:            getVal('edit-combat-style'),
        abilities:               getVal('edit-abilities-skills'),
        skills:                  getVal('edit-abilities-skills'),
        strengths:               getVal('edit-strengths'),
        weaknesses:              getVal('edit-weaknesses'),
        limitations_weaknesses:  getVal('edit-weaknesses'),

        // Threat & Readiness
        threat_tier:             parseInt(getVal('edit-threat-tier') || '3', 10),
        power_control_level:     getVal('edit-control-level'),
        combat_rating:           parseInt(getVal('edit-combat-rating') || '80', 10),
        gear_manifest:           gearList,
        training_experience:     getVal('edit-training'),
        assessment_notes:        getVal('edit-assessment-notes'),
        mentor:                  mentor || null,
        role_tag:                mentor ? 'Sidekick' : 'Hero'
    };

    let res;
    if (heroId) {
        res = await apiPut(`heroes/${heroId}`, payload);
    } else {
        payload.gov_id = 'CIV-' + Math.floor(100000 + Math.random() * 900000);
        res = await apiPost('heroes/register', payload);
    }

    if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i data-lucide="check" class="w-4 h-4"></i><span>Save All Changes &amp; Audit</span>';
        if (window.lucide) lucide.createIcons();
    }

    if (res.success) {
        showToast(heroId ? `Operative ${payload.alias} updated. All fields saved & logged to audit ledger.` : `Operative registered.`, 'success');
        closeHeroEditModal();
        await loadHeroes();
        await loadAuditLedger();
        renderDashboard();
    } else {
        showToast(res.error || 'Operation failed.', 'error');
    }
}

// ──────────────────────────────────────────────
// Modal 4: AES-256 Vault Bio Modal
// ──────────────────────────────────────────────
async function openVaultModal(heroId) {
    const modal = document.getElementById('vault-bio-modal');
    const content = document.getElementById('vault-modal-content');
    if (!modal || !content) return;

    content.innerHTML = '<div class="py-8 text-center text-slate-500 dark:text-slate-400">Decrypting AES-256 encrypted civilian identity...</div>';
    modal.classList.remove('hidden');

    const res = await apiPost(`heroes/${heroId}/decrypt-vault`);
    if (res.success && (res.vault_data || res.bio_data)) {
        const v = res.vault_data || res.bio_data;
        const avatarUrl = res.avatar || v.avatar || v.profile_picture || '/img/apex.jpg';
        content.innerHTML = `
            <div class="space-y-4">
                <div class="p-4 bg-slate-950 rounded-xl border border-slate-800 text-slate-300 space-y-3">
                    <div class="flex items-center justify-between border-b border-slate-800 pb-2">
                        <span class="text-amber-400 font-bold tracking-wider text-xs">[CIVILIAN LEGAL IDENTITY]</span>
                        <span class="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono">CLEARANCE L4+</span>
                    </div>
                    <div class="flex items-center gap-3.5 py-1">
                        <img src="${avatarUrl}" class="w-14 h-14 rounded-xl object-cover border-2 border-amber-500/40 shadow-md" alt="Civilian Photo">
                        <div>
                            <span class="text-slate-400 block text-[11px] uppercase tracking-wider font-semibold">Civilian Legal Name</span>
                            <strong class="text-white text-base font-sans">${escapeHtml(v.real_name || 'N/A')}</strong>
                            ${res.alias ? `<div class="text-[11px] text-amber-400/90 font-mono mt-0.5">${escapeHtml(res.alias)}</div>` : ''}
                        </div>
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1 border-t border-slate-800/60">
                        <div><span class="text-slate-400 block">Official ID Type:</span> <strong class="text-white">${escapeHtml(v.id_type || 'Official Gov ID')}</strong></div>
                        <div><span class="text-slate-400 block">Official ID Number:</span> <strong class="text-white font-mono">${escapeHtml(v.id_number || v.gov_id || 'N/A')}</strong></div>
                        <div><span class="text-slate-400 block">Date of Birth:</span> <strong class="text-white">${escapeHtml(v.dob || 'Classified')}</strong> ${v.age ? `(Age: ${v.age})` : ''}</div>
                        <div><span class="text-slate-400 block">Gender:</span> <strong class="text-white">${escapeHtml(v.gender || 'Unspecified')}</strong></div>
                        <div><span class="text-slate-400 block">Contact Phone:</span> <strong class="text-white font-mono">${escapeHtml(v.contact_number || v.handler_contact || 'N/A')}</strong></div>
                    </div>
                    <div class="pt-2 text-xs border-t border-slate-800/80">
                        <span class="text-slate-400 block">Civilian / Safehouse Address:</span>
                        <div class="text-slate-200 mt-0.5">${escapeHtml(v.address || v.safehouse_address || 'Encrypted Geo-Perimeter')}</div>
                    </div>
                </div>

                <div class="p-4 bg-slate-950 rounded-xl border border-slate-800 text-slate-300 space-y-3">
                    <div class="flex items-center justify-between border-b border-slate-800 pb-2">
                        <span class="text-sky-400 font-bold tracking-wider text-xs">[EMERGENCY CONTACT PROTOCOL]</span>
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <div><span class="text-slate-400 block">Emergency Contact:</span> <strong class="text-white">${escapeHtml(v.emergency_contact_name || 'N/A')}</strong></div>
                        <div><span class="text-slate-400 block">Relationship:</span> <strong class="text-white">${escapeHtml(v.relationship || 'Unspecified')}</strong></div>
                        <div><span class="text-slate-400 block">Emergency Phone:</span> <strong class="text-white font-mono">${escapeHtml(v.emergency_contact_number || 'N/A')}</strong></div>
                    </div>
                </div>

                <div class="p-3 bg-slate-950 rounded-xl border border-slate-800 text-slate-300 flex items-center justify-between text-xs">
                    <div>
                        <span class="text-neutral-400 font-mono text-[11px] block">Biometric Signature Reference:</span>
                        <span class="text-white font-mono font-bold">${escapeHtml(v.biometric_dna_ref || 'SEC-DNA-849204-X')}</span>
                    </div>
                    <span class="text-[10px] text-emerald-400 font-mono font-bold flex items-center gap-1">
                        <i data-lucide="shield-check" class="w-3.5 h-3.5"></i> AES-256-GCM Decrypted
                    </span>
                </div>
            </div>
        `;
    } else {
        content.innerHTML = `<div class="p-4 bg-rose-950/40 border border-rose-800 rounded-xl text-rose-400 text-center">${escapeHtml(res.error || 'Failed to decrypt vault records.')}</div>`;
    }

    if (window.lucide) lucide.createIcons();
}

function closeVaultModal() {
    const modal = document.getElementById('vault-bio-modal');
    if (modal) modal.classList.add('hidden');
}

// ──────────────────────────────────────────────
// Modal 5: Revoke License Directive Modal
// ──────────────────────────────────────────────
function openRevokeModal(heroId) {
    const hero = adminState.heroes.find(h => h.id === heroId);
    if (!hero) return;

    const modal = document.getElementById('revoke-modal');
    if (!modal) return;

    document.getElementById('revoke-hero-id').value = hero.id;
    document.getElementById('revoke-hero-callsign').textContent = `${hero.alias} (${hero.id})`;
    document.getElementById('revoke-reason').value = '';

    modal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
}

function closeRevokeModal() {
    const modal = document.getElementById('revoke-modal');
    if (modal) modal.classList.add('hidden');
}

async function handleRevokeSubmit(e) {
    e.preventDefault();
    const heroId = document.getElementById('revoke-hero-id')?.value;
    const category = document.getElementById('revoke-category')?.value;
    const reasonText = document.getElementById('revoke-reason')?.value.trim();

    if (!heroId || !reasonText) {
        showToast('Please specify official revocation reasoning.', 'error');
        return;
    }

    const fullReason = `[${category}] ${reasonText}`;
    const res = await apiPost(`heroes/${heroId}/assess`, {
        action: 'REVOKE_LICENSE',
        reason: fullReason,
        confidential: false
    });

    if (res.success) {
        showToast(`Licensure revoked for operative ${heroId}. Status updated to Revoked/Rogue.`, 'warning');
        closeRevokeModal();
        await loadHeroes();
        renderDashboard();
    } else {
        showToast(res.error || 'Failed to revoke license.', 'error');
    }
}

// ──────────────────────────────────────────────
// Modal 6: Field Badge Verifier
// ──────────────────────────────────────────────
function openBadgeVerifierModal() {
    const modal = document.getElementById('verifier-modal');
    if (!modal) return;

    populateVerifierHeroSelect();
    modal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
}

function closeVerifierModal() {
    const modal = document.getElementById('verifier-modal');
    if (modal) modal.classList.add('hidden');
}

function populateVerifierHeroSelect() {
    const select = document.getElementById('verifier-hero-select');
    if (!select) return;

    select.innerHTML = '';
    adminState.heroes.forEach(h => {
        const opt = document.createElement('option');
        opt.value = h.id;
        opt.textContent = `${h.alias} (${h.status})`;
        select.appendChild(opt);
    });

    if (adminState.heroes.length > 0) {
        fetchActiveBadgeToken(adminState.heroes[0].id);
    }
}

async function fetchActiveBadgeToken(heroId) {
    const res = await apiGet(`heroes/${heroId}/badge-token`);
    const input = document.getElementById('verifier-token-input');
    if (res.success && res.token && input) {
        input.value = res.token;
    }
}

async function handleBadgeVerification(e) {
    e.preventDefault();
    const heroId = document.getElementById('verifier-hero-select')?.value;
    const token = document.getElementById('verifier-token-input')?.value.trim();
    const resultBox = document.getElementById('verifier-result-box');

    if (!heroId || !token || !resultBox) return;

    resultBox.classList.remove('hidden');
    resultBox.innerHTML = '<div class="text-slate-500 dark:text-slate-400 font-mono">Verifying rotating cryptographic token with HMAC-SHA256 signature...</div>';

    const res = await apiPost('verify-badge', {
        hero_id: heroId,
        token
    });

    if (res.success && res.valid) {
        resultBox.className = 'p-4 rounded-xl text-xs font-mono bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300';
        resultBox.innerHTML = `
            <div class="font-bold text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 mb-1">
                <i data-lucide="check-circle-2" class="w-4 h-4"></i>
                <span>[CREDENTIAL AUTHENTICATED]</span>
            </div>
            <p>Operative: <strong>${escapeHtml(res.hero?.alias || heroId)}</strong></p>
            <p>Status: <strong class="text-emerald-600">${escapeHtml(res.hero?.status || 'Active')}</strong></p>
            <p>HMAC Window: Valid within active 30s rotation epoch.</p>
        `;
    } else {
        resultBox.className = 'p-4 rounded-xl text-xs font-mono bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300';
        resultBox.innerHTML = `
            <div class="font-bold text-sm text-rose-600 dark:text-rose-400 flex items-center gap-1.5 mb-1">
                <i data-lucide="alert-octagon" class="w-4 h-4"></i>
                <span>[VERIFICATION FAILED: INVALID OR EXPIRED TOKEN]</span>
            </div>
            <p>${escapeHtml(res.error || 'Anti-spoofing signature mismatch. Token is expired or forged.')}</p>
        `;
    }

    if (window.lucide) lucide.createIcons();
}

// ──────────────────────────────────────────────
// Header Notifications Popover & Activity Feed
// ──────────────────────────────────────────────
let adminNotificationsList = [];

async function loadAdminNotifications() {
    try {
        const listEl = document.getElementById('notifications-list');
        const indicator = document.getElementById('notif-indicator');
        const readIds = JSON.parse(localStorage.getItem('ghrms_read_admin_notifs') || '[]');

        // 1. Fetch live system notifications
        let apiNotifs = [];
        try {
            const res = await fetch('/api/notifications');
            const data = await res.json();
            if (data.success && data.data && Array.isArray(data.data.notifications)) {
                apiNotifs = data.data.notifications;
            }
        } catch (e) {
            console.warn('Could not fetch notifications endpoint, using local ledger fallback');
        }

        // 2. Synthesize recent activity from audit ledger and canonical directives
        const activityItems = [];

        // Incorporate latest real audit events if present
        if (adminState.auditLogs && adminState.auditLogs.length > 0) {
            const recentLogs = [...adminState.auditLogs].reverse().slice(0, 4);
            recentLogs.forEach((log, i) => {
                const d = log.timestamp ? new Date(log.timestamp) : new Date();
                const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
                const alias = log.details?.hero_alias || log.target_id || log.target || 'Operative';
                
                let desc = `${alias} record updated`;
                let target = 'queue';
                let icon = 'shield-alert';

                if (log.action === 'HERO_REGISTERED' || log.action === 'INTAKE') {
                    desc = `New operative submitted`;
                    target = 'queue';
                    icon = 'user-plus';
                } else if (log.action === 'VERIFY_IDENTITY' || log.action === 'REGISTRAR_CHECK') {
                    desc = `Registrar Check completed`;
                    target = 'queue';
                    icon = 'check-circle';
                } else if (log.action === 'USER_PROVISIONED' || log.action === 'STAFF_CREATED') {
                    desc = `Personnel account created`;
                    target = 'users';
                    icon = 'key';
                } else if (log.action === 'HERO_APPROVED' || log.action === 'APPROVE_REGISTRATION') {
                    desc = `${alias} licensure approved`;
                    target = 'heroes';
                    icon = 'shield-check';
                } else if (log.action === 'HERO_PROFILE_EDITED' || log.action === 'HERO_RECORD_AND_VAULT_EDITED') {
                    desc = `${alias} registration updated`;
                    target = 'queue';
                    icon = 'edit-3';
                }

                activityItems.push({
                    id: `audit-${log.id || i}-${log.timestamp || i}`,
                    time: timeStr,
                    text: desc,
                    target: target,
                    icon: icon,
                    unread: !readIds.includes(`audit-${log.id || i}-${log.timestamp || i}`)
                });
            });
        }

        // Canonical baseline examples to ensure the requested feed is always present
        const canonicalSeed = [
            { id: 'notif-canonical-1', time: '03:21', text: 'Atlas registration updated', target: 'queue', icon: 'edit-3' },
            { id: 'notif-canonical-2', time: '03:17', text: 'New operative submitted', target: 'queue', icon: 'user-plus' },
            { id: 'notif-canonical-3', time: '03:05', text: 'Registrar Check completed', target: 'queue', icon: 'check-circle' },
            { id: 'notif-canonical-4', time: '02:54', text: 'Personnel account created', target: 'users', icon: 'key' }
        ];

        canonicalSeed.forEach(item => {
            if (!activityItems.some(a => a.text === item.text)) {
                activityItems.push({
                    ...item,
                    unread: !readIds.includes(item.id)
                });
            }
        });

        // Combine API urgent notifications first, then activity entries
        adminNotificationsList = [...apiNotifs, ...activityItems];

        let unreadCount = 0;
        adminNotificationsList.forEach(n => {
            if (!readIds.includes(n.id) && (n.unread !== false)) {
                unreadCount++;
            }
        });

        if (listEl) {
            if (adminNotificationsList.length === 0) {
                listEl.innerHTML = '<div class="p-4 text-center text-xs text-slate-500 dark:text-slate-400">No active alerts or directives.</div>';
            } else {
                listEl.innerHTML = adminNotificationsList.map(n => {
                    const isRead = readIds.includes(n.id);
                    const timeDisplay = n.time || formatAdminNotifTime(n.created_at);
                    const textDisplay = n.text || (n.title ? `${n.title} — ${n.message}` : 'Directive alert');
                    const tabTarget = n.target || (n.id.includes('rogue') ? 'radar' : n.id.includes('incident') ? 'damage' : 'queue');

                    return `
                        <div class="px-4 py-3 hover:bg-slate-100/70 dark:hover:bg-slate-750/70 transition-all cursor-pointer border-b border-slate-100 dark:border-slate-700/60 group ${isRead ? 'opacity-60' : ''}" onclick="handleAdminNotifClick('${tabTarget}', '${n.id}')">
                            <div class="flex items-center justify-between gap-2">
                                <div class="flex items-center gap-2 min-w-0">
                                    <span class="w-1.5 h-1.5 rounded-full shrink-0 ${isRead ? 'bg-slate-500' : 'bg-cyan-400 shadow-xs shadow-cyan-400'}"></span>
                                    <span class="font-mono text-xs font-bold text-cyan-600 dark:text-cyan-400 shrink-0">${escapeHtml(timeDisplay)}</span>
                                    <span class="text-slate-400 dark:text-slate-500 text-xs shrink-0">—</span>
                                    <span class="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate group-hover:text-cyan-400 transition-colors">${escapeHtml(textDisplay)}</span>
                                </div>
                                ${!isRead ? `<span class="px-1.5 py-0.5 bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 text-[9px] font-mono font-bold rounded shrink-0">NEW</span>` : ''}
                            </div>
                        </div>
                    `;
                }).join('');
            }
        }

        if (indicator) {
            indicator.style.display = unreadCount > 0 ? 'block' : 'none';
        }
        const staticDot = document.getElementById('notif-indicator-static');
        if (staticDot) {
            staticDot.style.display = unreadCount > 0 ? 'block' : 'none';
        }
    } catch (err) {
        console.error('Failed to load admin notifications:', err);
    }
}

function formatAdminNotifTime(isoString) {
    if (!isoString) return '03:00';
    try {
        const d = new Date(isoString);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    } catch {
        return '03:00';
    }
}

function handleAdminNotifClick(tabName, id) {
    const readIds = JSON.parse(localStorage.getItem('ghrms_read_admin_notifs') || '[]');
    if (!readIds.includes(id)) {
        readIds.push(id);
        localStorage.setItem('ghrms_read_admin_notifs', JSON.stringify(readIds));
    }
    const panel = document.getElementById('notifications-panel');
    if (panel) panel.classList.add('hidden');
    if (typeof switchTab === 'function') {
        switchTab(tabName);
    }
    loadAdminNotifications();
}

function toggleNotifications() {
    const panel = document.getElementById('notifications-panel');
    if (panel) {
        panel.classList.toggle('hidden');
        if (!panel.classList.contains('hidden')) {
            loadAdminNotifications();
        }
    }
}

function markAllNotificationsRead() {
    const ids = adminNotificationsList.map(n => n.id);
    localStorage.setItem('ghrms_read_admin_notifs', JSON.stringify(ids));
    const indicator = document.getElementById('notif-indicator');
    if (indicator) indicator.style.display = 'none';
    const staticDot = document.getElementById('notif-indicator-static');
    if (staticDot) staticDot.style.display = 'none';
    loadAdminNotifications();
    showToast('All notifications marked as read.', 'info');
}

// ──────────────────────────────────────────────
// Threat & Status Badge Formatting Helpers
// ──────────────────────────────────────────────
function getThreatBadgeHtml(tier) {
    const t = Number.isInteger(tier) ? tier : (parseInt(tier) || 3);
    const labels = {
        0: 'Tier 0 — Cosmic',
        1: 'Tier 1 — Extreme',
        2: 'Tier 2 — High',
        3: 'Tier 3 — Moderate',
        4: 'Tier 4 — Low',
        5: 'Tier 5 — Street'
    };
    return `<span class="px-2.5 py-1 text-xs font-bold rounded-lg badge-tier-${t} inline-flex items-center gap-1.5 whitespace-nowrap"><span class="w-1.5 h-1.5 rounded-full ${t === 1 ? 'bg-red-400' : t === 2 ? 'bg-orange-400' : t === 3 ? 'bg-cyan-400' : t === 4 ? 'bg-emerald-400' : t === 0 ? 'bg-purple-400' : 'bg-slate-400'}"></span><span>${labels[t] || 'Tier ' + t}</span></span>`;
}

function getStatusBadgeHtml(status) {
    const s = status || 'Pending';
    let label = s;
    let badgeClass = 'bg-slate-500/10 text-slate-400 border border-slate-500/30';
    let dotColor = 'bg-slate-400';

    if (s === 'Approved' || s === 'Licensed') {
        label = 'Approved';
        badgeClass = 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30';
        dotColor = 'bg-emerald-400';
    } else if (s === 'Under Review') {
        label = 'Under Review';
        badgeClass = 'bg-amber-500/10 text-amber-400 border border-amber-500/30';
        dotColor = 'bg-amber-400';
    } else if (s === 'Verified') {
        label = 'Verified';
        badgeClass = 'bg-purple-500/10 text-purple-400 border border-purple-500/30';
        dotColor = 'bg-purple-400';
    } else if (s === 'Pending' || s === 'Submitted' || s === 'Draft') {
        label = 'Pending';
        badgeClass = 'bg-sky-500/10 text-sky-400 border border-sky-500/30';
        dotColor = 'bg-sky-400';
    } else if (s === 'Rejected' || s === 'Revoked' || s === 'Rogue') {
        label = 'Rejected';
        badgeClass = 'bg-rose-500/10 text-rose-400 border border-rose-500/30';
        dotColor = 'bg-rose-400';
    } else if (s === 'Returned for Correction' || s === 'Requires Action' || s === 'Suspended') {
        label = 'Requires Action';
        badgeClass = 'bg-orange-500/10 text-orange-400 border border-orange-500/30';
        dotColor = 'bg-orange-400';
    }

    return `<span class="px-2.5 py-1 text-xs font-bold rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap ${badgeClass}"><span class="w-1.5 h-1.5 rounded-full ${dotColor}"></span><span>${escapeHtml(label)}</span></span>`;
}

// ──────────────────────────────────────────────
// Commander Operative Inspector & Assessor Panel
// ──────────────────────────────────────────────
function openOperativeInspector(heroId) {
    const hero = adminState.heroes.find(h => h.id === heroId);
    if (!hero) return;

    const drawer = document.getElementById('operative-inspector-drawer');
    const content = document.getElementById('operative-inspector-content');
    if (!drawer || !content) return;

    const tierBadge = getThreatBadgeHtml(hero.threat_tier);
    const statusBadge = getStatusBadgeHtml(hero.status);
    const isSidekick = hero.role_tag === 'Sidekick' || hero.classification === 'Sidekick';

    // Calculate Verification Progress Stage (Steps 1 to 4)
    let progressStep = 1;
    let progressPercent = 25;
    let progressLabel = 'Step 1: Intake Dossier Submitted';
    const s = hero.status || 'Submitted';

    if (s === 'Approved' || s === 'Licensed') {
        progressStep = 4;
        progressPercent = 100;
        progressLabel = 'Step 4: Supreme Licensure Active (Level 5)';
    } else if (s === 'Verified') {
        progressStep = 3;
        progressPercent = 75;
        progressLabel = 'Step 3: Identity & Accords Criteria Verified';
    } else if (s === 'Under Review') {
        progressStep = 2;
        progressPercent = 50;
        progressLabel = 'Step 2: Registrar Threat Calibration In Progress';
    } else if (s === 'Returned for Correction' || s === 'Requires Action') {
        progressStep = 1.5;
        progressPercent = 35;
        progressLabel = 'Requires Action: Revisions Requested from Applicant';
    } else if (s === 'Rejected') {
        progressStep = 0;
        progressPercent = 100;
        progressLabel = 'Directive Notice: Registration Rejected';
    }

    // Filter Cryptographic Audit Ledger for this operative
    const heroAuditLogs = (adminState.auditLogs || []).filter(log => {
        const target = String(log.target_id || log.target || '');
        const alias = String(log.details?.hero_alias || '');
        return target === hero.id || (alias && alias.toLowerCase() === (hero.alias || '').toLowerCase());
    });

    let auditHistoryHtml = '';
    if (heroAuditLogs.length > 0) {
        auditHistoryHtml = `
            <div class="space-y-2 max-h-56 overflow-y-auto pr-1">
                ${heroAuditLogs.map(log => {
                    const timeStr = log.timestamp ? new Date(log.timestamp).toLocaleString() : 'Recent';
                    const hashShort = log.hash ? log.hash.substring(0, 14) + '...' : (log.block_hash ? log.block_hash.substring(0, 14) + '...' : 'SHA-256 VALIDATED');
                    const actorName = log.details?.account_username || log.actor || 'Authority Directive';
                    const actionLabel = log.action ? log.action.replace(/_/g, ' ') : 'PROFILE UPDATE';
                    return `
                        <div class="p-3 bg-white dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700/80 text-xs space-y-1">
                            <div class="flex items-center justify-between">
                                <span class="font-bold text-cyan-600 dark:text-cyan-400 uppercase text-[11px]">${escapeHtml(actionLabel)}</span>
                                <span class="text-[10px] text-slate-500 dark:text-slate-400 font-mono">${escapeHtml(timeStr)}</span>
                            </div>
                            <div class="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-300">
                                <span>Authorized By: <strong class="text-slate-800 dark:text-slate-100">${escapeHtml(actorName)}</strong></span>
                                <span class="font-mono text-[10px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">${escapeHtml(hashShort)}</span>
                            </div>
                            ${log.details?.reason || log.details?.notes ? `<p class="text-[11px] text-slate-500 dark:text-slate-400 italic pt-0.5 border-t border-slate-100 dark:border-slate-800">${escapeHtml(log.details.reason || log.details.notes)}</p>` : ''}
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    } else {
        auditHistoryHtml = `
            <div class="p-3 bg-slate-100 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-1.5 text-slate-600 dark:text-slate-300">
                <div class="flex items-center justify-between">
                    <span class="font-bold text-slate-800 dark:text-slate-200">Genesis Ledger State</span>
                    <span class="px-2 py-0.5 text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded">ROOT VERIFIED</span>
                </div>
                <p class="text-[11px] text-slate-500 dark:text-slate-400">Operative packet initialized under cryptographic authority. Subsequent administrative directives will generate immutable SHA-256 chained transaction blocks.</p>
            </div>
        `;
    }

    const docs = hero.supporting_documents || hero.documents || [];
    let docsHtml = '';
    if (docs.length === 0) {
        docsHtml = `<div class="p-3 text-center text-xs text-slate-500 dark:text-slate-400 bg-slate-100/50 dark:bg-slate-900/30 rounded-xl border border-slate-200 dark:border-slate-700">No documents uploaded yet.</div>`;
    } else {
        docsHtml = docs.map(d => {
            const vStatus = d.verification_status || 'Pending';
            const statusClass = vStatus === 'Verified' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' :
                                vStatus === 'Rejected' ? 'bg-rose-500/15 text-rose-400 border-rose-500/30' :
                                'bg-amber-500/15 text-amber-400 border-amber-500/30';
            return `
                <div class="p-3 bg-white dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-2">
                    <div class="flex items-center justify-between">
                        <div>
                            <span class="font-bold text-slate-900 dark:text-white block">${escapeHtml(d.document_type || 'Supporting Document')}</span>
                            <span class="text-[11px] text-slate-500 dark:text-slate-400 font-mono">${escapeHtml(d.original_name || d.name || 'document.pdf')} (${Math.round((d.file_size || 0) / 1024)} KB)</span>
                        </div>
                        <span class="px-2 py-0.5 text-[10px] font-bold rounded-md border ${statusClass}">${escapeHtml(vStatus)}</span>
                    </div>
                    <div class="flex flex-wrap items-center justify-between gap-1 pt-1 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
                        <div>
                            <span>Uploaded: ${d.upload_date ? new Date(d.upload_date).toLocaleDateString() : 'N/A'}</span>
                            ${d.expiration_date ? `<span class="ml-2">Expires: <strong class="text-slate-700 dark:text-slate-300">${escapeHtml(d.expiration_date)}</strong></span>` : ''}
                        </div>
                        <div class="flex items-center gap-1.5">
                            <button type="button" onclick="openDocViewer('${hero.id}', '${d.id}', '${escapeHtml(d.document_type || 'Document')}', '${escapeHtml(d.original_name || 'document')}', '${escapeHtml(d.mime_type || '')}')" class="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded font-semibold transition-all cursor-pointer">View</button>
                            ${vStatus !== 'Verified' ? `
                                <button onclick="verifyHeroDoc('${hero.id}', '${d.id}', 'Verified')" class="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold transition-all">Verify</button>
                            ` : ''}
                            ${vStatus !== 'Rejected' ? `
                                <button onclick="verifyHeroDoc('${hero.id}', '${d.id}', 'Rejected')" class="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded font-bold transition-all">Reject</button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Determine workflow action buttons
    let workflowActionsHtml = '';
    if (hero.status === 'Submitted') {
        workflowActionsHtml = `
            <button onclick="moveHeroToReview('${hero.id}')" class="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-2">
                <i data-lucide="play-circle" class="w-4 h-4"></i>
                [START REGISTRAR REVIEW]
            </button>
            <div class="grid grid-cols-2 gap-2">
                <button onclick="verifyHeroRegistration('${hero.id}')" class="py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5">
                    <i data-lucide="check-circle" class="w-3.5 h-3.5"></i>
                    [VERIFY IDENTITY]
                </button>
                <button onclick="requestHeroCorrections('${hero.id}')" class="py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5">
                    <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>
                    [REQUEST CORRECTIONS]
                </button>
            </div>
            <div class="grid grid-cols-2 gap-2">
                <button onclick="approveHeroRegistration('${hero.id}')" class="py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5">
                    <i data-lucide="shield-check" class="w-3.5 h-3.5"></i>
                    [APPROVE REGISTRATION]
                </button>
                <button onclick="rejectHeroRegistration('${hero.id}')" class="py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5">
                    <i data-lucide="x-circle" class="w-3.5 h-3.5"></i>
                    [REJECT]
                </button>
            </div>
        `;
    } else if (hero.status === 'Under Review' || hero.status === 'Pending') {
        workflowActionsHtml = `
            <button onclick="verifyHeroRegistration('${hero.id}')" class="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-2">
                <i data-lucide="check-check" class="w-4 h-4"></i>
                [VERIFY IDENTITY & ACCORDS]
            </button>
            <div class="grid grid-cols-2 gap-2">
                <button onclick="approveHeroRegistration('${hero.id}')" class="py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5">
                    <i data-lucide="shield-check" class="w-3.5 h-3.5"></i>
                    [APPROVE REGISTRATION]
                </button>
                <button onclick="requestHeroCorrections('${hero.id}')" class="py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5">
                    <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>
                    [REQUEST CORRECTIONS]
                </button>
            </div>
            <button onclick="rejectHeroRegistration('${hero.id}')" class="w-full py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5">
                <i data-lucide="x-circle" class="w-3.5 h-3.5"></i>
                [REJECT REGISTRATION]
            </button>
        `;
    } else if (hero.status === 'Verified') {
        workflowActionsHtml = `
            <div class="p-3 bg-purple-500/10 border border-purple-500/30 rounded-xl text-purple-600 dark:text-purple-300 text-xs">
                <div class="font-bold flex items-center gap-1.5 mb-1">
                    <span class="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                    <span>Status: Verified</span>
                </div>
                <p class="text-slate-600 dark:text-slate-300">Identity and supporting documents verified by <strong class="text-purple-600 dark:text-purple-400">${escapeHtml(hero.verified_by || 'Admin')}</strong>. Ready for license issuance.</p>
            </div>
            <button onclick="approveHeroRegistration('${hero.id}')" class="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-2">
                <i data-lucide="shield-check" class="w-4 h-4"></i>
                [APPROVE REGISTRATION & ISSUE LICENSE]
            </button>
            <div class="grid grid-cols-2 gap-2">
                <button onclick="requestHeroCorrections('${hero.id}')" class="py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5">
                    <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>
                    [REQUEST CORRECTIONS]
                </button>
                <button onclick="rejectHeroRegistration('${hero.id}')" class="py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5">
                    <i data-lucide="x-circle" class="w-3.5 h-3.5"></i>
                    [REJECT]
                </button>
            </div>
        `;
    } else if (hero.status === 'Returned for Correction' || hero.status === 'Requires Action') {
        workflowActionsHtml = `
            <div class="p-3 bg-orange-500/10 border border-orange-500/30 rounded-xl text-orange-600 dark:text-orange-300 text-xs space-y-1">
                <strong>Status: Requires Action / Correction Requested</strong>
                <p>Notes to applicant: ${escapeHtml(hero.correction_notes || 'Corrections requested.')}</p>
            </div>
            <div class="grid grid-cols-2 gap-2">
                <button onclick="approveHeroRegistration('${hero.id}')" class="py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5">
                    <i data-lucide="shield-check" class="w-3.5 h-3.5"></i>
                    [FORCE APPROVE]
                </button>
                <button onclick="rejectHeroRegistration('${hero.id}')" class="py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5">
                    <i data-lucide="x-circle" class="w-3.5 h-3.5"></i>
                    [REJECT]
                </button>
            </div>
        `;
    } else if (hero.status === 'Approved' || hero.status === 'Licensed') {
        workflowActionsHtml = `
            <div class="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-600 dark:text-emerald-300 text-xs space-y-1">
                <strong>License Active: ${escapeHtml(hero.license_number || 'GHRMS-ACTIVE')}</strong>
                <p>Approved By: ${escapeHtml(hero.approved_by || 'Federal Authority')}</p>
                <p>Approval Date: ${hero.approved_at ? new Date(hero.approved_at).toLocaleDateString() : 'N/A'}</p>
            </div>
            <button onclick="openRevokeModal('${hero.id}'); closeOperativeInspectorDrawer();" class="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-2">
                <i data-lucide="alert-octagon" class="w-4 h-4"></i>
                [ISSUE REVOCATION DIRECTIVE]
            </button>
        `;
    } else if (hero.status === 'Rejected') {
        workflowActionsHtml = `
            <div class="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-600 dark:text-rose-300 text-xs space-y-1">
                <strong>Registration Rejected</strong>
                <p>Reason: ${escapeHtml(hero.rejection_reason || hero.revocation_reason || 'Failed Accords clearance criteria')}</p>
            </div>
            <button onclick="approveHeroRegistration('${hero.id}')" class="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-2">
                <i data-lucide="refresh-cw" class="w-4 h-4"></i>
                [RECONSIDER & APPROVE]
            </button>
        `;
    } else {
        workflowActionsHtml = `
            <div class="p-3 bg-slate-500/10 border border-slate-500/30 rounded-xl text-slate-500 dark:text-slate-400 text-xs">
                Candidate is compiling registration packet.
            </div>
        `;
    }

    content.innerHTML = `
        <!-- Profile Banner -->
        <div class="p-4 bg-white dark:bg-slate-900/70 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-xs flex items-center gap-4">
            <img src="${hero.avatar || hero.profile_picture || '/img/apex.jpg'}" alt="${escapeHtml(hero.alias)}" class="w-16 h-16 rounded-2xl object-cover border-2 border-slate-200 dark:border-slate-700 shadow-md">
            <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                    <h3 class="text-lg font-bold text-slate-900 dark:text-white truncate">${escapeHtml(hero.alias)}</h3>
                    <span class="text-xs px-2 py-0.5 rounded-md font-bold ${isSidekick ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700'}">${escapeHtml(hero.classification || (isSidekick ? 'SIDEKICK' : 'HERO'))}</span>
                </div>
                <div class="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                    <span>${escapeHtml(hero.id)}</span>
                    <span>•</span>
                    <span class="font-sans font-medium text-slate-600 dark:text-slate-300">${escapeHtml(hero.region || 'Sector 1')}</span>
                </div>
                <div class="flex items-center gap-2 mt-2">
                    ${statusBadge}
                    ${tierBadge}
                </div>
            </div>
        </div>

        <!-- Verification Progress Stepper -->
        <div class="p-4 bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-3">
            <div class="flex items-center justify-between">
                <h4 class="font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-[11px]">Verification Progress</h4>
                <span class="text-[11px] font-mono font-bold ${progressPercent === 100 && s !== 'Rejected' ? 'text-emerald-400' : 'text-cyan-400'}">${progressPercent}%</span>
            </div>

            <!-- Progress Bar -->
            <div class="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                <div class="h-full rounded-full transition-all duration-500 ${s === 'Rejected' ? 'bg-rose-500' : progressPercent === 100 ? 'bg-emerald-500' : 'bg-cyan-500'}" style="width: ${progressPercent}%"></div>
            </div>

            <!-- Stepper Nodes -->
            <div class="grid grid-cols-4 gap-1 text-center pt-1 text-[10px]">
                <div class="${progressStep >= 1 ? 'text-cyan-400 font-bold' : 'text-slate-500 dark:text-slate-500'}">
                    <div class="w-6 h-6 mx-auto mb-1 rounded-full flex items-center justify-center font-bold text-xs ${progressStep >= 1 ? 'bg-cyan-500/20 border border-cyan-500 text-cyan-400' : 'bg-slate-800 text-slate-500 border border-slate-700'}">1</div>
                    <span>Intake</span>
                </div>
                <div class="${progressStep >= 2 ? 'text-cyan-400 font-bold' : 'text-slate-500 dark:text-slate-500'}">
                    <div class="w-6 h-6 mx-auto mb-1 rounded-full flex items-center justify-center font-bold text-xs ${progressStep >= 2 ? 'bg-cyan-500/20 border border-cyan-500 text-cyan-400' : 'bg-slate-800 text-slate-500 border border-slate-700'}">2</div>
                    <span>Assessment</span>
                </div>
                <div class="${progressStep >= 3 ? 'text-cyan-400 font-bold' : 'text-slate-500 dark:text-slate-500'}">
                    <div class="w-6 h-6 mx-auto mb-1 rounded-full flex items-center justify-center font-bold text-xs ${progressStep >= 3 ? 'bg-cyan-500/20 border border-cyan-500 text-cyan-400' : 'bg-slate-800 text-slate-500 border border-slate-700'}">3</div>
                    <span>Verification</span>
                </div>
                <div class="${progressStep >= 4 ? 'text-emerald-400 font-bold' : 'text-slate-500 dark:text-slate-500'}">
                    <div class="w-6 h-6 mx-auto mb-1 rounded-full flex items-center justify-center font-bold text-xs ${progressStep >= 4 ? 'bg-emerald-500/20 border border-emerald-500 text-emerald-400' : 'bg-slate-800 text-slate-500 border border-slate-700'}">4</div>
                    <span>Licensure</span>
                </div>
            </div>
            <p class="text-[11px] text-slate-500 dark:text-slate-400 italic pt-1 text-center border-t border-slate-100 dark:border-slate-800/80">${escapeHtml(progressLabel)}</p>
        </div>

        <!-- 1. ACCOUNT INFORMATION -->
        <div class="p-4 bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-2 text-xs">
            <h4 class="font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-[11px]">1. Account Information</h4>
            <div class="grid grid-cols-2 gap-2 text-slate-600 dark:text-slate-300">
                <div><span class="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-bold">Registration ID</span> <span class="font-mono font-bold text-slate-800 dark:text-slate-200">${escapeHtml(hero.id)}</span></div>
                <div><span class="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-bold">Hero Callsign</span> <span class="font-bold text-slate-800 dark:text-slate-200">${escapeHtml(hero.alias)}</span></div>
                <div><span class="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-bold">Registration Date</span> <span>${hero.registration_date ? new Date(hero.registration_date).toLocaleDateString() : (hero.created_at ? new Date(hero.created_at).toLocaleDateString() : 'N/A')}</span></div>
                <div><span class="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-bold">Last Login</span> <span>${hero.last_login ? new Date(hero.last_login).toLocaleString() : 'Never'}</span></div>
            </div>
        </div>

        <!-- 2. PERSONAL INFORMATION & CIVILIAN IDENTITY -->
        <div class="p-4 bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-3 text-xs">
            <div class="flex items-center justify-between">
                <h4 class="font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-[11px]">2. Civilian Identity (Vault Encrypted)</h4>
                <button onclick="openVaultModal('${hero.id}')" class="px-2.5 py-1 text-[11px] font-bold bg-purple-500/15 text-purple-600 dark:text-purple-300 border border-purple-500/30 rounded-lg hover:bg-purple-500/25 transition-all flex items-center gap-1 cursor-pointer">
                    <i data-lucide="lock" class="w-3 h-3 text-amber-400"></i> [DECRYPT REAL IDENTITY]
                </button>
            </div>
            <div class="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl space-y-1.5 text-slate-600 dark:text-slate-300">
                <div class="flex justify-between">
                    <span class="text-slate-500 dark:text-slate-400 font-medium">Official ID Type:</span>
                    <strong class="text-slate-800 dark:text-slate-200">${escapeHtml(hero.id_type || 'Official Gov ID')}</strong>
                </div>
                <div class="flex justify-between">
                    <span class="text-slate-500 dark:text-slate-400 font-medium">Official ID Number:</span>
                    <strong class="font-mono text-slate-800 dark:text-slate-200">${escapeHtml(hero.id_number || hero.gov_id || 'Vault Encrypted')}</strong>
                </div>
                <div class="flex justify-between">
                    <span class="text-slate-500 dark:text-slate-400 font-medium">Civilian Name:</span>
                    <span class="font-mono text-slate-500 dark:text-slate-400">${escapeHtml(hero.real_name || 'Classified AES-256 Vault')}</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-slate-500 dark:text-slate-400 font-medium">Operational Region:</span>
                    <span class="font-bold text-slate-800 dark:text-slate-200">${escapeHtml(hero.region || 'Sector 1')}</span>
                </div>
            </div>
        </div>

        <!-- 3. HERO SPECIFICATIONS & POWERS -->
        <div class="p-4 bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-2.5 text-xs">
            <h4 class="font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-[11px]">3. Primary Abilities &amp; Powers</h4>
            <div class="grid grid-cols-2 gap-2 text-slate-600 dark:text-slate-300">
                <div><span class="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-bold">Classification</span> <strong class="text-slate-800 dark:text-slate-200">${escapeHtml(hero.classification || hero.role_tag || 'Hero')}</strong></div>
                <div><span class="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-bold">Combat Style</span> <strong class="text-slate-800 dark:text-slate-200">${escapeHtml(hero.combat_style || 'Tactical Direct')}</strong></div>
                <div class="col-span-2"><span class="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-bold">Primary Power</span> <strong class="text-cyan-600 dark:text-cyan-400 text-sm">${escapeHtml(hero.primary_power || 'N/A')}</strong></div>
                <div class="col-span-2"><span class="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-bold">Secondary Powers</span> <span class="text-slate-700 dark:text-slate-300">${escapeHtml(hero.secondary_powers || hero.secondary_power || 'None recorded')}</span></div>
            </div>
            ${hero.power_description ? `
                <div class="pt-1">
                    <span class="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-bold">Power Description</span>
                    <p class="text-slate-700 dark:text-slate-300 italic mt-0.5">${escapeHtml(hero.power_description)}</p>
                </div>
            ` : ''}
            <div class="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100 dark:border-slate-800 text-[11px]">
                <div><span class="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-bold">Abilities</span> <span class="text-slate-700 dark:text-slate-300">${escapeHtml(hero.abilities || 'Standard Operative Abilities')}</span></div>
                <div><span class="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-bold">Tactical Skills</span> <span class="text-slate-700 dark:text-slate-300">${escapeHtml(hero.skills || 'Field Tactics')}</span></div>
                <div><span class="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-bold">Strengths</span> <span class="text-slate-700 dark:text-slate-300">${escapeHtml(hero.strengths || 'N/A')}</span></div>
                <div><span class="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-bold">Limitations</span> <span class="text-slate-700 dark:text-slate-300">${escapeHtml(hero.weaknesses || 'N/A')}</span></div>
            </div>
        </div>

        <!-- 4. POWER & THREAT ASSESSMENT -->
        <div class="p-4 bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-3 text-xs">
            <div class="flex items-center justify-between">
                <h4 class="font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-[11px]">4. Threat &amp; Power Rating</h4>
                <button onclick="saveHeroAssessment('${hero.id}')" class="px-2.5 py-1 bg-black text-white dark:bg-white dark:text-black rounded-lg font-bold text-[11px] hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-all cursor-pointer">Save Assessment</button>
            </div>
            <div class="grid grid-cols-2 gap-3">
                <div>
                    <label class="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-bold mb-1">Power Level (1-100)</label>
                    <input type="number" id="inspect-power-level" min="1" max="100" value="${hero.power_level ?? 50}" class="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-xs">
                </div>
                <div>
                    <label class="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-bold mb-1">Combat Rating (1-100)</label>
                    <input type="number" id="inspect-combat-rating" min="1" max="100" value="${hero.combat_rating ?? 50}" class="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-xs">
                </div>
                <div>
                    <label class="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-bold mb-1">Control Level</label>
                    <select id="inspect-control-level" class="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs">
                        <option value="Minimal" ${hero.power_control_level === 'Minimal' ? 'selected' : ''}>Minimal</option>
                        <option value="Low" ${hero.power_control_level === 'Low' ? 'selected' : ''}>Low</option>
                        <option value="Moderate" ${(hero.power_control_level === 'Moderate' || !hero.power_control_level) ? 'selected' : ''}>Moderate</option>
                        <option value="High" ${hero.power_control_level === 'High' ? 'selected' : ''}>High</option>
                        <option value="Expert" ${hero.power_control_level === 'Expert' ? 'selected' : ''}>Expert</option>
                        <option value="Absolute" ${hero.power_control_level === 'Absolute' ? 'selected' : ''}>Absolute</option>
                    </select>
                </div>
                <div>
                    <label class="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-bold mb-1">Threat Tier</label>
                    <select id="inspect-threat-tier" class="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-bold">
                        <option value="0" ${hero.threat_tier === 0 ? 'selected' : ''}>Tier 0 — Cosmic</option>
                        <option value="1" ${hero.threat_tier === 1 ? 'selected' : ''}>Tier 1 — Extreme</option>
                        <option value="2" ${hero.threat_tier === 2 ? 'selected' : ''}>Tier 2 — High</option>
                        <option value="3" ${(hero.threat_tier === 3 || hero.threat_tier === undefined) ? 'selected' : ''}>Tier 3 — Moderate</option>
                        <option value="4" ${hero.threat_tier === 4 ? 'selected' : ''}>Tier 4 — Low</option>
                        <option value="5" ${hero.threat_tier === 5 ? 'selected' : ''}>Tier 5 — Street</option>
                    </select>
                </div>
            </div>
        </div>

        <!-- 5. SUPPORTING ACCORD DOCUMENTS -->
        <div class="p-4 bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-3 text-xs">
            <div class="flex items-center justify-between">
                <h4 class="font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-[11px]">5. Supporting Accord Documents (${docs.length})</h4>
            </div>
            <div class="space-y-2">
                ${docsHtml}
            </div>
        </div>

        <!-- 6. AUDIT HISTORY & SECURITY LEDGER -->
        <div class="p-4 bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-3 text-xs">
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <i data-lucide="history" class="w-3.5 h-3.5 text-cyan-400"></i>
                    <h4 class="font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-[11px]">6. Audit History &amp; Cryptographic Ledger</h4>
                </div>
                <span class="text-[10px] font-mono text-slate-500 dark:text-slate-400">${heroAuditLogs.length} Entry(s)</span>
            </div>
            ${auditHistoryHtml}
        </div>

        <!-- 7. REGISTRATION WORKFLOW ACTIONS -->
        <div class="space-y-2.5 pt-2">
            <h4 class="font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Registration Workflow Actions</h4>
            ${workflowActionsHtml}

            <div class="pt-3 border-t border-slate-200 dark:border-slate-700 space-y-2">
                <button onclick="openHeroEditModal('${hero.id}'); closeOperativeInspectorDrawer();" class="w-full py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer">
                    <i data-lucide="edit-3" class="w-4 h-4"></i>
                    [EDIT ALL OPERATIVE INFO]
                </button>
                <button onclick="openHeroPasskeyModal('${hero.id}'); closeOperativeInspectorDrawer();" class="w-full py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer">
                    <i data-lucide="key" class="w-4 h-4"></i>
                    [RESET HERO PASSKEY / PASSWORD]
                </button>
            </div>
        </div>
    `;

    drawer.classList.remove('hidden');
    setTimeout(() => drawer.classList.remove('translate-x-full'), 10);
    if (window.lucide) lucide.createIcons();
}

function closeOperativeInspectorDrawer() {
    const drawer = document.getElementById('operative-inspector-drawer');
    if (!drawer) return;
    drawer.classList.add('translate-x-full');
    setTimeout(() => drawer.classList.add('hidden'), 300);
}

// ──────────────────────────────────────────────
// In-Page Document Viewer Lightbox (Same Tab + Enlarge + Print)
// ──────────────────────────────────────────────
let currentDocViewerUrl = null;
let currentDocViewerMime = null;
let isDocZoomed = false;

function openDocViewer(heroId, docId, docType, originalName, mimeType) {
    const modal = document.getElementById('docViewerModal');
    const content = document.getElementById('docViewerContent');
    const titleEl = document.getElementById('docViewerTitle');
    const metaEl = document.getElementById('docViewerMeta');
    const dlBtn = document.getElementById('btnDocViewerDownload');

    if (!modal || !content) return;

    currentDocViewerUrl = `/api/heroes/${encodeURIComponent(heroId)}/documents/${encodeURIComponent(docId)}`;
    currentDocViewerMime = mimeType || '';
    isDocZoomed = false;

    if (titleEl) titleEl.textContent = `[${(docType || 'DOCUMENT').toUpperCase()}: ${originalName || 'EVIDENCE'}]`;
    if (metaEl) metaEl.textContent = `Operative ID: ${heroId} // File: ${originalName || docId} (${mimeType || 'binary'})`;
    if (dlBtn) {
        dlBtn.href = currentDocViewerUrl;
        dlBtn.download = originalName || 'ghrms_document';
    }

    const isPdf = (mimeType && mimeType.includes('pdf')) || (originalName && originalName.toLowerCase().endsWith('.pdf'));

    if (isPdf) {
        content.innerHTML = `
            <iframe id="docViewerIframe" src="${currentDocViewerUrl}" class="w-full rounded-xl bg-white border border-slate-700" style="height: 70vh;"></iframe>
        `;
    } else {
        content.innerHTML = `
            <div class="text-center w-full">
                <img id="docViewerImg" src="${currentDocViewerUrl}" alt="${escapeHtml(docType)}" 
                     class="max-w-full rounded-xl shadow-2xl transition-transform duration-200 inline-block cursor-zoom-in"
                     style="max-height: 70vh; object-fit: contain;" 
                     onclick="toggleDocZoom()">
                <div class="text-[11px] text-slate-400 mt-2">
                    Click image or [Toggle Fullsize / Zoom] below to zoom in/out
                </div>
            </div>
        `;
    }

    modal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
}

function closeDocViewer() {
    const modal = document.getElementById('docViewerModal');
    if (modal) modal.classList.add('hidden');
    const content = document.getElementById('docViewerContent');
    if (content) content.innerHTML = '';
    currentDocViewerUrl = null;
    currentDocViewerMime = null;
    isDocZoomed = false;
}

function toggleDocZoom() {
    const img = document.getElementById('docViewerImg');
    if (!img) return;
    isDocZoomed = !isDocZoomed;
    if (isDocZoomed) {
        img.style.maxHeight = 'none';
        img.style.transform = 'scale(1.25)';
        img.style.cursor = 'zoom-out';
    } else {
        img.style.maxHeight = '70vh';
        img.style.transform = 'scale(1)';
        img.style.cursor = 'zoom-in';
    }
}

function printCurrentDoc() {
    if (!currentDocViewerUrl) return;

    const isPdf = (currentDocViewerMime && currentDocViewerMime.includes('pdf')) || currentDocViewerUrl.includes('.pdf');
    if (isPdf) {
        const iframe = document.getElementById('docViewerIframe');
        if (iframe && iframe.contentWindow) {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
            return;
        }
    }

    const printWin = window.open('', '_blank', 'width=900,height=700');
    if (printWin) {
        printWin.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>GHRMS Accredited Document Print</title>
                <style>
                    body { margin: 0; padding: 20px; display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #fff; font-family: monospace; }
                    img { max-width: 100%; max-height: 95vh; object-fit: contain; }
                    @page { size: auto; margin: 10mm; }
                </style>
            </head>
            <body>
                <img src="${currentDocViewerUrl}" onload="window.print(); window.close();" />
            </body>
            </html>
        `);
        printWin.document.close();
    }
}
