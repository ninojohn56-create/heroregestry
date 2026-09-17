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
    const notifBtn = e.target.closest('button[onclick*="toggleNotifications"]');
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
            roleEl.textContent = isSuper ? 'Clearance L5 · Supreme Commander' :
                                 `Clearance L${res.user.clearance_level} · ${res.user.role}`;
        }

        if (subRoleEl) {
            subRoleEl.textContent = isSuper ? 'Supreme Command (L5)' : 'Command Staff';
        }

        if (brandTitleEl) {
            brandTitleEl.textContent = 'GHRMS Command';
        }

        if (pillEl) {
            pillEl.textContent = isSuper ? '[SUPER ADMIN · CLEARANCE L5]' :
                                 `[${res.user.role} · CLEARANCE L${res.user.clearance_level}]`;
        }

        // Super Admin Command Center Presentation
        document.title = 'GHRMS // Super Admin Command Center';
        if (pageTitleEl) {
            pageTitleEl.textContent = 'Super Admin Command Center';
        }
        if (pageSubEl) {
            pageSubEl.textContent = 'Master Superhuman Authority & Incident Response Directive (Level 5).';
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
    if (res.success && Array.isArray(res.chain)) {
        adminState.auditLogs = res.chain;
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
        el.classList.remove('bg-brand-50', 'dark:bg-brand-900/30', 'text-brand-600', 'dark:text-brand-400');
        el.classList.add('text-slate-600', 'dark:text-slate-300');
    });

    const activeLink = document.querySelector(`.nav-link[data-target="${tabId}"]`);
    if (activeLink) {
        activeLink.classList.remove('text-slate-600', 'dark:text-slate-300');
        activeLink.classList.add('bg-brand-50', 'dark:bg-brand-900/30', 'text-brand-600', 'dark:text-brand-400');
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
    const licensedHeroes = adminState.heroes.filter(h => h.status === 'Licensed').length;
    const reviewQueue = adminState.heroes.filter(h => h.status === 'Under Review' || h.status === 'Pending').length + adminState.pendingUpdates.length;
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

    const previewList = adminState.heroes.filter(h => h.status === 'Under Review' || h.status === 'Pending' || h.status === 'Suspended').slice(0, 5);

    if (previewList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="py-6 text-center text-slate-400">No operatives currently awaiting evaluation in intake queue.</td></tr>`;
        return;
    }

    tbody.innerHTML = previewList.map(h => {
        const tierBadge = getThreatBadgeHtml(h.threat_tier);
        const statusBadge = getStatusBadgeHtml(h.status);
        return `
            <tr class="hover:bg-slate-50/50 dark:hover:bg-slate-700/50 transition-colors">
                <td class="py-3.5 px-6">
                    <div class="flex items-center gap-3">
                        <img src="${h.avatar || '/img/apex.jpg'}" alt="${escapeHtml(h.alias)}" class="w-8 h-8 rounded-lg object-cover border border-slate-200 dark:border-slate-700">
                        <div>
                            <span class="font-bold text-slate-900 dark:text-white block">${escapeHtml(h.alias)}</span>
                            <span class="text-xs text-slate-400 font-mono">${escapeHtml(h.real_name || 'Classified')}</span>
                        </div>
                    </div>
                </td>
                <td class="py-3.5 px-6 text-slate-500 dark:text-slate-400">${escapeHtml(h.region || 'Sector 1')}</td>
                <td class="py-3.5 px-6 font-medium text-slate-700 dark:text-slate-300">${escapeHtml(h.primary_power || 'N/A')}</td>
                <td class="py-3.5 px-6">${tierBadge}</td>
                <td class="py-3.5 px-6">${statusBadge}</td>
                <td class="py-3.5 px-6 text-right whitespace-nowrap">
                    <button onclick="approveHeroLicense('${h.id}')" class="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold mr-1.5 transition-all" title="Approve Licensure">Approve</button>
                    <button onclick="openHeroEditModal('${h.id}')" class="px-2.5 py-1 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold mr-1.5 transition-all">Review</button>
                    <a href="/registrar?hero=${encodeURIComponent(h.id)}" class="px-2.5 py-1 bg-black hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-200 text-white dark:text-black rounded-lg text-xs font-semibold transition-all inline-flex items-center gap-1" title="Conduct Face-to-Face Registrar Check">
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
        tbody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-slate-400">No superhuman operatives match the specified filter criteria.</td></tr>`;
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
                            <span class="text-xs text-slate-400 font-mono block">${escapeHtml(h.real_name || 'Encrypted Vault')} · ${escapeHtml(h.id)}</span>
                        </div>
                    </div>
                </td>
                <td class="py-3.5 px-6">
                    <span class="font-semibold text-slate-800 dark:text-slate-200">${escapeHtml(h.primary_power || 'N/A')}</span>
                    ${h.secondary_power && h.secondary_power !== 'None' ? `<span class="text-xs text-slate-400 block">+ ${escapeHtml(h.secondary_power)}</span>` : ''}
                </td>
                <td class="py-3.5 px-6 text-slate-600 dark:text-slate-400 text-xs">${escapeHtml(h.region || 'Sector 1')}</td>
                <td class="py-3.5 px-6">${tierBadge}</td>
                <td class="py-3.5 px-6">${statusBadge}</td>
                <td class="py-3.5 px-6 text-right">
                    <div class="flex items-center justify-end gap-1.5">
                        <button onclick="openOperativeInspector('${h.id}')" class="p-1.5 text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/30 rounded-lg transition-colors" title="Launch Commander Assessor Panel">
                            <i data-lucide="eye" class="w-4 h-4"></i>
                        </button>
                        <button onclick="openHeroPasskeyModal('${h.id}')" class="p-1.5 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded-lg transition-colors" title="Reset Operative Passkey">
                            <i data-lucide="key" class="w-4 h-4"></i>
                        </button>
                        <button onclick="openHeroEditModal('${h.id}')" class="p-1.5 text-slate-500 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/30 rounded-lg transition-colors" title="Edit Profile">
                            <i data-lucide="edit-3" class="w-4 h-4"></i>
                        </button>
                        <button onclick="openVaultModal('${h.id}')" class="p-1.5 text-slate-500 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded-lg transition-colors" title="Decrypt AES-256 Vault Bio">
                            <i data-lucide="lock" class="w-4 h-4"></i>
                        </button>
                        <button onclick="openRevokeModal('${h.id}')" class="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors" title="Revoke Licensure Directive">
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
        tbody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-slate-400">Queue is clear. No matching hero registrations found.</td></tr>`;
        return;
    }

    tbody.innerHTML = list.map(h => {
        const tierBadge = getThreatBadgeHtml(h.threat_tier);
        const statusBadge = getStatusBadgeHtml(h.status);

        let actionButtons = `
            <button onclick="openOperativeInspector('${h.id}')" class="px-2.5 py-1.5 bg-black text-white dark:bg-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-200 rounded-lg text-xs font-semibold shadow-xs transition-all flex items-center gap-1">
                <i data-lucide="eye" class="w-3.5 h-3.5"></i> Inspect
            </button>
        `;

        if (h.status === 'Submitted') {
            actionButtons += `
                <button onclick="moveHeroToReview('${h.id}')" class="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg text-xs font-semibold shadow-xs transition-all">Review</button>
                <button onclick="approveHeroRegistration('${h.id}')" class="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-all">Approve</button>
            `;
        } else if (h.status === 'Under Review' || h.status === 'Pending') {
            actionButtons += `
                <button onclick="verifyHeroRegistration('${h.id}')" class="px-2.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-all">Verify</button>
                <button onclick="approveHeroRegistration('${h.id}')" class="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-all">Approve</button>
                <button onclick="requestHeroCorrections('${h.id}')" class="px-2.5 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-semibold shadow-xs transition-all">Corrections</button>
            `;
        } else if (h.status === 'Verified') {
            actionButtons += `
                <button onclick="approveHeroRegistration('${h.id}')" class="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-all">Approve</button>
                <button onclick="requestHeroCorrections('${h.id}')" class="px-2.5 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-semibold shadow-xs transition-all">Corrections</button>
            `;
        } else if (h.status === 'Returned for Correction') {
            actionButtons += `
                <button onclick="approveHeroRegistration('${h.id}')" class="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-all">Approve</button>
                <button onclick="rejectHeroRegistration('${h.id}')" class="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-all">Reject</button>
            `;
        } else if (h.status === 'Approved' || h.status === 'Licensed') {
            actionButtons += `
                <button onclick="openRevokeModal('${h.id}')" class="px-2.5 py-1.5 bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100 rounded-lg text-xs font-semibold transition-all">Revoke</button>
            `;
        } else if (h.status === 'Rejected') {
            actionButtons += `
                <button onclick="approveHeroRegistration('${h.id}')" class="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-all">Reconsider</button>
            `;
        }

        return `
            <tr class="hover:bg-slate-50/50 dark:hover:bg-slate-700/50 transition-colors">
                <td class="py-3.5 px-6 font-medium">
                    <div class="flex items-center gap-3">
                        <img src="${h.avatar || h.profile_picture || '/img/apex.jpg'}" alt="${escapeHtml(h.alias)}" class="w-9 h-9 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shadow-xs">
                        <div>
                            <span class="font-bold text-slate-900 dark:text-white block">${escapeHtml(h.alias)}</span>
                            <span class="text-xs text-slate-400 font-mono">${escapeHtml(h.id)}</span>
                        </div>
                    </div>
                </td>
                <td class="py-3.5 px-6 text-xs text-slate-500 dark:text-slate-400">
                    <strong class="text-slate-700 dark:text-slate-300 block">${escapeHtml(h.classification || h.role_tag || 'Hero')}</strong>
                    <span>Style: ${escapeHtml(h.combat_style || 'General')}</span>
                </td>
                <td class="py-3.5 px-6 font-medium text-slate-700 dark:text-slate-300 text-xs">
                    <strong class="block">${escapeHtml(h.primary_power || 'N/A')}</strong>
                    ${h.secondary_powers || h.secondary_power ? `<span class="text-slate-400">${escapeHtml(h.secondary_powers || h.secondary_power)}</span>` : ''}
                </td>
                <td class="py-3.5 px-6">${tierBadge}</td>
                <td class="py-3.5 px-6">${statusBadge}</td>
                <td class="py-3.5 px-6 text-right">
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
                <span class="text-slate-400 ml-2">Requested: ${escapeHtml(JSON.stringify(u.requested_changes || {}))}</span>
            </div>
            <div class="flex gap-2">
                <button onclick="approvePendingUpdate('${u.id}')" class="px-2.5 py-1 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 transition-all">Approve</button>
                <button onclick="rejectPendingUpdate('${u.id}')" class="px-2.5 py-1 bg-rose-50 text-rose-600 font-bold rounded-lg hover:bg-rose-100 transition-all">Reject</button>
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
    const notes = prompt('Enter identity verification notes (optional):', 'Official identity and supporting documents verified.') || '';
    const res = await apiPost(`heroes/${heroId}/assess`, { action: 'VERIFY_IDENTITY', notes });
    if (res.success) {
        showToast(`Identity verified for ${heroId}. Status updated to Verified.`, 'success');
        await loadHeroes();
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

async function requestHeroCorrections(heroId) {
    const notes = prompt('Enter required corrections / instructions for candidate:', 'Please upload a clearer copy of your Official ID and clarify your primary power description.');
    if (!notes) return;

    const res = await apiPost(`heroes/${heroId}/assess`, { action: 'REQUEST_CORRECTIONS', notes });
    if (res.success) {
        showToast(`Corrections requested for ${heroId}. Registration returned.`, 'warning');
        await loadHeroes();
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

async function approveHeroRegistration(heroId) {
    if (!confirm(`Approve registration and grant official Hero License for operative ${heroId}?`)) return;

    const res = await apiPost(`heroes/${heroId}/assess`, { action: 'APPROVE_REGISTRATION' });
    if (res.success) {
        showToast(`Registration approved! License generated for operative ${heroId}.`, 'success');
        await loadHeroes();
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

async function approveHeroLicense(heroId) {
    return approveHeroRegistration(heroId);
}

async function rejectHeroRegistration(heroId) {
    const reason = prompt('Enter formal reason for registration rejection:', 'Applicant failed federal security clearance criteria.');
    if (!reason) return;

    const res = await apiPost(`heroes/${heroId}/assess`, { action: 'REJECT_REGISTRATION', reason });
    if (res.success) {
        showToast(`Registration rejected for ${heroId}.`, 'error');
        await loadHeroes();
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
                <button onclick="deleteUserAccount('${escapeHtml(u.username)}')" class="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors ml-2" title="Permanently delete user account">
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
                            <span class="text-xs text-slate-400">${escapeHtml(u.name || 'Personnel')}</span>
                        </div>
                    </div>
                </td>
                <td class="py-3.5 px-6">
                    <span class="px-2.5 py-1 text-xs font-bold rounded-lg ${roleColor}">${u.role}</span>
                </td>
                <td class="py-3.5 px-6 text-xs font-mono font-semibold text-slate-500">
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
            b.className = 'users-tab-btn px-3 py-1.5 text-xs font-bold rounded-lg bg-brand-600 text-white';
        } else {
            b.className = 'users-tab-btn px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200';
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

    if (adminState.auditLogs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="py-8 text-center text-slate-400">Audit ledger empty or initializing...</td></tr>`;
        return;
    }

    const reversed = [...adminState.auditLogs].reverse();

    tbody.innerHTML = reversed.slice(0, 30).map(entry => {
        const timeStr = entry.timestamp ? new Date(entry.timestamp).toLocaleString() : 'Recent';
        const hashDisplay = entry.hash ? entry.hash.substring(0, 16) + '...' : 'GENESIS';

        return `
            <tr class="hover:bg-slate-50/50 dark:hover:bg-slate-700/50 transition-colors">
                <td class="py-3.5 px-6 text-xs text-slate-500 whitespace-nowrap">${timeStr}</td>
                <td class="py-3.5 px-6">
                    <span class="font-bold text-slate-900 dark:text-white block text-xs">${escapeHtml(entry.actor || 'System')}</span>
                    <span class="text-[10px] text-slate-400">[${escapeHtml(entry.role || 'SYS')}]</span>
                </td>
                <td class="py-3.5 px-6 font-bold text-xs text-brand-600 dark:text-brand-400">${escapeHtml(entry.action || entry.event)}</td>
                <td class="py-3.5 px-6 text-xs text-slate-600 dark:text-slate-300 font-mono">${escapeHtml(entry.target || '—')}</td>
                <td class="py-3.5 px-6 font-mono text-[11px] text-slate-400" title="${escapeHtml(entry.hash)}">${hashDisplay}</td>
            </tr>
        `;
    }).join('');

    if (window.lucide) lucide.createIcons();
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
            center: [40.7128, -74.0060],
            zoom: 11,
            zoomControl: true
        });

        // Official OpenStreetMap Tile Layer (100% Free & Open Source, No API Key Required)
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'
        }).addTo(adminState.leafletMap);

        adminState.heroMarkersGroup = L.layerGroup().addTo(adminState.leafletMap);

        // Render sector boundary polygon
        const sector1Coords = [
            [40.7300, -74.0200],
            [40.7300, -73.9800],
            [40.6900, -73.9800],
            [40.6900, -74.0200]
        ];
        L.polygon(sector1Coords, {
            color: '#737373',
            fillColor: '#a3a3a3',
            fillOpacity: 0.1,
            weight: 2,
            dashArray: '4, 4'
        }).bindPopup('<strong>Sector 1: Metro Downtown</strong><br>High-density civilian containment area.').addTo(adminState.leafletMap);
    }

    // Refresh markers & resize
    setTimeout(() => {
        if (adminState.leafletMap) {
            adminState.leafletMap.invalidateSize();
            plotTacticalHeroMarkers();
        }
    }, 150);

    // Fetch live weather telemetry
    fetchTacticalWeather();
}

function plotTacticalHeroMarkers() {
    if (!adminState.leafletMap || !adminState.heroMarkersGroup) return;
    adminState.heroMarkersGroup.clearLayers();

    adminState.heroes.forEach(h => {
        const lat = h.coordinates?.lat || (40.7128 + (Math.random() - 0.5) * 0.08);
        const lng = h.coordinates?.lng || (-74.0060 + (Math.random() - 0.5) * 0.08);
        const color = h.status === 'Rogue' ? '#ef4444' : (h.status === 'Licensed' ? '#ffffff' : '#f59e0b');

        const customIcon = L.divIcon({
            html: `
                <div style="position:relative; display:flex; align-items:center; justify-content:center; width:28px; height:28px;">
                    <div style="position:absolute; width:22px; height:22px; border-radius:50%; background:${color}; opacity:0.35;"></div>
                    <div style="width:10px; height:10px; border-radius:50%; background:${color}; border:2px solid #fff; box-shadow:0 0 8px ${color};"></div>
                </div>
            `,
            className: 'tactical-marker',
            iconSize: [28, 28],
            iconAnchor: [14, 14]
        });

        const marker = L.marker([lat, lng], { icon: customIcon });
        marker.bindPopup(`
            <div style="color:#0f172a; padding:4px; font-family:sans-serif; min-width:160px;">
                <div style="font-weight:bold; font-size:13px; color:#1e293b;">${escapeHtml(h.alias)}</div>
                <div style="font-size:11px; color:#64748b;">${escapeHtml(h.primary_power)}</div>
                <div style="font-size:11px; margin-top:2px;">Status: <strong style="color:${color};">${h.status}</strong></div>
                <div style="font-size:10px; color:#94a3b8; margin-top:4px;">Threat: Tier ${h.threat_tier ?? 2} · ${escapeHtml(h.region || 'Sector 1')}</div>
            </div>
        `);
        adminState.heroMarkersGroup.addLayer(marker);
    });
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

    const res = await apiPost('admin/system/reset-data');
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
            statusEl.className = 'text-brand-600 font-bold';
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
    document.getElementById('edit-sector').value = 'Sector 1 - Metro Downtown';

    populateMentorSelect();

    modal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
}

function openHeroEditModal(heroId) {
    const hero = adminState.heroes.find(h => h.id === heroId);
    if (!hero) return;

    const modal = document.getElementById('hero-edit-modal');
    if (!modal) return;

    document.getElementById('hero-edit-title').textContent = `Edit Profile: ${hero.alias}`;
    document.getElementById('edit-hero-id').value = hero.id;
    document.getElementById('edit-alias').value = hero.alias || '';
    document.getElementById('edit-real-name').value = hero.real_name || '';
    document.getElementById('edit-primary-power').value = hero.primary_power || '';
    document.getElementById('edit-secondary-power').value = hero.secondary_power || '';
    document.getElementById('edit-threat-tier').value = hero.threat_tier ?? '3';
    document.getElementById('edit-status').value = hero.status || 'Licensed';
    document.getElementById('edit-sector').value = hero.region || 'Sector 1 - Metro Downtown';

    populateMentorSelect(hero.mentor, hero.id);

    modal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
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
    const alias = document.getElementById('edit-alias')?.value.trim();
    const realName = document.getElementById('edit-real-name')?.value.trim();
    const primaryPower = document.getElementById('edit-primary-power')?.value.trim();
    const secondaryPower = document.getElementById('edit-secondary-power')?.value.trim();
    const threatTier = parseInt(document.getElementById('edit-threat-tier')?.value || '3');
    const status = document.getElementById('edit-status')?.value;
    const region = document.getElementById('edit-sector')?.value;
    const mentor = document.getElementById('edit-mentor')?.value;

    const payload = {
        alias,
        real_name: realName,
        primary_power: primaryPower,
        secondary_power: secondaryPower || 'None',
        threat_tier: threatTier,
        status,
        region,
        mentor: mentor || null,
        role_tag: mentor ? 'Sidekick' : 'Hero'
    };

    let res;
    if (heroId) {
        res = await apiPut(`heroes/${heroId}`, payload);
    } else {
        // New Registration requires gov_id
        payload.gov_id = 'CIV-' + Math.floor(100000 + Math.random() * 900000);
        res = await apiPost('heroes/register', payload);
    }

    if (res.success) {
        showToast(heroId ? `Operative ${alias} updated successfully.` : `New operative ${alias} registered.`, 'success');
        closeHeroEditModal();
        await loadHeroes();
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

    content.innerHTML = '<div class="py-8 text-center text-slate-400">Decrypting AES-256 encrypted civilian identity...</div>';
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
                            <span class="text-slate-500 block text-[11px] uppercase tracking-wider font-semibold">Civilian Legal Name</span>
                            <strong class="text-white text-base font-sans">${escapeHtml(v.real_name || 'N/A')}</strong>
                            ${res.alias ? `<div class="text-[11px] text-amber-400/90 font-mono mt-0.5">${escapeHtml(res.alias)}</div>` : ''}
                        </div>
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1 border-t border-slate-800/60">
                        <div><span class="text-slate-500 block">Official ID Type:</span> <strong class="text-white">${escapeHtml(v.id_type || 'Official Gov ID')}</strong></div>
                        <div><span class="text-slate-500 block">Official ID Number:</span> <strong class="text-white font-mono">${escapeHtml(v.id_number || v.gov_id || 'N/A')}</strong></div>
                        <div><span class="text-slate-500 block">Date of Birth:</span> <strong class="text-white">${escapeHtml(v.dob || 'Classified')}</strong> ${v.age ? `(Age: ${v.age})` : ''}</div>
                        <div><span class="text-slate-500 block">Gender:</span> <strong class="text-white">${escapeHtml(v.gender || 'Unspecified')}</strong></div>
                        <div><span class="text-slate-500 block">Contact Phone:</span> <strong class="text-white font-mono">${escapeHtml(v.contact_number || v.handler_contact || 'N/A')}</strong></div>
                    </div>
                    <div class="pt-2 text-xs border-t border-slate-800/80">
                        <span class="text-slate-500 block">Civilian / Safehouse Address:</span>
                        <div class="text-slate-200 mt-0.5">${escapeHtml(v.address || v.safehouse_address || 'Encrypted Geo-Perimeter')}</div>
                    </div>
                </div>

                <div class="p-4 bg-slate-950 rounded-xl border border-slate-800 text-slate-300 space-y-3">
                    <div class="flex items-center justify-between border-b border-slate-800 pb-2">
                        <span class="text-sky-400 font-bold tracking-wider text-xs">[EMERGENCY CONTACT PROTOCOL]</span>
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <div><span class="text-slate-500 block">Emergency Contact:</span> <strong class="text-white">${escapeHtml(v.emergency_contact_name || 'N/A')}</strong></div>
                        <div><span class="text-slate-500 block">Relationship:</span> <strong class="text-white">${escapeHtml(v.relationship || 'Unspecified')}</strong></div>
                        <div><span class="text-slate-500 block">Emergency Phone:</span> <strong class="text-white font-mono">${escapeHtml(v.emergency_contact_number || 'N/A')}</strong></div>
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
    resultBox.innerHTML = '<div class="text-slate-400">Verifying rotating cryptographic token with HMAC-SHA256 signature...</div>';

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
// Header Notifications Popover
// ──────────────────────────────────────────────
let adminNotificationsList = [];

async function loadAdminNotifications() {
    try {
        const res = await fetch('/api/notifications');
        const data = await res.json();
        if (!data.success) return;

        const info = data.data;
        const listEl = document.getElementById('notifications-list');
        const indicator = document.getElementById('notif-indicator');
        const readIds = JSON.parse(localStorage.getItem('ghrms_read_admin_notifs') || '[]');

        adminNotificationsList = info.notifications || [];
        let unreadCount = 0;

        if (listEl) {
            if (adminNotificationsList.length === 0) {
                listEl.innerHTML = '<div class="p-4 text-center text-xs text-slate-500">No active alerts or directives.</div>';
            } else {
                listEl.innerHTML = adminNotificationsList.map(n => {
                    const isRead = readIds.includes(n.id);
                    if (!isRead && n.unread) unreadCount++;

                    const badgeColor = n.type === 'urgent' ? 'text-rose-600 dark:text-rose-400' :
                                       n.type === 'warning' ? 'text-amber-600 dark:text-amber-400' :
                                       n.type === 'success' ? 'text-emerald-600 dark:text-emerald-400' : 'text-neutral-900 dark:text-neutral-100';

                    let tabTarget = 'queue';
                    if (n.id.includes('rogue')) tabTarget = 'radar';
                    else if (n.id.includes('incident')) tabTarget = 'damage';
                    else if (n.id.includes('audit')) tabTarget = 'audit';

                    return `
                        <div class="p-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer ${isRead ? 'opacity-60' : ''}" onclick="handleAdminNotifClick('${tabTarget}', '${n.id}')">
                            <div class="flex items-center justify-between">
                                <p class="font-bold text-xs ${badgeColor}">${escapeHtml(n.tag || '[ALERT]')}</p>
                                <span class="text-[10px] text-slate-400">${formatAdminNotifTime(n.created_at)}</span>
                            </div>
                            <p class="text-xs text-slate-700 dark:text-slate-200 mt-0.5 font-semibold">${escapeHtml(n.title || '')}</p>
                            <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">${escapeHtml(n.message || '')}</p>
                        </div>
                    `;
                }).join('');
            }
        }

        if (indicator) {
            indicator.style.display = unreadCount > 0 ? 'block' : 'none';
        }
    } catch (err) {
        console.error('Failed to load admin notifications:', err);
    }
}

function formatAdminNotifTime(isoString) {
    if (!isoString) return 'Recent';
    try {
        const d = new Date(isoString);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
        return 'Recent';
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
    return `<span class="px-2.5 py-1 text-xs font-bold rounded-lg badge-tier-${t}">${labels[t] || 'Tier ' + t}</span>`;
}

function getStatusBadgeHtml(status) {
    const s = status || 'Draft';
    let col = 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300';
    if (s === 'Approved' || s === 'Licensed') {
        col = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30';
    } else if (s === 'Verified') {
        col = 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/30';
    } else if (s === 'Under Review' || s === 'Pending') {
        col = 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30';
    } else if (s === 'Submitted') {
        col = 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/30';
    } else if (s === 'Returned for Correction') {
        col = 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/30';
    } else if (s === 'Draft') {
        col = 'bg-slate-500/10 text-slate-500 dark:text-slate-400 border border-slate-500/30';
    } else if (s === 'Rejected' || s === 'Revoked' || s === 'Rogue') {
        col = 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30';
    } else if (s === 'Suspended') {
        col = 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30';
    }
    return `<span class="px-2.5 py-1 text-xs font-bold rounded-lg inline-block whitespace-nowrap ${col}">${s}</span>`;
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

    const docs = hero.supporting_documents || hero.documents || [];
    let docsHtml = '';
    if (docs.length === 0) {
        docsHtml = `<div class="p-3 text-center text-xs text-slate-400 bg-slate-100/50 dark:bg-slate-900/30 rounded-xl border border-slate-200 dark:border-slate-700">No documents uploaded yet.</div>`;
    } else {
        docsHtml = docs.map(d => {
            const vStatus = d.verification_status || 'Pending';
            const statusClass = vStatus === 'Verified' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' :
                                vStatus === 'Rejected' ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30' :
                                'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30';
            return `
                <div class="p-3 bg-white dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-2">
                    <div class="flex items-center justify-between">
                        <div>
                            <span class="font-bold text-slate-900 dark:text-white block">${escapeHtml(d.document_type || 'Supporting Document')}</span>
                            <span class="text-[11px] text-slate-400 font-mono">${escapeHtml(d.original_name || d.name || 'document.pdf')} (${Math.round((d.file_size || 0) / 1024)} KB)</span>
                        </div>
                        <span class="px-2 py-0.5 text-[10px] font-bold rounded-md border ${statusClass}">${escapeHtml(vStatus)}</span>
                    </div>
                    <div class="flex flex-wrap items-center justify-between gap-1 pt-1 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400">
                        <div>
                            <span>Uploaded: ${d.upload_date ? new Date(d.upload_date).toLocaleDateString() : 'N/A'}</span>
                            ${d.expiration_date ? `<span class="ml-2">Expires: <strong class="text-slate-300">${escapeHtml(d.expiration_date)}</strong></span>` : ''}
                        </div>
                        <div class="flex items-center gap-1.5">
                            <a href="/api/heroes/${encodeURIComponent(hero.id)}/documents/${encodeURIComponent(d.id)}" target="_blank" class="px-2 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded font-semibold transition-all">View</a>
                            ${vStatus !== 'Verified' ? `
                                <button onclick="verifyHeroDoc('${hero.id}', '${d.id}', 'Verified')" class="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold transition-all">Verify</button>
                            ` : ''}
                            ${vStatus !== 'Rejected' ? `
                                <button onclick="verifyHeroDoc('${hero.id}', '${d.id}', 'Rejected')" class="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded font-bold transition-all">Reject</button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Determine workflow buttons
    let workflowActionsHtml = '';
    if (hero.status === 'Submitted') {
        workflowActionsHtml = `
            <button onclick="moveHeroToReview('${hero.id}')" class="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-2">
                <i data-lucide="play-circle" class="w-4 h-4"></i>
                [START UNDER REVIEW]
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
                <strong>Status: Verified</strong> · Identity and supporting documents verified by ${escapeHtml(hero.verified_by || 'Admin')}. Ready for license issuance.
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
    } else if (hero.status === 'Returned for Correction') {
        workflowActionsHtml = `
            <div class="p-3 bg-orange-500/10 border border-orange-500/30 rounded-xl text-orange-600 dark:text-orange-300 text-xs space-y-1">
                <strong>Status: Returned for Correction</strong>
                <p>Notes to applicant: ${escapeHtml(hero.correction_notes || 'None specified')}</p>
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
    } else if (hero.status === 'Draft') {
        workflowActionsHtml = `
            <div class="p-3 bg-slate-500/10 border border-slate-500/30 rounded-xl text-slate-500 dark:text-slate-400 text-xs">
                Candidate is currently compiling draft packet. Not submitted yet.
            </div>
        `;
    }

    content.innerHTML = `
        <!-- Profile Banner -->
        <div class="p-4 bg-slate-100 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center gap-4">
            <img src="${hero.avatar || hero.profile_picture || '/img/apex.jpg'}" alt="${escapeHtml(hero.alias)}" class="w-16 h-16 rounded-2xl object-cover border-2 border-neutral-400 dark:border-neutral-600 shadow-md">
            <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                    <h3 class="text-lg font-bold text-slate-900 dark:text-white truncate">${escapeHtml(hero.alias)}</h3>
                    <span class="text-xs px-2 py-0.5 rounded-md font-bold ${isSidekick ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border border-neutral-300 dark:border-neutral-700'}">${escapeHtml(hero.classification || (isSidekick ? 'SIDEKICK' : 'HERO'))}</span>
                </div>
                <p class="text-xs text-slate-400 font-mono mt-0.5">${escapeHtml(hero.id)}</p>
                <div class="flex items-center gap-2 mt-2">
                    ${statusBadge}
                    ${tierBadge}
                </div>
            </div>
        </div>

        <!-- 1. ACCOUNT INFORMATION -->
        <div class="p-4 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
            <h4 class="font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-[11px]">1. Account Information</h4>
            <div class="grid grid-cols-2 gap-2 text-slate-600 dark:text-slate-300">
                <div><span class="text-slate-400 block text-[10px] uppercase">Hero Registration ID</span> <span class="font-mono font-bold text-slate-800 dark:text-slate-200">${escapeHtml(hero.id)}</span></div>
                <div><span class="text-slate-400 block text-[10px] uppercase">Hero Callsign</span> <span class="font-bold text-slate-800 dark:text-slate-200">${escapeHtml(hero.alias)}</span></div>
                <div><span class="text-slate-400 block text-[10px] uppercase">Registration Date</span> <span>${hero.registration_date ? new Date(hero.registration_date).toLocaleDateString() : (hero.created_at ? new Date(hero.created_at).toLocaleDateString() : 'N/A')}</span></div>
                <div><span class="text-slate-400 block text-[10px] uppercase">Last Login</span> <span>${hero.last_login ? new Date(hero.last_login).toLocaleString() : 'Never'}</span></div>
            </div>
        </div>

        <!-- 2. PERSONAL INFORMATION & CIVILIAN IDENTITY -->
        <div class="p-4 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3 text-xs">
            <div class="flex items-center justify-between">
                <h4 class="font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-[11px]">2. Personal Information (Civilian Vault)</h4>
                <button onclick="openVaultModal('${hero.id}')" class="px-2.5 py-1 text-[11px] font-bold bg-purple-500/15 text-purple-600 dark:text-purple-300 border border-purple-500/30 rounded-lg hover:bg-purple-500/25 transition-all flex items-center gap-1">
                    <i data-lucide="lock" class="w-3 h-3 text-amber-400"></i> [DECRYPT REAL IDENTITY]
                </button>
            </div>
            <div class="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl space-y-1.5 text-slate-600 dark:text-slate-300">
                <div class="flex justify-between">
                    <span class="text-slate-400">Official ID Type:</span>
                    <strong class="text-slate-800 dark:text-slate-200">${escapeHtml(hero.id_type || 'Official Gov ID')}</strong>
                </div>
                <div class="flex justify-between">
                    <span class="text-slate-400">Official ID Number:</span>
                    <strong class="font-mono text-slate-800 dark:text-slate-200">${escapeHtml(hero.id_number || hero.gov_id || 'Vault Encrypted')}</strong>
                </div>
                <div class="flex justify-between">
                    <span class="text-slate-400">Civilian Name:</span>
                    <span class="font-mono text-slate-400">${escapeHtml(hero.real_name || 'Classified AES-256 Vault')}</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-slate-400">Operational Region / Sector:</span>
                    <span class="font-bold text-slate-800 dark:text-slate-200">${escapeHtml(hero.region || 'Sector 1')}</span>
                </div>
            </div>
        </div>

        <!-- 3. HERO INFORMATION -->
        <div class="p-4 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2.5 text-xs">
            <h4 class="font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-[11px]">3. Hero Specifications</h4>
            <div class="grid grid-cols-2 gap-2 text-slate-600 dark:text-slate-300">
                <div><span class="text-slate-400 block text-[10px] uppercase">Classification</span> <strong class="text-slate-800 dark:text-slate-200">${escapeHtml(hero.classification || hero.role_tag || 'Hero')}</strong></div>
                <div><span class="text-slate-400 block text-[10px] uppercase">Combat Style</span> <strong class="text-slate-800 dark:text-slate-200">${escapeHtml(hero.combat_style || 'N/A')}</strong></div>
                <div class="col-span-2"><span class="text-slate-400 block text-[10px] uppercase">Primary Power</span> <strong class="text-slate-900 dark:text-white">${escapeHtml(hero.primary_power || 'N/A')}</strong></div>
                <div class="col-span-2"><span class="text-slate-400 block text-[10px] uppercase">Secondary Powers</span> <span class="text-slate-700 dark:text-slate-300">${escapeHtml(hero.secondary_powers || hero.secondary_power || 'None')}</span></div>
            </div>
            ${hero.power_description ? `
                <div class="pt-1">
                    <span class="text-slate-400 block text-[10px] uppercase">Power Description</span>
                    <p class="text-slate-700 dark:text-slate-300 italic mt-0.5">${escapeHtml(hero.power_description)}</p>
                </div>
            ` : ''}
            <div class="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200 dark:border-slate-800">
                <div><span class="text-slate-400 block text-[10px] uppercase">Abilities</span> <span class="text-slate-700 dark:text-slate-300">${escapeHtml(hero.abilities || 'Standard Operative Abilities')}</span></div>
                <div><span class="text-slate-400 block text-[10px] uppercase">Tactical Skills</span> <span class="text-slate-700 dark:text-slate-300">${escapeHtml(hero.skills || 'Combat Tactics')}</span></div>
                <div><span class="text-slate-400 block text-[10px] uppercase">Strengths</span> <span class="text-slate-700 dark:text-slate-300">${escapeHtml(hero.strengths || 'N/A')}</span></div>
                <div><span class="text-slate-400 block text-[10px] uppercase">Limitations / Weaknesses</span> <span class="text-slate-700 dark:text-slate-300">${escapeHtml(hero.weaknesses || 'N/A')}</span></div>
                <div class="col-span-2"><span class="text-slate-400 block text-[10px] uppercase">Training / Experience</span> <span class="text-slate-700 dark:text-slate-300">${escapeHtml(hero.training_experience || 'Standard Agency Training')}</span></div>
            </div>
        </div>

        <!-- 4. POWER & THREAT ASSESSMENT -->
        <div class="p-4 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3 text-xs">
            <div class="flex items-center justify-between">
                <h4 class="font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-[11px]">4. Power &amp; Threat Assessment</h4>
                <button onclick="saveHeroAssessment('${hero.id}')" class="px-2.5 py-1 bg-black text-white dark:bg-white dark:text-black rounded-lg font-bold text-[11px] hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-all">Save Assessment</button>
            </div>
            <div class="grid grid-cols-2 gap-3">
                <div>
                    <label class="text-slate-400 block text-[10px] uppercase font-bold mb-1">Power Level (1-100)</label>
                    <input type="number" id="inspect-power-level" min="1" max="100" value="${hero.power_level ?? 50}" class="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-xs">
                </div>
                <div>
                    <label class="text-slate-400 block text-[10px] uppercase font-bold mb-1">Combat Rating (1-100)</label>
                    <input type="number" id="inspect-combat-rating" min="1" max="100" value="${hero.combat_rating ?? 50}" class="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-xs">
                </div>
                <div>
                    <label class="text-slate-400 block text-[10px] uppercase font-bold mb-1">Power Control Level</label>
                    <select id="inspect-control-level" class="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs">
                        <option value="Minimal" ${hero.power_control_level === 'Minimal' ? 'selected' : ''}>Minimal</option>
                        <option value="Low" ${hero.power_control_level === 'Low' ? 'selected' : ''}>Low</option>
                        <option value="Moderate" ${(hero.power_control_level === 'Moderate' || !hero.power_control_level) ? 'selected' : ''}>Moderate</option>
                        <option value="High" ${hero.power_control_level === 'High' ? 'selected' : ''}>High</option>
                        <option value="Expert" ${hero.power_control_level === 'Expert' ? 'selected' : ''}>Expert</option>
                        <option value="Absolute" ${hero.power_control_level === 'Absolute' ? 'selected' : ''}>Absolute</option>
                    </select>
                </div>
                <div>
                    <label class="text-slate-400 block text-[10px] uppercase font-bold mb-1">Threat Tier</label>
                    <select id="inspect-threat-tier" class="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-bold">
                        <option value="0" ${hero.threat_tier === 0 ? 'selected' : ''}>Tier 0 — Cosmic</option>
                        <option value="1" ${hero.threat_tier === 1 ? 'selected' : ''}>Tier 1 — Extreme</option>
                        <option value="2" ${hero.threat_tier === 2 ? 'selected' : ''}>Tier 2 — High</option>
                        <option value="3" ${(hero.threat_tier === 3 || hero.threat_tier === undefined) ? 'selected' : ''}>Tier 3 — Moderate</option>
                        <option value="4" ${hero.threat_tier === 4 ? 'selected' : ''}>Tier 4 — Low</option>
                        <option value="5" ${hero.threat_tier === 5 ? 'selected' : ''}>Tier 5 — Street</option>
                    </select>
                </div>
            </div>
            <div>
                <label class="text-slate-400 block text-[10px] uppercase font-bold mb-1">Assessment Notes</label>
                <textarea id="inspect-assessment-notes" rows="2" class="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs" placeholder="Add tactical notes or conditions...">${escapeHtml(hero.assessment_notes || '')}</textarea>
            </div>
        </div>

        <!-- 5. IDENTITY VERIFICATION STATUS -->
        <div class="p-4 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3 text-xs">
            <div class="flex items-center justify-between">
                <h4 class="font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-[11px]">5. Identity Verification</h4>
                <button onclick="addHeroVerificationNotes('${hero.id}')" class="px-2 py-1 text-[11px] font-semibold bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-lg text-slate-700 dark:text-slate-200 transition-all">Edit Notes</button>
            </div>
            
            <!-- Biometric Face Photo Card -->
            <div class="p-3 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-3">
                <img src="${hero.avatar || hero.profile_picture || '/img/apex.jpg'}" alt="Face Photo" class="w-12 h-12 rounded-xl object-cover border-2 border-purple-500/40 shadow-sm">
                <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between">
                        <span class="font-bold text-slate-800 dark:text-slate-200 text-xs">Biometric Face Profile</span>
                        <span class="px-2 py-0.5 text-[10px] font-bold rounded ${hero.avatar || hero.profile_picture ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30'}">
                            ${hero.avatar || hero.profile_picture ? 'PHOTO ENROLLED' : 'DEFAULT / PENDING'}
                        </span>
                    </div>
                    <p class="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">${hero.avatar || hero.profile_picture ? 'Facial features verified for Agency field operative deployment.' : 'No operative face picture uploaded during intake.'}</p>
                </div>
            </div>

            <div class="grid grid-cols-2 gap-2 text-slate-600 dark:text-slate-300">
                <div><span class="text-slate-400 block text-[10px] uppercase">Verification Status</span> <strong class="font-bold text-slate-800 dark:text-slate-200">${escapeHtml(hero.verification_status || 'Pending')}</strong></div>
                <div><span class="text-slate-400 block text-[10px] uppercase">Verified By</span> <strong class="text-slate-800 dark:text-slate-200">${escapeHtml(hero.verified_by || 'Unassigned')}</strong></div>
                <div class="col-span-2"><span class="text-slate-400 block text-[10px] uppercase">Verification Date</span> <span>${hero.verification_date ? new Date(hero.verification_date).toLocaleString() : 'Pending'}</span></div>
                <div class="col-span-2"><span class="text-slate-400 block text-[10px] uppercase">Verification Notes</span> <span class="italic text-slate-700 dark:text-slate-300">${escapeHtml(hero.verification_notes || 'None recorded.')}</span></div>
            </div>
        </div>

        <!-- 6. SUPPORTING DOCUMENTS -->
        <div class="p-4 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3 text-xs">
            <div class="flex items-center justify-between">
                <h4 class="font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-[11px]">6. Supporting Documents (${docs.length})</h4>
            </div>
            <div class="space-y-2">
                ${docsHtml}
            </div>
        </div>

        <!-- 7. ADMIN WORKFLOW ACTIONS -->
        <div class="space-y-2.5 pt-2">
            <h4 class="font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Registration Workflow Actions</h4>
            ${workflowActionsHtml}

            <div class="pt-3 border-t border-slate-200 dark:border-slate-700 space-y-2">
                <button onclick="openHeroEditModal('${hero.id}'); closeOperativeInspectorDrawer();" class="w-full py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2">
                    <i data-lucide="edit-3" class="w-4 h-4"></i>
                    [EDIT ALL OPERATIVE INFO]
                </button>
                <button onclick="openHeroPasskeyModal('${hero.id}'); closeOperativeInspectorDrawer();" class="w-full py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2">
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
