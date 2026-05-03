document.addEventListener('DOMContentLoaded', () => {
    function setAppReady(isReady) {
        document.body.setAttribute('data-app-ready', isReady ? 'true' : 'false');
    }

    // Keep UI hidden until role-based permissions are applied (prevents brief admin flash).
    setAppReady(false);
    const bootstrapVisibilityWatchdog = setTimeout(() => {
        if (document.body.getAttribute('data-app-ready') !== 'true') {
            console.warn('Dashboard bootstrap fallback triggered. Revealing UI shell.');
            setAppReady(true);
        }
    }, 12000);

    // Logo is always dark mode
    const sidebarLogo = document.querySelector('.sidebar-brand-img');
    if (sidebarLogo) sidebarLogo.src = 'public/logo.png';

    const ROLE_LABELS = {
        superuser: 'Super User',
        admin: 'Admin',
        cashier: 'Cashier',
        returnhandler: 'Return Handler',
        inventorymanager: 'Inventory Manager',
        deliveryops: 'Delivery Ops',
        customer: 'Customer'
    };

    const ROLE_ALLOWED_PAGES = {
        superuser: ['superuser', 'businesses', 'dashboard', 'orders', 'inventory', 'delivery', 'returns', 'reports', 'users', 'profile', 'notifications'],
        admin: ['dashboard', 'orders', 'inventory', 'delivery', 'returns', 'reports', 'users', 'profile', 'notifications'],
        cashier: ['cashier', 'dashboard', 'orders', 'reports', 'profile', 'notifications'],
        returnhandler: ['dashboard', 'returns', 'orders', 'reports', 'profile', 'notifications'],
        inventorymanager: ['dashboard', 'inventory', 'reports', 'profile', 'notifications'],
        deliveryops: ['dashboard', 'delivery', 'reports', 'profile', 'notifications'],
        customer: ['cashier', 'profile', 'reports', 'notifications']
    };

    const ROLE_ACTIONS = {
        superuser: { orders: true, inventory: true, users: true, returns: true, delivery: true, businesses: true },
        admin: { orders: true, inventory: true, users: true, returns: true, delivery: true, businesses: false },
        cashier: { orders: true, inventory: false, users: false, returns: false, delivery: false, businesses: false },
        returnhandler: { orders: false, inventory: false, users: false, returns: true, delivery: false, businesses: false },
        inventorymanager: { orders: false, inventory: true, users: false, returns: false, delivery: false, businesses: false },
        deliveryops: { orders: false, inventory: false, users: false, returns: false, delivery: true, businesses: false },
        customer: { orders: false, inventory: false, users: false, returns: false, delivery: false, businesses: false }
    };

    // Initialized early to avoid temporal-dead-zone crashes when notifications render before helper sections run.
    var DELIVERY_PARTNER_DIRECTORY = {};
    var SUPPLIER_DIRECTORY = {};

    let activeRoleKey = 'customer';

    function normalizeRole(role) {
        return String(role || '').toLowerCase().replace(/\s+/g, '');
    }

    function roleFromStorage(value) {
        const key = normalizeRole(value);
        if (key === 'super' || key === 'superuser') return 'superuser';
        if (key === 'admin') return 'admin';
        if (key === 'cashier') return 'cashier';
        if (key === 'returnhandler' || key === 'returns') return 'returnhandler';
        if (key === 'inventorymanager' || key === 'inventory') return 'inventorymanager';
        if (key === 'deliveryops' || key === 'deliverymanager' || key === 'delivery') return 'deliveryops';
        if (key === 'customer' || key === 'user') return 'customer';
        return '';
    }

    function clearSession() {
        localStorage.removeItem('userRole');
        localStorage.removeItem('userName');
        localStorage.removeItem('currentUser');
        localStorage.removeItem('activeBusinessId');
        localStorage.removeItem('activeBusinessName');
        sessionStorage.removeItem('bb_customer_session_id');
        sessionStorage.removeItem('bb_customer_session_notifications');
    }

    function goToLogin() {
        window.location.href = 'login.html';
    }

    function hasActionAccess(moduleKey) {
        const actions = ROLE_ACTIONS[activeRoleKey] || ROLE_ACTIONS.customer;
        return !!actions[moduleKey];
    }

    function hasOrderDeleteAccess() {
        return activeRoleKey === 'admin' || activeRoleKey === 'superuser';
    }

    function denyAction(actionLabel) {
        alert(`Access denied: ${actionLabel} is not allowed for your role.`);
    }

    function enforceActionPermissions() {
        const hide = (selector) => {
            document.querySelectorAll(selector).forEach(el => {
                el.style.display = 'none';
            });
        };

        if (!hasActionAccess('inventory')) {
            hide('#addProductBtn, #addProductBtnDyn');
            hide("button[onclick*='editProduct'], button[onclick*='deleteProduct']");
        }
        if (!hasActionAccess('orders')) {
            hide('#newOrderBtn, #newOrderBtnDyn');
            hide("button[onclick*='editOrder'], button[onclick*='deleteOrder']");
        } else if (!hasOrderDeleteAccess()) {
            hide("button[onclick*='deleteOrder']");
        }
        if (!hasActionAccess('users')) {
            hide('#addUserBtn, #addUserBtnDyn');
            hide("button[onclick*='editUser'], button[onclick*='deleteUser']");
        }
        if (!hasActionAccess('returns')) {
            hide('#raiseReturnBtnDyn');
            hide("button[data-action='returns']");
        }
        if (!hasActionAccess('delivery')) {
            hide("button[data-action='delivery']");
        }
        if (!hasActionAccess('businesses')) {
            hide("button[data-action='businesses']");
        }
    }

    // Apply Role-Based UI
    function applyRoleBasedUI() {
        const currentUser = loadObject('currentUser', {});
        const storedName = String(localStorage.getItem('userName') || currentUser.name || '').trim();
        const storedRole = String(localStorage.getItem('userRole') || currentUser.role || '').trim();

        if (!storedName || !storedRole) {
            clearSession();
            goToLogin();
            return;
        }

        // Normalize legacy sessions where one of these fields may be missing.
        if (!localStorage.getItem('userName')) localStorage.setItem('userName', storedName);
        if (!localStorage.getItem('userRole')) localStorage.setItem('userRole', storedRole);

        const roleKey = roleFromStorage(storedRole);
        if (!roleKey || !ROLE_ALLOWED_PAGES[roleKey]) {
            clearSession();
            goToLogin();
            return;
        }

        activeRoleKey = roleKey;
        document.body.setAttribute('data-role', roleKey);

        const uName = storedName;
        const uRole = ROLE_LABELS[roleKey] || storedRole;
        
        const nameEl = document.querySelector('.user-name');
        const roleEl = document.querySelector('.user-role');
        const avatarEl = document.querySelector('.user-avatar');
        
        if (nameEl) nameEl.textContent = uName;
        if (roleEl) roleEl.textContent = uRole;
        if (avatarEl) avatarEl.textContent = uName.charAt(0).toUpperCase();

        const currentPage = document.body.getAttribute('data-page') || 'dashboard';
        const allowedPages = ROLE_ALLOWED_PAGES[roleKey] || [];
        let activeBusinessName = localStorage.getItem('activeBusinessName') || '';

        // Cashier/customer sessions should run in the dedicated POS terminal page.
        if ((roleKey === 'cashier' || roleKey === 'customer') && currentPage !== 'cashier') {
            window.location.href = 'cashier.html';
            return;
        }

        const shouldHideSidebarLayout = roleKey === 'superuser' && ['superuser', 'profile', 'notifications'].includes(currentPage);
        document.body.classList.toggle('no-sidebar-layout', shouldHideSidebarLayout);

        if (roleKey === 'superuser' && currentPage === 'superuser') {
            localStorage.removeItem('activeBusinessId');
            localStorage.removeItem('activeBusinessName');
            activeBusinessName = '';
        }

        const bcAppEl = document.querySelector('.bc-app');
        if (bcAppEl) {
            bcAppEl.textContent = activeBusinessName ? `BillBhai / ${activeBusinessName}` : 'BillBhai';
        }

        function ensureBusinessesNavItem() {
            const nav = document.getElementById('sidebarNav');
            if (!nav || nav.querySelector('.nav-item[data-page="superuser"]')) return;

            const usersLink = nav.querySelector('.nav-item[data-page="users"]');
            const item = document.createElement('a');
            item.href = 'superuser.html';
            item.className = 'nav-item';
            item.setAttribute('data-page', 'superuser');
            item.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18"/><rect x="4" y="3" width="7" height="14" rx="1"/><rect x="13" y="7" width="7" height="10" rx="1"/><path d="M8 7h0M8 11h0M8 15h0M16 11h0M16 15h0"/></svg><span>Super User Portal</span>';

            if (usersLink && usersLink.parentElement === nav) {
                usersLink.insertAdjacentElement('afterend', item);
            } else {
                nav.appendChild(item);
            }

            item.addEventListener('click', () => {
                if (window.innerWidth <= 768) {
                    const sidebarEl = document.getElementById('sidebar');
                    if (sidebarEl) sidebarEl.classList.remove('mobile-open');
                }
            });
        }

        ensureBusinessesNavItem();

        // Route-level guard for direct URL access.
        if (!allowedPages.includes(currentPage)) {
            window.location.href = (allowedPages[0] || 'dashboard') + '.html';
            return;
        }

        // Hide all nav pages not allowed for this role.
        document.querySelectorAll('.nav-item[data-page]').forEach(item => {
            const page = item.getAttribute('data-page');
            const isAllowed = allowedPages.includes(page);
            item.hidden = !isAllowed;
            item.classList.toggle('active', isAllowed && page === currentPage);
        });

        const bcPageEl = document.getElementById('bcPage');
        if (bcPageEl) {
            const activeItem = document.querySelector(`.nav-item[data-page="${currentPage}"] span`);
            if (activeItem) {
                bcPageEl.textContent = activeItem.textContent;
                document.title = `BillBhai - ${activeItem.textContent}`;
            }
        }

        // Keep section labels tidy if no visible entries under management.
        const labels = document.querySelectorAll('.nav-section-label');
        labels.forEach(label => {
            if (label.textContent.trim() !== 'Management') return;
            const managementPages = ['returns', 'reports', 'users', 'superuser'];
            const hasAny = managementPages.some(p => allowedPages.includes(p));
            label.style.display = hasAny ? '' : 'none';
        });

        // Optional superuser marker in header role text.
        if (roleEl && roleKey === 'superuser') roleEl.textContent = 'Super User (Full Access)';

        enforceActionPermissions();

        // Wire logout links to clear session first.
        document.querySelectorAll('.nav-logout, .dropdown-item.text-danger').forEach(el => {
            el.addEventListener('click', (e) => {
                e.preventDefault();
                clearSession();
                goToLogin();
            });
        });

    }

    try {
        applyRoleBasedUI();
    } catch (err) {
        console.error('Failed to initialize role-based UI', err);
        // Better to show something than keep the screen blocked forever.
        setAppReady(true);
    }

    // Header & Search
    const notifBtn = document.getElementById('notifBtn');
    const notifDropdown = document.getElementById('notifDropdown');
    const userMenuBtn = document.getElementById('userMenuBtn');
    const userDropdown = document.getElementById('userDropdown');

    function closeDropdowns() {
        if (notifDropdown) notifDropdown.classList.remove('show');
        if (userDropdown) userDropdown.classList.remove('show');
    }

    if (notifBtn && notifDropdown) {
        notifBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isShowing = notifDropdown.classList.contains('show');
            closeDropdowns();
            if (!isShowing) notifDropdown.classList.add('show');
        });
    }

    if (userMenuBtn && userDropdown) {
        userMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isShowing = userDropdown.classList.contains('show');
            closeDropdowns();
            if (!isShowing) userDropdown.classList.add('show');
        });
    }

    document.addEventListener('click', () => {
        closeDropdowns();
    });

    // Navigation & Sidebar
    const sidebar = document.getElementById('sidebar');
    const menuToggle = document.getElementById('menuToggle');
    const overlay = document.getElementById('sidebarOverlay');
    const navItems = document.querySelectorAll('.nav-item[data-page]');
    const bcPage = document.getElementById('bcPage');
    const content = document.getElementById('contentArea');

    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', () => {
            if (window.innerWidth <= 768) sidebar.classList.toggle('mobile-open');
            else sidebar.classList.toggle('collapsed');
        });
    }
    if (overlay && sidebar) {
        overlay.addEventListener('click', () => sidebar.classList.remove('mobile-open'));
    }

    let currentPage = document.body.getAttribute('data-page') || 'dashboard';
    const LIVE_SYNC_KEY = 'bb_live_sync_event';
    const LIVE_SYNC_CHANNEL = 'bb_live_sync';
    const FETCH_TIMEOUT_MS = 7000;
    const NOTIFICATION_STATE_STORAGE_KEY = 'bb_notification_state';
    const NOTIFICATIONS_STORAGE_KEY = 'bb_notifications';
    const PROFILE_SETTINGS_STORAGE_KEY = 'bb_profile_settings';
    const AUTH_OVERRIDE_STORAGE_KEY = 'bb_auth_overrides';
    const CUSTOMER_SESSION_NOTIFICATION_KEY = 'bb_customer_session_notifications';
    const NOTIFICATION_CATEGORY_LABELS = {
        orders: 'Order Alerts',
        payments: 'Payment Alerts',
        inventory: 'Inventory Alerts',
        delivery: 'Delivery Alerts',
        returns: 'Return Alerts',
        users: 'User Alerts',
        businesses: 'Business Alerts',
        summary: 'Summary Alerts'
    };
    const ROLE_NOTIFICATION_CONFIG = {
        superuser: [
            { key: 'businesses', label: 'Business Alerts', defaultEnabled: true },
            { key: 'payments', label: 'Payment Alerts', defaultEnabled: true },
            { key: 'users', label: 'User Alerts', defaultEnabled: true },
            { key: 'orders', label: 'Order Alerts', defaultEnabled: true },
            { key: 'inventory', label: 'Inventory Alerts', defaultEnabled: true },
            { key: 'delivery', label: 'Delivery Alerts', defaultEnabled: true },
            { key: 'returns', label: 'Return Alerts', defaultEnabled: true },
            { key: 'summary', label: 'Summary Digest', defaultEnabled: false }
        ],
        admin: [
            { key: 'orders', label: 'Order Alerts', defaultEnabled: true },
            { key: 'payments', label: 'Payment Alerts', defaultEnabled: true },
            { key: 'inventory', label: 'Inventory Alerts', defaultEnabled: true },
            { key: 'delivery', label: 'Delivery Alerts', defaultEnabled: true },
            { key: 'returns', label: 'Return Alerts', defaultEnabled: true },
            { key: 'users', label: 'User Alerts', defaultEnabled: true },
            { key: 'summary', label: 'Summary Digest', defaultEnabled: false }
        ],
        cashier: [
            { key: 'orders', label: 'Order Alerts', defaultEnabled: true },
            { key: 'payments', label: 'Payment Alerts', defaultEnabled: true },
            { key: 'returns', label: 'Return Updates', defaultEnabled: true }
        ],
        inventorymanager: [
            { key: 'inventory', label: 'Inventory Alerts', defaultEnabled: true },
            { key: 'summary', label: 'Daily Summary', defaultEnabled: false }
        ],
        deliveryops: [
            { key: 'delivery', label: 'Delivery Alerts', defaultEnabled: true },
            { key: 'summary', label: 'Queue Summary', defaultEnabled: false }
        ],
        returnhandler: [
            { key: 'returns', label: 'Return Alerts', defaultEnabled: true },
            { key: 'summary', label: 'Desk Summary', defaultEnabled: false }
        ],
        customer: [
            { key: 'orders', label: 'Order Alerts', defaultEnabled: true },
            { key: 'payments', label: 'Payment Alerts', defaultEnabled: true },
            { key: 'delivery', label: 'Delivery Alerts', defaultEnabled: true }
        ]
    };
    const syncSourceId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    let syncDebounceTimer = null;
    let syncChannel = null;

    navItems.forEach(item => {
        // Highlight active item based on current page
        if (item.dataset.page === currentPage) {
            item.classList.add('active');
            const span = item.querySelector('span');
            if (span && bcPage) bcPage.textContent = span.textContent;
        } else {
            item.classList.remove('active');
        }

        item.addEventListener('click', (e) => {
            const targetPage = String(item.getAttribute('data-page') || '').trim();
            const href = String(item.getAttribute('href') || '').trim();
            if (targetPage && (!href || href === '#')) {
                e.preventDefault();
                window.location.href = `${targetPage}.html`;
                return;
            }
            if (window.innerWidth <= 768) sidebar.classList.remove('mobile-open');
        });
    });

    // Data
    function loadList(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            if (!raw) return fallback;
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : fallback;
        } catch (err) {
            return fallback;
        }
    }

    function loadObject(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            if (!raw) return fallback;
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : fallback;
        } catch (err) {
            return fallback;
        }
    }

    function saveList(key, list) {
        localStorage.setItem(key, JSON.stringify(list));
    }

    function saveObject(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    }

    async function fetchJsonWithTimeout(path) {
        const controller = typeof AbortController === 'function' ? new AbortController() : null;
        const requestOptions = { cache: 'no-store' };
        if (controller) requestOptions.signal = controller.signal;

        let timeoutId;
        const timeoutPromise = new Promise((_, reject) => {
            timeoutId = setTimeout(() => {
                if (controller) controller.abort();
                reject(new Error('Request timed out'));
            }, FETCH_TIMEOUT_MS);
        });

        try {
            const response = await Promise.race([
                fetch(path, requestOptions),
                timeoutPromise
            ]);
            if (!response.ok) return null;
            return await response.json();
        } catch (err) {
            return null;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    async function loadJsonArray(path, fallback) {
        return fallback;
    }

    async function loadJsonObject(path, fallback) {
        return fallback;
    }

    const API_BASE_URL = 'http://localhost:3000/api';

    function normalizeBackendRole(role) {
        const key = normalizeRole(role);
        if (key === 'superuser' || key === 'super') return 'superuser';
        if (key === 'admin' || key === 'opshead' || key === 'storemanager' || key === 'accountant' || key === 'supportagent') return 'admin';
        if (key === 'cashier') return 'cashier';
        if (key === 'returnhandler' || key === 'returns') return 'returnhandler';
        if (key === 'inventorymanager' || key === 'inventory') return 'inventorymanager';
        if (key === 'deliveryops' || key === 'delivery' || key === 'deliverymanager' || key === 'deliverydriver') return 'deliveryops';
        if (key === 'customer' || key === 'user') return 'customer';
        return 'admin';
    }

    function mapBackendRoleToLabel(role) {
        const normalized = normalizeBackendRole(role);
        if (normalized === 'superuser') return 'Super User';
        if (normalized === 'admin') return 'Admin';
        if (normalized === 'cashier') return 'Cashier';
        if (normalized === 'returnhandler') return 'Return Handler';
        if (normalized === 'inventorymanager') return 'Inventory Manager';
        if (normalized === 'deliveryops') return 'Delivery Ops';
        return 'Customer';
    }

    function mapRoleLabelToBackendRole(role) {
        return normalizeBackendRole(role);
    }

    function getCurrentSessionRole() {
        return normalizeBackendRole(localStorage.getItem('userRole') || activeRoleKey || 'admin');
    }

    async function apiRequest(path, options) {
        const opts = options && typeof options === 'object' ? options : {};
        const method = String(opts.method || 'GET').toUpperCase();
        const role = normalizeBackendRole(opts.role || getCurrentSessionRole());
        const headers = {
            'Content-Type': 'application/json',
            'x-role': role
        };

        const request = {
            method,
            headers,
            cache: 'no-store'
        };

        if (opts.body !== undefined) {
            request.body = JSON.stringify(opts.body);
        }

        const response = await fetch(`${API_BASE_URL}${path}`, request);
        const contentType = response.headers.get('content-type') || '';
        const payload = contentType.includes('application/json')
            ? await response.json()
            : await response.text();

        if (!response.ok) {
            const message = payload && typeof payload === 'object' && payload.message
                ? payload.message
                : `HTTP ${response.status}`;
            const error = new Error(message);
            error.status = response.status;
            throw error;
        }

        return payload;
    }

    function mutationErrorMessage(actionLabel, error) {
        const message = error && error.message ? error.message : 'Backend unavailable';
        return `${actionLabel} failed: ${message}`;
    }

    function showMutationError(actionLabel, error) {
        console.warn(`${actionLabel} failed`, error);
        showToast(mutationErrorMessage(actionLabel, error));
    }

    function isNotFoundError(error) {
        return Number(error && error.status) === 404
            || /not found/i.test(String(error && error.message || ''));
    }

    function buildBackendReturnPayload(item, overrides) {
        const patch = overrides && typeof overrides === 'object' ? overrides : {};
        const currentUser = loadObject('currentUser', {});
        const nextRequestedBy = String(
            patch.requestedBy !== undefined ? patch.requestedBy : (item && item.requestedBy) || localStorage.getItem('userName') || 'Operator'
        ).trim() || 'Operator';

        return {
            orderId: String(
                patch.orderId !== undefined ? patch.orderId : ((item && (item.oid || item.orderId)) || '')
            ).trim().toUpperCase(),
            staffId: String(
                patch.staffId !== undefined ? patch.staffId : ((item && item.staffId) || currentUser.id || 'USR-005')
            ).trim() || 'USR-005',
            reason: String(
                patch.reason !== undefined ? patch.reason : ((item && item.reason) || '')
            ).trim(),
            refundAmount: Math.max(0, Number(
                patch.refundAmount !== undefined ? patch.refundAmount : ((item && item.amount) || 0)
            ) || 0),
            returnType: String(
                patch.returnType !== undefined ? patch.returnType : ((item && item.returnType) || 'refund')
            ).trim() || 'refund',
            product: String(
                patch.product !== undefined ? patch.product : ((item && (item.backendProduct || item.product)) || '')
            ).trim(),
            qty: Math.max(1, Number(
                patch.qty !== undefined ? patch.qty : ((item && item.qty) || 1)
            ) || 1),
            requestedBy: nextRequestedBy
        };
    }

    async function resolveBackendReturnId(item) {
        if (!item) throw new Error('Return item missing');
        const currentId = String(item.backendId || item.id || '').trim();
        const rows = await apiRequest('/returns', { role: 'returnhandler' });
        const list = Array.isArray(rows) ? rows : [];

        let match = currentId
            ? list.find((row) => String(row && row.id || '').trim() === currentId)
            : null;

        if (!match) {
            const orderId = String(item.oid || '').trim();
            const reason = String(item.reason || '').trim().toLowerCase();
            const qty = Math.max(1, Number(item.qty) || 1);
            const amount = Math.max(0, Number(item.amount) || 0);
            const requestedBy = String(item.requestedBy || '').trim().toLowerCase();
            match = list.find((row) =>
                String(row && row.orderId || '').trim() === orderId
                && String(row && row.reason || '').trim().toLowerCase() === reason
                && Math.max(1, Number(row && row.qty) || 1) === qty
                && Math.abs((Math.max(0, Number(row && row.refundAmount) || 0)) - amount) < 0.01
                && (!requestedBy || String(row && row.requestedBy || '').trim().toLowerCase() === requestedBy)
            );
        }

        if (!match || !match.id) {
            throw new Error(`Return ${currentId || item.oid || ''} not found`);
        }

        item.backendId = String(match.id).trim();
        item.id = item.backendId;
        if (match.product) item.backendProduct = String(match.product).trim();
        if (match.staffId) item.staffId = String(match.staffId).trim();
        return item.backendId;
    }

    async function ensureBackendReturnId(item, overrides) {
        try {
            return await resolveBackendReturnId(item);
        } catch (error) {
            if (!isNotFoundError(error) && !/not found/i.test(String(error && error.message || ''))) {
                throw error;
            }
        }

        const created = await apiRequest('/returns', {
            method: 'POST',
            role: 'returnhandler',
            body: buildBackendReturnPayload(item, overrides)
        });

        const backendId = String(created && created.id || '').trim();
        if (!backendId) {
            throw new Error('Return could not be recreated in backend');
        }

        item.backendId = backendId;
        item.id = backendId;
        item.status = String(created && created.status || item.status || 'Pending').trim();
        item.staffId = String(created && created.staffId || item.staffId || '').trim();
        item.backendProduct = String(created && created.product || item.backendProduct || item.product || '').trim();
        return backendId;
    }

    async function updateReturnOnBackend(item, payload) {
        const updatePayload = payload && typeof payload === 'object' ? payload : {};
        const preferredId = String(item && (item.backendId || item.id) || '').trim();

        try {
            if (!preferredId) throw new Error('Return id missing');
            await apiRequest(`/returns/${encodeURIComponent(preferredId)}`, {
                method: 'PUT',
                role: 'returnhandler',
                body: updatePayload
            });
            item.backendId = preferredId;
            return preferredId;
        } catch (error) {
            if (!isNotFoundError(error)) throw error;
            const resolvedId = await ensureBackendReturnId(item, updatePayload);
            await apiRequest(`/returns/${encodeURIComponent(String(resolvedId))}`, {
                method: 'PUT',
                role: 'returnhandler',
                body: updatePayload
            });
            item.backendId = resolvedId;
            item.id = resolvedId;
            return resolvedId;
        }
    }

    async function resolveBackendDeliveryId(item) {
        if (!item) throw new Error('Delivery item missing');
        const orderId = String(item.orderId || item.oid || '').trim();
        if (!orderId) throw new Error('Delivery order id missing');

        const delivery = await apiRequest(`/deliveries/order/${encodeURIComponent(orderId)}`, {
            role: 'deliveryops'
        });
        if (!delivery || !delivery.id) {
            throw new Error(`Delivery for order ${orderId} not found`);
        }

        item.id = String(delivery.id).trim();
        return item.id;
    }

    function formatBackendDate(value) {
        if (!value) return formatDate();
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) return String(value);
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const hh = String(parsed.getHours()).padStart(2, '0');
        const mm = String(parsed.getMinutes()).padStart(2, '0');
        return `${parsed.getDate()} ${months[parsed.getMonth()]} ${hh}:${mm}`;
    }

    async function loadOperationalDataFromBackend() {
        try {
            const scopedCompanyId = String(activeBusinessId || '').trim();

            const [
                productsData,
                suppliersData,
                inventoryData,
                ordersData,
                customersData,
                deliveriesData,
                returnsData,
                usersData,
                companiesData
            ] = await Promise.all([
                apiRequest('/products', { role: 'cashier' }).catch(() => []),
                apiRequest('/suppliers', { role: 'inventorymanager' }).catch(() => []),
                apiRequest('/inventory', { role: 'inventorymanager' }).catch(() => []),
                apiRequest(scopedCompanyId ? `/orders?companyId=${encodeURIComponent(scopedCompanyId)}` : '/orders', { role: 'cashier' }).catch(() => []),
                apiRequest(scopedCompanyId ? `/customers?companyId=${encodeURIComponent(scopedCompanyId)}` : '/customers', { role: 'cashier' }).catch(() => []),
                apiRequest('/deliveries', { role: 'deliveryops' }).catch(() => []),
                apiRequest('/returns', { role: 'returnhandler' }).catch(() => []),
                apiRequest(scopedCompanyId ? `/users?companyId=${encodeURIComponent(scopedCompanyId)}` : '/users', { role: 'admin' }).catch(() => []),
                apiRequest('/companies', { role: 'superuser' }).catch(() => [])
            ]);

            if (!Array.isArray(productsData) || !Array.isArray(inventoryData) || !Array.isArray(ordersData)) {
                return false;
            }

            const supplierById = new Map(
                (Array.isArray(suppliersData) ? suppliersData : []).map((item) => [String(item.id || ''), item])
            );
            const productById = new Map(
                (Array.isArray(productsData) ? productsData : []).map((item) => [String(item.id || ''), item])
            );
            const customerById = new Map(
                (Array.isArray(customersData) ? customersData : []).map((item) => [String(item.id || ''), item])
            );
            const orderById = new Map(
                (Array.isArray(ordersData) ? ordersData : []).map((item) => [String(item.id || ''), item])
            );

            const mappedInventory = inventoryData.map((inv, idx) => {
                const product = productById.get(String(inv.productId || '')) || {};
                const supplier = supplierById.get(String(product.supplierId || '')) || {};
                const fallbackSku = `SKU-${String(idx + 1).padStart(2, '0')}`;
                return {
                    sku: String(inv.id || fallbackSku).replace('INV-', 'SKU-'),
                    inventoryId: inv.id,
                    productId: inv.productId,
                    name: String(product.name || inv.productId || 'Unknown Product').trim(),
                    cat: String(product.category || 'Uncategorized').trim(),
                    supplier: String(supplier.name || product.supplierId || 'Unknown Supplier').trim(),
                    stock: Math.max(0, Number(inv.stockAvailable || 0)),
                    price: Math.max(0, Number(product.price || 0)),
                    status: String(inv.status || 'In Stock').trim(),
                    reorderLevel: Math.max(0, Number(inv.reorderLevel || 0)),
                    location: String(inv.location || '').trim()
                };
            });

            const mappedOrders = ordersData.map((order) => {
                const customer = customerById.get(String(order.customerId || ''));
                const itemCount = Array.isArray(order.items)
                    ? order.items.reduce((sum, item) => sum + Math.max(0, Number(item && item.quantity || 0)), 0)
                    : 0;
                return {
                    id: String(order.id || '').trim(),
                    customer: String(order.customerName || (customer && customer.name) || order.customerId || 'Unknown Customer').trim(),
                    items: Math.max(0, Number(order.itemsCount || itemCount || 0)),
                    total: Math.max(0, Number(order.total || 0)),
                    payment: String(order.paymentMethod || 'Pending').trim(),
                    status: String(order.status || 'Pending').trim(),
                    date: formatBackendDate(order.orderDate),
                    companyId: String(order.companyId || '').trim()
                };
            });

            const mappedDeliveries = (Array.isArray(deliveriesData) ? deliveriesData : []).map((delivery) => {
                const order = orderById.get(String(delivery.orderId || '')) || {};
                const customer = customerById.get(String(order.customerId || '')) || {};
                const status = String(delivery.status || 'Pending').trim();
                const updatedAtRaw = delivery.deliveryDate || delivery.dispatchDate || '';
                return {
                    id: String(delivery.id || '').trim(),
                    oid: String(delivery.orderId || '').trim(),
                    orderId: String(delivery.orderId || '').trim(),
                    customer: String(delivery.customerName || order.customerName || customer.name || order.customerId || 'Unknown Customer').trim(),
                    address: String(delivery.address || order.customerAddress || customer.address || 'Address unavailable').trim(),
                    partner: String(delivery.partnerName || 'Unassigned').trim(),
                    partnerPhone: String(delivery.partnerPhone || '').trim(),
                    partnerAgency: String(delivery.partnerAgency || '').trim(),
                    partnerVehicle: String(delivery.partnerVehicle || '').trim(),
                    dispatchDate: String(delivery.dispatchDate || '').trim(),
                    deliveryDate: String(delivery.deliveryDate || '').trim(),
                    status,
                    etaMin: status === 'In Transit' ? 20 : (status === 'Pending' ? 35 : 0),
                    updatedAt: formatBackendDate(updatedAtRaw || new Date().toISOString()),
                    time: formatBackendDate(updatedAtRaw || new Date().toISOString()).split(' ').slice(-1)[0]
                };
            });

            const mappedReturns = (Array.isArray(returnsData) ? returnsData : []).map((ret) => {
                const order = orderById.get(String(ret.orderId || '')) || {};
                const customer = customerById.get(String(order.customerId || '')) || {};
                const product = productById.get(String(ret.product || '')) || {};
                return {
                    id: String(ret.id || '').trim(),
                    backendId: String(ret.id || '').trim(),
                    oid: String(ret.orderId || '').trim(),
                    orderId: String(ret.orderId || '').trim(),
                    customer: String(customer.name || order.customerId || 'Unknown Customer').trim(),
                    product: String(product.name || ret.product || 'Unknown Product').trim(),
                    backendProduct: String(ret.product || '').trim(),
                    reason: String(ret.reason || '').trim(),
                    amount: Math.max(0, Number(ret.refundAmount ?? ret.amount ?? 0)),
                    qty: Math.max(1, Number(ret.qty || 1)),
                    status: String(ret.status || 'Pending').trim(),
                    requestedBy: String(ret.requestedBy || '').trim() || 'Operator',
                    staffId: String(ret.staffId || '').trim(),
                    returnType: String(ret.returnType || 'refund').trim() || 'refund',
                    updatedAt: formatBackendDate(ret.returnDate || new Date().toISOString())
                };
            });

            const mappedUsers = (Array.isArray(usersData) ? usersData : []).map((user) => ({
                id: String(user.id || '').trim(),
                companyId: String(user.companyId || '').trim(),
                name: String(user.name || '').trim(),
                role: mapBackendRoleToLabel(user.role),
                status: String(user.status || 'Active').trim(),
                email: String(user.email || '').trim(),
                phone: String(user.mobileNo || '').trim(),
                username: String(user.username || '').trim()
            }));

            // Backend is source-of-truth in backend-only mode.
inventory = cloneRows(mappedInventory);
            orders = cloneRows(mappedOrders);
            deliveries = cloneRows(mappedDeliveries);
            returns = cloneRows(mappedReturns);
            users = cloneRows(mappedUsers);

            if (Array.isArray(companiesData) && companiesData.length) {
                const existingById = new Map(businesses.map((item) => [item.id, item]));
                const mapped = companiesData.map((company) => {
                    const existing = existingById.get(String(company.id || '').trim()) || {};
                    return normalizeBusinessRecord({
                        ...existing,
                        ...company
                    }, company.id, company.name);
                });
                businesses.splice(0, businesses.length, ...mapped);
                saveList('bb_businesses', businesses);
            }

            persistOperationalData({ silentSync: true });
            return true;
        } catch (error) {
            console.warn('Backend sync unavailable, using local fallback.', error);
            return false;
        }
    }

    function normalizeBusinessRecord(raw, fallbackId, fallbackName) {
        const safe = raw && typeof raw === 'object' ? raw : {};
        const id = String(safe.id || fallbackId || 'BIZ-000').trim();
        const name = String(safe.name || fallbackName || id).trim();

        const usersList = Array.isArray(safe.users)
            ? safe.users.map((u, idx) => ({
                name: String((u && u.name) || `User ${idx + 1}`).trim(),
                role: String((u && u.role) || 'Staff').trim(),
                status: String((u && u.status) || 'Active').trim()
            }))
            : [];

        const storesList = Array.isArray(safe.stores)
            ? safe.stores.map((s, idx) => ({
                code: String((s && s.code) || `${id}-S${idx + 1}`).trim(),
                city: String((s && s.city) || 'Unknown').trim(),
                status: String((s && s.status) || 'Active').trim()
            }))
            : [];

        const paymentsList = Array.isArray(safe.payments)
            ? safe.payments.map((p, idx) => ({
                month: String((p && p.month) || `Entry ${idx + 1}`).trim(),
                amount: Math.max(0, Number((p && p.amount) || 0) || 0),
                status: String((p && p.status) || 'Due').trim()
            }))
            : [];

        const storesCount = Number.isFinite(Number(safe.storesCount))
            ? Math.max(0, Number(safe.storesCount))
            : storesList.length;

        const paymentDue = Number.isFinite(Number(safe.paymentDue))
            ? Math.max(0, Number(safe.paymentDue))
            : paymentsList.filter(p => String(p.status).toLowerCase() !== 'paid').reduce((sum, p) => sum + Number(p.amount || 0), 0);

        return {
            id,
            name,
            owner: String(safe.owner || 'Unknown Owner').trim(),
            adminName: String(safe.adminName || 'Store Admin').trim(),
            type: String(safe.type || 'Retail').trim(),
            email: String(safe.email || 'na@business.local').trim(),
            phone: String(safe.phone || 'NA').trim(),
            status: String(safe.status || 'Active').trim(),
            productsPlan: String(safe.productsPlan || 'Billing Starter').trim(),
            tenureMonths: Math.max(0, Number(safe.tenureMonths) || 0),
            storesCount,
            profit: Math.max(0, Number(safe.profit) || 0),
            paymentDue,
            users: usersList,
            stores: storesList,
            payments: paymentsList
        };
    }

    const defaultOrders = [];
    const defaultInventory = [];
    const defaultDeliveries = [];
    const defaultReturns = [];
    const defaultUsers = [];
    const defaultBusinesses = [];

    const businesses = [];

    let activeBusinessId = String(localStorage.getItem('activeBusinessId') || '').trim();
    const activeBusinessName = String(localStorage.getItem('activeBusinessName') || '').trim();

    // Some roles should always be scoped to a business (defaults to first business or BIZ-101).
    // - admin: full owner access within one business
    // - deliveryops / returnhandler / inventorymanager: operational access within one business
    if (activeRoleKey === 'admin' || activeRoleKey === 'cashier' || activeRoleKey === 'deliveryops' || activeRoleKey === 'returnhandler' || activeRoleKey === 'inventorymanager') {
        const fallbackBusinessId = String((businesses[0] && businesses[0].id) || 'BIZ-101').trim();
        const hasValidBusiness = activeBusinessId && businesses.some(b => b.id === activeBusinessId);
        if (!hasValidBusiness) {
            activeBusinessId = fallbackBusinessId;
            localStorage.setItem('activeBusinessId', activeBusinessId);
            localStorage.removeItem('activeBusinessName');
        }
    }

    function cloneRows(rows) {
        return JSON.parse(JSON.stringify(rows));
    }

    function mergeSeedRecords(existingRows, seedRows, key) {
        const existing = Array.isArray(existingRows) ? existingRows : [];
        const seed = Array.isArray(seedRows) ? seedRows : [];
        if (!existing.length) return cloneRows(seed);
        if (!seed.length) return cloneRows(existing);

        const getKey = (row) => String(row && row[key] ? row[key] : '').trim();
        const seedByKey = new Map(seed.map(r => [getKey(r), r]).filter(([k]) => k));
        const existingKeys = new Set(existing.map(getKey).filter(Boolean));

        const merged = existing.map(row => {
            const k = getKey(row);
            const seedRow = k ? seedByKey.get(k) : null;
            return seedRow ? { ...seedRow, ...row } : row;
        });

        seed.forEach(row => {
            const k = getKey(row);
            if (!k || existingKeys.has(k)) return;
            merged.push(row);
        });

        return cloneRows(merged);
    }

    function mergePrimaryWithSecondary(primaryRows, secondaryRows, key) {
        const primary = Array.isArray(primaryRows) ? primaryRows : [];
        const secondary = Array.isArray(secondaryRows) ? secondaryRows : [];
        if (!primary.length) return cloneRows(secondary);
        if (!secondary.length) return cloneRows(primary);

        const getKey = (row) => String(row && row[key] ? row[key] : '').trim();
        const primaryKeys = new Set(primary.map(getKey).filter(Boolean));
        const merged = cloneRows(primary);

        secondary.forEach((row) => {
            const k = getKey(row);
            if (!k || primaryKeys.has(k)) return;
            merged.push(cloneRows([row])[0]);
        });

        return merged;
    }

    function buildBusinessSeedData(business, idx) {
        const userList = Array.isArray(business.users) ? business.users : [];
        const adminName = userList.find(u => String(u.role || '').toLowerCase() === 'admin')?.name || business.adminName || 'Store Admin';
        const cashierName = userList.find(u => String(u.role || '').toLowerCase().includes('cashier'))?.name || 'POS Counter';
        const inventoryManager = userList.find(u => String(u.role || '').toLowerCase().includes('inventory'))?.name || 'Inventory Desk';
        const deliveryLead = userList.find(u => String(u.role || '').toLowerCase().includes('delivery'))?.name || 'Delivery Desk';
        const returnLead = userList.find(u => String(u.role || '').toLowerCase().includes('return'))?.name || 'Returns Desk';
        const city = Array.isArray(business.stores) && business.stores[0] ? business.stores[0].city : 'Primary City';
        const seedNum = 500 + idx * 50;

        const seedOrders = [
            { id: `ORD-${seedNum + 1}`, customer: `${city} Walk-in`, items: 6, total: 4280 + idx * 180, payment: 'Paid Upfront', status: 'Processing', date: '17 Feb 16:42' },
            { id: `ORD-${seedNum + 2}`, customer: 'Anita Verma', items: 2, total: 980 + idx * 90, payment: 'COD', status: 'Processing', date: '17 Feb 16:05' }
        ];

        const addressBook = [
            `12, MG Road, ${city}`,
            `A-204, Green Park, ${city}`,
            `Plot 7, Industrial Area, ${city}`,
            `302, Lotus Tower, ${city}`,
            `H.No 15, Civil Lines, ${city}`,
            `42, Lake View Road, ${city}`,
            `101, Sapphire Towers, ${city}`,
            `5th Cross, Jayanagar, ${city}`,
            `B-12, Shanti Nagar, ${city}`,
            `House 23, Ram Nagar, ${city}`,
            `Flat 6A, Sunrise Apartments, ${city}`,
            `Sector 14 Market Lane, ${city}`
        ];

        const seedDeliveries = [
            { id: `DEL-${seedNum + 1}`, oid: seedOrders[0].id, customer: seedOrders[0].customer, customerName: seedOrders[0].customer, address: addressBook[0], partner: 'Rajesh K.', partnerPhone: '+91 98214 44770', partnerAgency: 'SwiftDrop Logistics', status: 'Pending', etaMin: 35, updatedAt: '17 Feb 05:30' },
            { id: `DEL-${seedNum + 2}`, oid: seedOrders[1].id, customer: seedOrders[1].customer, customerName: seedOrders[1].customer, address: addressBook[1], partner: 'Sunil M.', partnerPhone: '+91 98214 44771', partnerAgency: 'SwiftDrop Logistics', status: 'In Transit', etaMin: 18, updatedAt: '17 Feb 16:20' }
        ];

        const seedInventory = [
            { sku: `SKU-${seedNum + 1}`, name: 'Basmati Rice', cat: 'Grocery', supplier: 'Agarwal Traders', supplierPhone: '+91 98115 44101', supplierEmail: 'sanjay@agarwaltraders.in', leadTimeDays: 2, stock: 145 - idx * 3, price: 380 + idx * 5, status: 'In Stock' },
            { sku: `SKU-${seedNum + 2}`, name: 'Toor Dal', cat: 'Grocery', supplier: 'Sharma Wholesale', supplierPhone: '+91 98917 22055', supplierEmail: 'orders@sharmawholesale.in', leadTimeDays: 3, stock: 230 - idx * 5, price: 120 + idx * 4, status: 'In Stock' },
            { sku: `SKU-${seedNum + 3}`, name: 'Refined Oil', cat: 'Grocery', supplier: 'Fortune Dist.', supplierPhone: '+91 99004 11233', supplierEmail: 'north@fortunedist.in', leadTimeDays: 4, stock: 18 + idx, price: 155 + idx * 3, status: 'Low Stock' },
            { sku: `SKU-${seedNum + 4}`, name: 'Atta Flour', cat: 'Grocery', supplier: 'Agarwal Traders', supplierPhone: '+91 98115 44101', supplierEmail: 'sanjay@agarwaltraders.in', leadTimeDays: 2, stock: 122 - idx * 2, price: 248 + idx * 3, status: 'In Stock' },
            { sku: `SKU-${seedNum + 5}`, name: 'Sugar', cat: 'Grocery', supplier: 'Sharma Wholesale', supplierPhone: '+91 98917 22055', supplierEmail: 'orders@sharmawholesale.in', leadTimeDays: 3, stock: 64 - idx * 3, price: 48 + idx * 2, status: 'In Stock' },
            { sku: `SKU-${seedNum + 6}`, name: 'Paneer', cat: 'Dairy', supplier: 'City Dairy', supplierPhone: '+91 97170 55544', supplierEmail: 'supply@citydairy.in', leadTimeDays: 1, stock: 21 + idx, price: 78, status: 'Low Stock' },
            { sku: `SKU-${seedNum + 7}`, name: 'Curd Cup', cat: 'Dairy', supplier: 'City Dairy', supplierPhone: '+91 97170 55544', supplierEmail: 'supply@citydairy.in', leadTimeDays: 1, stock: 88 + idx * 2, price: 26, status: 'In Stock' },
            { sku: `SKU-${seedNum + 8}`, name: 'Butter', cat: 'Dairy', supplier: 'City Dairy', supplierPhone: '+91 97170 55544', supplierEmail: 'supply@citydairy.in', leadTimeDays: 1, stock: 14 + idx, price: 60, status: 'Low Stock' },
            { sku: `SKU-${seedNum + 9}`, name: 'Potato Chips', cat: 'Snacks', supplier: 'SnackHub Foods', supplierPhone: '+91 99100 77442', supplierEmail: 'supply@snackhubfoods.in', leadTimeDays: 2, stock: 172 + idx * 6, price: 20, status: 'In Stock' },
            { sku: `SKU-${seedNum + 10}`, name: 'Biscuits', cat: 'Snacks', supplier: 'SnackHub Foods', supplierPhone: '+91 99100 77442', supplierEmail: 'supply@snackhubfoods.in', leadTimeDays: 2, stock: 154 + idx * 5, price: 12, status: 'In Stock' },
            { sku: `SKU-${seedNum + 11}`, name: 'Orange Juice', cat: 'Beverages', supplier: 'Cool Bev', supplierPhone: '+91 98180 33021', supplierEmail: 'ops@coolbev.in', leadTimeDays: 2, stock: 37 - idx, price: 42, status: 'In Stock' },
            { sku: `SKU-${seedNum + 12}`, name: 'Mineral Water', cat: 'Beverages', supplier: 'Cool Bev', supplierPhone: '+91 98180 33021', supplierEmail: 'ops@coolbev.in', leadTimeDays: 2, stock: 9 + idx, price: 20, status: 'Critical' },
            { sku: `SKU-${seedNum + 13}`, name: 'Dishwash Liquid', cat: 'Home Care', supplier: 'HomeSpark Supplies', supplierPhone: '+91 98101 56512', supplierEmail: 'care@homespark.in', leadTimeDays: 3, stock: 48 + idx * 2, price: 58, status: 'In Stock' },
            { sku: `SKU-${seedNum + 14}`, name: 'Detergent Powder', cat: 'Home Care', supplier: 'HomeSpark Supplies', supplierPhone: '+91 98101 56512', supplierEmail: 'care@homespark.in', leadTimeDays: 3, stock: Math.max(0, idx - 1), price: 96, status: idx > 0 ? 'Critical' : 'Out of Stock' }
        ];

        const seedReturns = [
            { id: `RET-${seedNum + 1}`, oid: seedOrders[0].id, product: seedInventory[2].name, sku: seedInventory[2].sku, cat: seedInventory[2].cat, reason: 'Damaged', amount: seedInventory[2].price, qty: 1, status: 'Pending', requestedBy: cashierName, updatedAt: '17 Feb 16:18' },
            { id: `RET-${seedNum + 2}`, oid: seedOrders[1].id, product: seedInventory[5].name, sku: seedInventory[5].sku, cat: seedInventory[5].cat, reason: 'Expired', amount: seedInventory[5].price, qty: 1, status: 'Pending', requestedBy: cashierName, updatedAt: '17 Feb 15:42' }
        ];

        const fallbackUsers = [
            { name: adminName, role: 'Admin', status: 'Active' },
            { name: cashierName, role: 'Cashier', status: 'Active' },
            { name: inventoryManager, role: 'Inventory Manager', status: 'Active' },
            { name: deliveryLead, role: 'Delivery Ops', status: 'Active' },
            { name: returnLead, role: 'Return Handler', status: 'Active' }
        ];

        return {
            orders: seedOrders,
            inventory: seedInventory,
            deliveries: seedDeliveries,
            returns: seedReturns,
            users: userList.length ? mergeSeedRecords(userList, fallbackUsers, 'name') : fallbackUsers
        };
    }

    const businessDataStore = {};

    let selectedBusiness = activeBusinessId ? businesses.find(b => b.id === activeBusinessId) : null;
    let isBusinessScoped = !!selectedBusiness;
    let businessScopedData = isBusinessScoped ? businessDataStore[selectedBusiness.id] : null;

    if (activeBusinessId && !selectedBusiness) {
        localStorage.removeItem('activeBusinessId');
        localStorage.removeItem('activeBusinessName');
        activeBusinessId = '';
        isBusinessScoped = false;
        businessScopedData = null;
    }

    if (selectedBusiness) {
        localStorage.setItem('activeBusinessName', selectedBusiness.name);
        const bcAppEl = document.querySelector('.bc-app');
        if (bcAppEl) bcAppEl.textContent = `BillBhai / ${selectedBusiness.name}`;
    }

    let orders = isBusinessScoped
        ? (Array.isArray(businessScopedData.orders) ? businessScopedData.orders : cloneRows(defaultOrders))
        : loadList('bb_orders', defaultOrders);
    let inventory = isBusinessScoped
        ? (Array.isArray(businessScopedData.inventory) ? businessScopedData.inventory : cloneRows(defaultInventory))
        : loadList('bb_inventory', defaultInventory);
    let deliveries = isBusinessScoped
        ? (Array.isArray(businessScopedData.deliveries) ? businessScopedData.deliveries : cloneRows(defaultDeliveries))
        : loadList('bb_deliveries', defaultDeliveries);
    let returns = isBusinessScoped
        ? (Array.isArray(businessScopedData.returns) ? businessScopedData.returns : cloneRows(defaultReturns))
        : loadList('bb_returns', defaultReturns);
    let users = isBusinessScoped
        ? (Array.isArray(businessScopedData.users) ? businessScopedData.users : cloneRows(defaultUsers))
        : loadList('bb_users', defaultUsers);

    function publishDataSync(domains) {
        const payload = {
            sourceId: syncSourceId,
            at: Date.now(),
            businessId: isBusinessScoped && selectedBusiness ? selectedBusiness.id : '',
            domains: Array.isArray(domains) && domains.length ? domains : ['orders', 'inventory', 'deliveries', 'returns', 'users']
        };

        localStorage.setItem(LIVE_SYNC_KEY, JSON.stringify(payload));
        if (syncChannel) {
            try {
                syncChannel.postMessage(payload);
            } catch (err) {
                // Ignore channel failures and keep localStorage sync active.
            }
        }
    }

    function loadOperationalSnapshotFromStorage() {
        // Backend-only mode: do not rehydrate operational collections from localStorage.
        return;
    }

    function shouldApplyIncomingSync(payload) {
        if (!payload || typeof payload !== 'object') return false;
        if (String(payload.sourceId || '') === syncSourceId) return false;

        const incomingBusinessId = String(payload.businessId || '').trim();
        if (isBusinessScoped && selectedBusiness) {
            return incomingBusinessId === selectedBusiness.id;
        }
        return true;
    }

    function handleIncomingSync(payload) {
        if (!shouldApplyIncomingSync(payload)) return;

        if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
        syncDebounceTimer = setTimeout(() => {
            loadOperationalSnapshotFromStorage();
            renderPage(currentPage);
        }, 120);
    }

    function initRealtimeSync() {
        window.addEventListener('storage', (event) => {
            if (event.key !== LIVE_SYNC_KEY || !event.newValue) return;
            try {
                const payload = JSON.parse(event.newValue);
                handleIncomingSync(payload);
            } catch (err) {
                // Ignore malformed payloads.
            }
        });

        if (!('BroadcastChannel' in window)) return;
        try {
            syncChannel = new BroadcastChannel(LIVE_SYNC_CHANNEL);
            syncChannel.addEventListener('message', (event) => {
                handleIncomingSync(event && event.data);
            });
            window.addEventListener('beforeunload', () => {
                if (!syncChannel) return;
                try {
                    syncChannel.close();
                } catch (err) {
                    // no-op
                }
            });
        } catch (err) {
            syncChannel = null;
        }
    }

    function persistOperationalData(options) {
        const opts = options && typeof options === 'object' ? options : {};

        renderNotificationDropdown();
        if (!opts.silentSync) publishDataSync(opts.domains);
    }

    function mergeBusinessCollections(preferredList, fallbackList) {
        const map = new Map();

        (Array.isArray(fallbackList) ? fallbackList : []).forEach((item, idx) => {
            const normalized = normalizeBusinessRecord(item, defaultBusinesses[idx] && defaultBusinesses[idx].id, defaultBusinesses[idx] && defaultBusinesses[idx].name);
            map.set(normalized.id, normalized);
        });

        (Array.isArray(preferredList) ? preferredList : []).forEach((item, idx) => {
            const normalized = normalizeBusinessRecord(item, defaultBusinesses[idx] && defaultBusinesses[idx].id, defaultBusinesses[idx] && defaultBusinesses[idx].name);
            map.set(normalized.id, normalized);
        });

        return Array.from(map.values());
    }

    async function hydrateDataFromJsonFiles() {
        const scopedCompanyId = String(activeBusinessId || '').trim();
        const [
            backendOrdersRaw,
            jsonInventoryRaw,
            jsonDeliveriesRaw,
            jsonReturnsRaw,
            jsonUsersRaw,
            jsonBusinessesRaw,
            jsonBusinessData
        ] = await Promise.all([
            apiRequest(scopedCompanyId ? `/orders?companyId=${encodeURIComponent(scopedCompanyId)}` : '/orders', { role: 'cashier' }).catch(() => defaultOrders),
            loadJsonArray('data/inventory.json', defaultInventory),
            loadJsonArray('data/deliveries.json', defaultDeliveries),
            loadJsonArray('data/returns.json', defaultReturns),
            loadJsonArray('data/users.json', defaultUsers),
            loadJsonArray('data/businesses.json', defaultBusinesses),
            loadJsonObject('data/business_data.json', {})
        ]);

        const jsonOrders = mergeSeedRecords(Array.isArray(backendOrdersRaw) ? backendOrdersRaw : defaultOrders, defaultOrders, 'id');
        const jsonInventory = mergeSeedRecords(jsonInventoryRaw, defaultInventory, 'sku');
        const jsonDeliveries = mergeSeedRecords(jsonDeliveriesRaw, defaultDeliveries, 'id');
        const jsonReturns = mergeSeedRecords(jsonReturnsRaw, defaultReturns, 'id');
        const jsonUsers = mergeSeedRecords(jsonUsersRaw, defaultUsers, 'name');
        const jsonBusinesses = jsonBusinessesRaw.map((b, idx) => normalizeBusinessRecord(
            b,
            defaultBusinesses[idx] && defaultBusinesses[idx].id,
            defaultBusinesses[idx] && defaultBusinesses[idx].name
        ));

        const storedBusinesses = loadList('bb_businesses', []);
        const hasStoredBusinesses = Array.isArray(storedBusinesses) && storedBusinesses.length > 0;
        const mergedBusinesses = mergeBusinessCollections(hasStoredBusinesses ? storedBusinesses : jsonBusinesses, jsonBusinesses);
        businesses.splice(0, businesses.length, ...mergedBusinesses);
        saveList('bb_businesses', businesses);

        const storedBusinessData = loadObject('bb_business_data', {});
        const rebuiltBusinessData = {};
        businesses.forEach((business, idx) => {
            const seed = buildBusinessSeedData(business, idx);
            const storedEntry = storedBusinessData[business.id];
            const jsonEntry = jsonBusinessData[business.id];
            const source = storedEntry && typeof storedEntry === 'object'
                ? storedEntry
                : (jsonEntry && typeof jsonEntry === 'object' ? jsonEntry : seed);

            rebuiltBusinessData[business.id] = {
                orders: Array.isArray(source.orders) ? mergeSeedRecords(source.orders, seed.orders, 'id') : seed.orders,
                inventory: Array.isArray(source.inventory) ? mergeSeedRecords(source.inventory, seed.inventory, 'sku') : seed.inventory,
                deliveries: Array.isArray(source.deliveries) ? mergeSeedRecords(source.deliveries, seed.deliveries, 'id') : seed.deliveries,
                returns: Array.isArray(source.returns) ? mergeSeedRecords(source.returns, seed.returns, 'id') : seed.returns,
                users: Array.isArray(source.users)
                    ? mergeSeedRecords(source.users, Array.isArray(business.users) && business.users.length ? business.users : seed.users, 'name')
                    : (Array.isArray(business.users) && business.users.length ? cloneRows(business.users) : seed.users)
            };
        });

        Object.keys(businessDataStore).forEach((bizId) => {
            delete businessDataStore[bizId];
        });
        Object.assign(businessDataStore, rebuiltBusinessData);
        saveObject('bb_business_data', businessDataStore);

        if (isBusinessScoped) {
            let targetBusinessId = selectedBusiness ? String(selectedBusiness.id || '').trim() : '';
            if (!targetBusinessId || !Object.prototype.hasOwnProperty.call(businessDataStore, targetBusinessId)) {
                targetBusinessId = String((businesses[0] && businesses[0].id) || '').trim();
            }

            selectedBusiness = targetBusinessId ? businesses.find(b => b.id === targetBusinessId) || null : null;
            isBusinessScoped = !!selectedBusiness;
            businessScopedData = isBusinessScoped ? businessDataStore[targetBusinessId] : null;

            if (selectedBusiness) {
                activeBusinessId = selectedBusiness.id;
                localStorage.setItem('activeBusinessId', selectedBusiness.id);
                localStorage.setItem('activeBusinessName', selectedBusiness.name);
                const bcAppEl = document.querySelector('.bc-app');
                if (bcAppEl) bcAppEl.textContent = `BillBhai / ${selectedBusiness.name}`;
            }

            const scoped = businessScopedData || {};
            orders = Array.isArray(scoped.orders) ? cloneRows(scoped.orders) : cloneRows(defaultOrders);
            inventory = Array.isArray(scoped.inventory) ? cloneRows(scoped.inventory) : cloneRows(defaultInventory);
            deliveries = Array.isArray(scoped.deliveries) ? cloneRows(scoped.deliveries) : cloneRows(defaultDeliveries);
            returns = Array.isArray(scoped.returns) ? cloneRows(scoped.returns) : cloneRows(defaultReturns);
            users = Array.isArray(scoped.users) ? cloneRows(scoped.users) : cloneRows(defaultUsers);
            persistOperationalData({ silentSync: true });
            return;
        }

        const useStoredOrders = !!localStorage.getItem('bb_orders');
        const useStoredInventory = !!localStorage.getItem('bb_inventory');
        const useStoredDeliveries = !!localStorage.getItem('bb_deliveries');
        const useStoredReturns = !!localStorage.getItem('bb_returns');
        const useStoredUsers = !!localStorage.getItem('bb_users');

        orders = useStoredOrders ? mergeSeedRecords(loadList('bb_orders', jsonOrders), jsonOrders, 'id') : cloneRows(jsonOrders);
        inventory = useStoredInventory ? mergeSeedRecords(loadList('bb_inventory', jsonInventory), jsonInventory, 'sku') : cloneRows(jsonInventory);
        deliveries = useStoredDeliveries ? mergeSeedRecords(loadList('bb_deliveries', jsonDeliveries), jsonDeliveries, 'id') : cloneRows(jsonDeliveries);
        returns = useStoredReturns ? mergeSeedRecords(loadList('bb_returns', jsonReturns), jsonReturns, 'id') : cloneRows(jsonReturns);
        users = useStoredUsers ? mergeSeedRecords(loadList('bb_users', jsonUsers), jsonUsers, 'name') : cloneRows(jsonUsers);

        persistOperationalData({ silentSync: true });
    }

    const DEFAULT_NOTIFICATIONS = [
        {
            id: 'NOTIF-001',
            title: 'New Order #4821 Received',
            type: 'order',
            time: '2 mins ago',
            desc: 'Order contains 3 items. Total: ₹1250 (Paid via UPI).',
            icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/></svg>',
            color: 'blue',
            iconKey: 'order',
            unread: true,
            changes: [
                { file: 'orders/status', old: 'Pending', new: 'Processing' },
                { file: 'payment/log', old: 'null', new: 'Transaction #TXN-89A (UPI)' }
            ]
        },
        {
            id: 'NOTIF-002',
            title: 'Low Stock Alert: Sugar',
            type: 'alert',
            time: '1 hour ago',
            desc: 'SKU-05 stock level has fallen below threshold. Current stock: 5 units.',
            icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>',
            color: 'red',
            iconKey: 'alert',
            unread: true,
            changes: [
                { file: 'inventory/SKU-05/quantity', old: '15', new: '5' },
                { file: 'inventory/SKU-05/status', old: 'In Stock', new: 'Low Stock' }
            ]
        },
        {
            id: 'NOTIF-003',
            title: 'Delivery Completed',
            type: 'delivery',
            time: '30 mins ago',
            desc: 'ORD-4819 was delivered successfully to Amit Kumar.',
            color: 'green',
            iconKey: 'delivery',
            unread: false,
            changes: [
                { file: 'deliveries/DEL-899/status', old: 'In Transit', new: 'Delivered' }
            ]
        },
        {
            id: 'NOTIF-004',
            title: 'Return Request #RET-108',
            type: 'return',
            time: '1 hour ago',
            desc: 'Suresh Iyer requested a return for Ghee 500ml due to leaking packaging.',
            color: 'amber',
            iconKey: 'return',
            unread: false,
            changes: [
                { file: 'returns/RET-108/status', old: 'Closed', new: 'Pending' }
            ]
        }
    ];

    function normalizeNotificationRecord(raw, index) {
        const safe = raw && typeof raw === 'object' ? raw : {};
        const idx = Number(index) || 0;
        const fallback = DEFAULT_NOTIFICATIONS[idx % DEFAULT_NOTIFICATIONS.length] || DEFAULT_NOTIFICATIONS[0];
        const changes = Array.isArray(safe.changes) ? safe.changes : (Array.isArray(fallback.changes) ? fallback.changes : []);

        return {
            id: String(safe.id || fallback.id || `NOTIF-${String(idx + 1).padStart(3, '0')}`).trim(),
            title: String(safe.title || fallback.title || 'Notification').trim(),
            type: String(safe.type || fallback.type || 'system').trim().toLowerCase(),
            time: String(safe.time || fallback.time || 'Recently').trim(),
            desc: String(safe.desc || fallback.desc || '').trim(),
            icon: typeof safe.icon === 'string' ? safe.icon : (typeof fallback.icon === 'string' ? fallback.icon : ''),
            color: String(safe.color || fallback.color || 'blue').trim().toLowerCase(),
            iconKey: String(safe.iconKey || fallback.iconKey || safe.type || 'order').trim().toLowerCase(),
            unread: Boolean(safe.unread),
            changes: changes.map((change, changeIndex) => {
                const safeChange = change && typeof change === 'object' ? change : {};
                return {
                    file: String(safeChange.file || `changes/${idx + 1}/${changeIndex + 1}`).trim(),
                    old: String(safeChange.old || '-').trim(),
                    new: String(safeChange.new || '-').trim()
                };
            })
        };
    }

    function normalizeNotificationsList(list, fallbackList) {
        const source = Array.isArray(list) && list.length ? list : fallbackList;
        const normalized = Array.isArray(source)
            ? source.map((item, idx) => normalizeNotificationRecord(item, idx))
            : [];
        return normalized.length
            ? normalized
            : DEFAULT_NOTIFICATIONS.map((item, idx) => normalizeNotificationRecord(item, idx));
    }

    let notificationsList = [];

    function getNotificationIcon(notification) {
        const iconKey = String(notification && notification.iconKey || '').trim().toLowerCase();
        if (iconKey === 'alert') return '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>';
        if (iconKey === 'delivery') return '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>';
        if (iconKey === 'return') return '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>';
        if (iconKey === 'user') return '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/></svg>';
        if (iconKey === 'payment') return '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1v22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>';
        return notification && notification.icon
            ? notification.icon
            : '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/></svg>';
    }

    function persistNotifications() {
        notificationsList = normalizeNotificationsList(notificationsList, DEFAULT_NOTIFICATIONS);
        saveList(NOTIFICATIONS_STORAGE_KEY, notificationsList);
        renderNotificationDropdown();
    }

    function renderNotificationDropdown() {
        if (!notifDropdown) return;
        const unreadCount = notificationsList.filter(n => !!n.unread).length;
        const previewItems = notificationsList.slice(0, 3);

        notifDropdown.innerHTML = `
            <div class="dropdown-header">
                <strong>Notifications</strong>
                <div class="text-sm text-muted">${unreadCount ? `You have ${unreadCount} new notifications` : 'All caught up'}</div>
            </div>
            ${previewItems.map(n => `
                <div class="dropdown-item" style="align-items:flex-start; cursor:default;">
                    <div style="background: var(--${n.color || 'blue'}-bg); color: var(--${n.color || 'blue'}); padding: 6px; border-radius: 6px; margin-right: 4px;">
                        ${getNotificationIcon(n)}
                    </div>
                    <div>
                        <div style="font-weight: 600; font-size: 0.8rem; color: var(--text-primary);">${n.title}</div>
                        <div class="text-sm text-muted">${n.time}</div>
                    </div>
                </div>
            `).join('')}
            <div class="dropdown-divider"></div>
            <a href="notifications.html" class="dropdown-item nav-item" data-page="notifications" style="justify-content:center;font-weight:500;color:var(--accent);">View all notifications</a>
        `;

        document.querySelectorAll('.notif-dot').forEach(dot => {
            dot.style.display = unreadCount ? '' : 'none';
        });
    }

    renderNotificationDropdown();

    function getNotificationPreferenceConfig(roleKey) {
        return ROLE_NOTIFICATION_CONFIG[roleKey] || ROLE_NOTIFICATION_CONFIG.customer;
    }

    function normalizeNotificationPreferences(savedPreferences, roleKey) {
        const config = getNotificationPreferenceConfig(roleKey);
        const safe = savedPreferences && typeof savedPreferences === 'object' ? savedPreferences : {};
        const next = {};
        config.forEach(item => {
            next[item.key] = typeof safe[item.key] === 'boolean'
                ? safe[item.key]
                : item.defaultEnabled !== false;
        });
        return next;
    }

    function getNotificationCategoryLabel(category) {
        return NOTIFICATION_CATEGORY_LABELS[category] || 'Notification';
    }

    function getNotificationPriorityRank(priority) {
        const value = String(priority || 'medium').trim().toLowerCase();
        if (value === 'critical') return 4;
        if (value === 'high') return 3;
        if (value === 'medium') return 2;
        return 1;
    }

    function formatRelativeTime(timestamp) {
        const numeric = Number(timestamp);
        if (!Number.isFinite(numeric) || numeric <= 0) return 'Current snapshot';
        const diffMs = Math.max(0, Date.now() - numeric);
        const diffMins = Math.round(diffMs / 60000);
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} min ago`;
        const diffHours = Math.round(diffMins / 60);
        if (diffHours < 24) return `${diffHours} hr ago`;
        const diffDays = Math.round(diffHours / 24);
        return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
    }

    function getNotificationColor(category, priority) {
        const normalizedCategory = String(category || '').trim().toLowerCase();
        const normalizedPriority = String(priority || '').trim().toLowerCase();
        if (normalizedPriority === 'critical') return 'red';
        if (normalizedCategory === 'payments') return 'green';
        if (normalizedCategory === 'inventory') return 'amber';
        if (normalizedCategory === 'delivery') return 'blue';
        if (normalizedCategory === 'returns') return 'amber';
        if (normalizedCategory === 'users' || normalizedCategory === 'businesses') return 'purple';
        return 'blue';
    }

    function getNotificationIconKeyForCategory(category) {
        const normalized = String(category || '').trim().toLowerCase();
        if (normalized === 'payments') return 'payment';
        if (normalized === 'inventory') return 'alert';
        if (normalized === 'delivery') return 'delivery';
        if (normalized === 'returns') return 'return';
        if (normalized === 'users' || normalized === 'businesses') return 'user';
        return 'order';
    }

    function makeNotificationRecord(record) {
        const safe = record && typeof record === 'object' ? record : {};
        const category = String(safe.category || 'orders').trim().toLowerCase();
        const priority = String(safe.priority || 'medium').trim().toLowerCase();
        const sortTimeMs = Number(safe.sortTimeMs) || Date.now();
        const detailRows = Array.isArray(safe.detailRows)
            ? safe.detailRows
                .map(row => ({
                    label: String(row && row.label || '').trim(),
                    value: String(row && row.value || '-').trim() || '-'
                }))
                .filter(row => row.label)
            : [];

        return {
            id: String(safe.id || `notif-${Math.random().toString(36).slice(2)}`).trim(),
            title: String(safe.title || 'Notification').trim(),
            desc: String(safe.desc || '').trim(),
            category,
            color: String(safe.color || getNotificationColor(category, priority)).trim().toLowerCase(),
            iconKey: String(safe.iconKey || getNotificationIconKeyForCategory(category)).trim().toLowerCase(),
            priority,
            priorityRank: getNotificationPriorityRank(priority),
            sortTimeMs,
            time: String(safe.time || formatRelativeTime(sortTimeMs)).trim(),
            detailRows,
            defaultUnread: safe.defaultUnread !== false
        };
    }

    function parseMonthEntry(monthLabel, fallbackIndex) {
        const raw = String(monthLabel || '').trim();
        if (!raw) return Date.now() - (Number(fallbackIndex) || 0) * 86400000;
        const parsed = new Date(`01 ${raw}`);
        if (!Number.isNaN(parsed.getTime())) return parsed.getTime();
        return Date.now() - (Number(fallbackIndex) || 0) * 86400000;
    }

    function getActiveBusinessRecord() {
        if (selectedBusiness) return selectedBusiness;
        const scopedId = String(localStorage.getItem('activeBusinessId') || '').trim();
        return businesses.find(item => item.id === scopedId) || businesses[0] || null;
    }

    function getNotificationAudienceKey() {
        const currentUser = loadObject('currentUser', {});
        const username = String(currentUser.username || localStorage.getItem('userName') || activeRoleKey || 'user')
            .trim()
            .toLowerCase()
            .replace(/\s+/g, '-');

        if (activeRoleKey === 'customer') {
            const sessionId = String(sessionStorage.getItem('bb_customer_session_id') || 'customer-session').trim();
            return `${activeRoleKey}::${username}::${sessionId}`;
        }

        const businessScope = activeRoleKey === 'superuser'
            ? 'all-businesses'
            : String((getActiveBusinessRecord() && getActiveBusinessRecord().id) || localStorage.getItem('activeBusinessId') || 'global').trim();

        return `${activeRoleKey}::${username}::${businessScope}`;
    }

    function loadNotificationState() {
        const store = loadObject(NOTIFICATION_STATE_STORAGE_KEY, {});
        const key = getNotificationAudienceKey();
        const saved = store[key] && typeof store[key] === 'object' ? store[key] : {};
        const readMap = saved.readMap && typeof saved.readMap === 'object' && !Array.isArray(saved.readMap)
            ? saved.readMap
            : {};
        return { key, readMap };
    }

    function saveNotificationState(state) {
        const safe = state && typeof state === 'object' ? state : {};
        const store = loadObject(NOTIFICATION_STATE_STORAGE_KEY, {});
        const key = String(safe.key || getNotificationAudienceKey()).trim() || getNotificationAudienceKey();
        store[key] = {
            readMap: safe.readMap && typeof safe.readMap === 'object' ? safe.readMap : {}
        };
        saveObject(NOTIFICATION_STATE_STORAGE_KEY, store);
    }

    function setNotificationReadState(notificationId, isRead) {
        const id = String(notificationId || '').trim();
        if (!id) return;
        const state = loadNotificationState();
        state.readMap[id] = Boolean(isRead);
        saveNotificationState(state);
    }

    function markNotificationsRead(ids, isRead) {
        const state = loadNotificationState();
        (Array.isArray(ids) ? ids : []).forEach(id => {
            const safeId = String(id || '').trim();
            if (!safeId) return;
            state.readMap[safeId] = Boolean(isRead);
        });
        saveNotificationState(state);
    }

    function loadCustomerSessionNotifications() {
        try {
            const raw = sessionStorage.getItem(CUSTOMER_SESSION_NOTIFICATION_KEY);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch (err) {
            return [];
        }
    }

    function getBusinessDataForNotifications(business, fallbackIndex) {
        const idx = Number(fallbackIndex) || 0;
        const seed = buildBusinessSeedData(business, idx);
        const source = businessDataStore[business.id] && typeof businessDataStore[business.id] === 'object'
            ? businessDataStore[business.id]
            : seed;

        return {
            orders: Array.isArray(source.orders) ? source.orders : seed.orders,
            inventory: Array.isArray(source.inventory) ? source.inventory : seed.inventory,
            deliveries: Array.isArray(source.deliveries) ? source.deliveries : seed.deliveries,
            returns: Array.isArray(source.returns) ? source.returns : seed.returns,
            users: Array.isArray(source.users) ? source.users : seed.users
        };
    }

    function getNotificationContexts() {
        if (activeRoleKey === 'superuser') {
            return businesses.map((business, index) => ({
                business,
                data: getBusinessDataForNotifications(business, index)
            }));
        }

        const business = getActiveBusinessRecord();
        if (!business) return [];

        return [{
            business,
            data: {
                orders,
                inventory,
                deliveries,
                returns,
                users
            }
        }];
    }

    function createOrderNotification(order, business, category, priority) {
        const parsed = parseOrderDate(order && order.date);
        const status = normalizeOrderStatus(order && order.status);
        return makeNotificationRecord({
            id: `order:${business ? business.id : 'global'}:${order.id}:${status}`,
            category: category || 'orders',
            priority: priority || (status === 'Cancelled' ? 'high' : (status === 'Pending' ? 'medium' : 'low')),
            title: `${order.id} is ${status.toLowerCase()}`,
            desc: `${order.customer} • Rs ${Math.max(0, Number(order.total || 0)).toLocaleString()} • ${order.payment || 'Pending payment'}`,
            sortTimeMs: parsed ? parsed.getTime() : Date.now(),
            detailRows: [
                { label: 'Business', value: business ? business.name : '-' },
                { label: 'Order', value: String(order.id || '-') },
                { label: 'Customer', value: String(order.customer || '-') },
                { label: 'Status', value: status },
                { label: 'Payment', value: String(order.payment || 'Pending') },
                { label: 'Total', value: `Rs ${Math.max(0, Number(order.total || 0)).toLocaleString()}` }
            ]
        });
    }

    function createPaymentNotification(source, business, fallbackIndex) {
        if (source && source.id && source.customer) {
            const parsed = parseOrderDate(source && source.date);
            return makeNotificationRecord({
                id: `payment:${business ? business.id : 'global'}:${source.id}:${source.payment || 'pending'}`,
                category: 'payments',
                priority: String(source.payment || '').trim().toLowerCase() === 'pending' ? 'high' : 'low',
                title: `Payment update for ${source.id}`,
                desc: `${source.customer} paid via ${source.payment || 'Pending'} for Rs ${Math.max(0, Number(source.total || 0)).toLocaleString()}.`,
                sortTimeMs: parsed ? parsed.getTime() : Date.now() - (Number(fallbackIndex) || 0) * 1000,
                detailRows: [
                    { label: 'Business', value: business ? business.name : '-' },
                    { label: 'Order', value: String(source.id || '-') },
                    { label: 'Customer', value: String(source.customer || '-') },
                    { label: 'Mode', value: String(source.payment || 'Pending') },
                    { label: 'Amount', value: `Rs ${Math.max(0, Number(source.total || 0)).toLocaleString()}` }
                ]
            });
        }

        const monthLabel = String(source && source.month || 'Current cycle').trim();
        const status = String(source && source.status || 'Due').trim();
        const amount = Math.max(0, Number(source && source.amount || business && business.paymentDue || 0));
        return makeNotificationRecord({
            id: `payment:${business ? business.id : 'global'}:${monthLabel}:${status}:${amount}`,
            category: 'payments',
            priority: status.toLowerCase() === 'paid' ? 'low' : 'high',
            title: `${business ? business.name : 'Business'} billing is ${status.toLowerCase()}`,
            desc: `${monthLabel} billing cycle shows Rs ${amount.toLocaleString()} as ${status.toLowerCase()}.`,
            sortTimeMs: parseMonthEntry(monthLabel, fallbackIndex),
            detailRows: [
                { label: 'Business', value: business ? business.name : '-' },
                { label: 'Billing Cycle', value: monthLabel },
                { label: 'Amount', value: `Rs ${amount.toLocaleString()}` },
                { label: 'Status', value: status },
                { label: 'Plan', value: String(business && business.productsPlan || '-') }
            ]
        });
    }

    function createInventoryNotification(item, business, fallbackIndex) {
        const status = normalizeInventoryStatus(item && item.status, item && item.stock);
        const supplier = getSupplierDetails(item);
        const stock = Math.max(0, Number(item && item.stock) || 0);
        const priority = status === 'Out of Stock' || status === 'Critical'
            ? 'critical'
            : (status === 'Low Stock' ? 'high' : 'low');

        return makeNotificationRecord({
            id: `inventory:${business ? business.id : 'global'}:${item.sku}:${status}:${stock}`,
            category: 'inventory',
            priority,
            title: `${status}: ${item.name}`,
            desc: `${item.sku} is at ${stock} units. Supplier ${supplier.name} needs ${supplier.leadTimeDays} day${supplier.leadTimeDays === 1 ? '' : 's'} lead time.`,
            sortTimeMs: Date.now() - (Number(fallbackIndex) || 0) * 60000,
            detailRows: [
                { label: 'Business', value: business ? business.name : '-' },
                { label: 'SKU', value: String(item.sku || '-') },
                { label: 'Product', value: String(item.name || '-') },
                { label: 'Category', value: String(item.cat || '-') },
                { label: 'Stock', value: String(stock) },
                { label: 'Status', value: status },
                { label: 'Supplier', value: supplier.name },
                { label: 'Lead Time', value: `${supplier.leadTimeDays} days` }
            ]
        });
    }

    function createDeliveryNotification(item, business, fallbackIndex) {
        const partner = getDeliveryPartnerDetails(item);
        const status = normalizeDeliveryStatus(item && item.status);
        const parsed = parseOrderDate(item && (item.updatedAt || item.time));
        const priority = status === 'Failed' || partner.name === 'Unassigned'
            ? 'critical'
            : (status === 'Pending' ? 'high' : (status === 'In Transit' ? 'medium' : 'low'));

        return makeNotificationRecord({
            id: `delivery:${business ? business.id : 'global'}:${item.id}:${status}:${partner.name}`,
            category: 'delivery',
            priority,
            title: `${item.id} is ${status.toLowerCase()}`,
            desc: `${item.customer} • ${partner.name} • ${item.address || 'Address pending'}`,
            sortTimeMs: parsed ? parsed.getTime() : Date.now() - (Number(fallbackIndex) || 0) * 1000,
            detailRows: [
                { label: 'Business', value: business ? business.name : '-' },
                { label: 'Delivery', value: String(item.id || '-') },
                { label: 'Order', value: String(item.oid || '-') },
                { label: 'Customer', value: String(item.customer || '-') },
                { label: 'Status', value: status },
                { label: 'Partner', value: partner.name },
                { label: 'Partner Phone', value: partner.phone },
                { label: 'ETA', value: item.etaMin === null ? '-' : `${Math.max(0, Math.round(item.etaMin))} min` },
                { label: 'Address', value: String(item.address || '-') }
            ]
        });
    }

    function createReturnNotification(item, business, fallbackIndex) {
        const parsed = parseOrderDate(item && item.updatedAt);
        const status = String(item && item.status || 'Pending').trim() || 'Pending';
        const priority = status.toLowerCase().includes('pending')
            ? 'high'
            : (status.toLowerCase().includes('approve') ? 'medium' : 'low');

        return makeNotificationRecord({
            id: `return:${business ? business.id : 'global'}:${item.id}:${status}`,
            category: 'returns',
            priority,
            title: `${item.id} is ${status.toLowerCase()}`,
            desc: `${item.product} for ${item.customer} • ${item.reason} • Rs ${Math.max(0, Number(item.amount || 0)).toLocaleString()}`,
            sortTimeMs: parsed ? parsed.getTime() : Date.now() - (Number(fallbackIndex) || 0) * 1000,
            detailRows: [
                { label: 'Business', value: business ? business.name : '-' },
                { label: 'Return', value: String(item.id || '-') },
                { label: 'Order', value: String(item.oid || '-') },
                { label: 'Customer', value: String(item.customer || '-') },
                { label: 'Product', value: String(item.product || '-') },
                { label: 'Reason', value: String(item.reason || '-') },
                { label: 'Status', value: status },
                { label: 'Requested By', value: String(item.requestedBy || '-') },
                { label: 'Amount', value: `Rs ${Math.max(0, Number(item.amount || 0)).toLocaleString()}` }
            ]
        });
    }

    function createBusinessNotification(business, fallbackIndex) {
        return makeNotificationRecord({
            id: `business:${business.id}:${business.status}:${business.paymentDue || 0}`,
            category: 'businesses',
            priority: String(business.status || '').toLowerCase() === 'active' ? 'low' : 'high',
            title: `${business.name} is ${String(business.status || 'Active').toLowerCase()}`,
            desc: `${business.productsPlan || 'Plan pending'} • ${business.storesCount || 0} stores • Rs ${Math.max(0, Number(business.paymentDue || 0)).toLocaleString()} due`,
            sortTimeMs: Date.now() - (Number(fallbackIndex) || 0) * 120000,
            detailRows: [
                { label: 'Business', value: business.name },
                { label: 'Owner', value: String(business.owner || '-') },
                { label: 'Status', value: String(business.status || '-') },
                { label: 'Plan', value: String(business.productsPlan || '-') },
                { label: 'Stores', value: String(business.storesCount || 0) },
                { label: 'Payment Due', value: `Rs ${Math.max(0, Number(business.paymentDue || 0)).toLocaleString()}` }
            ]
        });
    }

    function createUserSummaryNotification(business, userRows, fallbackIndex) {
        const rows = Array.isArray(userRows) ? userRows : [];
        const activeCount = rows.filter(item => String(item && item.status || '').trim().toLowerCase() === 'active').length;
        const inactiveCount = Math.max(0, rows.length - activeCount);
        return makeNotificationRecord({
            id: `users:${business ? business.id : 'global'}:${activeCount}:${inactiveCount}`,
            category: 'users',
            priority: inactiveCount ? 'high' : 'low',
            title: `${business ? business.name : 'Team'} roster snapshot`,
            desc: `${activeCount} active staff${inactiveCount ? `, ${inactiveCount} inactive` : ''}.`,
            sortTimeMs: Date.now() - (Number(fallbackIndex) || 0) * 240000,
            detailRows: [
                { label: 'Business', value: business ? business.name : '-' },
                { label: 'Total Team Members', value: String(rows.length) },
                { label: 'Active', value: String(activeCount) },
                { label: 'Inactive', value: String(inactiveCount) }
            ]
        });
    }

    function createSummaryNotification(title, desc, detailRows, priority, fallbackIndex) {
        return makeNotificationRecord({
            id: `summary:${title.replace(/\s+/g, '-').toLowerCase()}`,
            category: 'summary',
            priority: priority || 'low',
            title,
            desc,
            sortTimeMs: Date.now() - (Number(fallbackIndex) || 0) * 300000,
            detailRows: Array.isArray(detailRows) ? detailRows : []
        });
    }

    function generateSuperuserNotifications() {
        const contexts = getNotificationContexts();
        const list = [];
        let activeBusinesses = 0;
        let dueAmountTotal = 0;

        contexts.forEach((context, index) => {
            const business = context.business;
            const data = context.data;
            if (String(business.status || '').trim().toLowerCase() === 'active') activeBusinesses += 1;
            dueAmountTotal += Math.max(0, Number(business.paymentDue || 0));

            list.push(createBusinessNotification(business, index));
            if (Number(business.paymentDue || 0) > 0) {
                list.push(createPaymentNotification({
                    month: 'Current billing cycle',
                    amount: business.paymentDue,
                    status: 'Due'
                }, business, index));
            }

            if (Array.isArray(business.payments)) {
                business.payments
                    .filter(payment => String(payment.status || '').trim().toLowerCase() !== 'paid')
                    .slice(0, 2)
                    .forEach((payment, paymentIndex) => {
                        list.push(createPaymentNotification(payment, business, (index * 5) + paymentIndex));
                    });
            }

            list.push(createUserSummaryNotification(business, data.users, index));

            data.orders
                .slice()
                .sort((a, b) => (parseOrderDate(b && b.date)?.getTime() || 0) - (parseOrderDate(a && a.date)?.getTime() || 0))
                .slice(0, 2)
                .forEach(order => list.push(createOrderNotification(order, business, 'orders', 'medium')));

            data.inventory
                .filter(item => normalizeInventoryStatus(item && item.status, item && item.stock) !== 'In Stock')
                .sort((a, b) => Math.max(0, Number(a && a.stock || 0)) - Math.max(0, Number(b && b.stock || 0)))
                .slice(0, 2)
                .forEach((item, itemIndex) => list.push(createInventoryNotification(item, business, (index * 2) + itemIndex)));

            const deliveryRows = (Array.isArray(data.deliveries) ? data.deliveries : [])
                .map(item => {
                    const order = (Array.isArray(data.orders) ? data.orders : []).find(orderRow => orderRow.id === item.oid);
                    return {
                        ...item,
                        customer: String(item.customer || (order && order.customer) || '').trim() || '-'
                    };
                })
                .filter(item => {
                    const status = normalizeDeliveryStatus(item && item.status);
                    const partner = String(item && item.partner || '').trim() || 'Unassigned';
                    return status !== 'Delivered' || partner === 'Unassigned';
                })
                .slice(0, 2);
            deliveryRows.forEach((item, itemIndex) => list.push(createDeliveryNotification(item, business, (index * 2) + itemIndex)));

            const returnRows = (Array.isArray(data.returns) ? data.returns : [])
                .map(item => {
                    const order = (Array.isArray(data.orders) ? data.orders : []).find(orderRow => orderRow.id === item.oid);
                    return {
                        ...item,
                        customer: String((order && order.customer) || '').trim() || '-'
                    };
                })
                .filter(item => String(item.status || '').trim().toLowerCase().includes('pending'))
                .slice(0, 2);
            returnRows.forEach((item, itemIndex) => list.push(createReturnNotification(item, business, (index * 2) + itemIndex)));
        });

        list.push(createSummaryNotification(
            'Portfolio snapshot',
            `${contexts.length} businesses tracked, ${activeBusinesses} active, Rs ${dueAmountTotal.toLocaleString()} due.`,
            [
                { label: 'Total Businesses', value: String(contexts.length) },
                { label: 'Active Businesses', value: String(activeBusinesses) },
                { label: 'Outstanding Due', value: `Rs ${dueAmountTotal.toLocaleString()}` }
            ],
            dueAmountTotal > 0 ? 'high' : 'low',
            0
        ));

        return list;
    }

    function generateAdminNotifications() {
        const context = getNotificationContexts()[0];
        if (!context) return [];

        const business = context.business;
        const data = context.data;
        const list = [];
        const inventoryAlerts = data.inventory.filter(item => normalizeInventoryStatus(item && item.status, item && item.stock) !== 'In Stock');
        const activeDeliveries = data.deliveries.filter(item => {
            const status = normalizeDeliveryStatus(item && item.status);
            return status === 'Pending' || status === 'In Transit' || status === 'Failed';
        });
        const pendingReturns = data.returns.filter(item => String(item && item.status || '').trim().toLowerCase().includes('pending')).length;

        list.push(createSummaryNotification(
            `${business.name} operations snapshot`,
            `${data.orders.length} orders, ${inventoryAlerts.length} stock alerts, ${activeDeliveries.length} active deliveries, ${pendingReturns} pending returns.`,
            [
                { label: 'Business', value: business.name },
                { label: 'Orders', value: String(data.orders.length) },
                { label: 'Inventory Alerts', value: String(inventoryAlerts.length) },
                { label: 'Active Deliveries', value: String(activeDeliveries.length) },
                { label: 'Pending Returns', value: String(pendingReturns) }
            ],
            (inventoryAlerts.length || activeDeliveries.length || pendingReturns) ? 'high' : 'low',
            0
        ));

        if (Number(business.paymentDue || 0) > 0) {
            list.push(createPaymentNotification({
                month: 'Current billing cycle',
                amount: business.paymentDue,
                status: 'Due'
            }, business, 0));
        }

        data.orders
            .slice()
            .sort((a, b) => (parseOrderDate(b && b.date)?.getTime() || 0) - (parseOrderDate(a && a.date)?.getTime() || 0))
            .slice(0, 8)
            .forEach((order, index) => list.push(createOrderNotification(order, business, 'orders', index < 3 ? 'medium' : 'low')));

        data.orders
            .slice()
            .sort((a, b) => (parseOrderDate(b && b.date)?.getTime() || 0) - (parseOrderDate(a && a.date)?.getTime() || 0))
            .slice(0, 4)
            .forEach((order, index) => list.push(createPaymentNotification(order, business, index)));

        inventoryAlerts
            .sort((a, b) => Math.max(0, Number(a && a.stock || 0)) - Math.max(0, Number(b && b.stock || 0)))
            .slice(0, 8)
            .forEach((item, index) => list.push(createInventoryNotification(item, business, index)));

        activeDeliveries
            .slice(0, 8)
            .forEach((item, index) => {
                const order = data.orders.find(orderRow => orderRow.id === item.oid);
                list.push(createDeliveryNotification({
                    ...item,
                    customer: String(item.customer || (order && order.customer) || '').trim() || '-'
                }, business, index));
            });

        data.returns
            .slice()
            .sort((a, b) => (parseOrderDate(b && b.updatedAt)?.getTime() || 0) - (parseOrderDate(a && a.updatedAt)?.getTime() || 0))
            .slice(0, 8)
            .forEach((item, index) => {
                const order = data.orders.find(orderRow => orderRow.id === item.oid);
                list.push(createReturnNotification({
                    ...item,
                    customer: String((order && order.customer) || '').trim() || '-'
                }, business, index));
            });

        list.push(createUserSummaryNotification(business, data.users, 0));
        return list;
    }

    function generateCashierNotifications() {
        const context = getNotificationContexts()[0];
        if (!context) return [];
        const business = context.business;
        const data = context.data;
        const list = [];

        data.orders
            .slice()
            .sort((a, b) => (parseOrderDate(b && b.date)?.getTime() || 0) - (parseOrderDate(a && a.date)?.getTime() || 0))
            .slice(0, 6)
            .forEach((order, index) => list.push(createOrderNotification(order, business, 'orders', index < 2 ? 'medium' : 'low')));

        data.orders
            .slice()
            .sort((a, b) => (parseOrderDate(b && b.date)?.getTime() || 0) - (parseOrderDate(a && a.date)?.getTime() || 0))
            .slice(0, 4)
            .forEach((order, index) => list.push(createPaymentNotification(order, business, index)));

        data.returns
            .filter(item => {
                const status = String(item && item.status || '').trim().toLowerCase();
                return status.includes('approve') || status.includes('refund') || status.includes('reject');
            })
            .slice(0, 6)
            .forEach((item, index) => {
                const order = data.orders.find(orderRow => orderRow.id === item.oid);
                list.push(createReturnNotification({
                    ...item,
                    customer: String((order && order.customer) || '').trim() || '-'
                }, business, index));
            });

        return list;
    }

    function generateInventoryManagerNotifications() {
        const context = getNotificationContexts()[0];
        if (!context) return [];
        const business = context.business;
        const alerts = context.data.inventory
            .filter(item => normalizeInventoryStatus(item && item.status, item && item.stock) !== 'In Stock')
            .sort((a, b) => Math.max(0, Number(a && a.stock || 0)) - Math.max(0, Number(b && b.stock || 0)));

        const list = [
            createSummaryNotification(
                `${business.name} stock snapshot`,
                `${alerts.length} SKUs need attention in inventory.`,
                [
                    { label: 'Business', value: business.name },
                    { label: 'SKUs needing action', value: String(alerts.length) }
                ],
                alerts.length ? 'high' : 'low',
                0
            )
        ];

        alerts.slice(0, 10).forEach((item, index) => list.push(createInventoryNotification(item, business, index)));
        return list;
    }

    function generateDeliveryOpsNotifications() {
        const context = getNotificationContexts()[0];
        if (!context) return [];
        const business = context.business;
        const activeRows = context.data.deliveries
            .map(item => {
                const order = context.data.orders.find(orderRow => orderRow.id === item.oid);
                return {
                    ...item,
                    customer: String(item.customer || (order && order.customer) || '').trim() || '-'
                };
            })
            .sort((a, b) => (parseOrderDate(b && (b.updatedAt || b.time))?.getTime() || 0) - (parseOrderDate(a && (a.updatedAt || a.time))?.getTime() || 0));

        const actionable = activeRows.filter(item => {
            const status = normalizeDeliveryStatus(item && item.status);
            const partner = String(item && item.partner || '').trim() || 'Unassigned';
            return status !== 'Delivered' || partner === 'Unassigned';
        });

        const list = [
            createSummaryNotification(
                `${business.name} delivery queue`,
                `${actionable.length} deliveries still need active attention.`,
                [
                    { label: 'Business', value: business.name },
                    { label: 'Actionable Deliveries', value: String(actionable.length) }
                ],
                actionable.length ? 'high' : 'low',
                0
            )
        ];

        actionable.slice(0, 10).forEach((item, index) => list.push(createDeliveryNotification(item, business, index)));
        return list;
    }

    function generateReturnHandlerNotifications() {
        const context = getNotificationContexts()[0];
        if (!context) return [];
        const business = context.business;
        const rows = context.data.returns
            .map(item => {
                const order = context.data.orders.find(orderRow => orderRow.id === item.oid);
                return {
                    ...item,
                    customer: String((order && order.customer) || '').trim() || '-'
                };
            })
            .sort((a, b) => (parseOrderDate(b && b.updatedAt)?.getTime() || 0) - (parseOrderDate(a && a.updatedAt)?.getTime() || 0));

        const pendingCount = rows.filter(item => String(item.status || '').trim().toLowerCase().includes('pending')).length;
        const list = [
            createSummaryNotification(
                `${business.name} returns desk`,
                `${pendingCount} returns are still pending review.`,
                [
                    { label: 'Business', value: business.name },
                    { label: 'Pending Returns', value: String(pendingCount) },
                    { label: 'Total Returns', value: String(rows.length) }
                ],
                pendingCount ? 'high' : 'low',
                0
            )
        ];

        rows.slice(0, 10).forEach((item, index) => list.push(createReturnNotification(item, business, index)));
        return list;
    }

    function generateCustomerNotifications() {
        return loadCustomerSessionNotifications()
            .map((item, index) => makeNotificationRecord({
                ...item,
                id: String(item && item.id || `customer-session-${index + 1}`).trim(),
                category: String(item && item.category || 'orders').trim().toLowerCase(),
                priority: String(item && item.priority || 'medium').trim().toLowerCase(),
                sortTimeMs: Number(item && item.sortTimeMs) || Date.now() - index * 1000,
                detailRows: Array.isArray(item && item.detailRows) ? item.detailRows : []
            }));
    }

    function getDerivedNotifications() {
        if (activeRoleKey === 'superuser') return generateSuperuserNotifications();
        if (activeRoleKey === 'admin') return generateAdminNotifications();
        if (activeRoleKey === 'cashier') return generateCashierNotifications();
        if (activeRoleKey === 'inventorymanager') return generateInventoryManagerNotifications();
        if (activeRoleKey === 'deliveryops') return generateDeliveryOpsNotifications();
        if (activeRoleKey === 'returnhandler') return generateReturnHandlerNotifications();
        if (activeRoleKey === 'customer') return generateCustomerNotifications();
        return [];
    }

    function getActiveNotifications() {
        const state = loadNotificationState();
        const preferences = loadProfileSettingsRecord().notifications;
        return getDerivedNotifications()
            .filter(item => preferences[item.category] !== false)
            .map(item => {
                const hasSavedState = Object.prototype.hasOwnProperty.call(state.readMap, item.id);
                return {
                    ...item,
                    unread: hasSavedState ? !Boolean(state.readMap[item.id]) : Boolean(item.defaultUnread)
                };
            })
            .sort((a, b) => {
                if (b.priorityRank !== a.priorityRank) return b.priorityRank - a.priorityRank;
                return (b.sortTimeMs || 0) - (a.sortTimeMs || 0);
            });
    }

    function renderNotificationDropdown() {
        if (!notifDropdown) return;
        let notifications = [];
        try {
            notifications = getActiveNotifications();
        } catch (err) {
            console.error('Failed to build notifications.', err);
            notifications = [];
        }
        const unreadCount = notifications.filter(item => item.unread).length;
        const previewItems = notifications.slice(0, 3);

        notifDropdown.innerHTML = `
            <div class="dropdown-header">
                <strong>Notifications</strong>
                <div class="text-sm text-muted">${unreadCount ? `You have ${unreadCount} new notifications` : 'All caught up'}</div>
            </div>
            ${previewItems.length ? previewItems.map(item => `
                <div class="dropdown-item" style="align-items:flex-start; cursor:default;">
                    <div style="background: var(--${item.color || 'blue'}-bg); color: var(--${item.color || 'blue'}); padding: 6px; border-radius: 6px; margin-right: 4px;">
                        ${getNotificationIcon(item)}
                    </div>
                    <div>
                        <div style="font-weight: 600; font-size: 0.8rem; color: var(--text-primary);">${item.title}</div>
                        <div class="text-sm text-muted">${item.time}</div>
                    </div>
                </div>
            `).join('') : '<div class="dropdown-item text-muted" style="cursor:default;">No notifications for this role right now.</div>'}
            <div class="dropdown-divider"></div>
            <a href="notifications.html" class="dropdown-item nav-item" data-page="notifications" style="justify-content:center;font-weight:500;color:var(--accent);">View all notifications</a>
        `;

        document.querySelectorAll('.notif-dot').forEach(dot => {
            dot.style.display = unreadCount ? '' : 'none';
        });
    }

    // Helpers
    function badge(txt, type) {
        const safeType = String(type || txt || 'default').toLowerCase().replace(/[^a-z0-9]+/g, '');
        return `<span class="badge b-${safeType || 'default'}">${txt}</span>`;
    }
    function statusBadge(s) { return badge(s, s.toLowerCase().replace(/ /g, '')); }
    function table(hdrs, rows) { return `<div class="tbl-wrap"><table class="dt"><thead><tr>${hdrs.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>`; }

    function normalizeDeliveryStatus(status) {
        const raw = String(status || '').trim().toLowerCase();
        if (!raw) return 'Pending';
        if (raw.includes('deliver')) return 'Delivered';
        if (raw.includes('out for') || raw.includes('transit') || raw.includes('dispatch') || raw.includes('processing')) return 'In Transit';
        if (raw.includes('fail') || raw.includes('cancel')) return 'Failed';
        if (raw.includes('pending')) return 'Pending';
        return 'Pending';
    }

    function normalizeOrderStatus(status) {
        const raw = String(status || '').trim().toLowerCase();
        if (!raw) return 'Pending';
        if (raw.includes('deliver')) return 'Delivered';
        if (raw.includes('process') || raw.includes('transit') || raw.includes('dispatch')) return 'Processing';
        if (raw.includes('cancel') || raw.includes('fail')) return 'Cancelled';
        if (raw.includes('pending')) return 'Pending';
        return 'Pending';
    }

    function normalizeInventoryStatus(status, stockValue) {
        const stock = Number.isFinite(Number(stockValue)) ? Number(stockValue) : 0;
        const raw = String(status || '').trim().toLowerCase();
        if (raw.includes('out')) return 'Out of Stock';
        if (raw.includes('critical')) return 'Critical';
        if (raw.includes('low')) return 'Low Stock';
        if (raw.includes('in stock') || raw.includes('available') || raw.includes('active')) {
            if (stock <= 0) return 'Out of Stock';
            if (stock <= 10) return 'Critical';
            if (stock <= 30) return 'Low Stock';
            return 'In Stock';
        }
        if (stock <= 0) return 'Out of Stock';
        if (stock <= 10) return 'Critical';
        if (stock <= 30) return 'Low Stock';
        return 'In Stock';
    }

    function getInventoryMetrics() {
        const metrics = {
            totalSkus: inventory.length,
            totalUnits: 0,
            inStock: 0,
            lowStock: 0,
            critical: 0,
            outOfStock: 0,
            alerts: 0
        };

        inventory.forEach(item => {
            const stock = Math.max(0, Number(item && item.stock) || 0);
            const status = normalizeInventoryStatus(item && item.status, stock);
            metrics.totalUnits += stock;
            if (status === 'Out of Stock') metrics.outOfStock += 1;
            else if (status === 'Critical') metrics.critical += 1;
            else if (status === 'Low Stock') metrics.lowStock += 1;
            else metrics.inStock += 1;
        });

        metrics.alerts = metrics.lowStock + metrics.critical + metrics.outOfStock;
        return metrics;
    }

    function parseOrderDate(dateText) {
        const raw = String(dateText || '').trim();
        if (!raw) return null;

        const nativeParsed = new Date(raw);
        if (!Number.isNaN(nativeParsed.getTime())) return nativeParsed;

        const match = raw.match(/^(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{1,2}):(\d{2})$/);
        if (!match) return null;

        const day = Number(match[1]);
        const monthLabel = match[2].slice(0, 3).toLowerCase();
        const monthMap = {
            jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
            jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
        };
        const month = monthMap[monthLabel];
        if (month === undefined) return null;

        const hours = Number(match[3]);
        const minutes = Number(match[4]);
        const now = new Date();
        const inferred = new Date(now.getFullYear(), month, day, hours, minutes, 0, 0);

        if (inferred.getTime() > now.getTime() + 1000 * 60 * 60 * 24) {
            inferred.setFullYear(inferred.getFullYear() - 1);
        }
        return inferred;
    }

    function startOfDay(date) {
        const day = new Date(date);
        day.setHours(0, 0, 0, 0);
        return day;
    }

    function startOfWeek(date) {
        const week = startOfDay(date);
        const day = week.getDay();
        const diff = day === 0 ? -6 : 1 - day;
        week.setDate(week.getDate() + diff);
        return week;
    }

    function getOrderTimelineEntries() {
        return orders
            .map(order => {
                const parsed = parseOrderDate(order && order.date);
                if (!parsed) return null;
                return {
                    date: parsed,
                    total: Math.max(0, Number(order && order.total) || 0)
                };
            })
            .filter(Boolean);
    }

    function buildRevenueTrendDays(dayCount) {
        const count = Math.max(1, Number(dayCount) || 7);
        const now = startOfDay(new Date());
        const labels = [];
        const values = [];
        const totalsByDay = new Map();
        const timelineEntries = getOrderTimelineEntries();

        timelineEntries.forEach(entry => {
            const dayStart = startOfDay(entry.date);
            const key = dayStart.toISOString().slice(0, 10);
            totalsByDay.set(key, (totalsByDay.get(key) || 0) + entry.total);
        });

        let anchorDay = new Date(now);
        if (timelineEntries.length) {
            const currentWindowStart = new Date(now);
            currentWindowStart.setDate(now.getDate() - (count - 1));
            const hasRecentData = timelineEntries.some(entry => startOfDay(entry.date).getTime() >= currentWindowStart.getTime());
            if (!hasRecentData) {
                anchorDay = startOfDay(
                    timelineEntries.reduce((latest, entry) => (entry.date > latest ? entry.date : latest), timelineEntries[0].date)
                );
            }
        }

        for (let offset = count - 1; offset >= 0; offset -= 1) {
            const day = new Date(anchorDay);
            day.setDate(anchorDay.getDate() - offset);
            const key = day.toISOString().slice(0, 10);
            labels.push(day.toLocaleDateString('en-US', { weekday: 'short' }));
            values.push(Math.round(totalsByDay.get(key) || 0));
        }

        return { labels, values };
    }

    function buildRevenueTrendWeeks(weekCount) {
        const count = Math.max(1, Number(weekCount) || 4);
        const timelineEntries = getOrderTimelineEntries();
        const totalsByWeek = new Map();

        timelineEntries.forEach(entry => {
            const weekStart = startOfWeek(entry.date);
            const key = weekStart.toISOString().slice(0, 10);
            totalsByWeek.set(key, (totalsByWeek.get(key) || 0) + entry.total);
        });

        let anchorWeek = startOfWeek(new Date());
        if (timelineEntries.length) {
            anchorWeek = startOfWeek(
                timelineEntries.reduce((latest, entry) => (entry.date > latest ? entry.date : latest), timelineEntries[0].date)
            );
        }

        const labels = [];
        const values = [];
        for (let offset = count - 1; offset >= 0; offset -= 1) {
            const weekStart = new Date(anchorWeek);
            weekStart.setDate(anchorWeek.getDate() - (offset * 7));
            const key = weekStart.toISOString().slice(0, 10);
            labels.push(weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
            values.push(Math.round(totalsByWeek.get(key) || 0));
        }

        return { labels, values };
    }

    function getDashboardStatusMetrics() {
        const deliveredOrders = orders.filter(o => normalizeOrderStatus(o && o.status) === 'Delivered').length;
        const openOrders = orders.length - deliveredOrders;
        const totalReturns = returns.length;
        const alertCount = getInventoryMetrics().alerts;

        return {
            deliveredOrders,
            openOrders: Math.max(0, openOrders),
            totalReturns,
            alertCount
        };
    }

    function deliveryBadge(status) {
        const normalized = normalizeDeliveryStatus(status);
        if (normalized === 'Delivered') return badge('Delivered', 'delivered');
        if (normalized === 'In Transit') return badge('In Transit', 'processing');
        if (normalized === 'Failed') return badge('Failed', 'cancelled');
        return badge('Pending', 'pending');
    }

    DELIVERY_PARTNER_DIRECTORY = {
        'Rajesh K.': { phone: '+91 98214 44770', agency: 'SwiftDrop Logistics', vehicle: 'Bike', coverage: 'MG Road - Sector 20' },
        'Sunil M.': { phone: '+91 98104 31852', agency: 'Metro Last Mile', vehicle: 'Bike', coverage: 'Green Park - Civil Lines' },
        'Deepak R.': { phone: '+91 98739 22815', agency: 'RapidX Couriers', vehicle: 'Bike', coverage: 'Industrial Area - Lake View' },
        'Rider Team A': { phone: '+91 80109 42021', agency: 'Fleet Hub A', vehicle: 'Shared Rider Pool', coverage: 'Central Zone' },
        'Rider Team B': { phone: '+91 80109 42022', agency: 'Fleet Hub B', vehicle: 'Shared Rider Pool', coverage: 'North Zone' },
        'Rider Team C': { phone: '+91 80109 42023', agency: 'Fleet Hub C', vehicle: 'Shared Rider Pool', coverage: 'South Zone' }
    };

    function getDeliveryPartnerDetails(item) {
        const partnerName = String(item && item.partner || '').trim();
        const directory = DELIVERY_PARTNER_DIRECTORY[partnerName] || {};
        const phoneRaw = String((item && item.partnerPhone) || directory.phone || '').trim();
        const normalizedPhone = phoneRaw.replace(/[^\d+]/g, '');
        return {
            name: partnerName || 'Unassigned',
            phone: phoneRaw || 'Not available',
            phoneHref: normalizedPhone && normalizedPhone !== '+'
                ? `tel:${normalizedPhone.startsWith('+') ? normalizedPhone : `+91${normalizedPhone}`}`
                : '',
            agency: String((item && item.partnerAgency) || directory.agency || 'External partner').trim(),
            vehicle: String((item && item.partnerVehicle) || directory.vehicle || 'Bike').trim(),
            coverage: String((item && item.partnerCoverage) || directory.coverage || 'City zone').trim()
        };
    }

    function getDeliveryView() {
        return deliveries.map(d => {
            const order = orders.find(o => o.id === d.oid);
            const customer = String(d.customer || (order ? order.customer : '') || '').trim() || '-';
            const partnerDetails = getDeliveryPartnerDetails(d);
            return {
                id: d.id,
                oid: d.oid,
                customer,
                address: String(d.address || '').trim() || '-',
                partner: partnerDetails.name,
                partnerPhone: partnerDetails.phone,
                partnerPhoneHref: partnerDetails.phoneHref,
                partnerAgency: partnerDetails.agency,
                partnerVehicle: partnerDetails.vehicle,
                partnerCoverage: partnerDetails.coverage,
                status: normalizeDeliveryStatus(d.status),
                etaMin: Number.isFinite(Number(d.etaMin)) ? Number(d.etaMin) : null,
                updatedAt: String(d.updatedAt || d.time || '-').trim() || '-'
            };
        });
    }

    function getReturnView() {
        return returns.map(r => {
            const order = orders.find(o => o.id === r.oid);
            const customer = String((order && order.customer) || '').trim() || '-';
            const product = String(r.product || '').trim() || '-';
            const qty = Number.isFinite(Number(r.qty)) ? Math.max(1, Number(r.qty)) : null;
            const amount = Number.isFinite(Number(r.amount)) ? Math.max(0, Number(r.amount)) : 0;
            const rawStatus = String(r.status || 'Pending').trim() || 'Pending';
            const status = /approve/i.test(rawStatus) ? 'Pending' : rawStatus;
            const reason = String(r.reason || 'Unknown').trim() || 'Unknown';
            const requestedBy = String(r.requestedBy || '').trim() || '-';
            const updatedAt = String(r.updatedAt || '-').trim() || '-';
            return {
                id: String(r.id || '').trim() || 'RET-NA',
                oid: String(r.oid || '').trim() || '-',
                customer,
                product,
                qty,
                reason,
                amount,
                status,
                requestedBy,
                updatedAt
            };
        });
    }

    SUPPLIER_DIRECTORY = {
        'Agarwal Traders': { contact: 'Sanjay Agarwal', phone: '+91 98115 44101', email: 'sanjay@agarwaltraders.in', leadTimeDays: 2, moq: 25, rating: 4.8 },
        'Sharma Wholesale': { contact: 'Neha Sharma', phone: '+91 98917 22055', email: 'orders@sharmawholesale.in', leadTimeDays: 3, moq: 30, rating: 4.6 },
        'Fortune Dist.': { contact: 'Ritesh Jain', phone: '+91 99004 11233', email: 'north@fortunedist.in', leadTimeDays: 4, moq: 20, rating: 4.5 },
        'City Dairy': { contact: 'Mehul Shah', phone: '+91 97170 55544', email: 'supply@citydairy.in', leadTimeDays: 1, moq: 40, rating: 4.7 },
        'Cool Bev': { contact: 'Ankita Roy', phone: '+91 98180 33021', email: 'ops@coolbev.in', leadTimeDays: 2, moq: 36, rating: 4.4 },
        'SnackHub Foods': { contact: 'Varun Sethi', phone: '+91 99100 77442', email: 'supply@snackhubfoods.in', leadTimeDays: 2, moq: 48, rating: 4.3 },
        'HomeSpark Supplies': { contact: 'Pallavi Jain', phone: '+91 98101 56512', email: 'care@homespark.in', leadTimeDays: 3, moq: 18, rating: 4.5 }
    };

    function getSupplierDetails(item) {
        const supplierName = String(item && item.supplier || '').trim() || 'Unknown Supplier';
        const meta = item && item.supplierDetails && typeof item.supplierDetails === 'object'
            ? item.supplierDetails
            : {};
        const directory = SUPPLIER_DIRECTORY[supplierName] || {};

        return {
            name: supplierName,
            contact: String(meta.contact || item.supplierContact || directory.contact || 'Procurement Desk').trim(),
            phone: String(meta.phone || item.supplierPhone || directory.phone || 'Not available').trim(),
            email: String(meta.email || item.supplierEmail || directory.email || 'supplier@na.local').trim(),
            leadTimeDays: Math.max(1, Number(meta.leadTimeDays || item.leadTimeDays || directory.leadTimeDays || 3)),
            moq: Math.max(1, Number(meta.moq || item.minimumOrderQty || directory.moq || 10)),
            rating: Math.max(0, Number(meta.rating || item.supplierRating || directory.rating || 4.2))
        };
    }

    function getRecentProfileActivity() {
        const items = [];

        const latestOrder = orders
            .map(order => ({ order, timestamp: parseOrderDate(order && order.date) }))
            .filter(entry => entry.timestamp)
            .sort((a, b) => b.timestamp - a.timestamp)[0];
        if (latestOrder) {
            items.push({
                time: latestOrder.order.date,
                text: `Processed order <strong>#${latestOrder.order.id}</strong> for ${latestOrder.order.customer}`
            });
        }

        const latestReturn = returns
            .map(item => ({ item, timestamp: parseOrderDate(item && item.updatedAt) }))
            .filter(entry => entry.timestamp)
            .sort((a, b) => b.timestamp - a.timestamp)[0];
        if (latestReturn) {
            items.push({
                time: latestReturn.item.updatedAt,
                text: `Updated return <strong>#${latestReturn.item.id}</strong> to ${latestReturn.item.status}`
            });
        }

        const latestDelivery = deliveries
            .map(item => ({ item, timestamp: parseOrderDate(item && (item.updatedAt || item.time)) }))
            .filter(entry => entry.timestamp)
            .sort((a, b) => b.timestamp - a.timestamp)[0];
        if (latestDelivery) {
            items.push({
                time: latestDelivery.item.updatedAt || latestDelivery.item.time,
                text: `Checked delivery <strong>#${latestDelivery.item.id}</strong> - ${normalizeDeliveryStatus(latestDelivery.item.status)}`
            });
        }

        const alertItem = inventory
            .map(item => ({
                item,
                stock: Math.max(0, Number(item && item.stock) || 0),
                status: normalizeInventoryStatus(item && item.status, item && item.stock)
            }))
            .filter(entry => entry.status !== 'In Stock')
            .sort((a, b) => a.stock - b.stock)[0];
        if (alertItem) {
            items.push({
                time: 'Current inventory snapshot',
                text: `Reviewed stock alert for <strong>${alertItem.item.name}</strong> (${alertItem.status})`
            });
        }

        return items.slice(0, 4);
    }

    // Page Renderers
    let activeCharts = []; // Track active charts for cleanup
    let currentReportChartState = null;

    function renderPage(page) {
        content.innerHTML = '';
        // Cleanup existing charts
        if (activeCharts.length) {
            activeCharts.forEach(c => c.destroy());
            activeCharts = [];
        }

        const renderers = {
            dashboard: renderDashboard, orders: renderOrders, inventory: renderInventory,
            delivery: renderDelivery, returns: renderReturns, reports: renderReports, users: renderUsers,
            superuser: renderBusinesses, businesses: renderBusinesses, profile: renderProfile, notifications: renderNotifications
        };
        if (renderers[page]) renderers[page]();
        content.scrollTop = 0;
        enforceActionPermissions();
    }

    window.renderUserProfile = renderUserProfile;
    window.renderNotificationDetail = renderNotificationDetail;

    function renderDashboard() {
        if (activeRoleKey === 'deliveryops') {
            renderDeliveryOpsDashboard();
            return;
        }
        if (activeRoleKey === 'returnhandler') {
            renderReturnHandlerDashboard();
            return;
        }
        if (activeRoleKey === 'inventorymanager') {
            renderInventoryManagerDashboard();
            return;
        }
        const inventoryMetrics = getInventoryMetrics();
        const totalSales = orders.reduce((a, o) => a + o.total, 0);
        const scopedName = selectedBusiness ? selectedBusiness.name : activeBusinessName;
        content.innerHTML = `
        <div class="page-header"><h2>Dashboard${scopedName ? ` - ${scopedName}` : ''}</h2><div class="page-header-actions"><button class="btn btn-outline" onclick="window.print()">Print</button></div></div>
        <section class="stats-grid">
            <div class="stat-card"><div class="stat-icon si-green"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div><div class="stat-info"><span class="stat-label">Revenue</span><span class="stat-value">₹${totalSales.toLocaleString()}</span></div></div>
            <div class="stat-card"><div class="stat-icon si-blue"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/></svg></div><div class="stat-info"><span class="stat-label">Orders</span><span class="stat-value">${orders.length}</span></div></div>
            <div class="stat-card"><div class="stat-icon si-red"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg></div><div class="stat-info"><span class="stat-label">Returns</span><span class="stat-value">${returns.length}</span></div></div>
            <div class="stat-card"><div class="stat-icon si-amber"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg></div><div class="stat-info"><span class="stat-label">Alerts</span><span class="stat-value">${inventoryMetrics.alerts}</span></div></div>
        </section>
        <section class="grid-2">
            <div class="card"><div class="card-hd"><h3>Sales Trend</h3></div><div class="card-bd" style="position:relative;height:240px"><canvas id="dashSalesChart"></canvas></div></div>
            <div class="card"><div class="card-hd"><h3>Order Status</h3></div><div class="card-bd" style="position:relative;height:240px"><canvas id="dashStatusChart"></canvas></div></div>
        </section>
        <section class="card"><div class="card-hd"><h3>Recent Orders</h3></div><div class="card-bd">${table(
            ['ID', 'Customer', 'Total', 'Payment', 'Status'],
            orders.slice(0, 5).map(o => `<tr><td class="cell-main">${o.id}</td><td>${o.customer}</td><td>₹${o.total}</td><td>${badge(o.payment, o.payment.toLowerCase())}</td><td>${statusBadge(o.status)}</td></tr>`).join('')
        )}</div></section>`;
        setTimeout(initDashboardCharts, 0);
    }

    function renderInventoryManagerDashboard() {
        const scopedName = selectedBusiness ? selectedBusiness.name : activeBusinessName;
        const metrics = getInventoryMetrics();
        const lowCritical = metrics.lowStock + metrics.critical;

        const lowestStockRows = inventory
            .map(item => ({
                sku: String(item && item.sku || '-'),
                name: String(item && item.name || '-'),
                cat: String(item && item.cat || '-'),
                stock: Math.max(0, Number(item && item.stock) || 0),
                status: normalizeInventoryStatus(item && item.status, Number(item && item.stock))
            }))
            .sort((a, b) => a.stock - b.stock)
            .slice(0, 10)
            .map(item => `<tr>
                <td class="cell-main">${item.sku}</td>
                <td>${item.name}</td>
                <td>${item.cat}</td>
                <td>${item.stock}</td>
                <td>${statusBadge(item.status)}</td>
            </tr>`)
            .join('');

        content.innerHTML = `
        <div class="page-header">
            <h2>Inventory Dashboard${scopedName ? ` - ${scopedName}` : ''}</h2>
            <div class="page-header-actions">
                <button class="btn btn-primary" onclick="window.location.href='inventory.html'">Open Inventory</button>
                <button class="btn btn-outline" onclick="window.print()">Print</button>
            </div>
        </div>
        <section class="stats-grid">
            <div class="stat-card"><div class="stat-icon si-blue"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg></div><div class="stat-info"><span class="stat-label">Total SKUs</span><span class="stat-value">${metrics.totalSkus}</span></div></div>
            <div class="stat-card"><div class="stat-icon si-green"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div><div class="stat-info"><span class="stat-label">Stock Units</span><span class="stat-value">${metrics.totalUnits.toLocaleString()}</span></div></div>
            <div class="stat-card"><div class="stat-icon si-amber"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg></div><div class="stat-info"><span class="stat-label">Low + Critical</span><span class="stat-value">${lowCritical}</span></div></div>
            <div class="stat-card"><div class="stat-icon si-red"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div><div class="stat-info"><span class="stat-label">Out of Stock</span><span class="stat-value">${metrics.outOfStock}</span></div></div>
        </section>
        <section class="grid-2">
            <div class="card"><div class="card-hd"><h3>Category Distribution</h3></div><div class="card-bd" style="position:relative;height:220px"><canvas id="invMgrCategoryChart"></canvas></div></div>
            <div class="card"><div class="card-hd"><h3>Stock Health</h3></div><div class="card-bd" style="position:relative;height:220px"><canvas id="invMgrHealthChart"></canvas></div></div>
        </section>
        <section class="card"><div class="card-hd"><h3>Lowest Stock Items</h3></div><div class="card-bd">${table(
            ['SKU', 'Product', 'Category', 'Stock', 'Status'],
            lowestStockRows || '<tr><td colspan="5" class="text-muted">No inventory data available.</td></tr>'
        )}</div></section>`;

        setTimeout(initInventoryManagerCharts, 0);
    }

    function renderDeliveryOpsDashboard() {
        const scopedName = selectedBusiness ? selectedBusiness.name : activeBusinessName;
        const view = getDeliveryView();
        const counts = view.reduce((acc, d) => {
            acc.total += 1;
            if (d.status === 'Delivered') acc.delivered += 1;
            else if (d.status === 'In Transit') acc.inTransit += 1;
            else if (d.status === 'Failed') acc.failed += 1;
            else acc.pending += 1;
            if (d.partner === 'Unassigned') acc.unassigned += 1;
            return acc;
        }, { total: 0, delivered: 0, inTransit: 0, pending: 0, failed: 0, unassigned: 0 });

        const activeRows = view
            .filter(d => d.status === 'Pending' || d.status === 'In Transit')
            .sort((a, b) => {
                const aEta = a.etaMin === null ? Number.POSITIVE_INFINITY : a.etaMin;
                const bEta = b.etaMin === null ? Number.POSITIVE_INFINITY : b.etaMin;
                return aEta - bEta;
            });

        const avgEtaRows = activeRows.filter(d => d.etaMin !== null);
        const avgEta = avgEtaRows.length
            ? Math.round(avgEtaRows.reduce((sum, d) => sum + Number(d.etaMin || 0), 0) / avgEtaRows.length)
            : null;

        const etaLabel = avgEta === null ? '&mdash;' : `${avgEta} min`;
        const activeCount = counts.pending + counts.inTransit;

        const actionBtn = (label, onClick, extraStyles) => `<button class="btn btn-outline" data-action="delivery" style="padding: 4px 8px; font-size: 0.75rem; ${extraStyles || ''}" onclick="${onClick}">${label}</button>`;
        const actionsFor = (item) => {
            const actions = [actionBtn('Assign Delivery', `window.assignDeliveryPartner('${item.id}')`, 'margin-right: 4px;')];
            const normalizedStatus = normalizeDeliveryStatus(item.status);
            if (normalizedStatus !== 'Delivered') {
                actions.push(actionBtn('Edit', `window.editDelivery('${item.id}')`, ''));
            }
            return actions.join('');
        };
        const externalFor = (item) => item.partnerPhoneHref
            ? `<a class="btn btn-outline" style="padding: 4px 8px; font-size: 0.75rem;" href="${item.partnerPhoneHref}">Call Partner</a>`
            : '<span class="text-muted text-sm">No contact</span>';

        const rows = activeRows
            .map(d => {
                const updated = d.updatedAt === '-' ? '&mdash;' : d.updatedAt;
                const eta = d.etaMin === null ? '&mdash;' : `${Math.max(0, Math.round(d.etaMin))} min`;
                const partnerPhone = d.partnerPhoneHref
                    ? `<a href="${d.partnerPhoneHref}" style="color:var(--accent); text-decoration:none;">${d.partnerPhone}</a>`
                    : d.partnerPhone;
                return `<tr>
                    <td class="cell-main">${d.id}</td>
                    <td>${d.oid}</td>
                    <td>${d.customer}</td>
                    <td>${d.address}</td>
                    <td>${d.partner}<div class="text-sm text-muted">${d.partnerAgency} &bull; ${partnerPhone}</div></td>
                    <td>${eta}</td>
                    <td>${deliveryBadge(d.status)}</td>
                    <td>${updated}</td>
                    <td>${externalFor(d)}</td>
                    <td>${actionsFor(d)}</td>
                </tr>`;
            })
            .join('');

        content.innerHTML = `
        <div class="page-header">
            <h2>Delivery Dashboard${scopedName ? ` - ${scopedName}` : ''}</h2>
            <div class="page-header-actions">
                <button class="btn btn-primary" onclick="window.location.href='delivery.html'">Open Delivery</button>
                <button class="btn btn-outline" onclick="window.print()">Print</button>
            </div>
        </div>

        <section class="stats-grid">
            <div class="stat-card">
                <div class="stat-icon si-blue">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
                </div>
                <div class="stat-info">
                    <span class="stat-label">Active Deliveries</span>
                    <span class="stat-value">${activeCount}</span>
                    <div class="text-sm text-muted" style="margin-top:6px;">Pending ${counts.pending} &bull; In Transit ${counts.inTransit}</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon si-green">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <div class="stat-info">
                    <span class="stat-label">Delivered</span>
                    <span class="stat-value">${counts.delivered}</span>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon si-red">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>
                </div>
                <div class="stat-info">
                    <span class="stat-label">Failed</span>
                    <span class="stat-value">${counts.failed}</span>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon si-amber">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                </div>
                <div class="stat-info">
                    <span class="stat-label">Avg ETA (Active)</span>
                    <span class="stat-value">${etaLabel}</span>
                </div>
            </div>
        </section>

        <section class="grid-2">
            <div class="card">
                <div class="card-hd"><h3>Status Breakdown</h3></div>
                <div class="card-bd" style="position:relative;height:220px"><canvas id="delStatusChart"></canvas></div>
            </div>
            <div class="card">
                <div class="card-hd"><h3>Partner Load (Active)</h3></div>
                <div class="card-bd" style="position:relative;height:220px"><canvas id="delPartnerChart"></canvas></div>
            </div>
        </section>

        <section class="card">
            <div class="card-hd" style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
                <h3>Active Queue</h3>
                <div class="text-sm text-muted">Unassigned ${counts.unassigned}</div>
            </div>
            <div class="card-bd">
                <div class="tbl-wrap">
                    <table class="dt">
                        <thead>
                            <tr>
                                <th>Delivery</th>
                                <th>Order</th>
                                <th>Customer</th>
                                <th>Address</th>
                                <th>Partner Info</th>
                                <th>ETA</th>
                                <th>Status</th>
                                <th>Updated</th>
                                <th>External</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows || `<tr><td colspan="10" class="text-muted">No active deliveries.</td></tr>`}
                        </tbody>
                    </table>
                </div>
            </div>
        </section>`;

        setTimeout(initDeliveryCharts, 0);
    }

    function renderReturnHandlerDashboard() {
        const scopedName = selectedBusiness ? selectedBusiness.name : activeBusinessName;
        const view = getReturnView();

        const counts = view.reduce((acc, r) => {
            const s = String(r.status || '').toLowerCase();
            acc.total += 1;
            if (s.includes('refund')) acc.refunded += 1;
            else if (s.includes('reject')) acc.rejected += 1;
            else acc.pending += 1;
            acc.valueRefunded += s.includes('refund') ? Number(r.amount || 0) : 0;
            return acc;
        }, { total: 0, pending: 0, refunded: 0, rejected: 0, valueRefunded: 0 });

        const productCounts = new Map();
        view.forEach(r => {
            const p = String(r.product || '').trim();
            if (!p || p === '-') return;
            productCounts.set(p, (productCounts.get(p) || 0) + 1);
        });
        const topProduct = Array.from(productCounts.entries()).sort((a, b) => b[1] - a[1])[0] || null;
        const topProductName = topProduct ? topProduct[0] : '—';
        const topProductCount = topProduct ? topProduct[1] : 0;
        const topShare = counts.total && topProductCount ? Math.round((topProductCount / counts.total) * 100) : 0;

        const tableRows = view
            .slice(0, 10)
            .map(r => `<tr>
                <td class="cell-main">${r.oid}</td>
                <td>${r.product}</td>
                <td>${r.reason}</td>
                <td>₹${Number(r.amount || 0).toLocaleString()}</td>
                <td>${statusBadge(r.status)}</td>
                <td>${r.updatedAt}</td>
            </tr>`)
            .join('');

        content.innerHTML = `
        <div class="page-header">
            <h2>Returns Dashboard${scopedName ? ` - ${scopedName}` : ''}</h2>
            <div class="page-header-actions">
                <button class="btn btn-primary" onclick="window.location.href='returns.html'">Open Returns</button>
                <button class="btn btn-outline" onclick="window.print()">Print</button>
            </div>
        </div>

        <section class="stats-grid">
            <div class="stat-card">
                <div class="stat-icon si-red">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
                </div>
                <div class="stat-info">
                    <span class="stat-label">Total Returns</span>
                    <span class="stat-value">${counts.total}</span>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon si-amber">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                </div>
                <div class="stat-info">
                    <span class="stat-label">Pending</span>
                    <span class="stat-value">${counts.pending}</span>
                    <div class="text-sm text-muted" style="margin-top:6px;">Rejected ${counts.rejected}</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon si-green">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                </div>
                <div class="stat-info">
                    <span class="stat-label">Refunded</span>
                    <span class="stat-value">${counts.refunded}</span>
                    <div class="text-sm text-muted" style="margin-top:6px;">Value ₹${Math.round(counts.valueRefunded).toLocaleString()}</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon si-purple">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                </div>
                <div class="stat-info">
                    <span class="stat-label">Most Returned</span>
                    <span class="stat-value" style="font-size: 1rem; font-weight: 700;">${topProductName}</span>
                    <div class="text-sm text-muted" style="margin-top:6px;">${topProductCount} returns &bull; ${topShare}% share</div>
                </div>
            </div>
        </section>

        <section class="grid-3">
            <div class="card"><div class="card-hd"><h3>Top Returned Products</h3></div><div class="card-bd" style="position:relative;height:220px"><canvas id="retProductChart"></canvas></div></div>
            <div class="card"><div class="card-hd"><h3>Return Reasons</h3></div><div class="card-bd" style="position:relative;height:220px"><canvas id="retReasonChart"></canvas></div></div>
            <div class="card"><div class="card-hd"><h3>Status Breakdown</h3></div><div class="card-bd" style="position:relative;height:220px"><canvas id="retStatusChart"></canvas></div></div>
        </section>

        <section class="card">
            <div class="card-hd"><h3>Returned Orders</h3></div>
            <div class="card-bd">${table(
                ['Order', 'Product', 'Reason', 'Amount', 'Status', 'Updated'],
                tableRows || '<tr><td colspan=\"6\" class=\"text-muted\">No returns found.</td></tr>'
            )}</div>
        </section>`;

        setTimeout(initReturnCharts, 0);
    }

    function renderOrders() {
        const orderRows = orders.map(order => ({
            ...order,
            normalizedStatus: normalizeOrderStatus(order && order.status),
            normalizedPayment: String(order && order.payment || 'Pending').trim() || 'Pending',
            parsedDate: parseOrderDate(order && order.date)
        }));
        const buildOrderActions = (item) => {
            const actions = [
                `<button class="btn btn-outline" style="padding: 4px 8px; font-size: 0.75rem; margin-right: 4px;" onclick="window.editOrder('${item.id}')">Edit</button>`
            ];
            if (hasOrderDeleteAccess()) {
                actions.push(`<button class="btn btn-outline" style="padding: 4px 8px; font-size: 0.75rem; color: var(--red); border-color: var(--red);" onclick="window.deleteOrder('${item.id}')">Delete</button>`);
            }
            return actions.join('');
        };
        const statusOptions = Array.from(new Set(orderRows.map(item => item.normalizedStatus))).sort();
        const paymentOptions = Array.from(new Set(orderRows.map(item => item.normalizedPayment))).sort();

        content.innerHTML = `
        <div class="page-header"><h2>Orders</h2><div class="page-header-actions"><button class="btn btn-primary" id="newOrderBtnDyn">+ New Order</button></div></div>
        <section class="card" style="margin-bottom:14px;">
            <div class="card-bd table-toolbar">
                <div class="toolbar-group"><label class="toolbar-label" for="ordersStatusFilter">Status</label><select id="ordersStatusFilter" class="toolbar-select"><option value="all">All statuses</option>${statusOptions.map(option => `<option value="${option}">${option}</option>`).join('')}</select></div>
                <div class="toolbar-group"><label class="toolbar-label" for="ordersPaymentFilter">Payment</label><select id="ordersPaymentFilter" class="toolbar-select"><option value="all">All payments</option>${paymentOptions.map(option => `<option value="${option}">${option}</option>`).join('')}</select></div>
                <div class="toolbar-group"><label class="toolbar-label" for="ordersSortSelect">Sort by</label><select id="ordersSortSelect" class="toolbar-select"><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="total_high">Total high-low</option><option value="total_low">Total low-high</option></select></div>
            </div>
        </section>
        <section class="card"><div class="card-bd"><div class="tbl-wrap"><table class="dt"><thead><tr><th>ID</th><th>Customer</th><th>Items</th><th>Total</th><th>Payment</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead><tbody id="ordersTableBodyDyn"></tbody></table></div></div></section>`;

        const tbody = document.getElementById('ordersTableBodyDyn');
        const statusFilter = document.getElementById('ordersStatusFilter');
        const paymentFilter = document.getElementById('ordersPaymentFilter');
        const sortSelect = document.getElementById('ordersSortSelect');

        function renderTable() {
            if (!tbody) return;
            const filteredRows = orderRows
                .filter(item => {
                    if (statusFilter && statusFilter.value !== 'all' && item.normalizedStatus !== statusFilter.value) return false;
                    if (paymentFilter && paymentFilter.value !== 'all' && item.normalizedPayment !== paymentFilter.value) return false;
                    return true;
                })
                .sort((a, b) => {
                    const sortKey = sortSelect ? sortSelect.value : 'newest';
                    if (sortKey === 'oldest') return (a.parsedDate?.getTime() || 0) - (b.parsedDate?.getTime() || 0);
                    if (sortKey === 'total_high') return Math.max(0, Number(b.total || 0)) - Math.max(0, Number(a.total || 0));
                    if (sortKey === 'total_low') return Math.max(0, Number(a.total || 0)) - Math.max(0, Number(b.total || 0));
                    return (b.parsedDate?.getTime() || 0) - (a.parsedDate?.getTime() || 0);
                });

            tbody.innerHTML = filteredRows.length
                ? filteredRows.map(item => `<tr><td class="cell-main">${item.id}</td><td>${item.customer}</td><td>${item.items}</td><td>Rs ${Math.max(0, Number(item.total || 0)).toLocaleString()}</td><td>${badge(item.normalizedPayment, item.normalizedPayment.toLowerCase())}</td><td>${statusBadge(item.normalizedStatus)}</td><td>${item.date}</td><td>${buildOrderActions(item)}</td></tr>`).join('')
                : '<tr><td colspan="8" class="text-muted">No orders match the selected filters.</td></tr>';
        }

        [statusFilter, paymentFilter, sortSelect].forEach(control => {
            if (control) control.addEventListener('change', renderTable);
        });

        renderTable();
        const dynBtn = document.getElementById('newOrderBtnDyn');
        if (dynBtn) dynBtn.addEventListener('click', openNewOrderModal);
    }
    function renderInventory() {
        const supplierSummaryRows = Array.from(
            inventory.reduce((map, item) => {
                const details = getSupplierDetails(item);
                if (!map.has(details.name)) map.set(details.name, details);
                return map;
            }, new Map()).values()
        ).map(details => `<tr>
            <td class="cell-main">${details.name}</td>
            <td>${details.contact}</td>
            <td>${details.phone}</td>
            <td>${details.email}</td>
            <td>${details.leadTimeDays} days</td>
            <td>${details.moq}</td>
            <td>${details.rating.toFixed(1)} / 5</td>
        </tr>`).join('');

        const categoryOptions = Array.from(new Set(inventory.map(item => String(item && item.cat || 'Uncategorized').trim() || 'Uncategorized'))).sort();
        const inventoryRows = inventory.map(item => ({
            ...item,
            supplierMeta: getSupplierDetails(item),
            normalizedStatus: normalizeInventoryStatus(item.status, item.stock)
        }));

        content.innerHTML = `
        <div class="page-header"><h2>Inventory</h2><div class="page-header-actions"><button class="btn btn-primary" id="addProductBtnDyn">+ Add Product</button></div></div>
        <section class="card" style="margin-bottom:14px;">
            <div class="card-bd table-toolbar">
                <div class="toolbar-group"><label class="toolbar-label" for="inventoryCategoryFilter">Category</label><select id="inventoryCategoryFilter" class="toolbar-select"><option value="all">All categories</option>${categoryOptions.map(option => `<option value="${option}">${option}</option>`).join('')}</select></div>
                <div class="toolbar-group"><label class="toolbar-label" for="inventoryStatusFilter">Stock status</label><select id="inventoryStatusFilter" class="toolbar-select"><option value="all">All stock levels</option><option value="In Stock">In Stock</option><option value="Low Stock">Low Stock</option><option value="Critical">Critical</option><option value="Out of Stock">Out of Stock</option></select></div>
                <div class="toolbar-group"><label class="toolbar-label" for="inventorySortSelect">Sort by</label><select id="inventorySortSelect" class="toolbar-select"><option value="stock_low">Stock low-high</option><option value="stock_high">Stock high-low</option><option value="price_high">Price high-low</option><option value="price_low">Price low-high</option></select></div>
            </div>
        </section>
        <section class="grid-2">
             <div class="card"><div class="card-hd"><h3>Category Distribution</h3></div><div class="card-bd" style="position:relative;height:220px"><canvas id="invCatChart"></canvas></div></div>
             <div class="card"><div class="card-hd"><h3>Stock Levels</h3></div><div class="card-bd" style="position:relative;height:220px"><canvas id="invStockChart"></canvas></div></div>
        </section>
        <section class="card"><div class="card-bd"><div class="tbl-wrap"><table class="dt"><thead><tr><th>SKU</th><th>Product</th><th>Category</th><th>Supplier</th><th>Supplier Contact</th><th>Lead Time</th><th>Stock</th><th>Unit Price</th><th>Status</th><th>Actions</th></tr></thead><tbody id="inventoryTableBodyDyn"></tbody></table></div></div></section>
        <section class="card"><div class="card-hd"><h3>Supplier Directory</h3></div><div class="card-bd">${table(
            ['Supplier', 'Contact Person', 'Phone', 'Email', 'Lead Time', 'MOQ', 'Rating'],
            supplierSummaryRows || '<tr><td colspan="7" class="text-muted">No supplier details available.</td></tr>'
        )}</div></section>`;

        const tbody = document.getElementById('inventoryTableBodyDyn');
        const categoryFilter = document.getElementById('inventoryCategoryFilter');
        const statusFilter = document.getElementById('inventoryStatusFilter');
        const sortSelect = document.getElementById('inventorySortSelect');

        function renderTable() {
            if (!tbody) return;
            const filteredRows = inventoryRows
                .filter(item => {
                    if (categoryFilter && categoryFilter.value !== 'all' && String(item.cat || 'Uncategorized').trim() !== categoryFilter.value) return false;
                    if (statusFilter && statusFilter.value !== 'all' && item.normalizedStatus !== statusFilter.value) return false;
                    return true;
                })
                .sort((a, b) => {
                    const sortKey = sortSelect ? sortSelect.value : 'stock_low';
                    if (sortKey === 'stock_high') return Math.max(0, Number(b.stock || 0)) - Math.max(0, Number(a.stock || 0));
                    if (sortKey === 'price_high') return Math.max(0, Number(b.price || 0)) - Math.max(0, Number(a.price || 0));
                    if (sortKey === 'price_low') return Math.max(0, Number(a.price || 0)) - Math.max(0, Number(b.price || 0));
                    return Math.max(0, Number(a.stock || 0)) - Math.max(0, Number(b.stock || 0));
                });

            tbody.innerHTML = filteredRows.length
                ? filteredRows.map(item => `<tr><td class="cell-main">${item.sku}</td><td>${item.name}</td><td>${item.cat}</td><td>${item.supplierMeta.name}</td><td>${item.supplierMeta.contact}<div class="text-sm text-muted">${item.supplierMeta.phone}</div></td><td>${item.supplierMeta.leadTimeDays} days</td><td>${item.stock}</td><td>Rs ${Math.max(0, Number(item.price || 0)).toLocaleString()}</td><td>${statusBadge(item.normalizedStatus)}</td><td><button class="btn btn-outline" style="padding: 4px 8px; font-size: 0.75rem; margin-right: 4px;" onclick="window.editProduct('${item.sku}')">Edit</button><button class="btn btn-outline" style="padding: 4px 8px; font-size: 0.75rem; color: var(--red); border-color: var(--red);" onclick="window.deleteProduct('${item.sku}')">Delete</button></td></tr>`).join('')
                : '<tr><td colspan="10" class="text-muted">No inventory items match the selected filters.</td></tr>';
        }

        [categoryFilter, statusFilter, sortSelect].forEach(control => {
            if (control) control.addEventListener('change', renderTable);
        });

        renderTable();
        setTimeout(initInventoryCharts, 0);
        const dynBtn = document.getElementById('addProductBtnDyn');
        if (dynBtn) dynBtn.addEventListener('click', openAddProductModal);
    }
    function renderDelivery() {
        const view = getDeliveryView();

        const counts = view.reduce((acc, d) => {
            acc.total += 1;
            if (d.status === 'Delivered') acc.delivered += 1;
            else if (d.status === 'In Transit') acc.inTransit += 1;
            else if (d.status === 'Failed') acc.failed += 1;
            else acc.pending += 1;
            if (d.partner === 'Unassigned') acc.unassigned += 1;
            return acc;
        }, { total: 0, delivered: 0, inTransit: 0, pending: 0, failed: 0, unassigned: 0 });

        const activeCount = counts.pending + counts.inTransit;

        content.innerHTML = `
        <div class="page-header">
            <h2>Delivery</h2>
            <div class="page-header-actions">
                <button class="btn btn-outline" onclick="window.print()">Print</button>
            </div>
        </div>

        <section class="stats-grid">
            <div class="stat-card">
                <div class="stat-icon si-blue">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
                </div>
                <div class="stat-info">
                    <span class="stat-label">Active Deliveries</span>
                    <span class="stat-value">${activeCount}</span>
                    <div class="text-sm text-muted" style="margin-top:6px;">Pending ${counts.pending} • In Transit ${counts.inTransit}</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon si-green">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <div class="stat-info">
                    <span class="stat-label">Delivered</span>
                    <span class="stat-value">${counts.delivered}</span>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon si-amber">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                </div>
                <div class="stat-info">
                    <span class="stat-label">Unassigned</span>
                    <span class="stat-value">${counts.unassigned}</span>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon si-red">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>
                </div>
                <div class="stat-info">
                    <span class="stat-label">Failed</span>
                    <span class="stat-value">${counts.failed}</span>
                </div>
            </div>
        </section>

        <section class="grid-2">
            <div class="card">
                <div class="card-hd"><h3>Status Breakdown</h3></div>
                <div class="card-bd" style="position:relative;height:220px"><canvas id="delStatusChart"></canvas></div>
            </div>
            <div class="card">
                <div class="card-hd"><h3>Partner Load</h3></div>
                <div class="card-bd" style="position:relative;height:220px"><canvas id="delPartnerChart"></canvas></div>
            </div>
        </section>

        <section class="card">
            <div class="card-hd" style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
                <h3>Delivery Queue</h3>
                <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
                    <div class="chart-tabs" id="deliveryFilters">
                        <button class="chart-tab active" type="button" data-filter="active">Active</button>
                        <button class="chart-tab" type="button" data-filter="pending">Pending</button>
                        <button class="chart-tab" type="button" data-filter="intransit">In Transit</button>
                        <button class="chart-tab" type="button" data-filter="delivered">Delivered</button>
                        <button class="chart-tab" type="button" data-filter="failed">Failed</button>
                        <button class="chart-tab" type="button" data-filter="all">All</button>
                    </div>
                    <select id="deliverySortSelect" class="toolbar-select">
                        <option value="updated_new">Updated newest</option>
                        <option value="updated_old">Updated oldest</option>
                        <option value="eta_low">ETA low-high</option>
                        <option value="eta_high">ETA high-low</option>
                        <option value="partner">Partner A-Z</option>
                    </select>
                </div>
            </div>
            <div class="card-bd">
                <div class="tbl-wrap">
                    <table class="dt">
                        <thead>
                            <tr>
                                <th>Delivery</th>
                                <th>Order</th>
                                <th>Customer</th>
                                <th>Address</th>
                                <th>Partner</th>
                                <th>ETA</th>
                                <th>Status</th>
                                <th>Updated</th>
                                <th>External</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="deliveryTableBody"></tbody>
                    </table>
                </div>
            </div>
        </section>`;

        setTimeout(initDeliveryCharts, 0);

        const tbody = document.getElementById('deliveryTableBody');
        const filterWrap = document.getElementById('deliveryFilters');
        const sortSelect = document.getElementById('deliverySortSelect');

        function matchesFilter(item, filter) {
            if (filter === 'all') return true;
            if (filter === 'active') return item.status === 'Pending' || item.status === 'In Transit';
            if (filter === 'pending') return item.status === 'Pending';
            if (filter === 'intransit') return item.status === 'In Transit';
            if (filter === 'delivered') return item.status === 'Delivered';
            if (filter === 'failed') return item.status === 'Failed';
            return true;
        }

        function actionsFor(item) {
            const btn = (label, onClick, extraStyles) => `<button class="btn btn-outline" data-action="delivery" style="padding: 4px 8px; font-size: 0.75rem; ${extraStyles || ''}" onclick="${onClick}">${label}</button>`;
            const actions = [btn('Assign Delivery', `window.assignDeliveryPartner('${item.id}')`, 'margin-right: 4px;')];
            const normalizedStatus = normalizeDeliveryStatus(item.status);
            if (normalizedStatus !== 'Delivered') {
                actions.push(btn('Edit', `window.editDelivery('${item.id}')`, ''));
            }
            return actions.join('');
        }

        function externalActionsFor(item) {
            if (!item.partnerPhoneHref) return '<span class="text-muted text-sm">No contact</span>';
            return `<a class="btn btn-outline" style="padding: 4px 8px; font-size: 0.75rem;" href="${item.partnerPhoneHref}">Call Partner</a>`;
        }

        function renderTable(filter) {
            if (!tbody) return;
            const rows = view
                .filter(d => matchesFilter(d, filter))
                .sort((a, b) => {
                    const sortKey = sortSelect ? sortSelect.value : 'updated_new';
                    const updatedA = parseOrderDate(a.updatedAt)?.getTime() || 0;
                    const updatedB = parseOrderDate(b.updatedAt)?.getTime() || 0;
                    const etaA = a.etaMin === null ? Number.MAX_SAFE_INTEGER : Math.max(0, Number(a.etaMin || 0));
                    const etaB = b.etaMin === null ? Number.MAX_SAFE_INTEGER : Math.max(0, Number(b.etaMin || 0));
                    if (sortKey === 'updated_old') return updatedA - updatedB;
                    if (sortKey === 'eta_low') return etaA - etaB;
                    if (sortKey === 'eta_high') return etaB - etaA;
                    if (sortKey === 'partner') return String(a.partner || '').localeCompare(String(b.partner || ''));
                    return updatedB - updatedA;
                })
                .map(d => {
                    const updated = d.updatedAt === '-' ? '&mdash;' : d.updatedAt;
                    const eta = d.etaMin === null ? '&mdash;' : `${Math.max(0, Math.round(d.etaMin))} min`;
                    const partnerPhone = d.partnerPhoneHref
                        ? `<a href="${d.partnerPhoneHref}" style="color:var(--accent); text-decoration:none;">${d.partnerPhone}</a>`
                        : d.partnerPhone;
                    return `<tr>
                        <td class="cell-main">${d.id}</td>
                        <td>${d.oid}</td>
                        <td>${d.customer}</td>
                        <td>${d.address}</td>
                        <td>${d.partner}<div class="text-sm text-muted">${d.partnerAgency} &bull; ${partnerPhone}</div></td>
                        <td>${eta}</td>
                        <td>${deliveryBadge(d.status)}</td>
                        <td>${updated}</td>
                        <td>${externalActionsFor(d)}</td>
                        <td>${actionsFor(d)}</td>
                    </tr>`;
                })
                .join('');

            tbody.innerHTML = rows || `<tr><td colspan="10" class="text-muted">No deliveries found.</td></tr>`;
        }

        renderTable('active');

        if (filterWrap) {
            filterWrap.querySelectorAll('.chart-tab[data-filter]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const filter = btn.getAttribute('data-filter') || 'all';
                    filterWrap.querySelectorAll('.chart-tab').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    renderTable(filter);
                });
            });
        }
        if (sortSelect) {
            sortSelect.addEventListener('change', () => {
                const activeBtn = filterWrap ? filterWrap.querySelector('.chart-tab.active') : null;
                renderTable(activeBtn ? String(activeBtn.getAttribute('data-filter') || 'active') : 'active');
            });
        }
    }

    function renderReturns() {
        renderReturnsRefined();
        return;
        content.innerHTML = `
        <div class="page-header"><h2>Returns</h2><div class="page-header-actions"><button class="btn btn-primary" id="raiseReturnBtnDyn">+ Raise Return</button></div></div>
        <section class="grid-2">
            <div class="card"><div class="card-hd"><h3>Return Reasons</h3></div><div class="card-bd" style="position:relative;height:200px"><canvas id="retReasonChart"></canvas></div></div>
            <div class="card"><div class="card-hd"><h3>Status Breakdown</h3></div><div class="card-bd" style="position:relative;height:200px"><canvas id="retStatusChart"></canvas></div></div>
        </section>
        <section class="card"><div class="card-bd">${table(
            ['ID', 'Order', 'Reason', 'Amount', 'Status', 'Requested By', 'Updated', 'Actions'],
            returns.map(r => `<tr><td class="cell-main">${r.id}</td><td>${r.oid}</td><td>${r.reason}</td><td>₹${r.amount}</td><td>${statusBadge(r.status)}</td><td>${r.requestedBy || '-'}</td><td>${r.updatedAt || '-'}</td><td><button class="btn btn-outline" data-action="returns" style="padding: 4px 8px; font-size: 0.75rem; margin-right: 4px;" onclick="window.refundReturn('${r.id}')">Refund</button><button class="btn btn-outline" data-action="returns" style="padding: 4px 8px; font-size: 0.75rem; color: var(--red); border-color: var(--red);" onclick="window.rejectReturn('${r.id}')">Reject</button></td></tr>`).join('')
        )}</div></section>`;
        setTimeout(initReturnCharts, 0);
        const raiseBtn = document.getElementById('raiseReturnBtnDyn');
        if (raiseBtn) raiseBtn.addEventListener('click', window.raiseReturnRequest);
    }

    function renderReturnsRefined() {
        const view = getReturnView();

        const counts = view.reduce((acc, r) => {
            const s = String(r.status || '').toLowerCase();
            acc.total += 1;
            if (s.includes('refund')) acc.refunded += 1;
            else if (s.includes('reject')) acc.rejected += 1;
            else acc.pending += 1;
            acc.valueTotal += Number(r.amount || 0);
            if (s.includes('refund')) acc.valueRefunded += Number(r.amount || 0);
            if (!s.includes('refund') && !s.includes('reject')) acc.valueAtRisk += Number(r.amount || 0);
            return acc;
        }, { total: 0, pending: 0, refunded: 0, rejected: 0, valueTotal: 0, valueRefunded: 0, valueAtRisk: 0 });

        const productCounts = new Map();
        view.forEach(r => {
            const p = String(r.product || '').trim();
            if (!p || p === '-') return;
            productCounts.set(p, (productCounts.get(p) || 0) + 1);
        });
        const topProduct = Array.from(productCounts.entries()).sort((a, b) => b[1] - a[1])[0] || null;
        const topProductLabel = topProduct ? `${topProduct[0]} (${topProduct[1]})` : '&mdash;';

        content.innerHTML = `
        <div class="page-header">
            <h2>Returns</h2>
            <div class="page-header-actions">
                <button class="btn btn-primary" id="raiseReturnBtnDyn">+ Raise Return</button>
                <button class="btn btn-outline" onclick="window.print()">Print</button>
            </div>
        </div>

        <section class="stats-grid">
            <div class="stat-card">
                <div class="stat-icon si-red">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
                </div>
                <div class="stat-info">
                    <span class="stat-label">Total Requests</span>
                    <span class="stat-value">${counts.total}</span>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon si-amber">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                </div>
                <div class="stat-info">
                    <span class="stat-label">Pending / Open</span>
                    <span class="stat-value">${counts.pending}</span>
                    <div class="text-sm text-muted" style="margin-top:6px;">Pending ${counts.pending} &bull; Rejected ${counts.rejected}</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon si-green">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                </div>
                <div class="stat-info">
                    <span class="stat-label">Refunded Value</span>
                    <span class="stat-value">₹${Math.round(counts.valueRefunded).toLocaleString()}</span>
                    <div class="text-sm text-muted" style="margin-top:6px;">At risk ₹${Math.round(counts.valueAtRisk).toLocaleString()}</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon si-purple">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                </div>
                <div class="stat-info">
                    <span class="stat-label">Top Product</span>
                    <span class="stat-value" style="font-size: 1rem; font-weight: 700;">${topProductLabel}</span>
                </div>
            </div>
        </section>

        <section class="grid-3">
            <div class="card"><div class="card-hd"><h3>Top Returned Products</h3></div><div class="card-bd" style="position:relative;height:220px"><canvas id="retProductChart"></canvas></div></div>
            <div class="card"><div class="card-hd"><h3>Return Reasons</h3></div><div class="card-bd" style="position:relative;height:220px"><canvas id="retReasonChart"></canvas></div></div>
            <div class="card"><div class="card-hd"><h3>Status Breakdown</h3></div><div class="card-bd" style="position:relative;height:220px"><canvas id="retStatusChart"></canvas></div></div>
        </section>

        <section class="card">
            <div class="card-hd" style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
                <h3>Return Requests</h3>
                <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
                    <div class="chart-tabs" id="returnsFilters">
                        <button class="chart-tab active" type="button" data-filter="all">All</button>
                        <button class="chart-tab" type="button" data-filter="pending">Pending</button>
                        <button class="chart-tab" type="button" data-filter="refunded">Refunded</button>
                        <button class="chart-tab" type="button" data-filter="rejected">Rejected</button>
                    </div>
                    <select id="returnsSortSelect" class="toolbar-select">
                        <option value="updated_new">Updated newest</option>
                        <option value="updated_old">Updated oldest</option>
                        <option value="amount_high">Amount high-low</option>
                        <option value="amount_low">Amount low-high</option>
                        <option value="qty_high">Qty high-low</option>
                    </select>
                </div>
            </div>
            <div class="card-bd">
                <div class="tbl-wrap">
                    <table class="dt">
                        <thead>
                            <tr>
                                <th>Return</th>
                                <th>Order</th>
                                <th>Customer</th>
                                <th>Product</th>
                                <th>Qty</th>
                                <th>Reason</th>
                                <th>Amount</th>
                                <th>Status</th>
                                <th>Requested By</th>
                                <th>Updated</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="returnsTableBody"></tbody>
                    </table>
                </div>
            </div>
        </section>`;

        setTimeout(initReturnCharts, 0);

        const tbody = document.getElementById('returnsTableBody');
        const filterWrap = document.getElementById('returnsFilters');
        const sortSelect = document.getElementById('returnsSortSelect');

        function matchesFilter(item, filter) {
            const s = String(item.status || '').toLowerCase();
            if (filter === 'all') return true;
            if (filter === 'pending') return !s.includes('refund') && !s.includes('reject');
            if (filter === 'refunded') return s.includes('refund');
            if (filter === 'rejected') return s.includes('reject');
            return true;
        }

        function actionsFor(item) {
            const btn = (label, onClick, extraStyles) => `<button class="btn btn-outline" data-action="returns" style="padding: 4px 8px; font-size: 0.75rem; ${extraStyles || ''}" onclick="${onClick}">${label}</button>`;
            const s = String(item.status || '').toLowerCase();
            if (s.includes('refund') || s.includes('reject')) {
                return btn('Edit', `window.editReturn('${item.id}')`, '');
            }
            return [
                btn('Refund', `window.refundReturn('${item.id}')`, 'margin-right: 4px;'),
                btn('Reject', `window.rejectReturn('${item.id}')`, 'color: var(--red); border-color: var(--red);')
            ].join('');
        }

        function renderTable(filter) {
            if (!tbody) return;
            const rows = view
                .filter(r => matchesFilter(r, filter))
                .sort((a, b) => {
                    const sortKey = sortSelect ? sortSelect.value : 'updated_new';
                    const updatedA = parseOrderDate(a.updatedAt)?.getTime() || 0;
                    const updatedB = parseOrderDate(b.updatedAt)?.getTime() || 0;
                    if (sortKey === 'updated_old') return updatedA - updatedB;
                    if (sortKey === 'amount_high') return Math.max(0, Number(b.amount || 0)) - Math.max(0, Number(a.amount || 0));
                    if (sortKey === 'amount_low') return Math.max(0, Number(a.amount || 0)) - Math.max(0, Number(b.amount || 0));
                    if (sortKey === 'qty_high') return Math.max(0, Number(b.qty || 0)) - Math.max(0, Number(a.qty || 0));
                    return updatedB - updatedA;
                })
                .map(r => {
                    const qty = r.qty === null ? '&mdash;' : r.qty;
                    return `<tr>
                        <td class="cell-main">${r.id}</td>
                        <td>${r.oid}</td>
                        <td>${r.customer}</td>
                        <td>${r.product}</td>
                        <td>${qty}</td>
                        <td>${r.reason}</td>
                        <td>₹${Number(r.amount || 0).toLocaleString()}</td>
                        <td>${statusBadge(r.status)}</td>
                        <td>${r.requestedBy}</td>
                        <td>${r.updatedAt}</td>
                        <td>${actionsFor(r)}</td>
                    </tr>`;
                })
                .join('');

            tbody.innerHTML = rows || `<tr><td colspan="11" class="text-muted">No return requests found.</td></tr>`;
        }

        renderTable('all');

        if (filterWrap) {
            filterWrap.querySelectorAll('.chart-tab[data-filter]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const filter = btn.getAttribute('data-filter') || 'all';
                    filterWrap.querySelectorAll('.chart-tab').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    renderTable(filter);
                });
            });
        }
        if (sortSelect) {
            sortSelect.addEventListener('change', () => {
                const activeBtn = filterWrap ? filterWrap.querySelector('.chart-tab.active') : null;
                renderTable(activeBtn ? String(activeBtn.getAttribute('data-filter') || 'all') : 'all');
            });
        }

        const raiseBtn = document.getElementById('raiseReturnBtnDyn');
        if (raiseBtn) raiseBtn.addEventListener('click', window.raiseReturnRequest);
    }

    function renderReports() {
        const roleLabel = ROLE_LABELS[activeRoleKey] || 'Team Member';
        const scopedName = selectedBusiness ? ` - ${selectedBusiness.name}` : (activeBusinessName ? ` - ${activeBusinessName}` : '');
        const orderRows = orders.map(order => ({
            ...order,
            parsedDate: parseOrderDate(order && order.date)
        }));
        const returnRows = returns.map(item => ({
            ...item,
            parsedDate: parseOrderDate(item && item.updatedAt)
        }));
        const allDates = [...orderRows.map(item => item.parsedDate), ...returnRows.map(item => item.parsedDate)].filter(Boolean);
        const latestDataDate = allDates.length
            ? allDates.reduce((latest, item) => (item > latest ? item : latest), allDates[0])
            : new Date();

        function buildRangeStart(rangeKey) {
            if (rangeKey === 'all') return null;
            const days = { '7d': 7, '30d': 30, '90d': 90 }[rangeKey] || 30;
            const start = startOfDay(latestDataDate);
            start.setDate(start.getDate() - (days - 1));
            return start;
        }

        function matchesRange(dateValue, rangeKey) {
            if (rangeKey === 'all') return true;
            if (!(dateValue instanceof Date) || Number.isNaN(dateValue.getTime())) return false;
            const windowStart = buildRangeStart(rangeKey);
            const itemTime = startOfDay(dateValue).getTime();
            const endTime = startOfDay(latestDataDate).getTime();
            return itemTime >= windowStart.getTime() && itemTime <= endTime;
        }

        function getBucketMeta(dateValue, rangeKey) {
            const safeDate = dateValue instanceof Date && !Number.isNaN(dateValue.getTime())
                ? dateValue
                : latestDataDate;

            if (rangeKey === 'all') {
                return {
                    key: `${safeDate.getFullYear()}-${String(safeDate.getMonth() + 1).padStart(2, '0')}`,
                    label: safeDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
                    sortTimeMs: new Date(safeDate.getFullYear(), safeDate.getMonth(), 1).getTime()
                };
            }

            if (rangeKey === '90d') {
                const weekStart = startOfWeek(safeDate);
                return {
                    key: weekStart.toISOString().slice(0, 10),
                    label: `Week of ${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
                    sortTimeMs: weekStart.getTime()
                };
            }

            const dayStart = startOfDay(safeDate);
            return {
                key: dayStart.toISOString().slice(0, 10),
                label: dayStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                sortTimeMs: dayStart.getTime()
            };
        }

        function buildSummaryBuckets(filteredOrders, filteredReturns, rangeKey) {
            const bucketMap = new Map();

            filteredOrders.forEach(order => {
                const meta = getBucketMeta(order.parsedDate || latestDataDate, rangeKey);
                if (!bucketMap.has(meta.key)) {
                    bucketMap.set(meta.key, {
                        ...meta,
                        revenue: 0,
                        orders: 0,
                        returns: 0,
                        returnValue: 0
                    });
                }
                const entry = bucketMap.get(meta.key);
                entry.revenue += Math.max(0, Number(order.total || 0));
                entry.orders += 1;
            });

            filteredReturns.forEach(item => {
                const meta = getBucketMeta(item.parsedDate || latestDataDate, rangeKey);
                if (!bucketMap.has(meta.key)) {
                    bucketMap.set(meta.key, {
                        ...meta,
                        revenue: 0,
                        orders: 0,
                        returns: 0,
                        returnValue: 0
                    });
                }
                const entry = bucketMap.get(meta.key);
                entry.returns += 1;
                entry.returnValue += Math.max(0, Number(item.amount || 0));
            });

            return Array.from(bucketMap.values())
                .map(item => ({
                    ...item,
                    net: Math.max(0, item.revenue - item.returnValue)
                }))
                .sort((a, b) => b.sortTimeMs - a.sortTimeMs);
        }

        content.innerHTML = `
        <div class="page-header">
            <h2>Reports${scopedName}</h2>
            <div class="page-header-actions">
                <button class="btn btn-outline" onclick="window.print()">Print</button>
            </div>
        </div>
        <section class="card" style="margin-bottom:14px;">
            <div class="card-bd table-toolbar">
                <div class="toolbar-group">
                    <label class="toolbar-label" for="reportsTimeRange">Time range</label>
                    <select id="reportsTimeRange" class="toolbar-select">
                        <option value="7d">Last 7 days</option>
                        <option value="30d" selected>Last 30 days</option>
                        <option value="90d">Last 90 days</option>
                        <option value="all">All data</option>
                    </select>
                </div>
                <div class="toolbar-group">
                    <label class="toolbar-label" for="reportsSummarySort">Summary sort</label>
                    <select id="reportsSummarySort" class="toolbar-select">
                        <option value="newest">Newest first</option>
                        <option value="oldest">Oldest first</option>
                        <option value="revenue_high">Revenue high to low</option>
                        <option value="revenue_low">Revenue low to high</option>
                        <option value="orders_high">Most orders</option>
                        <option value="returns_high">Most returns</option>
                    </select>
                </div>
                <div class="toolbar-group">
                    <label class="toolbar-label" for="reportsSupplierSort">Supplier sort</label>
                    <select id="reportsSupplierSort" class="toolbar-select">
                        <option value="value_high">Stock value high to low</option>
                        <option value="value_low">Stock value low to high</option>
                        <option value="name">Supplier A-Z</option>
                        <option value="price_high">Avg price high to low</option>
                    </select>
                </div>
            </div>
        </section>
        <section class="stats-grid">
            <div class="stat-card">
                <div class="stat-icon si-green"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1v22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div>
                <div class="stat-info">
                    <span class="stat-label">Net Revenue</span>
                    <span class="stat-value" id="reportNetRevenue">Rs 0</span>
                    <div class="text-sm text-muted" style="margin-top:6px;">Role view: ${roleLabel}</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon si-blue"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/></svg></div>
                <div class="stat-info">
                    <span class="stat-label">Orders Processed</span>
                    <span class="stat-value" id="reportOrderCount">0</span>
                    <div class="text-sm text-muted" id="reportDeliveredMeta" style="margin-top:6px;">Delivered: 0</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon si-amber"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>
                <div class="stat-info">
                    <span class="stat-label">Avg Order Value</span>
                    <span class="stat-value" id="reportAvgOrderValue">Rs 0</span>
                    <div class="text-sm text-muted" id="reportCompletionMeta" style="margin-top:6px;">Completion rate: 0%</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon si-red"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg></div>
                <div class="stat-info">
                    <span class="stat-label">Return Value</span>
                    <span class="stat-value" id="reportReturnValue">Rs 0</span>
                    <div class="text-sm text-muted" id="reportPendingReturnsMeta" style="margin-top:6px;">Pending returns: 0</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon si-purple"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="M19 9l-5 5-4-4-3 3"/></svg></div>
                <div class="stat-info">
                    <span class="stat-label">Revenue Window</span>
                    <span class="stat-value" id="reportRevenueWindow">0 buckets</span>
                    <div class="text-sm text-muted" id="reportScopeMeta" style="margin-top:6px;">Inventory alerts: 0</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon si-blue"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 7h-9"/><path d="M14 17H5"/><circle cx="17" cy="17" r="3"/><circle cx="7" cy="7" r="3"/></svg></div>
                <div class="stat-info">
                    <span class="stat-label">Top Suppliers</span>
                    <span class="stat-value" id="reportSupplierCount">0</span>
                    <div class="text-sm text-muted" id="reportSupplierMeta" style="margin-top:6px;">Current stock snapshot</div>
                </div>
            </div>
        </section>
        <section class="grid-2">
            <div class="card"><div class="card-hd"><h3>Revenue Trend</h3></div><div class="card-bd" style="position:relative;height:260px"><canvas id="repRevChart"></canvas></div></div>
            <div class="card"><div class="card-hd"><h3>Order Status Mix</h3></div><div class="card-bd" style="position:relative;height:260px"><canvas id="repStatusChart"></canvas></div></div>
        </section>
        <section class="grid-2">
            <div class="card"><div class="card-hd"><h3>Payment Method Mix</h3></div><div class="card-bd" style="position:relative;height:240px"><canvas id="repPaymentChart"></canvas></div></div>
            <div class="card"><div class="card-hd"><h3>Supplier Stock Value</h3></div><div class="card-bd"><div class="tbl-wrap"><table class="dt"><thead><tr><th>Rank</th><th>Supplier</th><th>SKUs</th><th>Avg Price</th><th>Stock Value</th></tr></thead><tbody id="reportsSupplierTableBody"></tbody></table></div></div></div>
        </section>
        <section class="card"><div class="card-hd"><h3>Period Summary</h3></div><div class="card-bd"><div class="tbl-wrap"><table class="dt"><thead><tr><th>Period</th><th>Revenue</th><th>Orders</th><th>Returns</th><th>Net</th></tr></thead><tbody id="reportsSummaryTableBody"></tbody></table></div></div></section>`;

        const timeRangeSelect = document.getElementById('reportsTimeRange');
        const summarySortSelect = document.getElementById('reportsSummarySort');
        const supplierSortSelect = document.getElementById('reportsSupplierSort');
        const summaryBody = document.getElementById('reportsSummaryTableBody');
        const supplierBody = document.getElementById('reportsSupplierTableBody');

        function setText(id, value) {
            const node = document.getElementById(id);
            if (node) node.textContent = value;
        }

        function renderReportView() {
            const rangeKey = timeRangeSelect ? timeRangeSelect.value : '30d';
            const filteredOrders = orderRows.filter(item => matchesRange(item.parsedDate, rangeKey));
            const filteredReturns = returnRows.filter(item => matchesRange(item.parsedDate, rangeKey));

            const totalRevenue = filteredOrders.reduce((sum, order) => sum + Math.max(0, Number(order && order.total) || 0), 0);
            const totalReturnsValue = filteredReturns.reduce((sum, item) => sum + Math.max(0, Number(item && item.amount) || 0), 0);
            const netRevenue = Math.max(0, totalRevenue - totalReturnsValue);
            const avgOrderValue = filteredOrders.length ? Math.round(totalRevenue / filteredOrders.length) : 0;
            const deliveredOrders = filteredOrders.filter(order => normalizeOrderStatus(order && order.status) === 'Delivered').length;
            const completionRate = filteredOrders.length ? Math.round((deliveredOrders / filteredOrders.length) * 100) : 0;
            const pendingReturns = filteredReturns.filter(item => String(item && item.status || '').trim().toLowerCase().includes('pending')).length;
            const inventoryAlerts = inventory.filter(item => normalizeInventoryStatus(item && item.status, item && item.stock) !== 'In Stock').length;

            const summaryRows = buildSummaryBuckets(filteredOrders, filteredReturns, rangeKey);
            const sortedSummaryRows = summaryRows.slice().sort((a, b) => {
                const sortKey = summarySortSelect ? summarySortSelect.value : 'newest';
                if (sortKey === 'oldest') return a.sortTimeMs - b.sortTimeMs;
                if (sortKey === 'revenue_high') return b.revenue - a.revenue;
                if (sortKey === 'revenue_low') return a.revenue - b.revenue;
                if (sortKey === 'orders_high') return b.orders - a.orders;
                if (sortKey === 'returns_high') return b.returns - a.returns;
                return b.sortTimeMs - a.sortTimeMs;
            });

            if (summaryBody) {
                summaryBody.innerHTML = sortedSummaryRows.length
                    ? sortedSummaryRows.map(item => `<tr><td class="cell-main">${item.label}</td><td>Rs ${Math.round(item.revenue).toLocaleString()}</td><td>${item.orders}</td><td>${item.returns}</td><td>Rs ${Math.round(item.net).toLocaleString()}</td></tr>`).join('')
                    : '<tr><td colspan="5" class="text-muted">No report data available in this range.</td></tr>';
            }

            const supplierRows = Array.from(
                inventory.reduce((acc, item) => {
                    const supplier = getSupplierDetails(item);
                    const key = supplier.name || 'Unknown Supplier';
                    if (!acc.has(key)) {
                        acc.set(key, {
                            supplier: key,
                            skus: 0,
                            totalPrice: 0,
                            stockValue: 0
                        });
                    }
                    const entry = acc.get(key);
                    entry.skus += 1;
                    entry.totalPrice += Math.max(0, Number(item && item.price) || 0);
                    entry.stockValue += Math.max(0, Number(item && item.price) || 0) * Math.max(0, Number(item && item.stock) || 0);
                    return acc;
                }, new Map()).values()
            ).map(item => ({
                ...item,
                avgPrice: item.skus ? item.totalPrice / item.skus : 0
            }));

            const sortedSupplierRows = supplierRows.slice().sort((a, b) => {
                const sortKey = supplierSortSelect ? supplierSortSelect.value : 'value_high';
                if (sortKey === 'value_low') return a.stockValue - b.stockValue;
                if (sortKey === 'name') return a.supplier.localeCompare(b.supplier);
                if (sortKey === 'price_high') return b.avgPrice - a.avgPrice;
                return b.stockValue - a.stockValue;
            });

            if (supplierBody) {
                supplierBody.innerHTML = sortedSupplierRows.length
                    ? sortedSupplierRows.map((item, index) => `<tr><td class="cell-main">#${index + 1}</td><td>${item.supplier}</td><td>${item.skus}</td><td>Rs ${Math.round(item.avgPrice).toLocaleString()}</td><td>Rs ${Math.round(item.stockValue).toLocaleString()}</td></tr>`).join('')
                    : '<tr><td colspan="5" class="text-muted">No supplier records available.</td></tr>';
            }

            const paymentBuckets = new Map();
            filteredOrders.forEach(order => {
                const paymentLabel = String(order && order.payment || 'Unknown').trim() || 'Unknown';
                paymentBuckets.set(paymentLabel, (paymentBuckets.get(paymentLabel) || 0) + 1);
            });

            const trendRows = summaryRows.slice().sort((a, b) => a.sortTimeMs - b.sortTimeMs);
            currentReportChartState = {
                revenueTrend: {
                    labels: trendRows.length ? trendRows.map(item => item.label) : ['No data'],
                    values: trendRows.length ? trendRows.map(item => Math.round(item.revenue)) : [0]
                },
                statusCounts: {
                    delivered: filteredOrders.filter(order => normalizeOrderStatus(order && order.status) === 'Delivered').length,
                    processing: filteredOrders.filter(order => normalizeOrderStatus(order && order.status) === 'Processing').length,
                    pending: filteredOrders.filter(order => normalizeOrderStatus(order && order.status) === 'Pending').length,
                    cancelled: filteredOrders.filter(order => normalizeOrderStatus(order && order.status) === 'Cancelled').length
                },
                paymentLabels: Array.from(paymentBuckets.keys()),
                paymentValues: Array.from(paymentBuckets.values())
            };

            setText('reportNetRevenue', `Rs ${netRevenue.toLocaleString()}`);
            setText('reportOrderCount', filteredOrders.length.toLocaleString());
            setText('reportAvgOrderValue', `Rs ${avgOrderValue.toLocaleString()}`);
            setText('reportReturnValue', `Rs ${totalReturnsValue.toLocaleString()}`);
            setText('reportDeliveredMeta', `Delivered: ${deliveredOrders}`);
            setText('reportCompletionMeta', `Completion rate: ${completionRate}%`);
            setText('reportPendingReturnsMeta', `Pending returns: ${pendingReturns}`);
            setText('reportRevenueWindow', `${summaryRows.length} bucket${summaryRows.length === 1 ? '' : 's'}`);
            setText('reportScopeMeta', `Inventory alerts: ${inventoryAlerts}`);
            setText('reportSupplierCount', sortedSupplierRows.length.toLocaleString());
            setText('reportSupplierMeta', sortedSupplierRows.length ? `${sortedSupplierRows[0].supplier} leads current value` : 'Current stock snapshot');

            if (activeCharts.length) {
                activeCharts.forEach(chart => chart.destroy());
                activeCharts = [];
            }
            setTimeout(initReportCharts, 0);
        }

        [timeRangeSelect, summarySortSelect, supplierSortSelect].forEach(control => {
            if (control) control.addEventListener('change', renderReportView);
        });

        renderReportView();
    }

    function renderUsers() {
        const userRows = users.map(user => ({
            ...user,
            normalizedRole: String(user && user.role || 'Unassigned').trim() || 'Unassigned',
            normalizedStatus: String(user && user.status || 'Inactive').trim() || 'Inactive'
        }));
        const roleOptions = Array.from(new Set(userRows.map(item => item.normalizedRole))).sort();
        const statusOptions = Array.from(new Set(userRows.map(item => item.normalizedStatus))).sort();

        content.innerHTML = `
        <div class="page-header"><h2>Users</h2><div class="page-header-actions"><button class="btn btn-primary" id="addUserBtnDyn">+ Add User</button></div></div>
        <section class="card" style="margin-bottom:14px;">
            <div class="card-bd table-toolbar">
                <div class="toolbar-group"><label class="toolbar-label" for="usersRoleFilter">Role</label><select id="usersRoleFilter" class="toolbar-select"><option value="all">All roles</option>${roleOptions.map(option => `<option value="${option}">${option}</option>`).join('')}</select></div>
                <div class="toolbar-group"><label class="toolbar-label" for="usersStatusFilter">Status</label><select id="usersStatusFilter" class="toolbar-select"><option value="all">All statuses</option>${statusOptions.map(option => `<option value="${option}">${option}</option>`).join('')}</select></div>
                <div class="toolbar-group"><label class="toolbar-label" for="usersSortSelect">Sort by</label><select id="usersSortSelect" class="toolbar-select"><option value="name">Name A-Z</option><option value="role">Role A-Z</option><option value="status">Status A-Z</option></select></div>
            </div>
        </section>
        <section class="card"><div class="card-bd"><div class="tbl-wrap"><table class="dt"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead><tbody id="usersTableBodyDyn"></tbody></table></div></div></section>`;

        const tbody = document.getElementById('usersTableBodyDyn');
        const roleFilter = document.getElementById('usersRoleFilter');
        const statusFilter = document.getElementById('usersStatusFilter');
        const sortSelect = document.getElementById('usersSortSelect');

        function renderTable() {
            if (!tbody) return;
            const filteredRows = userRows
                .filter(item => {
                    if (roleFilter && roleFilter.value !== 'all' && item.normalizedRole !== roleFilter.value) return false;
                    if (statusFilter && statusFilter.value !== 'all' && item.normalizedStatus !== statusFilter.value) return false;
                    return true;
                })
                .sort((a, b) => {
                    const sortKey = sortSelect ? sortSelect.value : 'name';
                    if (sortKey === 'role') return a.normalizedRole.localeCompare(b.normalizedRole);
                    if (sortKey === 'status') return a.normalizedStatus.localeCompare(b.normalizedStatus);
                    return String(a.name || '').localeCompare(String(b.name || ''));
                });

            tbody.innerHTML = filteredRows.length
                ? filteredRows.map(item => {
                    const token = encodeUserToken(item.name);
                    return `<tr><td class="cell-main">${item.name}</td><td>${item.email || ''}</td><td>${item.normalizedRole}</td><td>${statusBadge(item.normalizedStatus)}</td><td><button class="btn btn-outline" style="padding: 4px 8px; font-size: 0.75rem; margin-right: 4px;" onclick="window.renderUserProfile('${token}')">View</button><button class="btn btn-outline" style="padding: 4px 8px; font-size: 0.75rem; margin-right: 4px;" onclick="window.editUser('${token}')">Edit</button><button class="btn btn-outline" style="padding: 4px 8px; font-size: 0.75rem; color: var(--red); border-color: var(--red);" onclick="window.deleteUser('${token}')">Delete</button></td></tr>`;
                }).join('')
                : '<tr><td colspan="5" class="text-muted">No users match the selected filters.</td></tr>';
        }

        [roleFilter, statusFilter, sortSelect].forEach(control => {
            if (control) control.addEventListener('change', renderTable);
        });

        renderTable();
        const dynBtn = document.getElementById('addUserBtnDyn');
        if (dynBtn) dynBtn.addEventListener('click', openAddUserModal);
    }

    function renderBusinesses() {
        const paymentDueTotal = businesses.reduce((sum, b) => sum + Number(b.paymentDue || 0), 0);
        const activeCount = businesses.filter(b => b.status === 'Active').length;
        const trialCount = businesses.filter(b => b.status === 'Trial').length;
        const statusOptions = Array.from(new Set(businesses.map(item => String(item && item.status || 'Unknown').trim() || 'Unknown'))).sort();
        const planOptions = Array.from(new Set(businesses.map(item => String(item && (item.productsPlan || item.type) || 'Unknown').trim() || 'Unknown'))).sort();

        content.innerHTML = `
        <div class="page-header"><h2>Businesses Using Your Products</h2><div class="page-header-actions"><button class="btn btn-primary" data-action="businesses" onclick="window.addBusiness()">+ Add Business</button></div></div>
        <section class="stats-grid">
            <div class="stat-card"><div class="stat-icon si-blue"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18"/><rect x="4" y="3" width="7" height="14" rx="1"/><rect x="13" y="7" width="7" height="10" rx="1"/></svg></div><div class="stat-info"><span class="stat-label">Total Businesses</span><span class="stat-value">${businesses.length}</span></div></div>
            <div class="stat-card"><div class="stat-icon si-green"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg></div><div class="stat-info"><span class="stat-label">Active Stores</span><span class="stat-value">${activeCount}</span></div></div>
            <div class="stat-card"><div class="stat-icon si-amber"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div><div class="stat-info"><span class="stat-label">Trial Stores</span><span class="stat-value">${trialCount}</span></div></div>
            <div class="stat-card"><div class="stat-icon si-red"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg></div><div class="stat-info"><span class="stat-label">Pending Payments</span><span class="stat-value">Rs ${paymentDueTotal.toLocaleString()}</span></div></div>
        </section>
        <section class="card" style="margin-bottom:14px;">
            <div class="card-bd table-toolbar">
                <div class="toolbar-group"><label class="toolbar-label" for="businessStatusFilter">Status</label><select id="businessStatusFilter" class="toolbar-select"><option value="all">All statuses</option>${statusOptions.map(option => `<option value="${option}">${option}</option>`).join('')}</select></div>
                <div class="toolbar-group"><label class="toolbar-label" for="businessPlanFilter">Plan / Type</label><select id="businessPlanFilter" class="toolbar-select"><option value="all">All plans</option>${planOptions.map(option => `<option value="${option}">${option}</option>`).join('')}</select></div>
                <div class="toolbar-group"><label class="toolbar-label" for="businessSortSelect">Sort by</label><select id="businessSortSelect" class="toolbar-select"><option value="payment_due">Payment due</option><option value="profit">Profit</option><option value="stores">Stores</option><option value="tenure">Tenure</option></select></div>
            </div>
        </section>
        <section class="card"><div class="card-hd"><h3>All Client Businesses</h3></div><div class="card-bd"><div class="tbl-wrap"><table class="dt"><thead><tr><th>Business ID</th><th>Business Name</th><th>Using BillBhai</th><th>Stores</th><th>Profit</th><th>Payment Due</th><th>Status</th><th>Actions</th></tr></thead><tbody id="businessesTableBodyDyn"></tbody></table></div></div></section>`;

        const tbody = document.getElementById('businessesTableBodyDyn');
        const statusFilter = document.getElementById('businessStatusFilter');
        const planFilter = document.getElementById('businessPlanFilter');
        const sortSelect = document.getElementById('businessSortSelect');

        function renderTable() {
            if (!tbody) return;
            const filteredRows = businesses
                .filter(item => {
                    const planLabel = String(item.productsPlan || item.type || 'Unknown').trim() || 'Unknown';
                    if (statusFilter && statusFilter.value !== 'all' && String(item.status || '').trim() !== statusFilter.value) return false;
                    if (planFilter && planFilter.value !== 'all' && planLabel !== planFilter.value) return false;
                    return true;
                })
                .slice()
                .sort((a, b) => {
                    const sortKey = sortSelect ? sortSelect.value : 'payment_due';
                    if (sortKey === 'profit') return Math.max(0, Number(b.profit || 0)) - Math.max(0, Number(a.profit || 0));
                    if (sortKey === 'stores') return Math.max(0, Number(b.storesCount || 0)) - Math.max(0, Number(a.storesCount || 0));
                    if (sortKey === 'tenure') return Math.max(0, Number(b.tenureMonths || 0)) - Math.max(0, Number(a.tenureMonths || 0));
                    return Math.max(0, Number(b.paymentDue || 0)) - Math.max(0, Number(a.paymentDue || 0));
                });

            tbody.innerHTML = filteredRows.length
                ? filteredRows.map(item => `<tr><td class="cell-main">${item.id}</td><td><button class="btn btn-outline" data-action="businesses" style="padding: 2px 8px; font-size: 0.75rem;" onclick="window.openBusinessDetails('${item.id}')">${item.name}</button></td><td>${item.tenureMonths} months</td><td>${item.storesCount}</td><td>Rs ${Number(item.profit || 0).toLocaleString()}</td><td>Rs ${Number(item.paymentDue || 0).toLocaleString()}</td><td>${statusBadge(item.status)}</td><td><button class="btn btn-outline" data-action="businesses" style="padding: 4px 8px; font-size: 0.75rem; margin-right: 4px;" onclick="window.openBusinessAdminDashboard('${item.id}')">View</button><button class="btn btn-outline" data-action="businesses" style="padding: 4px 8px; font-size: 0.75rem; margin-right: 4px;" onclick="window.editBusiness('${item.id}')">Edit</button><button class="btn btn-outline" data-action="businesses" style="padding: 4px 8px; font-size: 0.75rem; color: var(--red); border-color: var(--red);" onclick="window.deleteBusiness('${item.id}')">Delete</button></td></tr>`).join('')
                : '<tr><td colspan="8" class="text-muted">No businesses match the selected filters.</td></tr>';
        }

        [statusFilter, planFilter, sortSelect].forEach(control => {
            if (control) control.addEventListener('change', renderTable);
        });

        renderTable();
    }
    function renderBusinessDetails(businessId) {
        const b = businesses.find(x => x.id === businessId);
        if (!b) {
            renderBusinesses();
            return;
        }

        const usersRows = (b.users || []).map((u, idx) => `<tr><td class="cell-main">${u.name}</td><td>${u.role}</td><td>${statusBadge(u.status)}</td><td><button class="btn btn-outline" data-action="businesses" style="padding: 4px 8px; font-size: 0.75rem; margin-right: 4px;" onclick="window.editBusinessUser('${b.id}', ${idx})">Edit</button><button class="btn btn-outline" data-action="businesses" style="padding: 4px 8px; font-size: 0.75rem; color: var(--red); border-color: var(--red);" onclick="window.deleteBusinessUser('${b.id}', ${idx})">Delete</button></td></tr>`).join('');
        const storesRows = (b.stores || []).map((s, idx) => `<tr><td class="cell-main">${s.code}</td><td>${s.city}</td><td>${statusBadge(s.status)}</td><td><button class="btn btn-outline" data-action="businesses" style="padding: 4px 8px; font-size: 0.75rem; margin-right: 4px;" onclick="window.editBusinessStore('${b.id}', ${idx})">Edit</button><button class="btn btn-outline" data-action="businesses" style="padding: 4px 8px; font-size: 0.75rem; color: var(--red); border-color: var(--red);" onclick="window.deleteBusinessStore('${b.id}', ${idx})">Delete</button></td></tr>`).join('');
        const paymentRows = (b.payments || []).map((p, idx) => `<tr><td class="cell-main">${p.month}</td><td>₹${Number(p.amount || 0).toLocaleString()}</td><td>${statusBadge(p.status)}</td><td><button class="btn btn-outline" data-action="businesses" style="padding: 4px 8px; font-size: 0.75rem; margin-right: 4px;" onclick="window.editBusinessPayment('${b.id}', ${idx})">Edit</button><button class="btn btn-outline" data-action="businesses" style="padding: 4px 8px; font-size: 0.75rem; color: var(--red); border-color: var(--red);" onclick="window.deleteBusinessPayment('${b.id}', ${idx})">Delete</button></td></tr>`).join('');

        content.innerHTML = `
        <div class="page-header"><h2>${b.name}</h2><div class="page-header-actions"><button class="btn btn-outline" data-action="businesses" onclick="window.renderBusinessesHome()">Back to Businesses</button><button class="btn btn-outline" data-action="businesses" onclick="window.editBusiness('${b.id}')">Edit</button><button class="btn btn-outline" data-action="businesses" style="color: var(--red); border-color: var(--red);" onclick="window.deleteBusiness('${b.id}')">Delete</button></div></div>
        <section class="stats-grid">
            <div class="stat-card"><div class="stat-info"><span class="stat-label">Using BillBhai</span><span class="stat-value">${b.tenureMonths} months</span></div></div>
            <div class="stat-card"><div class="stat-info"><span class="stat-label">Stores</span><span class="stat-value">${b.storesCount}</span></div></div>
            <div class="stat-card"><div class="stat-info"><span class="stat-label">Profit</span><span class="stat-value">₹${Number(b.profit || 0).toLocaleString()}</span></div></div>
            <div class="stat-card"><div class="stat-info"><span class="stat-label">Payment Due</span><span class="stat-value">₹${Number(b.paymentDue || 0).toLocaleString()}</span></div></div>
        </section>
        <section class="grid-2" style="margin-top: 12px;">
            <div class="card"><div class="card-hd"><h3>Business Profile</h3></div><div class="card-bd"><div class="text-muted" style="display:flex;flex-direction:column;gap:8px;"><div><strong>Owner:</strong> ${b.owner}</div><div><strong>Admin:</strong> ${b.adminName}</div><div><strong>Type:</strong> ${b.type}</div><div><strong>Email:</strong> ${b.email}</div><div><strong>Phone:</strong> ${b.phone}</div><div><strong>Plan:</strong> ${b.productsPlan}</div><div><strong>Status:</strong> ${statusBadge(b.status)}</div></div></div></div>
            <div class="card"><div class="card-hd" style="display:flex;justify-content:space-between;align-items:center;"><h3>Store Locations</h3><button class="btn btn-outline" data-action="businesses" style="padding: 4px 10px;" onclick="window.addBusinessStore('${b.id}')">+ Add Store</button></div><div class="card-bd">${table(['Store Code', 'City', 'Status', 'Actions'], storesRows || '<tr><td colspan="4" class="text-muted">No stores found.</td></tr>')}</div></div>
        </section>
        <section class="grid-2" style="margin-top: 12px;">
            <div class="card"><div class="card-hd" style="display:flex;justify-content:space-between;align-items:center;"><h3>Business Users</h3><button class="btn btn-outline" data-action="businesses" style="padding: 4px 10px;" onclick="window.addBusinessUser('${b.id}')">+ Add User</button></div><div class="card-bd">${table(['Name', 'Role', 'Status', 'Actions'], usersRows || '<tr><td colspan="4" class="text-muted">No users found.</td></tr>')}</div></div>
            <div class="card"><div class="card-hd" style="display:flex;justify-content:space-between;align-items:center;"><h3>Payment History</h3><button class="btn btn-outline" data-action="businesses" style="padding: 4px 10px;" onclick="window.addBusinessPayment('${b.id}')">+ Add Payment</button></div><div class="card-bd">${table(['Month', 'Amount', 'Status', 'Actions'], paymentRows || '<tr><td colspan="4" class="text-muted">No payments found.</td></tr>')}</div></div>
        </section>`;
        enforceActionPermissions();
    }

    function getNextBusinessId() {
        const nums = businesses.map(b => parseInt(String(b.id || '').replace('BIZ-', ''), 10)).filter(n => !Number.isNaN(n));
        const next = nums.length ? Math.max(...nums) + 1 : 101;
        return `BIZ-${next}`;
    }

    function upsertBusiness(record, existingId) {
        const existingIdx = businesses.findIndex(b => b.id === existingId || b.id === record.id);
        if (existingIdx !== -1) {
            businesses[existingIdx] = record;
        } else {
            businesses.unshift(record);
        }
        saveList('bb_businesses', businesses);
    }

    function findBusinessIndex(id) {
        return businesses.findIndex(b => b.id === id);
    }

    function recalcBusinessDerivedFields(b) {
        if (!b) return;
        b.storesCount = Array.isArray(b.stores) ? b.stores.length : 0;
        const paymentEntries = Array.isArray(b.payments) ? b.payments : [];
        b.paymentDue = paymentEntries
            .filter(p => String(p.status || '').toLowerCase() !== 'paid')
            .reduce((sum, p) => sum + Number(p.amount || 0), 0);
    }

    function saveBusinessAndRefresh(id) {
        const idx = findBusinessIndex(id);
        if (idx === -1) return;
        recalcBusinessDerivedFields(businesses[idx]);
        saveList('bb_businesses', businesses);
        renderBusinessDetails(id);
    }

    const USER_MANAGED_ROLE_OPTIONS = ['Admin', 'Cashier', 'Return Handler', 'Inventory Manager', 'Delivery Ops', 'Customer', 'Super User'];
    const CORE_AUTH_USER_KEYS = new Set(['superuser', 'admin', 'cashier', 'returnhandler', 'inventorymanager', 'deliveryops', 'customer', 'chirag']);

    function escapeHtml(text) {
        return String(text || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function decodeUserToken(value) {
        const raw = String(value || '').trim();
        if (!raw) return '';
        try {
            return decodeURIComponent(raw);
        } catch (err) {
            return raw;
        }
    }

    function encodeUserToken(value) {
        return encodeURIComponent(String(value || '').trim());
    }

    function normalizeAuthUserKey(value) {
        return String(value || '')
            .trim()
            .toLowerCase()
            .replace(/\s+/g, '')
            .replace(/[^a-z0-9._-]/g, '');
    }

    function mapUserRoleToAuthRole(roleLabel) {
        const key = normalizeRole(roleLabel);
        if (key === 'superuser' || key === 'super') return 'Super User';
        if (key === 'admin' || key === 'opshead' || key === 'storemanager' || key === 'accountant' || key === 'supportagent') return 'Admin';
        if (key === 'cashier') return 'Cashier';
        if (key === 'returnhandler' || key === 'returns') return 'Return Handler';
        if (key === 'inventorymanager' || key === 'inventory') return 'Inventory Manager';
        if (key === 'deliveryops' || key === 'delivery' || key === 'deliverymanager' || key === 'deliverydriver') return 'Delivery Ops';
        if (key === 'customer' || key === 'user') return 'Customer';
        return 'Admin';
    }

    function buildUsernameSeed(name, email) {
        const emailSeed = String(email || '').trim().split('@')[0] || '';
        const nameSeed = String(name || '').trim().toLowerCase().replace(/\s+/g, '.');
        const rawSeed = emailSeed || nameSeed || 'user';
        return normalizeAuthUserKey(rawSeed) || `user${Math.floor(Math.random() * 900 + 100)}`;
    }

    function usernameTaken(usernameKey, existingOwnerName) {
        if (!usernameKey) return true;
        if (CORE_AUTH_USER_KEYS.has(usernameKey)) return true;

        const overrides = loadObject(AUTH_OVERRIDE_STORAGE_KEY, {});
        if (Object.prototype.hasOwnProperty.call(overrides, usernameKey)) {
            const owner = String(overrides[usernameKey] && overrides[usernameKey].name || '').trim();
            if (!existingOwnerName || owner !== existingOwnerName) return true;
        }

        return users.some(user => {
            const currentKey = normalizeAuthUserKey(user && user.username);
            if (!currentKey) return false;
            if (currentKey !== usernameKey) return false;
            const ownerName = String(user && user.name || '').trim();
            return !existingOwnerName || ownerName !== existingOwnerName;
        });
    }

    function generateUniqueUsername(name, email, existingUsername) {
        const currentKey = normalizeAuthUserKey(existingUsername);
        if (currentKey) return currentKey;

        const base = buildUsernameSeed(name, email);
        let candidate = base;
        let suffix = 2;
        while (usernameTaken(candidate, String(name || '').trim())) {
            candidate = `${base}${suffix}`;
            suffix += 1;
        }
        return candidate;
    }

    function generateTemporaryPassword() {
        const randomPart = Math.random().toString(36).slice(2, 8);
        const numberPart = String(Math.floor(Math.random() * 90) + 10);
        return `Bb${randomPart}${numberPart}!`;
    }

    function getUserLoginHandle(user) {
        const username = normalizeAuthUserKey(user && user.username);
        if (username) return username;

        const email = String(user && user.email || '').trim().toLowerCase();
        if (email) return email;

        return buildUsernameSeed(user && user.name, email);
    }

    function showCredentialsModal(title, credential) {
        if (!credential) return;

        openQuickConfirmModal({
            title,
            message: `Share these credentials with ${escapeHtml(credential.name)}:<br><br><strong>Username:</strong> ${escapeHtml(credential.username)}<br><strong>Password:</strong> ${escapeHtml(credential.password)}<br><strong>Role:</strong> ${escapeHtml(credential.role)}<br><strong>Email:</strong> ${escapeHtml(credential.email || '-')}`,
            confirmLabel: 'Done',
            onConfirm: () => {}
        });
    }

    function upsertAuthCredentialsForUser(userRecord, options) {
        const opts = options && typeof options === 'object' ? options : {};
        const userName = String(userRecord && userRecord.name || '').trim();
        const userEmail = String(userRecord && userRecord.email || '').trim();
        const userStatus = String(userRecord && userRecord.status || 'Active').trim() || 'Active';
        const existingUsername = normalizeAuthUserKey(opts.existingUsername || userRecord && userRecord.username);
        const username = generateUniqueUsername(userName, userEmail, existingUsername);

        const overrides = loadObject(AUTH_OVERRIDE_STORAGE_KEY, {});
        const previousRecord = existingUsername && overrides[existingUsername] && typeof overrides[existingUsername] === 'object'
            ? overrides[existingUsername]
            : {};
        const currentRecord = overrides[username] && typeof overrides[username] === 'object'
            ? overrides[username]
            : {};

        const knownPassword = String(currentRecord.password || previousRecord.password || '').trim();
        const forcedPassword = String(opts.forcePassword || '').trim();
        const password = forcedPassword || knownPassword || generateTemporaryPassword();

        if (existingUsername && existingUsername !== username) {
            delete overrides[existingUsername];
        }

        overrides[username] = {
            ...currentRecord,
            username,
            email: userEmail,
            name: userName,
            role: mapUserRoleToAuthRole(userRecord && userRecord.role),
            status: userStatus,
            password
        };

        saveObject(AUTH_OVERRIDE_STORAGE_KEY, overrides);

        return {
            username,
            password,
            generated: !forcedPassword && !knownPassword
        };
    }

    function removeAuthCredentialsForUser(userRecord) {
        const overrides = loadObject(AUTH_OVERRIDE_STORAGE_KEY, {});
        const username = normalizeAuthUserKey(userRecord && userRecord.username);
        const userEmail = String(userRecord && userRecord.email || '').trim().toLowerCase();
        const userName = String(userRecord && userRecord.name || '').trim().toLowerCase();

        if (username && Object.prototype.hasOwnProperty.call(overrides, username)) {
            delete overrides[username];
            saveObject(AUTH_OVERRIDE_STORAGE_KEY, overrides);
            return;
        }

        Object.keys(overrides).forEach(key => {
            const record = overrides[key] && typeof overrides[key] === 'object' ? overrides[key] : {};
            const recordEmail = String(record.email || '').trim().toLowerCase();
            const recordName = String(record.name || '').trim().toLowerCase();
            if ((userEmail && recordEmail === userEmail) || (userName && recordName === userName)) {
                delete overrides[key];
            }
        });

        saveObject(AUTH_OVERRIDE_STORAGE_KEY, overrides);
    }

    function renderUserProfile(username) {
        const decodedUsername = decodeUserToken(username);
        const user = users.find(u => u.name === decodedUsername);
        if (!user) return;

        const initial = user.name.charAt(0).toUpperCase();
        const email = String(user.email || `${user.name.toLowerCase().replace(/\s+/g, '.')}@billbhai.com`).trim();
        const loginHandle = getUserLoginHandle(user);
        const userToken = encodeUserToken(user.name);
        const normalizedStatus = String(user.status || '').toLowerCase();

        let activityHtml = '';
        if (user.role === 'Delivery') {
            activityHtml = `
             <div class="timeline-item"><div class="timeline-marker"></div><div class="timeline-time">Today, 11:30</div><div class="timeline-content">Delivered Order <strong>#ORD-4819</strong></div></div>
             <div class="timeline-item"><div class="timeline-marker"></div><div class="timeline-time">Today, 09:15</div><div class="timeline-content">Out for delivery with 4 orders</div></div>
             <div class="timeline-item"><div class="timeline-marker"></div><div class="timeline-time">Yesterday, 17:00</div><div class="timeline-content">Finished shift</div></div>`;
        } else if (user.role === 'Sales') {
            activityHtml = `
             <div class="timeline-item"><div class="timeline-marker"></div><div class="timeline-time">Today, 14:02</div><div class="timeline-content">Created Order <strong>#ORD-4821</strong> for ₹1250</div></div>
             <div class="timeline-item"><div class="timeline-marker"></div><div class="timeline-time">Yesterday, 16:45</div><div class="timeline-content">Processed Return <strong>#RET-201</strong></div></div>
             <div class="timeline-item"><div class="timeline-marker"></div><div class="timeline-time">Yesterday, 10:30</div><div class="timeline-content">Logged in</div></div>`;
        } else {
            activityHtml = `
             <div class="timeline-item"><div class="timeline-marker"></div><div class="timeline-time">Today, 10:12</div><div class="timeline-content">Updated inventory stock for <strong>SKU-05</strong></div></div>
             <div class="timeline-item"><div class="timeline-marker"></div><div class="timeline-time">14 Feb, 09:00</div><div class="timeline-content">System login</div></div>`;
        }

        content.innerHTML = `
        <div class="page-header" style="justify-content: flex-start; gap: 16px;">
            <button class="btn btn-outline" style="padding: 8px;" onclick="document.querySelector('.nav-item[data-page=\\'users\\']').click()"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg></button>
            <h2>User Details</h2>
        </div>
        <section class="grid-2">
            <div style="display: flex; flex-direction: column; gap: 20px;">
                <div class="card">
                    <div class="card-bd" style="text-align: center; padding-top: 30px;">
                        <div style="width: 80px; height: 80px; border-radius: 50%; background: linear-gradient(135deg, var(--blue), var(--amber)); margin: 0 auto 16px; display: flex; align-items: center; justify-content: center; font-size: 2rem; color: #fff; font-weight: 700;">${initial}</div>
                        <h3 style="font-size: 1.2rem; margin-bottom: 4px;">${user.name}</h3>
                        <p class="text-muted" style="margin-bottom: 8px;">${user.role} • ${email}</p>
                        <p class="text-sm text-muted" style="margin-bottom: 8px;">Login: ${loginHandle}</p>
                        <div style="margin-bottom: 20px;">${statusBadge(user.status)}</div>
                    </div>
                </div>
                <div class="card">
                    <div class="card-hd"><h3 style="color: var(--red);">Admin Actions</h3></div>
                    <div class="card-bd" style="display: flex; flex-direction: column; gap: 10px;">
                        <button class="btn btn-outline" style="justify-content: center;" onclick="window.changeUserRole('${userToken}')">Change User Role</button>
                        <button class="btn btn-outline" style="justify-content: center;" onclick="window.sendUserPasswordReset('${userToken}')">Send Password Reset</button>
                        <button class="btn" style="justify-content: center; background: rgba(220, 53, 69, 0.1); color: var(--red); border: 1px solid rgba(220, 53, 69, 0.3);" onclick="window.toggleUserSuspension('${userToken}')">${normalizedStatus === 'suspended' ? 'Activate Account' : 'Suspend Account'}</button>
                        <button class="btn" style="justify-content: center; background: var(--red-bg); color: var(--red); border: 1px solid var(--red);" onclick="window.deleteUser('${userToken}')">Delete User</button>
                    </div>
                </div>
            </div>
            <div class="card">
                <div class="card-hd"><h3>Recent Activity</h3></div>
                <div class="card-bd">
                    <div class="timeline">
                        ${activityHtml}
                    </div>
                </div>
            </div>
        </section>`;
    }

    function getCurrentUserIdentity() {
        const currentUser = loadObject('currentUser', {});
        const username = String(currentUser.username || '').trim();
        const displayName = String(localStorage.getItem('userName') || currentUser.name || 'User').trim() || 'User';
        const roleLabel = ROLE_LABELS[activeRoleKey] || 'Team Member';
        const email = username && username.includes('@')
            ? username
            : `${username || activeRoleKey}@billbhai.com`;
        const key = (username || displayName.toLowerCase().replace(/\s+/g, '.')).trim();

        return {
            key,
            username,
            displayName,
            roleLabel,
            email
        };
    }

    function loadProfileSettingsRecord() {
        const identity = getCurrentUserIdentity();
        const store = loadObject(PROFILE_SETTINGS_STORAGE_KEY, {});
        const saved = store[identity.key] && typeof store[identity.key] === 'object' ? store[identity.key] : {};
        const normalizedNotifications = normalizeNotificationPreferences(saved.notifications, activeRoleKey);

        return {
            key: identity.key,
            fullName: String(saved.fullName || identity.displayName).trim() || identity.displayName,
            email: String(saved.email || identity.email).trim() || identity.email,
            phone: String(saved.phone || '').trim(),
            location: String(saved.location || '').trim(),
            bio: String(saved.bio || '').trim(),
            language: String(saved.language || 'English (India)').trim(),
            currency: String(saved.currency || 'INR').trim(),
            timezone: String(saved.timezone || 'Asia/Kolkata').trim(),
            dateFormat: String(saved.dateFormat || 'DD/MM/YYYY').trim(),
            notifications: normalizedNotifications
        };
    }

    function saveProfileSettingsRecord(record) {
        const identity = getCurrentUserIdentity();
        const key = String(record.key || identity.key).trim() || identity.key;
        const store = loadObject(PROFILE_SETTINGS_STORAGE_KEY, {});

        store[key] = {
            fullName: record.fullName,
            email: record.email,
            phone: record.phone,
            location: record.location,
            bio: record.bio,
            language: record.language,
            currency: record.currency,
            timezone: record.timezone,
            dateFormat: record.dateFormat,
            notifications: { ...record.notifications }
        };
        saveObject(PROFILE_SETTINGS_STORAGE_KEY, store);

        localStorage.setItem('userName', record.fullName);
        const currentUser = loadObject('currentUser', {});
        saveObject('currentUser', {
            ...currentUser,
            name: record.fullName
        });

        document.querySelectorAll('.user-name').forEach(el => {
            el.textContent = record.fullName;
        });
        document.querySelectorAll('.user-avatar').forEach(el => {
            el.textContent = record.fullName.charAt(0).toUpperCase();
        });
        renderNotificationDropdown();
    }

    function updatePasswordOverrideForCurrentUser(newPassword) {
        const identity = getCurrentUserIdentity();
        if (!identity.username) return false;

        const overrides = loadObject(AUTH_OVERRIDE_STORAGE_KEY, {});
        overrides[identity.username] = {
            ...(overrides[identity.username] || {}),
            password: String(newPassword).trim()
        };
        saveObject(AUTH_OVERRIDE_STORAGE_KEY, overrides);
        return true;
    }

    function renderProfileSettingsUnified() {
        const profile = loadProfileSettingsRecord();
        const activityItems = getRecentProfileActivity();
        const initial = profile.fullName.charAt(0).toUpperCase();
        const notificationOptions = getNotificationPreferenceConfig(activeRoleKey);
        const notificationToggles = notificationOptions.length
            ? notificationOptions.map(option => `
                <label class="text-sm" style="display:flex;justify-content:space-between;gap:12px;align-items:center;">
                    <span>${option.label}</span>
                    <input id="psNotif_${option.key}" data-notification-key="${option.key}" type="checkbox" ${profile.notifications[option.key] ? 'checked' : ''}>
                </label>
            `).join('')
            : '<div class="text-sm text-muted">No notification preferences available for this role.</div>';

        content.innerHTML = `
        <div class="page-header"><h2>Profile & Settings</h2><div class="page-header-actions"><button class="btn btn-primary" id="saveProfileSettingsBtn">Save Changes</button></div></div>
        <section class="grid-2">
            <div style="display:flex;flex-direction:column;gap:16px;">
                <div class="card">
                    <div class="card-bd" style="text-align:center;padding-top:26px;">
                        <div style="width:80px;height:80px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--amber));margin:0 auto 14px;display:flex;align-items:center;justify-content:center;font-size:1.9rem;color:#fff;font-weight:700;">${initial}</div>
                        <h3 style="font-size:1.12rem;margin-bottom:4px;">${profile.fullName}</h3>
                        <p class="text-muted" style="margin-bottom:4px;">${ROLE_LABELS[activeRoleKey] || 'Team Member'}</p>
                        <p class="text-sm text-muted">${profile.email}</p>
                    </div>
                </div>
                <div class="card">
                    <div class="card-hd"><h3>Security</h3></div>
                    <div class="card-bd">
                        <div class="form-group"><label class="form-label">New Password</label><input type="password" id="psNewPassword" class="form-control" placeholder="Minimum 6 characters"></div>
                        <div class="form-group"><label class="form-label">Confirm Password</label><input type="password" id="psConfirmPassword" class="form-control" placeholder="Re-enter password"></div>
                        <button class="btn btn-outline" id="psPasswordBtn" style="width:100%;justify-content:center;">Update Password</button>
                    </div>
                </div>
            </div>
            <div class="card">
                <div class="card-hd"><h3>Recent Activity</h3></div>
                <div class="card-bd">
                    <div class="timeline">
                        ${(activityItems.length ? activityItems : [{ time: 'Just now', text: 'No recent activity available.' }]).map(item => `
                            <div class="timeline-item">
                                <div class="timeline-marker"></div>
                                <div class="timeline-time">${item.time}</div>
                                <div class="timeline-content">${item.text}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        </section>
        <section class="card" style="margin-top:14px;">
            <div class="card-hd"><h3>Account Preferences</h3></div>
            <div class="card-bd">
                <form id="profileSettingsForm">
                    <div class="form-row">
                        <div class="form-group"><label class="form-label">Full Name</label><input id="psFullName" class="form-control" value="${profile.fullName}"></div>
                        <div class="form-group"><label class="form-label">Email</label><input id="psEmail" type="email" class="form-control" value="${profile.email}"></div>
                    </div>
                    <div class="form-row">
                        <div class="form-group"><label class="form-label">Phone</label><input id="psPhone" class="form-control" value="${profile.phone}" placeholder="10-digit mobile"></div>
                        <div class="form-group"><label class="form-label">Location</label><input id="psLocation" class="form-control" value="${profile.location}" placeholder="Store or city"></div>
                    </div>
                    <div class="form-group"><label class="form-label">Bio</label><textarea id="psBio" class="form-control" rows="3" style="resize:vertical;">${profile.bio}</textarea></div>
                    <div class="form-row">
                        <div class="form-group"><label class="form-label">Language</label><select id="psLanguage" class="form-control"><option ${profile.language === 'English (India)' ? 'selected' : ''}>English (India)</option><option ${profile.language === 'Hindi' ? 'selected' : ''}>Hindi</option><option ${profile.language === 'Tamil' ? 'selected' : ''}>Tamil</option></select></div>
                        <div class="form-group"><label class="form-label">Currency</label><select id="psCurrency" class="form-control"><option value="INR" ${profile.currency === 'INR' ? 'selected' : ''}>INR</option><option value="USD" ${profile.currency === 'USD' ? 'selected' : ''}>USD</option></select></div>
                    </div>
                    <div class="form-row">
                        <div class="form-group"><label class="form-label">Timezone</label><select id="psTimezone" class="form-control"><option value="Asia/Kolkata" ${profile.timezone === 'Asia/Kolkata' ? 'selected' : ''}>Asia/Kolkata</option><option value="UTC" ${profile.timezone === 'UTC' ? 'selected' : ''}>UTC</option></select></div>
                        <div class="form-group"><label class="form-label">Date Format</label><select id="psDateFormat" class="form-control"><option ${profile.dateFormat === 'DD/MM/YYYY' ? 'selected' : ''}>DD/MM/YYYY</option><option ${profile.dateFormat === 'MM/DD/YYYY' ? 'selected' : ''}>MM/DD/YYYY</option></select></div>
                    </div>
                    <div style="margin-top:6px;padding-top:12px;border-top:1px solid var(--border);display:grid;gap:10px;">
                        ${notificationToggles}
                    </div>
                </form>
            </div>
        </section>`;

        const saveBtn = document.getElementById('saveProfileSettingsBtn');
        const settingsForm = document.getElementById('profileSettingsForm');
        const saveProfile = () => {
            if (!settingsForm) return;
            const fullName = String(document.getElementById('psFullName').value || '').trim();
            const email = String(document.getElementById('psEmail').value || '').trim();
            if (!fullName) {
                showToast('Full name is required.');
                return;
            }
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                showToast('Please enter a valid email.');
                return;
            }

            const nextRecord = {
                key: profile.key,
                fullName,
                email,
                phone: String(document.getElementById('psPhone').value || '').trim(),
                location: String(document.getElementById('psLocation').value || '').trim(),
                bio: String(document.getElementById('psBio').value || '').trim(),
                language: String(document.getElementById('psLanguage').value || 'English (India)').trim(),
                currency: String(document.getElementById('psCurrency').value || 'INR').trim(),
                timezone: String(document.getElementById('psTimezone').value || 'Asia/Kolkata').trim(),
                dateFormat: String(document.getElementById('psDateFormat').value || 'DD/MM/YYYY').trim(),
                notifications: normalizeNotificationPreferences(
                    notificationOptions.reduce((acc, option) => {
                        const toggle = document.getElementById(`psNotif_${option.key}`);
                        acc[option.key] = Boolean(toggle && toggle.checked);
                        return acc;
                    }, {}),
                    activeRoleKey
                )
            };

            saveProfileSettingsRecord(nextRecord);
            showToast('Profile and settings saved.');
            renderProfileSettingsUnified();
        };

        if (saveBtn) saveBtn.addEventListener('click', saveProfile);
        if (settingsForm) settingsForm.addEventListener('submit', (e) => {
            e.preventDefault();
            saveProfile();
        });

        const passwordBtn = document.getElementById('psPasswordBtn');
        if (passwordBtn) {
            passwordBtn.addEventListener('click', () => {
                const newPassword = String(document.getElementById('psNewPassword').value || '').trim();
                const confirmPassword = String(document.getElementById('psConfirmPassword').value || '').trim();

                if (!newPassword || newPassword.length < 6) {
                    showToast('Password must be at least 6 characters.');
                    return;
                }
                if (newPassword !== confirmPassword) {
                    showToast('Password confirmation does not match.');
                    return;
                }
                if (!updatePasswordOverrideForCurrentUser(newPassword)) {
                    showToast('Could not map current account for password update.');
                    return;
                }

                document.getElementById('psNewPassword').value = '';
                document.getElementById('psConfirmPassword').value = '';
                showToast('Password updated for next login.');
            });
        }
    }

    function renderProfile() {
        renderProfileSettingsUnified();
    }

    function renderSettings() {
        renderProfileSettingsUnified();
    }

    function resolveNotificationViewState(input) {
        const defaults = { status: 'all', category: 'all', sort: 'priority' };
        if (typeof input === 'string') return { ...defaults, status: String(input || 'all').trim().toLowerCase() || 'all' };
        if (!input || typeof input !== 'object') return defaults;
        return {
            status: String(input.status || defaults.status).trim().toLowerCase() || defaults.status,
            category: String(input.category || defaults.category).trim().toLowerCase() || defaults.category,
            sort: String(input.sort || defaults.sort).trim().toLowerCase() || defaults.sort
        };
    }

    function getNotificationPriorityBadge(notification) {
        const priority = String(notification && notification.priority || 'low').trim().toLowerCase();
        if (priority === 'critical') return badge('Critical', 'cancelled');
        if (priority === 'high') return badge('High', 'pending');
        if (priority === 'medium') return badge('Medium', 'processing');
        return badge('Low', 'active');
    }

    function renderNotifications(filterState) {
        const viewState = resolveNotificationViewState(filterState);
        const notifications = getActiveNotifications();
        const unreadCount = notifications.filter(item => item.unread).length;
        const readCount = Math.max(0, notifications.length - unreadCount);
        const actionableCount = notifications.filter(item => item.unread || item.priorityRank >= 3).length;
        const categoryOptions = Array.from(new Set(notifications.map(item => item.category))).sort((a, b) => getNotificationCategoryLabel(a).localeCompare(getNotificationCategoryLabel(b)));

        const filteredRows = notifications
            .filter(item => {
                if (viewState.status === 'unread' && !item.unread) return false;
                if (viewState.status === 'read' && item.unread) return false;
                if (viewState.category !== 'all' && item.category !== viewState.category) return false;
                return true;
            })
            .slice()
            .sort((a, b) => {
                if (viewState.sort === 'oldest') return (a.sortTimeMs || 0) - (b.sortTimeMs || 0);
                if (viewState.sort === 'newest') return (b.sortTimeMs || 0) - (a.sortTimeMs || 0);
                if (b.priorityRank !== a.priorityRank) return b.priorityRank - a.priorityRank;
                return (b.sortTimeMs || 0) - (a.sortTimeMs || 0);
            });

        content.innerHTML = `
        <div class="page-header">
            <h2>Notifications</h2>
            <div class="page-header-actions">
                <button class="btn btn-outline" id="markAllReadBtn" ${unreadCount ? '' : 'disabled'}>Mark all as read</button>
            </div>
        </div>
        <section class="stats-grid" style="margin-bottom:12px;">
            <div class="stat-card"><div class="stat-info"><span class="stat-label">Total</span><span class="stat-value">${notifications.length}</span></div></div>
            <div class="stat-card"><div class="stat-info"><span class="stat-label">Unread</span><span class="stat-value">${unreadCount}</span></div></div>
            <div class="stat-card"><div class="stat-info"><span class="stat-label">Read</span><span class="stat-value">${readCount}</span></div></div>
            <div class="stat-card"><div class="stat-info"><span class="stat-label">Actionable</span><span class="stat-value">${actionableCount}</span></div></div>
        </section>
        <section class="card" style="margin-bottom:14px;">
            <div class="card-bd table-toolbar" style="justify-content:space-between;align-items:center;gap:12px;">
                <div class="chart-tabs">
                    <button class="chart-tab notif-filter ${viewState.status === 'all' ? 'active' : ''}" data-filter="all">All</button>
                    <button class="chart-tab notif-filter ${viewState.status === 'unread' ? 'active' : ''}" data-filter="unread">Unread</button>
                    <button class="chart-tab notif-filter ${viewState.status === 'read' ? 'active' : ''}" data-filter="read">Read</button>
                </div>
                <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:flex-end;">
                    <div class="toolbar-group"><label class="toolbar-label" for="notificationsCategoryFilter">Category</label><select id="notificationsCategoryFilter" class="toolbar-select"><option value="all">All categories</option>${categoryOptions.map(option => `<option value="${option}" ${viewState.category === option ? 'selected' : ''}>${getNotificationCategoryLabel(option)}</option>`).join('')}</select></div>
                    <div class="toolbar-group"><label class="toolbar-label" for="notificationsSortSelect">Sort by</label><select id="notificationsSortSelect" class="toolbar-select"><option value="priority" ${viewState.sort === 'priority' ? 'selected' : ''}>Priority</option><option value="newest" ${viewState.sort === 'newest' ? 'selected' : ''}>Newest</option><option value="oldest" ${viewState.sort === 'oldest' ? 'selected' : ''}>Oldest</option></select></div>
                </div>
            </div>
        </section>
        <section class="card notification-shell" id="notificationCenter">
            <div class="card-hd"><h3>${ROLE_LABELS[activeRoleKey] || 'Team'} inbox</h3></div>
            <div class="card-bd notification-list" style="padding:0;">
                ${filteredRows.length ? filteredRows.map(item => `
                    <div class="notification-row ${item.unread ? 'unread' : ''}" data-notif-id="${item.id}">
                        <div class="notification-icon" style="background: var(--${item.color || 'blue'}-bg); color: var(--${item.color || 'blue'});">${getNotificationIcon(item)}</div>
                        <div class="notification-content">
                            <div class="notification-title-row">
                                <strong>${item.title}</strong>
                                <span class="notification-chip ${item.unread ? 'is-unread' : 'is-read'}">${item.unread ? 'Unread' : 'Read'}</span>
                                ${getNotificationPriorityBadge(item)}
                                <span class="notification-chip">${getNotificationCategoryLabel(item.category)}</span>
                            </div>
                            <div class="text-sm text-muted" style="margin-top:6px;">${item.desc}</div>
                            <div class="notification-meta">
                                <span>${item.time}</span>
                                <span>${item.priority.charAt(0).toUpperCase() + item.priority.slice(1)} priority</span>
                            </div>
                        </div>
                        <div class="notification-actions">
                            <button class="btn btn-outline" data-notif-action="toggle-read">${item.unread ? 'Mark read' : 'Mark unread'}</button>
                            <button class="btn btn-outline" data-notif-action="open">View</button>
                        </div>
                    </div>
                `).join('') : '<div class="notification-empty text-muted">No notifications match this view.</div>'}
            </div>
        </section>`;

        const markAllBtn = document.getElementById('markAllReadBtn');
        if (markAllBtn) {
            markAllBtn.addEventListener('click', () => {
                markNotificationsRead(notifications.filter(item => item.unread).map(item => item.id), true);
                renderNotificationDropdown();
                renderNotifications(viewState);
            });
        }

        content.querySelectorAll('.notif-filter').forEach(btn => {
            btn.addEventListener('click', () => {
                renderNotifications({ ...viewState, status: String(btn.getAttribute('data-filter') || 'all').trim().toLowerCase() || 'all' });
            });
        });

        const categorySelect = document.getElementById('notificationsCategoryFilter');
        const sortSelect = document.getElementById('notificationsSortSelect');
        if (categorySelect) {
            categorySelect.addEventListener('change', () => {
                renderNotifications({ ...viewState, category: categorySelect.value });
            });
        }
        if (sortSelect) {
            sortSelect.addEventListener('change', () => {
                renderNotifications({ ...viewState, sort: sortSelect.value });
            });
        }

        const center = document.getElementById('notificationCenter');
        if (center) {
            center.addEventListener('click', (event) => {
                const actionBtn = event.target.closest('[data-notif-action]');
                if (!actionBtn) return;

                const row = actionBtn.closest('[data-notif-id]');
                const notifId = row ? String(row.getAttribute('data-notif-id') || '').trim() : '';
                if (!notifId) return;

                const notification = notifications.find(item => item.id === notifId);
                if (!notification) return;

                const action = String(actionBtn.getAttribute('data-notif-action') || '').trim();
                if (action === 'toggle-read') {
                    setNotificationReadState(notification.id, notification.unread);
                    renderNotificationDropdown();
                    renderNotifications(viewState);
                    return;
                }

                if (action === 'open') {
                    renderNotificationDetail(notifId, viewState);
                }
            });
        }
    }

    function renderNotificationDetail(id, returnState) {
        const viewState = resolveNotificationViewState(returnState);
        const initialNotification = getActiveNotifications().find(item => item.id === id);
        if (!initialNotification) {
            renderNotifications(viewState);
            return;
        }

        if (initialNotification.unread) {
            setNotificationReadState(initialNotification.id, true);
            renderNotificationDropdown();
        }

        const notification = getActiveNotifications().find(item => item.id === id) || initialNotification;
        const detailRows = Array.isArray(notification.detailRows) ? notification.detailRows : [];
        const detailHtml = detailRows.length
            ? detailRows.map(row => `<div class="notification-detail-item"><span class="text-sm text-muted">${row.label}</span><strong>${row.value}</strong></div>`).join('')
            : '<div class="text-muted">No structured details are attached to this notification.</div>';

        content.innerHTML = `
        <div class="page-header" style="justify-content:flex-start;gap:10px;">
            <button class="btn btn-outline" id="notifBackBtn" style="padding:8px;">Back</button>
            <h2>Notification Details</h2>
            <div class="page-header-actions" style="margin-left:auto;"><button class="btn btn-outline" id="notifToggleBtn">${notification.unread ? 'Mark read' : 'Mark unread'}</button></div>
        </div>
        <section class="card" style="margin-bottom:14px;">
            <div class="card-bd" style="display:flex;gap:14px;align-items:flex-start;">
                <div class="notification-icon" style="background: var(--${notification.color || 'blue'}-bg); color: var(--${notification.color || 'blue'}); min-width:50px; min-height:50px;">${getNotificationIcon(notification)}</div>
                <div style="flex:1;min-width:0;">
                    <div class="notification-title-row" style="margin-bottom:6px;">
                        <h3 style="margin:0;">${notification.title}</h3>
                        ${getNotificationPriorityBadge(notification)}
                        <span class="notification-chip">${getNotificationCategoryLabel(notification.category)}</span>
                    </div>
                    <div class="text-sm text-muted" style="margin-bottom:10px;">${notification.time}</div>
                    <p style="margin:0;color:var(--text-secondary);">${notification.desc}</p>
                </div>
            </div>
        </section>
        <section class="card">
            <div class="card-hd"><h3>Context</h3></div>
            <div class="card-bd"><div class="notification-detail-grid">${detailHtml}</div></div>
        </section>`;

        const backBtn = document.getElementById('notifBackBtn');
        if (backBtn) backBtn.addEventListener('click', () => renderNotifications(viewState));

        const toggleBtn = document.getElementById('notifToggleBtn');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                setNotificationReadState(notification.id, notification.unread);
                renderNotificationDropdown();
                renderNotificationDetail(id, viewState);
            });
        }
    }

    function getColors() {
        return {
            text: '#f0f0f0',
            grid: 'rgba(255,255,255,0.05)',
            red: '#dc3545', amber: '#e8a838', blue: '#64b5f6', green: '#51cf66', purple: '#bf5af2'
        };
    }

    function createChart(id, type, data, options) {
        const ctx = document.getElementById(id);
        if (!ctx) return;
        const c = getColors();
        // Merge default styling
        const defaults = {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { labels: { color: c.text } } },
            scales: type !== 'pie' && type !== 'doughnut' ? {
                x: { grid: { color: c.grid, display: false }, ticks: { color: c.text } },
                y: { grid: { color: c.grid }, ticks: { color: c.text } }
            } : {}
        };
        const chart = new Chart(ctx, { type, data, options: { ...defaults, ...options } });
        activeCharts.push(chart);
    }

    function initDashboardCharts() {
        const c = getColors();
        const trend = buildRevenueTrendDays(7);
        const statusMetrics = getDashboardStatusMetrics();

        createChart('dashSalesChart', 'line', {
            labels: trend.labels,
            datasets: [{
                label: 'Revenue',
                data: trend.values,
                borderColor: c.red,
                backgroundColor: 'rgba(220,53,69,0.1)',
                tension: 0.4,
                fill: true
            }]
        });

        createChart('dashStatusChart', 'doughnut', {
            labels: ['Delivered Orders', 'Open Orders', 'Returns', 'Inventory Alerts'],
            datasets: [{
                data: [statusMetrics.deliveredOrders, statusMetrics.openOrders, statusMetrics.totalReturns, statusMetrics.alertCount],
                backgroundColor: [c.green, c.blue, c.red, c.amber],
                borderWidth: 0
            }]
        }, { plugins: { legend: { position: 'right', labels: { color: c.text } } } });
    }

    function getInventoryCategoryCounts() {
        const categoryMap = new Map();
        inventory.forEach(item => {
            const category = String(item && item.cat || '').trim() || 'Uncategorized';
            categoryMap.set(category, (categoryMap.get(category) || 0) + 1);
        });

        const entries = Array.from(categoryMap.entries()).sort((a, b) => b[1] - a[1]);
        if (!entries.length) return { labels: ['No data'], values: [0] };
        return {
            labels: entries.map(([label]) => label),
            values: entries.map(([, value]) => value)
        };
    }

    function initInventoryCharts() {
        const c = getColors();
        const categoryCounts = getInventoryCategoryCounts();
        const stockRows = inventory
            .map(item => ({
                label: String(item && item.name || item && item.sku || 'Item'),
                stock: Math.max(0, Number(item && item.stock) || 0),
                status: normalizeInventoryStatus(item && item.status, item && item.stock)
            }))
            .sort((a, b) => b.stock - a.stock)
            .slice(0, 8);

        const stockLabels = stockRows.length ? stockRows.map(row => row.label) : ['No data'];
        const stockData = stockRows.length ? stockRows.map(row => row.stock) : [0];
        const stockColors = stockRows.length
            ? stockRows.map(row => {
                if (row.status === 'Out of Stock' || row.status === 'Critical') return c.red;
                if (row.status === 'Low Stock') return c.amber;
                return c.green;
            })
            : [c.blue];

        createChart('invCatChart', 'pie', {
            labels: categoryCounts.labels,
            datasets: [{
                data: categoryCounts.values,
                backgroundColor: [c.amber, c.blue, c.green, c.purple, c.red, c.text],
                borderWidth: 0
            }]
        }, { plugins: { legend: { position: 'right', labels: { color: c.text } } } });

        createChart('invStockChart', 'bar', {
            labels: stockLabels,
            datasets: [{ label: 'Stock Level', data: stockData, backgroundColor: stockColors }]
        });
    }

    function initInventoryManagerCharts() {
        const c = getColors();
        const categoryCounts = getInventoryCategoryCounts();
        const metrics = getInventoryMetrics();

        createChart('invMgrCategoryChart', 'pie', {
            labels: categoryCounts.labels,
            datasets: [{
                data: categoryCounts.values,
                backgroundColor: [c.amber, c.blue, c.green, c.purple, c.red, c.text],
                borderWidth: 0
            }]
        }, { plugins: { legend: { position: 'right', labels: { color: c.text } } } });

        createChart('invMgrHealthChart', 'doughnut', {
            labels: ['In Stock', 'Low Stock', 'Critical', 'Out of Stock'],
            datasets: [{
                data: [metrics.inStock, metrics.lowStock, metrics.critical, metrics.outOfStock],
                backgroundColor: [c.green, c.amber, c.red, c.purple],
                borderWidth: 0
            }]
        }, { plugins: { legend: { position: 'right', labels: { color: c.text } } } });
    }

    function initReturnCharts() {
        const c = getColors();

        const view = getReturnView();
        const reasonCounts = new Map();
        const productCounts = new Map();
        const statusCounts = { pending: 0, refunded: 0, rejected: 0 };

        view.forEach(r => {
            const reason = String(r.reason || '').trim() || 'Unknown';
            reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1);

            const product = String(r.product || '').trim();
            if (product && product !== '-') productCounts.set(product, (productCounts.get(product) || 0) + 1);

            const s = String(r.status || '').toLowerCase();
            if (s.includes('refund')) statusCounts.refunded += 1;
            else if (s.includes('reject')) statusCounts.rejected += 1;
            else statusCounts.pending += 1;
        });

        const productsTop = Array.from(productCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 6);
        const productLabels = productsTop.length ? productsTop.map(([p]) => p) : ['No data'];
        const productData = productsTop.length ? productsTop.map(([, n]) => n) : [0];

        createChart('retProductChart', 'bar', {
            labels: productLabels,
            datasets: [{ label: 'Returns', data: productData, backgroundColor: c.purple }]
        }, {
            indexAxis: 'y',
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { color: c.grid }, ticks: { color: c.text, precision: 0 }, beginAtZero: true },
                y: { grid: { color: c.grid, display: false }, ticks: { color: c.text } }
            }
        });

        const reasonsSorted = Array.from(reasonCounts.entries()).sort((a, b) => b[1] - a[1]);
        const reasonLabels = reasonsSorted.length ? reasonsSorted.map(([r]) => r) : ['No data'];
        const reasonData = reasonsSorted.length ? reasonsSorted.map(([, n]) => n) : [0];

        createChart('retReasonChart', 'bar', {
            labels: reasonLabels,
            datasets: [{ label: 'Returns', data: reasonData, backgroundColor: c.red }]
        }, {
            indexAxis: 'y',
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { color: c.grid }, ticks: { color: c.text, precision: 0 }, beginAtZero: true },
                y: { grid: { color: c.grid, display: false }, ticks: { color: c.text } }
            }
        });

        createChart('retStatusChart', 'doughnut', {
            labels: ['Pending', 'Refunded', 'Rejected'],
            datasets: [{
                data: [statusCounts.pending, statusCounts.refunded, statusCounts.rejected],
                backgroundColor: [c.amber, c.green, c.red],
                borderWidth: 0
            }]
        }, { plugins: { legend: { position: 'right', labels: { color: c.text } } } });
    }

    function initDeliveryCharts() {
        const c = getColors();
        const statusCounts = { delivered: 0, inTransit: 0, pending: 0, failed: 0 };
        const partnerCounts = new Map();

        deliveries.forEach(d => {
            const status = normalizeDeliveryStatus(d.status);
            if (status === 'Delivered') statusCounts.delivered += 1;
            else if (status === 'In Transit') statusCounts.inTransit += 1;
            else if (status === 'Failed') statusCounts.failed += 1;
            else statusCounts.pending += 1;

            const partner = String(d.partner || '').trim();
            const isActive = status === 'Pending' || status === 'In Transit';
            if (partner && isActive) partnerCounts.set(partner, (partnerCounts.get(partner) || 0) + 1);
        });

        createChart('delStatusChart', 'doughnut', {
            labels: ['Delivered', 'In Transit', 'Pending', 'Failed'],
            datasets: [{
                data: [statusCounts.delivered, statusCounts.inTransit, statusCounts.pending, statusCounts.failed],
                backgroundColor: [c.green, c.blue, c.amber, c.red],
                borderWidth: 0
            }]
        }, { plugins: { legend: { position: 'right', labels: { color: c.text } } } });

        const partnerList = Array.from(partnerCounts.entries())
            .filter(([name]) => name.toLowerCase() !== 'unassigned')
            .sort((a, b) => b[1] - a[1])
            .slice(0, 6);

        const partnerLabels = partnerList.length ? partnerList.map(([name]) => name) : ['No partners'];
        const partnerData = partnerList.length ? partnerList.map(([, count]) => count) : [0];

        createChart('delPartnerChart', 'bar', {
            labels: partnerLabels,
            datasets: [{ label: 'Deliveries', data: partnerData, backgroundColor: c.blue }]
        }, {
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { color: c.grid, display: false }, ticks: { color: c.text } },
                y: { grid: { color: c.grid }, ticks: { color: c.text, precision: 0 }, beginAtZero: true }
            }
        });
    }

    function initReportCharts() {
        const c = getColors();
        const state = currentReportChartState || {
            revenueTrend: buildRevenueTrendWeeks(8),
            statusCounts: {
                delivered: orders.filter(order => normalizeOrderStatus(order && order.status) === 'Delivered').length,
                processing: orders.filter(order => normalizeOrderStatus(order && order.status) === 'Processing').length,
                pending: orders.filter(order => normalizeOrderStatus(order && order.status) === 'Pending').length,
                cancelled: orders.filter(order => normalizeOrderStatus(order && order.status) === 'Cancelled').length
            },
            paymentLabels: [],
            paymentValues: []
        };
        const trend = state.revenueTrend || { labels: ['No data'], values: [0] };
        createChart('repRevChart', 'line', {
            labels: trend.labels,
            datasets: [{
                label: 'Revenue',
                data: trend.values,
                borderColor: c.blue,
                backgroundColor: 'rgba(100,181,246,0.1)',
                tension: 0.35,
                fill: true
            }]
        });

        const statusCounts = state.statusCounts || {
            delivered: 0,
            processing: 0,
            pending: 0,
            cancelled: 0
        };
        createChart('repStatusChart', 'doughnut', {
            labels: ['Delivered', 'Processing', 'Pending', 'Cancelled'],
            datasets: [{
                data: [statusCounts.delivered, statusCounts.processing, statusCounts.pending, statusCounts.cancelled],
                backgroundColor: [c.green, c.blue, c.amber, c.red]
            }]
        });

        const paymentLabels = Array.isArray(state.paymentLabels) && state.paymentLabels.length ? state.paymentLabels : ['No Data'];
        const paymentValues = Array.isArray(state.paymentValues) && state.paymentValues.length ? state.paymentValues : [0];
        createChart('repPaymentChart', 'bar', {
            labels: paymentLabels,
            datasets: [{
                label: 'Orders',
                data: paymentValues,
                backgroundColor: c.purple
            }]
        }, {
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { color: c.grid, display: false }, ticks: { color: c.text } },
                y: { grid: { color: c.grid }, ticks: { color: c.text, precision: 0 }, beginAtZero: true }
            }
        });
    }

    function updateAllCharts() {
        const p = currentPage;
        renderPage(p); // Re-render page to cleanup and redraw charts with new colors
    }

    // Product Modal Logic
    function getNextSku() {
        const nums = inventory.map(i => parseInt(i.sku.replace('SKU-', ''), 10));
        // Also scan the DOM table for SKUs (handles static HTML items not in JS array)
        const tbody = document.getElementById('inventoryTableBody');
        if (tbody) {
            tbody.querySelectorAll('tr td:first-child').forEach(td => {
                const match = td.textContent.match(/SKU-(\d+)/);
                if (match) nums.push(parseInt(match[1], 10));
            });
        }
        const next = Math.max(...nums) + 1;
        return `SKU-${String(next).padStart(2, '0')}`;
    }

    function openAddProductModal() {
        if (!hasActionAccess('inventory')) {
            denyAction('Inventory create');
            return;
        }
        const overlay = document.getElementById('addProductModal');
        if (!overlay) return;
        const heading = overlay.querySelector('.modal-header h3');
        if (heading) heading.textContent = 'Add New Product';
        const submitBtn = overlay.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.textContent = 'Add Product';
        // Set auto-generated SKU
        const skuInput = document.getElementById('prodSku');
        if (skuInput) skuInput.value = getNextSku();
        // Reset form
        const form = document.getElementById('addProductForm');
        if (form) {
            form.querySelectorAll('.form-group').forEach(g => g.classList.remove('has-error'));
            form.querySelectorAll('.form-control').forEach(c => c.classList.remove('error'));
            document.getElementById('prodName').value = '';
            document.getElementById('prodCategory').value = '';
            document.getElementById('prodSupplier').value = '';
            const supplierPhoneInput = document.getElementById('prodSupplierPhone');
            const supplierEmailInput = document.getElementById('prodSupplierEmail');
            const supplierLeadTimeInput = document.getElementById('prodLeadTime');
            if (supplierPhoneInput) supplierPhoneInput.value = '';
            if (supplierEmailInput) supplierEmailInput.value = '';
            if (supplierLeadTimeInput) supplierLeadTimeInput.value = '';
            document.getElementById('prodPrice').value = '';
            document.getElementById('prodStock').value = '';
            document.getElementById('prodStatus').value = 'In Stock';
        }
        overlay.classList.add('active');
    }

    function closeAddProductModal() {
        const overlay = document.getElementById('addProductModal');
        if (overlay) overlay.classList.remove('active');
    }

    function showToast(msg) {
        const toast = document.getElementById('successToast');
        const msgEl = document.getElementById('toastMessage');
        if (!toast) return;
        if (msgEl) msgEl.textContent = msg;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    }

    function openQuickFormModal(config) {
        const {
            title,
            submitLabel,
            fields,
            initialValues,
            onSubmit
        } = config;

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay active';

        const fieldHtml = fields.map(f => {
            const value = initialValues && Object.prototype.hasOwnProperty.call(initialValues, f.name) ? initialValues[f.name] : (f.defaultValue || '');
            if (f.type === 'select') {
                return `<div class="form-group"><label class="form-label">${f.label}</label><select class="form-control" name="${f.name}" ${f.required ? 'required' : ''}>${(f.options || []).map(opt => `<option value="${opt}" ${String(value) === String(opt) ? 'selected' : ''}>${opt}</option>`).join('')}</select></div>`;
            }
            return `<div class="form-group"><label class="form-label">${f.label}</label><input class="form-control" name="${f.name}" type="${f.type || 'text'}" value="${String(value).replace(/"/g, '&quot;')}" placeholder="${f.placeholder || ''}" ${f.min !== undefined ? `min="${f.min}"` : ''} ${f.step !== undefined ? `step="${f.step}"` : ''} ${f.required ? 'required' : ''}></div>`;
        }).join('');

        overlay.innerHTML = `
            <div class="modal" style="max-width:540px;">
                <div class="modal-header">
                    <h3>${title}</h3>
                    <button class="modal-close" type="button">&times;</button>
                </div>
                <form class="modal-body" style="display:flex;flex-direction:column;gap:10px;">
                    ${fieldHtml}
                    <div class="text-sm" style="color:var(--red);display:none;" data-form-error></div>
                    <div class="modal-footer" style="margin-top: 6px;">
                        <button class="btn btn-outline" type="button" data-action="cancel">Cancel</button>
                        <button class="btn btn-primary" type="submit">${submitLabel || 'Save'}</button>
                    </div>
                </form>
            </div>
        `;

        function closeModal() {
            overlay.remove();
        }

        overlay.querySelector('.modal-close').addEventListener('click', closeModal);
        overlay.querySelector('[data-action="cancel"]').addEventListener('click', closeModal);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeModal();
        });

        const form = overlay.querySelector('form');
        const errEl = overlay.querySelector('[data-form-error]');
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const fd = new FormData(form);
            const values = {};

            for (const field of fields) {
                let raw = String(fd.get(field.name) || '').trim();
                if (field.required && !raw) {
                    errEl.textContent = `${field.label} is required.`;
                    errEl.style.display = 'block';
                    return;
                }
                if ((field.type === 'number') && raw !== '') {
                    const n = Number(raw);
                    if (Number.isNaN(n) || (field.min !== undefined && n < field.min)) {
                        errEl.textContent = `${field.label} is invalid.`;
                        errEl.style.display = 'block';
                        return;
                    }
                    values[field.name] = n;
                } else {
                    values[field.name] = raw;
                }
            }

            errEl.style.display = 'none';
            Promise.resolve(onSubmit(values, closeModal)).catch(() => {
                // Keep modal open on submission failure.
            });
        });

        document.body.appendChild(overlay);
    }

    function openQuickConfirmModal(config) {
        const { title, message, confirmLabel, onConfirm } = config;
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay active';
        overlay.innerHTML = `
            <div class="modal" style="max-width:460px;">
                <div class="modal-header">
                    <h3>${title || 'Confirm Action'}</h3>
                    <button class="modal-close" type="button">&times;</button>
                </div>
                <div class="modal-body">
                    <p class="text-muted">${message}</p>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" type="button" data-action="cancel">Cancel</button>
                    <button class="btn btn-primary" type="button" data-action="confirm">${confirmLabel || 'Confirm'}</button>
                </div>
            </div>
        `;

        function closeModal() {
            overlay.remove();
        }

        overlay.querySelector('.modal-close').addEventListener('click', closeModal);
        overlay.querySelector('[data-action="cancel"]').addEventListener('click', closeModal);
        overlay.querySelector('[data-action="confirm"]').addEventListener('click', async () => {
            try {
                const shouldClose = await onConfirm();
                if (shouldClose !== false) closeModal();
            } catch (error) {
                showMutationError('Action', error);
                // Keep modal open if confirm action fails.
            }
        });
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeModal();
        });

        document.body.appendChild(overlay);
    }

    function determineStatus(stock, selectedStatus) {
        // Auto-determine if user left it at In Stock
        if (selectedStatus !== 'In Stock') return selectedStatus;
        if (stock <= 0) return 'Out of Stock';
        if (stock <= 10) return 'Critical';
        if (stock <= 30) return 'Low Stock';
        return 'In Stock';
    }

    async function handleAddProduct(e) {
        e.preventDefault();
        if (!hasActionAccess('inventory')) {
            denyAction('Inventory create/update');
            return;
        }
        let valid = true;
        const fields = [
            { id: 'prodName', check: v => v.trim() !== '' },
            { id: 'prodCategory', check: v => v !== '' },
            { id: 'prodSupplier', check: v => v.trim() !== '' },
            { id: 'prodPrice', check: v => v !== '' && parseFloat(v) >= 0 },
            { id: 'prodStock', check: v => v !== '' && parseInt(v, 10) >= 0 }
        ];

        fields.forEach(f => {
            const el = document.getElementById(f.id);
            const group = el.closest('.form-group');
            if (!f.check(el.value)) {
                group.classList.add('has-error');
                el.classList.add('error');
                valid = false;
            } else {
                group.classList.remove('has-error');
                el.classList.remove('error');
            }
        });

        const supplierPhoneInput = document.getElementById('prodSupplierPhone');
        const supplierEmailInput = document.getElementById('prodSupplierEmail');
        const supplierLeadTimeInput = document.getElementById('prodLeadTime');
        const supplierPhoneRaw = supplierPhoneInput ? supplierPhoneInput.value.trim() : '';
        const supplierEmailRaw = supplierEmailInput ? supplierEmailInput.value.trim() : '';
        const supplierLeadTimeRaw = supplierLeadTimeInput ? supplierLeadTimeInput.value.trim() : '';

        if (supplierEmailRaw && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supplierEmailRaw)) {
            if (supplierEmailInput) {
                const emailGroup = supplierEmailInput.closest('.form-group');
                if (emailGroup) emailGroup.classList.add('has-error');
                supplierEmailInput.classList.add('error');
            }
            valid = false;
        }

        if (supplierLeadTimeRaw) {
            const leadTimeValue = Number(supplierLeadTimeRaw);
            if (!Number.isFinite(leadTimeValue) || leadTimeValue < 1) {
                if (supplierLeadTimeInput) {
                    const leadGroup = supplierLeadTimeInput.closest('.form-group');
                    if (leadGroup) leadGroup.classList.add('has-error');
                    supplierLeadTimeInput.classList.add('error');
                }
                valid = false;
            }
        }

        if (!valid) return;

        const stock = parseInt(document.getElementById('prodStock').value, 10);
        const selectedStatus = document.getElementById('prodStatus').value;
        const sku = document.getElementById('prodSku').value || getNextSku();
        const supplierName = document.getElementById('prodSupplier').value.trim();
        const supplierDefaults = getSupplierDetails({ supplier: supplierName });
        const leadTimeDays = supplierLeadTimeRaw
            ? Math.max(1, Math.round(Number(supplierLeadTimeRaw)))
            : supplierDefaults.leadTimeDays;

        const existingIdx = inventory.findIndex(i => i.sku === sku);
        const existingRecord = existingIdx !== -1 ? inventory[existingIdx] : null;
        const pData = {
            ...(existingRecord || {}),
            sku: sku,
            name: document.getElementById('prodName').value.trim(),
            cat: document.getElementById('prodCategory').value,
            supplier: supplierName,
            price: parseFloat(document.getElementById('prodPrice').value),
            stock: stock,
            status: determineStatus(stock, selectedStatus),
            supplierPhone: supplierPhoneRaw || supplierDefaults.phone,
            supplierEmail: supplierEmailRaw || supplierDefaults.email,
            leadTimeDays,
            supplierDetails: {
                contact: supplierDefaults.contact,
                phone: supplierPhoneRaw || supplierDefaults.phone,
                email: supplierEmailRaw || supplierDefaults.email,
                leadTimeDays,
                moq: supplierDefaults.moq,
                rating: supplierDefaults.rating
            }
        };

        const createProductInBackend = async () => {
            const supplierRows = await apiRequest('/suppliers', {
                role: 'inventorymanager'
            });
            const normalizedSupplier = String(pData.supplier || '').trim().toLowerCase();
            const matchedSupplier = (Array.isArray(supplierRows) ? supplierRows : []).find((row) =>
                String(row && row.name || '').trim().toLowerCase() === normalizedSupplier
            );

            const createdProduct = await apiRequest('/products', {
                method: 'POST',
                role: 'inventorymanager',
                body: {
                    supplierId: String((matchedSupplier && matchedSupplier.id) || existingRecord?.supplierId || 'SUP-001').trim() || 'SUP-001',
                    name: pData.name,
                    category: pData.cat,
                    price: Number(pData.price || 0),
                    barcode: String(existingRecord?.barcode || pData.sku || '').trim(),
                    size: String(existingRecord?.size || '1 unit').trim(),
                    description: String(existingRecord?.description || `${pData.name} (${pData.cat})`).trim()
                }
            });

            if (createdProduct && createdProduct.id) {
                pData.productId = createdProduct.id;
                pData.supplierId = createdProduct.supplierId || pData.supplierId;
                pData.barcode = createdProduct.barcode || pData.barcode || pData.sku;
                pData.size = createdProduct.size || pData.size || '1 unit';
                pData.description = createdProduct.description || pData.description || `${pData.name} (${pData.cat})`;
            }
        };

        try {
            if (existingRecord && existingRecord.productId) {
                try {
                    await apiRequest(`/products/${encodeURIComponent(String(existingRecord.productId))}`, {
                        method: 'PUT',
                        role: 'inventorymanager',
                        body: {
                            supplierId: String(existingRecord.supplierId || 'SUP-001').trim() || 'SUP-001',
                            name: pData.name,
                            category: pData.cat,
                            price: Number(pData.price || 0),
                            barcode: String(existingRecord.barcode || pData.sku || '').trim(),
                            size: String(existingRecord.size || '1 unit').trim(),
                            description: String(existingRecord.description || `${pData.name} (${pData.cat})`).trim()
                        }
                    });
                } catch (error) {
                    if (isNotFoundError(error)) {
                        // Backend may have restarted and lost older in-memory product IDs.
                        await createProductInBackend();
                    } else {
                        throw error;
                    }
                }
            } else {
                await createProductInBackend();
            }
        } catch (error) {
            showMutationError('Product save', error);
            return;
        }

        if (existingIdx !== -1 && pData.inventoryId) {
            try {
                await apiRequest(`/inventory/${encodeURIComponent(String(pData.inventoryId))}`, {
                    method: 'PUT',
                    role: 'inventorymanager',
                    body: {
                        stockAvailable: pData.stock,
                        reorderLevel: Number(pData.reorderLevel || 10),
                        location: String(pData.location || 'Shelf').trim()
                    }
                });
            } catch (error) {
                if (isNotFoundError(error)) {
                    // Stale local pointer after backend restart; stop retrying this missing inventory row.
                    pData.inventoryId = undefined;
                } else {
                    showMutationError('Inventory update', error);
                    return;
                }
            }
        }

        if (existingIdx !== -1) {
            inventory[existingIdx] = pData;
        } else {
            inventory.push(pData);
        }
        persistOperationalData();

        if (currentPage === 'inventory') {
            renderPage('inventory');
        }

        closeAddProductModal();
        showToast(`Product "${pData.name}" saved successfully!`);
    }

    // Wire up modal events
    const modalCloseBtn = document.getElementById('modalClose');
    const modalCancelBtn = document.getElementById('modalCancel');
    const addProductForm = document.getElementById('addProductForm');
    const addProductOverlay = document.getElementById('addProductModal');

    if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeAddProductModal);
    if (modalCancelBtn) modalCancelBtn.addEventListener('click', closeAddProductModal);
    if (addProductForm) addProductForm.addEventListener('submit', handleAddProduct);
    if (addProductOverlay) {
        addProductOverlay.addEventListener('click', (e) => {
            if (e.target === addProductOverlay) closeAddProductModal();
        });
    }

    // Wire up static page Add Product button
    const staticAddBtn = document.getElementById('addProductBtn');
    if (staticAddBtn) staticAddBtn.addEventListener('click', openAddProductModal);

    // Clear validation on input
    document.querySelectorAll('#addProductForm .form-control').forEach(el => {
        el.addEventListener('input', () => {
            const group = el.closest('.form-group');
            if (group) group.classList.remove('has-error');
            el.classList.remove('error');
        });
    });

    // Order Modal Logic
    function getNextOrderId() {
        const nums = orders.map(o => parseInt(o.id.replace('ORD-', ''), 10));
        const tbody = document.getElementById('ordersTableBody');
        if (tbody) {
            tbody.querySelectorAll('tr td:first-child').forEach(td => {
                const match = td.textContent.match(/ORD-(\d+)/);
                if (match) nums.push(parseInt(match[1], 10));
            });
        }
        const next = Math.max(...nums) + 1;
        return `ORD-${next}`;
    }

    function formatDate() {
        const now = new Date();
        const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        const d = now.getDate();
        const m = months[now.getMonth()];
        const h = String(now.getHours()).padStart(2, '0');
        const min = String(now.getMinutes()).padStart(2, '0');
        return `${d} ${m} ${h}:${min}`;
    }

    function getNextReturnId() {
        const nums = returns
            .map(r => parseInt(String(r.id || '').replace('RET-', ''), 10))
            .filter(n => !Number.isNaN(n));
        const next = nums.length ? Math.max(...nums) + 1 : 200;
        return `RET-${next}`;
    }

    function openNewOrderModal() {
        if (!hasActionAccess('orders')) {
            denyAction('Order create');
            return;
        }
        const overlay = document.getElementById('newOrderModal');
        if (!overlay) return;
        const idInput = document.getElementById('orderId');
        if (idInput) idInput.value = getNextOrderId();
        const form = document.getElementById('newOrderForm');
        if (form) {
            form.querySelectorAll('.form-group').forEach(g => g.classList.remove('has-error'));
            form.querySelectorAll('.form-control').forEach(c => c.classList.remove('error'));
            document.getElementById('orderCustomer').value = '';
            document.getElementById('orderItems').value = '';
            document.getElementById('orderTotal').value = '';
            document.getElementById('orderPayment').value = '';
            document.getElementById('orderStatus').value = 'Pending';
        }
        overlay.classList.add('active');
    }

    function closeNewOrderModal() {
        const overlay = document.getElementById('newOrderModal');
        if (overlay) overlay.classList.remove('active');
    }

    async function handleNewOrder(e) {
        e.preventDefault();
        if (!hasActionAccess('orders')) {
            denyAction('Order create/update');
            return;
        }
        let valid = true;
        const fields = [
            { id: 'orderCustomer', check: v => v.trim() !== '' },
            { id: 'orderItems', check: v => v !== '' && parseInt(v, 10) >= 1 },
            { id: 'orderTotal', check: v => v !== '' && parseFloat(v) >= 0 },
            { id: 'orderPayment', check: v => v !== '' }
        ];
        fields.forEach(f => {
            const el = document.getElementById(f.id);
            const group = el.closest('.form-group');
            if (!f.check(el.value)) {
                group.classList.add('has-error');
                el.classList.add('error');
                valid = false;
            } else {
                group.classList.remove('has-error');
                el.classList.remove('error');
            }
        });
        if (!valid) return;

        const oid = document.getElementById('orderId').value || getNextOrderId();
        const existingIdx = orders.findIndex(o => o.id === oid);
        const existingOrder = existingIdx !== -1 ? orders[existingIdx] : null;
        
        const oData = {
            id: oid,
            customer: document.getElementById('orderCustomer').value.trim(),
            items: parseInt(document.getElementById('orderItems').value, 10),
            total: parseFloat(document.getElementById('orderTotal').value),
            payment: document.getElementById('orderPayment').value,
            status: document.getElementById('orderStatus').value,
            date: existingIdx !== -1 ? orders[existingIdx].date : formatDate()
        };

        const activeCompanyId = String(activeBusinessId || 'BIZ-101').trim() || 'BIZ-101';
        const activeUser = loadObject('currentUser', {});
        const fallbackProduct = inventory.find(item => String(item && item.productId || '').trim());
        const fallbackProductId = String((fallbackProduct && fallbackProduct.productId) || 'P001').trim() || 'P001';
        const totalItems = Math.max(1, Number(oData.items) || 1);
        const totalValue = Math.max(0, Number(oData.total) || 0);

        try {
            if (existingOrder && existingOrder.id) {
                const backendOrder = await apiRequest(`/orders/${encodeURIComponent(String(existingOrder.id))}`, {
                    method: 'PUT',
                    body: {
                        status: oData.status,
                        paymentMethod: oData.payment,
                        customerName: oData.customer,
                        itemsCount: totalItems,
                        total: totalValue
                    }
                });

                if (backendOrder && typeof backendOrder === 'object') {
                    oData.customer = String(backendOrder.customerName || oData.customer).trim();
                    oData.items = Math.max(0, Number(backendOrder.itemsCount || oData.items || totalItems));
                    oData.total = Math.max(0, Number(backendOrder.total || oData.total));
                    oData.payment = String(backendOrder.paymentMethod || oData.payment).trim();
                    oData.status = String(backendOrder.status || oData.status).trim();
                    oData.date = backendOrder.orderDate ? formatBackendDate(backendOrder.orderDate) : oData.date;
                }
            } else {
                const customerRows = await apiRequest(`/customers?companyId=${encodeURIComponent(activeCompanyId)}`, {
                    role: 'cashier'
                });
                const normalizedName = String(oData.customer || '').trim().toLowerCase();
                let customer = (Array.isArray(customerRows) ? customerRows : []).find((row) =>
                    String(row && row.name || '').trim().toLowerCase() === normalizedName
                );

                if (!customer) {
                    const generatedPhone = `9${Date.now().toString().slice(-9)}`;
                    customer = await apiRequest('/customers', {
                        method: 'POST',
                        body: {
                            companyId: activeCompanyId,
                            name: oData.customer,
                            mobileNo: generatedPhone
                        }
                    });
                }
                const unitPrice = totalItems > 0 ? Number((totalValue / totalItems).toFixed(2)) : totalValue;
                const paymentToken = String(oData.payment || '').toLowerCase();
                const checkoutMode = paymentToken.includes('cod')
                    ? 'cod_delivery'
                    : (paymentToken.includes('paid') || paymentToken.includes('upi') || paymentToken.includes('card')
                        ? 'prepaid_delivery'
                        : 'takeaway_now');
                const orderType = checkoutMode === 'takeaway_now' ? 'pickup' : 'delivery';

                const createdOrder = await apiRequest('/orders', {
                    method: 'POST',
                    body: {
                        customerId: String((customer && customer.id) || 'CUS-001').trim() || 'CUS-001',
                        staffId: String(activeUser.id || 'USR-002').trim() || 'USR-002',
                        companyId: activeCompanyId,
                        orderType,
                        checkoutMode,
                        paymentMethod: oData.payment,
                        discountAmount: 0,
                        items: [
                            {
                                productId: fallbackProductId,
                                quantity: totalItems,
                                itemPrice: unitPrice
                            }
                        ]
                    }
                });

                if (createdOrder && createdOrder.id) {
                    oData.id = createdOrder.id;
                }
            }
        } catch (error) {
            showMutationError('Order save', error);
            return;
        }

        if (existingIdx !== -1) {
            orders[existingIdx] = oData;
        } else {
            orders.unshift(oData);
        }
        persistOperationalData();

        const payClass = 'b-' + oData.payment.toLowerCase();
        const statusClass = oData.status === 'Delivered' ? 'b-delivered' : oData.status === 'Processing' ? 'b-processing' : oData.status === 'Pending' ? 'b-pending' : 'b-cancelled';
        const orderActionsHtml = hasOrderDeleteAccess()
            ? `<button class="btn btn-outline" style="padding: 4px 8px; font-size: 0.75rem; margin-right: 4px;" onclick="window.editOrder('${oData.id}')">Edit</button><button class="btn btn-outline" style="padding: 4px 8px; font-size: 0.75rem; color: var(--red); border-color: var(--red);" onclick="window.deleteOrder('${oData.id}')">Delete</button>`
            : `<button class="btn btn-outline" style="padding: 4px 8px; font-size: 0.75rem;" onclick="window.editOrder('${oData.id}')">Edit</button>`;
        const trHtml = `<td class="cell-main">${oData.id}</td><td>${oData.customer}</td><td>${oData.items}</td><td>₹${oData.total.toLocaleString()}</td><td><span class="badge ${payClass}">${oData.payment}</span></td><td><span class="badge ${statusClass}">${oData.status}</span></td><td>${oData.date}</td><td>${orderActionsHtml}</td>`;

        let existingRow = null;
        document.querySelectorAll('tr').forEach(r => { if(r.children[0] && r.children[0].textContent === oid) existingRow = r; });
        
        if (existingRow) {
            existingRow.innerHTML = trHtml;
        } else {
            const tbody = document.getElementById('ordersTableBody') || (document.querySelector('table.dt tbody'));
            if (tbody) {
                const tr = document.createElement('tr');
                tr.innerHTML = trHtml;
                tbody.insertBefore(tr, tbody.firstChild);
            }
        }

        closeNewOrderModal();
        showToast(`Order "${oData.id}" saved successfully!`);
    }

    // Wire up New Order modal events
    const orderModalCloseBtn = document.getElementById('orderModalClose');
    const orderModalCancelBtn = document.getElementById('orderModalCancel');
    const newOrderForm = document.getElementById('newOrderForm');
    const newOrderOverlay = document.getElementById('newOrderModal');

    if (orderModalCloseBtn) orderModalCloseBtn.addEventListener('click', closeNewOrderModal);
    if (orderModalCancelBtn) orderModalCancelBtn.addEventListener('click', closeNewOrderModal);
    if (newOrderForm) newOrderForm.addEventListener('submit', handleNewOrder);
    if (newOrderOverlay) {
        newOrderOverlay.addEventListener('click', (e) => {
            if (e.target === newOrderOverlay) closeNewOrderModal();
        });
    }
    const staticNewOrderBtn = document.getElementById('newOrderBtn');
    if (staticNewOrderBtn) staticNewOrderBtn.addEventListener('click', openNewOrderModal);

    document.querySelectorAll('#newOrderForm .form-control').forEach(el => {
        el.addEventListener('input', () => {
            const group = el.closest('.form-group');
            if (group) group.classList.remove('has-error');
            el.classList.remove('error');
        });
    });

    // User Modal Logic
    function openAddUserModal() {
        if (!hasActionAccess('users')) {
            denyAction('User create');
            return;
        }
        const overlay = document.getElementById('addUserModal');
        if (!overlay) return;
        const heading = overlay.querySelector('.modal-header h3');
        if (heading) heading.textContent = 'Add New User';
        const submitBtn = overlay.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.textContent = 'Add User';
        const form = document.getElementById('addUserForm');
        if (form) {
            form.querySelectorAll('.form-group').forEach(g => g.classList.remove('has-error'));
            form.querySelectorAll('.form-control').forEach(c => c.classList.remove('error'));
            const nameEl = document.getElementById('userName');
            if (nameEl) {
                nameEl.value = '';
                nameEl.readOnly = false;
            }
            document.getElementById('userEmail').value = '';
            document.getElementById('userRole').value = '';
            const phoneEl = document.getElementById('userPhone');
            if (phoneEl) phoneEl.value = '';
            document.getElementById('userStatus').value = 'Active';
        }
        overlay.classList.add('active');
    }

    function closeAddUserModal() {
        const overlay = document.getElementById('addUserModal');
        if (overlay) overlay.classList.remove('active');
    }

    async function handleAddUser(e) {
        e.preventDefault();
        if (!hasActionAccess('users')) {
            denyAction('User create/update');
            return;
        }
        let valid = true;
        const fields = [
            { id: 'userName', check: v => v.trim() !== '' },
            { id: 'userEmail', check: v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) },
            { id: 'userRole', check: v => v !== '' }
        ];
        fields.forEach(f => {
            const el = document.getElementById(f.id);
            const group = el.closest('.form-group');
            if (!f.check(el.value)) {
                group.classList.add('has-error');
                el.classList.add('error');
                valid = false;
            } else {
                group.classList.remove('has-error');
                el.classList.remove('error');
            }
        });
        if (!valid) return;

        const uname = document.getElementById('userName').value.trim();
        const existingIdx = users.findIndex(u => u.name === uname);
        const existingUser = existingIdx !== -1 ? users[existingIdx] : null;

        const uData = {
            ...(existingUser || {}),
            name: uname,
            role: document.getElementById('userRole').value,
            status: document.getElementById('userStatus').value,
            email: document.getElementById('userEmail').value.trim(),
            phone: String(document.getElementById('userPhone') && document.getElementById('userPhone').value || '').trim()
        };

        const credential = upsertAuthCredentialsForUser(uData, {
            existingUsername: existingUser && existingUser.username
        });
        uData.username = credential.username;

        try {
            if (existingUser && existingUser.id) {
                const backendUser = await apiRequest(`/users/${encodeURIComponent(String(existingUser.id))}`, {
                    method: 'PUT',
                    role: 'admin',
                    body: {
                        name: uData.name,
                        role: mapRoleLabelToBackendRole(uData.role),
                        email: uData.email,
                        mobileNo: uData.phone || '',
                        status: uData.status
                    }
                });
                uData.id = backendUser.id || existingUser.id;
            } else {
                const backendUser = await apiRequest('/users', {
                    method: 'POST',
                    role: 'admin',
                    body: {
                        companyId: String(activeBusinessId || 'BIZ-101').trim() || 'BIZ-101',
                        name: uData.name,
                        role: mapRoleLabelToBackendRole(uData.role),
                        email: uData.email,
                        mobileNo: uData.phone || '0000000000',
                        username: uData.username,
                        password: credential.password || 'user123'
                    }
                });
                uData.id = backendUser.id;
            }
        } catch (error) {
            showMutationError('User save', error);
            return;
        }

        if (existingIdx !== -1) users[existingIdx] = uData;
        else users.push(uData);
        persistOperationalData();

        closeAddUserModal();
        renderPage('users');
        showToast(`User "${uData.name}" saved successfully!`);

        if (existingIdx === -1 || credential.generated) {
            showCredentialsModal(existingIdx === -1 ? 'New User Credentials' : 'User Credentials', {
                name: uData.name,
                username: credential.username,
                password: credential.password,
                role: mapUserRoleToAuthRole(uData.role),
                email: uData.email
            });
        }
    }

    // Wire up Add User modal events
    const userModalCloseBtn = document.getElementById('userModalClose');
    const userModalCancelBtn = document.getElementById('userModalCancel');
    const addUserForm = document.getElementById('addUserForm');
    const addUserOverlay = document.getElementById('addUserModal');

    if (userModalCloseBtn) userModalCloseBtn.addEventListener('click', closeAddUserModal);
    if (userModalCancelBtn) userModalCancelBtn.addEventListener('click', closeAddUserModal);
    if (addUserForm) addUserForm.addEventListener('submit', handleAddUser);
    if (addUserOverlay) {
        addUserOverlay.addEventListener('click', (e) => {
            if (e.target === addUserOverlay) closeAddUserModal();
        });
    }
    const staticAddUserBtn = document.getElementById('addUserBtn');
    if (staticAddUserBtn) staticAddUserBtn.addEventListener('click', openAddUserModal);

    document.querySelectorAll('#addUserForm .form-control').forEach(el => {
        el.addEventListener('input', () => {
            const group = el.closest('.form-group');
            if (group) group.classList.remove('has-error');
            el.classList.remove('error');
        });
    });

    // Global CRUD handlers for Product, Order, User
    window.editProduct = function(sku) {
        if (!hasActionAccess('inventory')) {
            denyAction('Inventory update');
            return;
        }
        const p = inventory.find(i => i.sku === sku);
        if (!p) return;
        openAddProductModal();
        document.querySelector('#addProductModal h3').textContent = 'Edit Product';
        const submitBtn = document.querySelector('#addProductModal button[type="submit"]');
        if (submitBtn) submitBtn.textContent = 'Save Product';
        document.getElementById('prodSku').value = p.sku;
        document.getElementById('prodName').value = p.name;
        document.getElementById('prodCategory').value = p.cat;
        document.getElementById('prodSupplier').value = p.supplier || '';
        const supplierDetails = getSupplierDetails(p);
        const supplierPhoneInput = document.getElementById('prodSupplierPhone');
        const supplierEmailInput = document.getElementById('prodSupplierEmail');
        const supplierLeadTimeInput = document.getElementById('prodLeadTime');
        if (supplierPhoneInput) supplierPhoneInput.value = p.supplierPhone || supplierDetails.phone || '';
        if (supplierEmailInput) supplierEmailInput.value = p.supplierEmail || supplierDetails.email || '';
        if (supplierLeadTimeInput) supplierLeadTimeInput.value = String(p.leadTimeDays || supplierDetails.leadTimeDays || 3);
        document.getElementById('prodPrice').value = p.price;
        document.getElementById('prodStock').value = p.stock;
        document.getElementById('prodStatus').value = p.status;
    };
    window.deleteProduct = function(sku) {
        if (!hasActionAccess('inventory')) {
            denyAction('Inventory delete');
            return;
        }
        openQuickConfirmModal({
            title: 'Delete Product',
            message: `Delete Product ${sku}?`,
            confirmLabel: 'Delete',
            onConfirm: async () => {
                const index = inventory.findIndex(i => i.sku === sku);
                const target = index !== -1 ? inventory[index] : null;
                if (!target) return true;
                if (!target.inventoryId && !target.productId) {
                    throw new Error('Missing backend identifiers for this inventory row');
                }

                if (target.inventoryId) {
                    try {
                        await apiRequest(`/inventory/${encodeURIComponent(String(target.inventoryId))}`, {
                            method: 'DELETE',
                            role: 'inventorymanager'
                        });
                    } catch (error) {
                        if (!isNotFoundError(error)) throw error;
                    }
                }
                if (target.productId) {
                    try {
                        await apiRequest(`/products/${encodeURIComponent(String(target.productId))}`, {
                            method: 'DELETE',
                            role: 'inventorymanager'
                        });
                    } catch (error) {
                        if (!isNotFoundError(error)) throw error;
                    }
                }
                inventory.splice(index, 1);
                persistOperationalData();
                if (currentPage === 'inventory') {
                    renderPage('inventory');
                }
                showToast(`Product "${sku}" deleted!`);
                return true;
            }
        });
    };

    window.editOrder = function(id) {
        if (!hasActionAccess('orders')) {
            denyAction('Order update');
            return;
        }
        const o = orders.find(i => i.id === id);
        if (!o) return;
        openNewOrderModal();
        document.querySelector('#newOrderModal h3').textContent = 'Edit Order';
        document.getElementById('orderId').value = o.id;
        document.getElementById('orderCustomer').value = o.customer;
        document.getElementById('orderItems').value = o.items;
        document.getElementById('orderTotal').value = o.total;
        document.getElementById('orderPayment').value = o.payment;
        document.getElementById('orderStatus').value = o.status;
    };
    window.deleteOrder = function(id) {
        if (!hasActionAccess('orders') || !hasOrderDeleteAccess()) {
            denyAction('Order delete');
            return;
        }
        openQuickConfirmModal({
            title: 'Delete Order',
            message: `Delete Order ${id}?`,
            confirmLabel: 'Delete',
            onConfirm: async () => {
                const index = orders.findIndex(i => i.id === id);
                if (index === -1) return true;
                await apiRequest(`/orders/${encodeURIComponent(String(id))}`, {
                    method: 'DELETE'
                });
                orders.splice(index, 1);
                persistOperationalData();
                document.querySelectorAll('tr').forEach(r => { if(r.children[0] && r.children[0].textContent === id) r.remove(); });
                showToast(`Order "${id}" deleted!`);
                return true;
            }
        });
    };

    window.editUser = function(nameToken) {
        if (!hasActionAccess('users')) {
            denyAction('User update');
            return;
        }
        const name = decodeUserToken(nameToken);
        const u = users.find(i => i.name === name);
        if (!u) return;
        openAddUserModal();
        const heading = document.querySelector('#addUserModal h3');
        if (heading) heading.textContent = 'Edit User';
        const submitBtn = document.querySelector('#addUserModal button[type="submit"]');
        if (submitBtn) submitBtn.textContent = 'Save User';
        document.getElementById('userName').value = u.name;
        document.getElementById('userName').readOnly = true; // Name acts as ID, so don't change
        document.getElementById('userEmail').value = u.email || '';
        document.getElementById('userRole').value = u.role;
        document.getElementById('userStatus').value = u.status;
        const phoneInput = document.getElementById('userPhone');
        if (phoneInput) phoneInput.value = u.phone || '';
    };
    window.deleteUser = function(nameToken) {
        if (!hasActionAccess('users')) {
            denyAction('User delete');
            return;
        }
        const name = decodeUserToken(nameToken);
        openQuickConfirmModal({
            title: 'Delete User',
            message: `Delete User ${name}?`,
            confirmLabel: 'Delete',
            onConfirm: async () => {
                const index = users.findIndex(i => i.name === name);
                const targetUser = index !== -1 ? users[index] : null;
                if (!targetUser) return true;
                if (!targetUser.id) {
                    throw new Error('Missing backend user id');
                }

                await apiRequest(`/users/${encodeURIComponent(String(targetUser.id))}`, {
                    method: 'DELETE',
                    role: 'admin'
                });
                users.splice(index, 1);
                removeAuthCredentialsForUser(targetUser);
                persistOperationalData();
                if (currentPage === 'users') {
                    renderPage('users');
                } else {
                    document.querySelectorAll('tr').forEach(r => { if (r.children[0] && r.children[0].textContent === name) r.remove(); });
                }
                showToast(`User "${name}" deleted!`);
                return true;
            }
        });
    };

    window.changeUserRole = function(nameToken) {
        if (!hasActionAccess('users')) {
            denyAction('User update');
            return;
        }
        const name = decodeUserToken(nameToken);
        const userIndex = users.findIndex(user => user.name === name);
        if (userIndex === -1) return;
        const user = users[userIndex];

        openQuickFormModal({
            title: `Change Role - ${user.name}`,
            submitLabel: 'Update Role',
            fields: [
                { name: 'role', label: 'Role', type: 'select', required: true, options: USER_MANAGED_ROLE_OPTIONS }
            ],
            initialValues: {
                role: mapUserRoleToAuthRole(user.role)
            },
            onSubmit: async (values, closeModal) => {
                try {
                    const nextRole = String(values.role || '').trim();
                    if (!user.id) throw new Error('Missing backend user id');
                    await apiRequest(`/users/${encodeURIComponent(String(user.id))}`, {
                        method: 'PUT',
                        role: 'admin',
                        body: { role: mapRoleLabelToBackendRole(nextRole) }
                    });
                    user.role = nextRole;
                    const credential = upsertAuthCredentialsForUser(user, { existingUsername: user.username });
                    user.username = credential.username;
                    persistOperationalData();
                    closeModal();
                    renderUserProfile(user.name);
                    showToast(`${user.name}'s role updated to ${user.role}.`);
                } catch (error) {
                    showMutationError('User role update', error);
                }
            }
        });
    };

    window.sendUserPasswordReset = async function(nameToken) {
        if (!hasActionAccess('users')) {
            denyAction('User password reset');
            return;
        }
        const name = decodeUserToken(nameToken);
        const userIndex = users.findIndex(user => user.name === name);
        if (userIndex === -1) return;
        const user = users[userIndex];
        const tempPassword = generateTemporaryPassword();
        const credential = upsertAuthCredentialsForUser(user, {
            existingUsername: user.username,
            forcePassword: tempPassword
        });
        try {
            if (!user.id) throw new Error('Missing backend user id');
            await apiRequest(`/users/${encodeURIComponent(String(user.id))}`, {
                method: 'PUT',
                role: 'admin',
                body: { password: credential.password }
            });
            user.username = credential.username;
            persistOperationalData();

            showCredentialsModal('Temporary Password Generated', {
                name: user.name,
                username: credential.username,
                password: credential.password,
                role: mapUserRoleToAuthRole(user.role),
                email: user.email
            });
            renderUserProfile(user.name);
            showToast(`Temporary password generated for ${user.name}.`);
        } catch (error) {
            showMutationError('Password reset', error);
        }
    };

    window.toggleUserSuspension = async function(nameToken) {
        if (!hasActionAccess('users')) {
            denyAction('User status update');
            return;
        }
        const name = decodeUserToken(nameToken);
        const userIndex = users.findIndex(user => user.name === name);
        if (userIndex === -1) return;
        const user = users[userIndex];
        const currentlySuspended = String(user.status || '').toLowerCase() === 'suspended';

        try {
            const nextStatus = currentlySuspended ? 'Active' : 'Suspended';
            if (!user.id) throw new Error('Missing backend user id');
            await apiRequest(`/users/${encodeURIComponent(String(user.id))}`, {
                method: 'PUT',
                role: 'admin',
                body: { status: nextStatus }
            });
            user.status = nextStatus;
            const credential = upsertAuthCredentialsForUser(user, { existingUsername: user.username });
            user.username = credential.username;
            persistOperationalData();
            renderUserProfile(user.name);
            showToast(currentlySuspended ? `${user.name} reactivated.` : `${user.name} suspended.`);
        } catch (error) {
            showMutationError('User status update', error);
        }
    };

    window.raiseReturnRequest = function() {
        if (!hasActionAccess('returns')) {
            denyAction('Return request create');
            return;
        }
        const productOptions = Array.from(new Set(
            inventory
                .map(i => String((i && i.name) || '').trim())
                .filter(Boolean)
        ));
        const productField = productOptions.length
            ? { name: 'product', label: 'Product', type: 'select', required: true, options: productOptions }
            : { name: 'product', label: 'Product', type: 'text', required: true, placeholder: 'Product name' };
        openQuickFormModal({
            title: 'Raise Return Request',
            submitLabel: 'Create',
            fields: [
                { name: 'oid', label: 'Order ID', type: 'text', required: true, placeholder: 'ORD-4821' },
                productField,
                { name: 'qty', label: 'Quantity', type: 'number', required: true, min: 1, step: 1 },
                { name: 'reason', label: 'Reason', type: 'select', required: true, options: ['Damaged', 'Wrong Item', 'Expired', 'Stale'] },
                { name: 'amount', label: 'Refund Amount', type: 'number', required: true, min: 0, step: 0.01 }
            ],
            initialValues: { product: productOptions[0] || '', qty: 1, reason: 'Damaged', amount: 0 },
            onSubmit: async (values, closeModal) => {
                try {
                    const productName = String(values.product || '').trim();
                    const invItem = inventory.find(i => String((i && i.name) || '').trim() === productName);
                    const returnRecord = {
                        id: getNextReturnId(),
                        oid: String(values.oid).trim().toUpperCase(),
                        product: productName,
                        sku: invItem ? invItem.sku : undefined,
                        cat: invItem ? invItem.cat : undefined,
                        qty: Math.max(1, Number(values.qty) || 1),
                        reason: String(values.reason).trim(),
                        amount: Number(values.amount),
                        status: 'Pending',
                        requestedBy: localStorage.getItem('userName') || 'Operator',
                        updatedAt: formatDate()
                    };
                    const currentUser = loadObject('currentUser', {});
                    const created = await apiRequest('/returns', {
                        method: 'POST',
                        role: 'returnhandler',
                        body: buildBackendReturnPayload(returnRecord, {
                            orderId: returnRecord.oid,
                            staffId: String(currentUser.id || 'USR-005').trim() || 'USR-005'
                        })
                    });
                    returnRecord.id = created.id || returnRecord.id;
                    returnRecord.backendId = returnRecord.id;
                    returnRecord.orderId = String(created.orderId || returnRecord.oid || '').trim();
                    returnRecord.backendProduct = String(created.product || returnRecord.product || '').trim();
                    returnRecord.staffId = String(created.staffId || currentUser.id || 'USR-005').trim();
                    returnRecord.returnType = String(created.returnType || 'refund').trim() || 'refund';
                    returns.unshift(returnRecord);
                    persistOperationalData();
                    renderPage('returns');
                    closeModal();
                    showToast('Return request raised successfully.');
                } catch (error) {
                    showMutationError('Return create', error);
                }
            }
        });
    };

    window.editReturn = function(id) {
        if (!hasActionAccess('returns')) {
            denyAction('Return edit');
            return;
        }
        const item = returns.find(r => r.id === id);
        if (!item) return;

        openQuickFormModal({
            title: `Edit Return - ${id}`,
            submitLabel: 'Save',
            fields: [
                { name: 'status', label: 'Status', type: 'select', required: true, options: ['Pending', 'Under Review', 'Refunded', 'Rejected'] },
                { name: 'reason', label: 'Reason', type: 'text', required: true, placeholder: 'Damaged / Wrong Item / ...' },
                { name: 'amount', label: 'Refund Amount', type: 'number', required: true, min: 0, step: 0.01 }
            ],
            initialValues: {
                status: String(item.status || 'Pending').trim() || 'Pending',
                reason: String(item.reason || '').trim(),
                amount: Number.isFinite(Number(item.amount)) ? Number(item.amount) : 0
            },
            onSubmit: async (values, closeModal) => {
                const payload = {
                    status: String(values.status || 'Pending').trim() || 'Pending',
                    reason: String(values.reason || '').trim(),
                    refundAmount: Math.max(0, Number(values.amount) || 0)
                };
                try {
                    await updateReturnOnBackend(item, payload);

                    item.status = payload.status;
                    item.reason = payload.reason;
                    item.amount = payload.refundAmount;
                    item.updatedAt = formatDate();
                    persistOperationalData();
                    renderPage('returns');
                    closeModal();
                    showToast(`Return ${id} updated.`);
                } catch (error) {
                    showMutationError('Return update', error);
                }
            }
        });
    };

    window.approveReturn = function(id) {
        window.editReturn(id);
    };

    window.refundReturn = async function(id) {
        if (!hasActionAccess('returns')) {
            denyAction('Return refund');
            return;
        }
        const item = returns.find(r => r.id === id);
        if (!item) return;
        try {
            await updateReturnOnBackend(item, {
                status: 'Refunded',
                refundAmount: Math.max(0, Number(item.amount) || 0)
            });
            item.status = 'Refunded';
            item.updatedAt = formatDate();
            persistOperationalData();
            renderPage('returns');
            showToast(`Return ${id} refunded.`);
        } catch (error) {
            showMutationError('Return refund', error);
        }
    };

    window.rejectReturn = async function(id) {
        if (!hasActionAccess('returns')) {
            denyAction('Return reject');
            return;
        }
        const item = returns.find(r => r.id === id);
        if (!item) return;
        try {
            await updateReturnOnBackend(item, { status: 'Rejected' });
            item.status = 'Rejected';
            item.updatedAt = formatDate();
            persistOperationalData();
            renderPage('returns');
            showToast(`Return ${id} rejected.`);
        } catch (error) {
            showMutationError('Return rejection', error);
        }
    };

    window.editDelivery = function(id) {
        if (!hasActionAccess('delivery')) {
            denyAction('Delivery edit');
            return;
        }
        const item = deliveries.find(d => d.id === id);
        if (!item) return;
        openQuickFormModal({
            title: `Edit Delivery - ${id}`,
            submitLabel: 'Save',
            fields: [
                { name: 'status', label: 'Status', type: 'select', required: true, options: ['Pending', 'Dispatched', 'In Transit', 'Delivered', 'Failed'] },
                { name: 'partner', label: 'Delivery Partner', type: 'text', required: false, placeholder: 'Unassigned' },
                { name: 'partnerPhone', label: 'Partner Phone', type: 'text', required: false, placeholder: '+91 98xxxxxx' },
                { name: 'partnerAgency', label: 'Agency / Team', type: 'text', required: false, placeholder: 'External delivery partner' },
                { name: 'partnerVehicle', label: 'Vehicle', type: 'text', required: false, placeholder: 'Bike' },
                { name: 'etaMin', label: 'ETA Minutes', type: 'number', required: false, min: 0, step: 1 }
            ],
            initialValues: {
                status: normalizeDeliveryStatus(item.status),
                partner: item.partner || '',
                partnerPhone: item.partnerPhone || '',
                partnerAgency: item.partnerAgency || '',
                partnerVehicle: item.partnerVehicle || '',
                etaMin: Number.isFinite(Number(item.etaMin)) ? Math.max(0, Number(item.etaMin)) : ''
            },
            onSubmit: async (values, closeModal) => {
                const status = String(values.status || 'Pending').trim() || 'Pending';
                const partner = String(values.partner || '').trim();
                const partnerName = partner || 'Unassigned';
                const partnerPhone = String(values.partnerPhone || '').trim();
                const partnerAgency = String(values.partnerAgency || '').trim();
                const partnerVehicle = String(values.partnerVehicle || '').trim();
                const etaMin = values.etaMin === '' ? null : Math.max(0, Number(values.etaMin) || 0);
                const payload = {
                    partnerName,
                    partnerPhone,
                    partnerAgency,
                    partnerVehicle,
                    status
                };
                if ((status === 'In Transit' || status === 'Dispatched') && !item.dispatchDate) {
                    payload.dispatchDate = new Date().toISOString().slice(0, 10);
                }
                if (status === 'Delivered') {
                    payload.deliveryDate = new Date().toISOString().slice(0, 10);
                }
                try {
                    try {
                        await apiRequest(`/deliveries/${encodeURIComponent(String(item.id || id))}`, {
                            method: 'PUT',
                            role: 'deliveryops',
                            body: payload
                        });
                    } catch (error) {
                        if (!isNotFoundError(error)) throw error;
                        const resolvedId = await resolveBackendDeliveryId(item);
                        await apiRequest(`/deliveries/${encodeURIComponent(String(resolvedId))}`, {
                            method: 'PUT',
                            role: 'deliveryops',
                            body: payload
                        });
                    }
                    item.partner = partnerName;
                    item.partnerPhone = partnerPhone;
                    item.partnerAgency = partnerAgency;
                    item.partnerVehicle = partnerVehicle;
                    item.status = status;
                    if (payload.dispatchDate) item.dispatchDate = payload.dispatchDate;
                    if (payload.deliveryDate) item.deliveryDate = payload.deliveryDate;
                    if (etaMin !== null) {
                        item.etaMin = etaMin;
                    } else if (status === 'Delivered' || status === 'Failed') {
                        item.etaMin = 0;
                    } else if (status === 'Pending') {
                        item.etaMin = 35;
                    }
                    item.updatedAt = formatDate();
                    item.time = item.updatedAt.split(' ').slice(-1)[0];
                    persistOperationalData();
                    renderPage(currentPage);
                    closeModal();
                    showToast(`Delivery ${id} updated.`);
                } catch (error) {
                    showMutationError('Delivery update', error);
                }
            }
        });
    };

    window.assignDeliveryPartner = function(id) {
        window.editDelivery(id);
    };

    window.markDeliveryDelivered = async function(id) {
        if (!hasActionAccess('delivery')) {
            denyAction('Delivery close');
            return;
        }
        const item = deliveries.find(d => d.id === id);
        if (!item) return;
        try {
            try {
                await apiRequest(`/deliveries/${encodeURIComponent(String(item.id || id))}`, {
                    method: 'PUT',
                    role: 'deliveryops',
                    body: {
                        status: 'Delivered',
                        deliveryDate: new Date().toISOString().slice(0, 10)
                    }
                });
            } catch (error) {
                if (!isNotFoundError(error)) throw error;
                const resolvedId = await resolveBackendDeliveryId(item);
                await apiRequest(`/deliveries/${encodeURIComponent(String(resolvedId))}`, {
                    method: 'PUT',
                    role: 'deliveryops',
                    body: {
                        status: 'Delivered',
                        deliveryDate: new Date().toISOString().slice(0, 10)
                    }
                });
            }
            item.status = 'Delivered';
            item.updatedAt = formatDate();
            item.time = item.updatedAt.split(' ').slice(-1)[0];
            item.etaMin = 0;
            persistOperationalData();
            renderPage(currentPage);
            showToast(`${id} marked delivered.`);
        } catch (error) {
            showMutationError('Delivery completion', error);
        }
    };

    window.markDeliveryFailed = async function(id) {
        if (!hasActionAccess('delivery')) {
            denyAction('Delivery failure');
            return;
        }
        const item = deliveries.find(d => d.id === id);
        if (!item) return;
        if (normalizeDeliveryStatus(item.status) === 'Delivered') return;
        try {
            try {
                await apiRequest(`/deliveries/${encodeURIComponent(String(item.id || id))}`, {
                    method: 'PUT',
                    role: 'deliveryops',
                    body: { status: 'Failed' }
                });
            } catch (error) {
                if (!isNotFoundError(error)) throw error;
                const resolvedId = await resolveBackendDeliveryId(item);
                await apiRequest(`/deliveries/${encodeURIComponent(String(resolvedId))}`, {
                    method: 'PUT',
                    role: 'deliveryops',
                    body: { status: 'Failed' }
                });
            }
            item.status = 'Failed';
            item.updatedAt = formatDate();
            item.time = item.updatedAt.split(' ').slice(-1)[0];
            item.etaMin = 0;
            persistOperationalData();
            renderPage(currentPage);
            showToast(`${id} marked failed.`);
        } catch (error) {
            showMutationError('Delivery failure update', error);
        }
    };

    window.retryDelivery = async function(id) {
        if (!hasActionAccess('delivery')) {
            denyAction('Delivery retry');
            return;
        }
        const item = deliveries.find(d => d.id === id);
        if (!item) return;
        try {
            try {
                await apiRequest(`/deliveries/${encodeURIComponent(String(item.id || id))}`, {
                    method: 'PUT',
                    role: 'deliveryops',
                    body: {
                        status: 'Pending',
                        partnerName: 'Unassigned'
                    }
                });
            } catch (error) {
                if (!isNotFoundError(error)) throw error;
                const resolvedId = await resolveBackendDeliveryId(item);
                await apiRequest(`/deliveries/${encodeURIComponent(String(resolvedId))}`, {
                    method: 'PUT',
                    role: 'deliveryops',
                    body: {
                        status: 'Pending',
                        partnerName: 'Unassigned'
                    }
                });
            }
            item.status = 'Pending';
            item.partner = '';
            item.partnerPhone = '';
            item.partnerAgency = '';
            item.partnerVehicle = '';
            item.updatedAt = formatDate();
            item.time = '-';
            persistOperationalData();
            renderPage(currentPage);
            showToast(`${id} moved back to pending.`);
        } catch (error) {
            showMutationError('Delivery retry', error);
        }
    };

    window.renderBusinessesHome = function() {
        if (!hasActionAccess('businesses')) {
            denyAction('Businesses view');
            return;
        }
        renderPage('superuser');
    };

    window.openBusinessDetails = function(id) {
        if (!hasActionAccess('businesses')) {
            denyAction('Businesses detail view');
            return;
        }
        renderBusinessDetails(id);
    };

    window.openBusinessAdminDashboard = function(id) {
        if (!hasActionAccess('businesses')) {
            denyAction('Businesses dashboard view');
            return;
        }
        const business = businesses.find(b => b.id === id);
        if (!business) {
            showToast('Business not found.');
            return;
        }

        localStorage.setItem('activeBusinessId', business.id);
        localStorage.setItem('activeBusinessName', business.name);
        window.location.href = 'dashboard.html';
    };

    window.addBusiness = function() {
        if (!hasActionAccess('businesses')) {
            denyAction('Business create');
            return;
        }

        openQuickFormModal({
            title: 'Add New Business',
            submitLabel: 'Create Business',
            fields: [
                { name: 'name', label: 'Business Name', type: 'text', required: true },
                { name: 'owner', label: 'Owner Name', type: 'text', required: true },
                { name: 'adminName', label: 'Admin Name', type: 'text', required: true },
                { name: 'type', label: 'Business Type', type: 'text', required: true },
                { name: 'email', label: 'Business Email', type: 'email', required: true },
                { name: 'phone', label: 'Business Phone', type: 'text', required: true },
                { name: 'tenureMonths', label: 'Using BillBhai (Months)', type: 'number', required: true, min: 0 },
                { name: 'storesCount', label: 'Stores Count', type: 'number', required: true, min: 0 },
                { name: 'profit', label: 'Profit', type: 'number', required: true, min: 0, step: 0.01 },
                { name: 'paymentDue', label: 'Payment Due', type: 'number', required: true, min: 0, step: 0.01 },
                { name: 'status', label: 'Status', type: 'select', required: true, options: ['Active', 'Trial', 'Paused'] },
                { name: 'productsPlan', label: 'Products Plan', type: 'text', required: true }
            ],
            initialValues: { status: 'Active', productsPlan: 'Billing Starter', tenureMonths: 1, storesCount: 1, profit: 0, paymentDue: 0 },
            onSubmit: async (values, closeModal) => {
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
                    showToast('Please enter a valid email.');
                    return;
                }

                const id = getNextBusinessId();
                const record = {
                    id,
                    name: String(values.name).trim(),
                    owner: String(values.owner).trim(),
                    adminName: String(values.adminName).trim(),
                    type: String(values.type).trim(),
                    email: String(values.email).trim(),
                    phone: String(values.phone).trim(),
                    status: String(values.status).trim(),
                    productsPlan: String(values.productsPlan).trim(),
                    tenureMonths: Number(values.tenureMonths),
                    storesCount: Number(values.storesCount),
                    profit: Number(values.profit),
                    paymentDue: Number(values.paymentDue),
                    users: [
                        { name: String(values.adminName).trim(), role: 'Admin', status: 'Active' }
                    ],
                    stores: [
                        { code: `${id}-S1`, city: 'Primary City', status: 'Active' }
                    ],
                    payments: [
                        { month: 'Mar 2026', amount: 0, status: 'Due' }
                    ]
                };

                try {
                    const created = await apiRequest('/companies', {
                        method: 'POST',
                        role: 'superuser',
                        body: {
                            name: record.name,
                            owner: record.owner,
                            adminName: record.adminName,
                            type: record.type,
                            email: record.email,
                            phone: record.phone,
                            productsPlan: record.productsPlan,
                            tenureMonths: Number(record.tenureMonths),
                            storesCount: Number(record.storesCount)
                        }
                    });
                    record.id = created.id || record.id;
                    record.status = created.status || record.status;
                } catch (error) {
                    showMutationError('Business create', error);
                    return;
                }
                upsertBusiness(record);
                renderPage('superuser');
                closeModal();
                showToast(`Business "${record.name}" created successfully.`);
            }
        });
    };

    window.editBusiness = function(id) {
        if (!hasActionAccess('businesses')) {
            denyAction('Business update');
            return;
        }
        const existing = businesses.find(b => b.id === id);
        if (!existing) return;

        openQuickFormModal({
            title: `Edit Business - ${existing.name}`,
            submitLabel: 'Save Changes',
            fields: [
                { name: 'name', label: 'Business Name', type: 'text', required: true },
                { name: 'owner', label: 'Owner Name', type: 'text', required: true },
                { name: 'adminName', label: 'Admin Name', type: 'text', required: true },
                { name: 'type', label: 'Business Type', type: 'text', required: true },
                { name: 'email', label: 'Business Email', type: 'email', required: true },
                { name: 'phone', label: 'Business Phone', type: 'text', required: true },
                { name: 'tenureMonths', label: 'Using BillBhai (Months)', type: 'number', required: true, min: 0 },
                { name: 'storesCount', label: 'Stores Count', type: 'number', required: true, min: 0 },
                { name: 'profit', label: 'Profit', type: 'number', required: true, min: 0, step: 0.01 },
                { name: 'paymentDue', label: 'Payment Due', type: 'number', required: true, min: 0, step: 0.01 },
                { name: 'status', label: 'Status', type: 'select', required: true, options: ['Active', 'Trial', 'Paused'] },
                { name: 'productsPlan', label: 'Products Plan', type: 'text', required: true }
            ],
            initialValues: existing,
            onSubmit: async (values, closeModal) => {
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
                    showToast('Please enter a valid email.');
                    return;
                }

                const updated = {
                    ...existing,
                    name: String(values.name).trim(),
                    owner: String(values.owner).trim(),
                    adminName: String(values.adminName).trim(),
                    type: String(values.type).trim(),
                    email: String(values.email).trim(),
                    phone: String(values.phone).trim(),
                    tenureMonths: Number(values.tenureMonths),
                    storesCount: Number(values.storesCount),
                    profit: Number(values.profit),
                    paymentDue: Number(values.paymentDue),
                    status: String(values.status).trim(),
                    productsPlan: String(values.productsPlan).trim()
                };

                try {
                    await apiRequest(`/companies/${encodeURIComponent(String(existing.id))}`, {
                        method: 'PUT',
                        role: 'superuser',
                        body: {
                            name: updated.name,
                            owner: updated.owner,
                            adminName: updated.adminName,
                            type: updated.type,
                            email: updated.email,
                            phone: updated.phone,
                            productsPlan: updated.productsPlan,
                            tenureMonths: Number(updated.tenureMonths),
                            storesCount: Number(updated.storesCount),
                            profit: Number(updated.profit),
                            paymentDue: Number(updated.paymentDue),
                            status: updated.status
                        }
                    });
                } catch (error) {
                    showMutationError('Business update', error);
                    return;
                }
                upsertBusiness(updated, existing.id);
                renderBusinessDetails(updated.id);
                closeModal();
                showToast(`Business "${updated.name}" updated successfully.`);
            }
        });
    };

    window.deleteBusiness = function(id) {
        if (!hasActionAccess('businesses')) {
            denyAction('Business delete');
            return;
        }
        const existing = businesses.find(b => b.id === id);
        if (!existing) return;
        openQuickConfirmModal({
            title: 'Delete Business',
            message: `Delete Business ${existing.name}?`,
            confirmLabel: 'Delete',
            onConfirm: async () => {
                await apiRequest(`/companies/${encodeURIComponent(String(id))}`, {
                    method: 'DELETE',
                    role: 'superuser'
                });
                const index = businesses.findIndex(b => b.id === id);
                if (index !== -1) businesses.splice(index, 1);
                saveList('bb_businesses', businesses);
                renderPage('superuser');
                showToast(`Business "${existing.name}" deleted.`);
                return true;
            }
        });
    };

    window.addBusinessUser = function(businessId) {
        if (!hasActionAccess('businesses')) {
            denyAction('Business user create');
            return;
        }
        const idx = findBusinessIndex(businessId);
        if (idx === -1) return;
        showToast('Backend-only mode: business user changes are disabled (no backend endpoint).');
        return;
        openQuickFormModal({
            title: 'Add Business User',
            submitLabel: 'Add User',
            fields: [
                { name: 'name', label: 'User Name', type: 'text', required: true },
                { name: 'role', label: 'Role', type: 'select', required: true, options: ['Admin', 'Cashier', 'Inventory Manager', 'Return Handler', 'Delivery Ops'] },
                { name: 'status', label: 'Status', type: 'select', required: true, options: ['Active', 'Inactive'] }
            ],
            initialValues: { role: 'Cashier', status: 'Active' },
            onSubmit: (values, closeModal) => {
                businesses[idx].users = Array.isArray(businesses[idx].users) ? businesses[idx].users : [];
                businesses[idx].users.push({ name: String(values.name).trim(), role: String(values.role).trim(), status: String(values.status).trim() });
                saveBusinessAndRefresh(businessId);
                closeModal();
                showToast('Business user added.');
            }
        });
    };

    window.editBusinessUser = function(businessId, userIndex) {
        if (!hasActionAccess('businesses')) {
            denyAction('Business user update');
            return;
        }
        const idx = findBusinessIndex(businessId);
        if (idx === -1) return;
        showToast('Backend-only mode: business user changes are disabled (no backend endpoint).');
        return;
        const arr = Array.isArray(businesses[idx].users) ? businesses[idx].users : [];
        const user = arr[userIndex];
        if (!user) return;
        openQuickFormModal({
            title: `Edit User - ${user.name}`,
            submitLabel: 'Save Changes',
            fields: [
                { name: 'name', label: 'User Name', type: 'text', required: true },
                { name: 'role', label: 'Role', type: 'select', required: true, options: ['Admin', 'Cashier', 'Inventory Manager', 'Return Handler', 'Delivery Ops'] },
                { name: 'status', label: 'Status', type: 'select', required: true, options: ['Active', 'Inactive'] }
            ],
            initialValues: user,
            onSubmit: (values, closeModal) => {
                arr[userIndex] = { name: String(values.name).trim(), role: String(values.role).trim(), status: String(values.status).trim() };
                businesses[idx].users = arr;
                saveBusinessAndRefresh(businessId);
                closeModal();
                showToast('Business user updated.');
            }
        });
    };

    window.deleteBusinessUser = function(businessId, userIndex) {
        if (!hasActionAccess('businesses')) {
            denyAction('Business user delete');
            return;
        }
        const idx = findBusinessIndex(businessId);
        if (idx === -1) return;
        showToast('Backend-only mode: business user changes are disabled (no backend endpoint).');
        return;
        const arr = Array.isArray(businesses[idx].users) ? businesses[idx].users : [];
        const user = arr[userIndex];
        if (!user) return;
        openQuickConfirmModal({
            title: 'Delete Business User',
            message: `Delete user ${user.name}?`,
            confirmLabel: 'Delete',
            onConfirm: () => {
                arr.splice(userIndex, 1);
                businesses[idx].users = arr;
                saveBusinessAndRefresh(businessId);
                showToast('Business user deleted.');
            }
        });
    };

    window.addBusinessStore = function(businessId) {
        if (!hasActionAccess('businesses')) {
            denyAction('Business store create');
            return;
        }
        const idx = findBusinessIndex(businessId);
        if (idx === -1) return;
        showToast('Backend-only mode: business store changes are disabled (no backend endpoint).');
        return;
        openQuickFormModal({
            title: 'Add Store',
            submitLabel: 'Add Store',
            fields: [
                { name: 'code', label: 'Store Code', type: 'text', required: true },
                { name: 'city', label: 'City', type: 'text', required: true },
                { name: 'status', label: 'Status', type: 'select', required: true, options: ['Active', 'Maintenance', 'Inactive'] }
            ],
            initialValues: { code: `${businessId}-S${(businesses[idx].stores || []).length + 1}`, status: 'Active' },
            onSubmit: (values, closeModal) => {
                businesses[idx].stores = Array.isArray(businesses[idx].stores) ? businesses[idx].stores : [];
                businesses[idx].stores.push({ code: String(values.code).trim(), city: String(values.city).trim(), status: String(values.status).trim() });
                saveBusinessAndRefresh(businessId);
                closeModal();
                showToast('Store added.');
            }
        });
    };

    window.editBusinessStore = function(businessId, storeIndex) {
        if (!hasActionAccess('businesses')) {
            denyAction('Business store update');
            return;
        }
        const idx = findBusinessIndex(businessId);
        if (idx === -1) return;
        showToast('Backend-only mode: business store changes are disabled (no backend endpoint).');
        return;
        const arr = Array.isArray(businesses[idx].stores) ? businesses[idx].stores : [];
        const store = arr[storeIndex];
        if (!store) return;
        openQuickFormModal({
            title: `Edit Store - ${store.code}`,
            submitLabel: 'Save Changes',
            fields: [
                { name: 'code', label: 'Store Code', type: 'text', required: true },
                { name: 'city', label: 'City', type: 'text', required: true },
                { name: 'status', label: 'Status', type: 'select', required: true, options: ['Active', 'Maintenance', 'Inactive'] }
            ],
            initialValues: store,
            onSubmit: (values, closeModal) => {
                arr[storeIndex] = { code: String(values.code).trim(), city: String(values.city).trim(), status: String(values.status).trim() };
                businesses[idx].stores = arr;
                saveBusinessAndRefresh(businessId);
                closeModal();
                showToast('Store updated.');
            }
        });
    };

    window.deleteBusinessStore = function(businessId, storeIndex) {
        if (!hasActionAccess('businesses')) {
            denyAction('Business store delete');
            return;
        }
        const idx = findBusinessIndex(businessId);
        if (idx === -1) return;
        showToast('Backend-only mode: business store changes are disabled (no backend endpoint).');
        return;
        const arr = Array.isArray(businesses[idx].stores) ? businesses[idx].stores : [];
        const store = arr[storeIndex];
        if (!store) return;
        openQuickConfirmModal({
            title: 'Delete Store',
            message: `Delete store ${store.code}?`,
            confirmLabel: 'Delete',
            onConfirm: () => {
                arr.splice(storeIndex, 1);
                businesses[idx].stores = arr;
                saveBusinessAndRefresh(businessId);
                showToast('Store deleted.');
            }
        });
    };

    window.addBusinessPayment = function(businessId) {
        if (!hasActionAccess('businesses')) {
            denyAction('Business payment create');
            return;
        }
        const idx = findBusinessIndex(businessId);
        if (idx === -1) return;
        showToast('Backend-only mode: business payment changes are disabled (no backend endpoint).');
        return;
        openQuickFormModal({
            title: 'Add Payment Entry',
            submitLabel: 'Add Payment',
            fields: [
                { name: 'month', label: 'Month', type: 'text', required: true },
                { name: 'amount', label: 'Amount', type: 'number', required: true, min: 0, step: 0.01 },
                { name: 'status', label: 'Status', type: 'select', required: true, options: ['Paid', 'Partial', 'Due'] }
            ],
            initialValues: { month: 'Apr 2026', amount: 0, status: 'Due' },
            onSubmit: (values, closeModal) => {
                businesses[idx].payments = Array.isArray(businesses[idx].payments) ? businesses[idx].payments : [];
                businesses[idx].payments.push({ month: String(values.month).trim(), amount: Number(values.amount), status: String(values.status).trim() });
                saveBusinessAndRefresh(businessId);
                closeModal();
                showToast('Payment entry added.');
            }
        });
    };

    window.editBusinessPayment = function(businessId, paymentIndex) {
        if (!hasActionAccess('businesses')) {
            denyAction('Business payment update');
            return;
        }
        const idx = findBusinessIndex(businessId);
        if (idx === -1) return;
        showToast('Backend-only mode: business payment changes are disabled (no backend endpoint).');
        return;
        const arr = Array.isArray(businesses[idx].payments) ? businesses[idx].payments : [];
        const payment = arr[paymentIndex];
        if (!payment) return;
        openQuickFormModal({
            title: `Edit Payment - ${payment.month}`,
            submitLabel: 'Save Changes',
            fields: [
                { name: 'month', label: 'Month', type: 'text', required: true },
                { name: 'amount', label: 'Amount', type: 'number', required: true, min: 0, step: 0.01 },
                { name: 'status', label: 'Status', type: 'select', required: true, options: ['Paid', 'Partial', 'Due'] }
            ],
            initialValues: payment,
            onSubmit: (values, closeModal) => {
                arr[paymentIndex] = { month: String(values.month).trim(), amount: Number(values.amount), status: String(values.status).trim() };
                businesses[idx].payments = arr;
                saveBusinessAndRefresh(businessId);
                closeModal();
                showToast('Payment entry updated.');
            }
        });
    };

    window.deleteBusinessPayment = function(businessId, paymentIndex) {
        if (!hasActionAccess('businesses')) {
            denyAction('Business payment delete');
            return;
        }
        const idx = findBusinessIndex(businessId);
        if (idx === -1) return;
        showToast('Backend-only mode: business payment changes are disabled (no backend endpoint).');
        return;
        const arr = Array.isArray(businesses[idx].payments) ? businesses[idx].payments : [];
        const payment = arr[paymentIndex];
        if (!payment) return;
        openQuickConfirmModal({
            title: 'Delete Payment Entry',
            message: `Delete payment record ${payment.month}?`,
            confirmLabel: 'Delete',
            onConfirm: () => {
                arr.splice(paymentIndex, 1);
                businesses[idx].payments = arr;
                saveBusinessAndRefresh(businessId);
                showToast('Payment entry deleted.');
            }
        });
    };

    // Reset modals to "Add" state when opened manually
    const btnAddProd = document.getElementById('addProductBtn');
    if (btnAddProd) btnAddProd.addEventListener('click', () => { const h3 = document.querySelector('#addProductModal h3'); if (h3) h3.textContent = 'Add New Product'; });
    const btnNewOrd = document.getElementById('newOrderBtn');
    if (btnNewOrd) btnNewOrd.addEventListener('click', () => { const h3 = document.querySelector('#newOrderModal h3'); if (h3) h3.textContent = 'Create New Order'; });
    const btnAddUsr = document.getElementById('addUserBtn');
    if (btnAddUsr) btnAddUsr.addEventListener('click', () => { const h3 = document.querySelector('#addUserModal h3'); if (h3) h3.textContent = 'Add New User'; const inName = document.getElementById('userName'); if (inName) inName.readOnly = false; });

    const appReadyWatchdog = setTimeout(() => {
        console.warn('Dashboard startup exceeded timeout. Rendering shell with fallback data.');
        setAppReady(true);
    }, FETCH_TIMEOUT_MS + 3000);

    (async function startApp() {
        try {
            ['bb_orders', 'bb_inventory', 'bb_deliveries', 'bb_returns', 'bb_users', 'bb_business_data', 'bb_businesses'].forEach((key) => {
                try { localStorage.removeItem(key); } catch (err) {}
            });
            initRealtimeSync();
            const loadedFromBackend = await loadOperationalDataFromBackend();
            if (!loadedFromBackend) {
                throw new Error('Backend unavailable: dashboard requires in-memory server data.');
            }
            renderPage(currentPage);
        } catch (err) {
            console.error('Dashboard startup failed in backend-only mode.', err);
            businesses.splice(0, businesses.length);
            selectedBusiness = null;
            isBusinessScoped = false;
            businessScopedData = null;
            orders = [];
            inventory = [];
            deliveries = [];
            returns = [];
            users = [];
            showToast('Backend is required. Start the API server to load dashboard data.');
            try {
                renderPage(currentPage);
            } catch (renderErr) {
                console.error('Fallback render failed.', renderErr);
            }
        } finally {
            // Reveal UI only after initial data + page render to avoid a brief "wrong dashboard" flash.
            clearTimeout(appReadyWatchdog);
            clearTimeout(bootstrapVisibilityWatchdog);
            setAppReady(true);
        }
    })();
});
