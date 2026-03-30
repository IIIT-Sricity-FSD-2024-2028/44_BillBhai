document.addEventListener('DOMContentLoaded', () => {
    function setAppReady(isReady) {
        document.body.setAttribute('data-app-ready', isReady ? 'true' : 'false');
    }

    // Keep UI hidden until role-based permissions are applied (prevents brief admin flash).
    setAppReady(false);

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
        superuser: ['superuser', 'businesses', 'dashboard', 'orders', 'inventory', 'delivery', 'returns', 'reports', 'users', 'profile', 'settings', 'notifications'],
        admin: ['dashboard', 'orders', 'inventory', 'delivery', 'returns', 'reports', 'users', 'profile', 'settings', 'notifications'],
        cashier: ['dashboard', 'orders', 'reports', 'profile', 'settings', 'notifications'],
        returnhandler: ['dashboard', 'returns', 'orders', 'reports', 'profile', 'settings', 'notifications'],
        inventorymanager: ['dashboard', 'inventory', 'reports', 'profile', 'settings', 'notifications'],
        deliveryops: ['dashboard', 'delivery', 'reports', 'profile', 'settings', 'notifications'],
        customer: ['profile', 'settings', 'reports', 'notifications']
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
    }

    function goToLogin() {
        window.location.href = 'login.html';
    }

    function hasActionAccess(moduleKey) {
        const actions = ROLE_ACTIONS[activeRoleKey] || ROLE_ACTIONS.customer;
        return !!actions[moduleKey];
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
        const storedName = localStorage.getItem('userName');
        const storedRole = localStorage.getItem('userRole');

        if (!storedName || !storedRole) {
            clearSession();
            goToLogin();
            return;
        }

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
    const globalSearch = document.getElementById('globalSearch');

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

    if (globalSearch) {
        globalSearch.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && globalSearch.value.trim() !== '') {
                alert(`Search functionality for "${globalSearch.value.trim()}" is not implemented yet.`);
                globalSearch.value = '';
            }
        });
    }

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
    const NOTIFICATIONS_STORAGE_KEY = 'bb_notifications';
    const PROFILE_SETTINGS_STORAGE_KEY = 'bb_profile_settings';
    const AUTH_OVERRIDE_STORAGE_KEY = 'bb_auth_overrides';
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

    async function loadJsonArray(path, fallback) {
        try {
            const response = await fetch(path, { cache: 'no-store' });
            if (!response.ok) return fallback;
            const parsed = await response.json();
            return Array.isArray(parsed) ? parsed : fallback;
        } catch (err) {
            return fallback;
        }
    }

    async function loadJsonObject(path, fallback) {
        try {
            const response = await fetch(path, { cache: 'no-store' });
            if (!response.ok) return fallback;
            const parsed = await response.json();
            return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : fallback;
        } catch (err) {
            return fallback;
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

    const defaultOrders = [
        { id: 'ORD-4821', customer: 'Rahul Sharma', items: 3, total: 1250, payment: 'UPI', status: 'Delivered', date: '17 Feb 14:32' },
        { id: 'ORD-4820', customer: 'Priya Patel', items: 1, total: 450, payment: 'Cash', status: 'Processing', date: '17 Feb 13:45' },
        { id: 'ORD-4819', customer: 'Amit Kumar', items: 5, total: 3200, payment: 'Card', status: 'Delivered', date: '17 Feb 12:10' }
    ];

    const defaultInventory = [
        { sku: 'SKU-01', name: 'Basmati Rice', cat: 'Grocery', supplier: 'Agarwal Traders', stock: 145, price: 380, status: 'In Stock' },
        { sku: 'SKU-02', name: 'Toor Dal', cat: 'Grocery', supplier: 'Sharma Wholesale', stock: 230, price: 120, status: 'In Stock' },
        { sku: 'SKU-03', name: 'Refined Oil', cat: 'Grocery', supplier: 'Fortune Dist.', stock: 18, price: 155, status: 'Low Stock' }
    ];

    const defaultDeliveries = [
        { id: 'DEL-901', oid: 'ORD-4821', customer: 'Rahul Sharma', address: '12, MG Road, Sector 14', partner: 'Rajesh K.', status: 'Delivered', etaMin: 0, updatedAt: '17 Feb 14:10' },
        { id: 'DEL-900', oid: 'ORD-4820', customer: 'Priya Patel', address: 'A-204, Green Park', partner: 'Sunil M.', status: 'In Transit', etaMin: 18, updatedAt: '17 Feb 13:50' },
        { id: 'DEL-899', oid: 'ORD-4819', customer: 'Amit Kumar', address: 'Plot 7, Industrial Area', partner: 'Rajesh K.', status: 'Delivered', etaMin: 0, updatedAt: '17 Feb 12:58' },
        { id: 'DEL-898', oid: 'ORD-4818', customer: 'Sneha Gupta', address: '302, Lotus Tower', partner: 'Unassigned', status: 'Pending', etaMin: 30, updatedAt: '17 Feb 12:40' },
        { id: 'DEL-897', oid: 'ORD-4817', customer: 'Vikram Joshi', address: 'H.No 15, Civil Lines', partner: 'Deepak R.', status: 'Delivered', etaMin: 0, updatedAt: '17 Feb 11:35' },
        { id: 'DEL-896', oid: 'ORD-4816', customer: 'Neha Reddy', address: 'F-3, Paradise Colony', partner: 'Sunil M.', status: 'Failed', etaMin: 0, updatedAt: '17 Feb 11:10' },
        { id: 'DEL-895', oid: 'ORD-4815', customer: 'Karan Mehta', address: '5th Cross, Jayanagar', partner: 'Sunil M.', status: 'In Transit', etaMin: 25, updatedAt: '17 Feb 10:55' },
        { id: 'DEL-894', oid: 'ORD-4814', customer: 'Anjali Desai', address: 'B-12, Shanti Nagar', partner: 'Rajesh K.', status: 'Delivered', etaMin: 0, updatedAt: '17 Feb 10:22' },
        { id: 'DEL-893', oid: 'ORD-4813', customer: 'Rohan Verma', address: 'Flat 6A, Sunrise Apts', partner: 'Deepak R.', status: 'Delivered', etaMin: 0, updatedAt: '17 Feb 09:58' },
        { id: 'DEL-892', oid: 'ORD-4812', customer: 'Suresh Iyer', address: '42, Lake View Road', partner: 'Rajesh K.', status: 'In Transit', etaMin: 10, updatedAt: '17 Feb 09:40' },
        { id: 'DEL-891', oid: 'ORD-4811', customer: 'Meera Krishnan', address: '101, Sapphire Towers', partner: 'Deepak R.', status: 'Delivered', etaMin: 0, updatedAt: '17 Feb 09:05' },
        { id: 'DEL-890', oid: 'ORD-4810', customer: 'Arjun Singh', address: 'House 23, Ram Nagar', partner: 'Unassigned', status: 'Pending', etaMin: 45, updatedAt: '17 Feb 08:50' }
    ];

    const defaultReturns = [
        { id: 'RET-221', oid: 'ORD-4820', product: 'Refined Oil', reason: 'Damaged', amount: 170, qty: 1, status: 'Pending', requestedBy: 'Walk-in', updatedAt: '17 Feb 13:55' },
        { id: 'RET-220', oid: 'ORD-4818', product: 'Milk Pack', reason: 'Expired', amount: 58, qty: 1, status: 'Approved', requestedBy: 'POS Counter', updatedAt: '17 Feb 12:50' },
        { id: 'RET-219', oid: 'ORD-4817', product: 'Refined Oil', reason: 'Wrong Item', amount: 170, qty: 1, status: 'Refunded', requestedBy: 'POS Counter', updatedAt: '17 Feb 12:15' },
        { id: 'RET-218', oid: 'ORD-4816', product: 'Basmati Rice', reason: 'Damaged', amount: 380, qty: 1, status: 'Rejected', requestedBy: 'Walk-in', updatedAt: '17 Feb 11:45' },
        { id: 'RET-217', oid: 'ORD-4815', product: 'Soft Drink', reason: 'Stale', amount: 42, qty: 2, status: 'Approved', requestedBy: 'Komal Shah', updatedAt: '17 Feb 11:20' },
        { id: 'RET-216', oid: 'ORD-4814', product: 'Refined Oil', reason: 'Damaged', amount: 170, qty: 1, status: 'Pending', requestedBy: 'Walk-in', updatedAt: '17 Feb 10:50' },
        { id: 'RET-215', oid: 'ORD-4813', product: 'Toor Dal', reason: 'Wrong Item', amount: 120, qty: 1, status: 'Refunded', requestedBy: 'Walk-in', updatedAt: '17 Feb 10:25' },
        { id: 'RET-214', oid: 'ORD-4812', product: 'Milk Pack', reason: 'Expired', amount: 58, qty: 1, status: 'Pending', requestedBy: 'POS Counter', updatedAt: '17 Feb 10:05' },
        { id: 'RET-213', oid: 'ORD-4811', product: 'Refined Oil', reason: 'Damaged', amount: 170, qty: 1, status: 'Approved', requestedBy: 'Komal Shah', updatedAt: '17 Feb 09:40' },
        { id: 'RET-212', oid: 'ORD-4810', product: 'Milk Pack', reason: 'Stale', amount: 58, qty: 1, status: 'Refunded', requestedBy: 'Walk-in', updatedAt: '17 Feb 09:10' },
        { id: 'RET-211', oid: 'ORD-4809', product: 'Refined Oil', reason: 'Damaged', amount: 170, qty: 1, status: 'Rejected', requestedBy: 'Walk-in', updatedAt: '17 Feb 08:55' },
        { id: 'RET-210', oid: 'ORD-4808', product: 'Basmati Rice', reason: 'Wrong Item', amount: 380, qty: 1, status: 'Approved', requestedBy: 'POS Counter', updatedAt: '16 Feb 18:20' },
        { id: 'RET-209', oid: 'ORD-4807', product: 'Toor Dal', reason: 'Damaged', amount: 120, qty: 1, status: 'Pending', requestedBy: 'Walk-in', updatedAt: '16 Feb 17:35' },
        { id: 'RET-208', oid: 'ORD-4806', product: 'Soft Drink', reason: 'Expired', amount: 42, qty: 1, status: 'Refunded', requestedBy: 'Walk-in', updatedAt: '16 Feb 16:10' }
    ];

    const defaultUsers = [
        { name: 'Admin', role: 'Ops Head', status: 'Active' },
        { name: 'Ramesh Gupta', role: 'Cashier', status: 'Active' },
        { name: 'Sunita Verma', role: 'Cashier', status: 'Active' }
    ];

    const defaultBusinesses = [
        {
            id: 'BIZ-101',
            name: 'FreshKart Central',
            owner: 'Ritu Malhotra',
            adminName: 'Arjun Mehta',
            type: 'Grocery Retail',
            email: 'central@freshkart.in',
            phone: '+91-9870011101',
            status: 'Active',
            productsPlan: 'Core POS + Inventory',
            tenureMonths: 32,
            storesCount: 6,
            profit: 1245000,
            paymentDue: 0,
            users: [
                { name: 'Arjun Mehta', role: 'Admin', status: 'Active' },
                { name: 'Komal Shah', role: 'Cashier', status: 'Active' },
                { name: 'Irfan Ali', role: 'Inventory Manager', status: 'Active' },
                { name: 'Gopal Yadav', role: 'Delivery Ops', status: 'Active' }
            ],
            stores: [
                { code: 'FK-CEN-01', city: 'Delhi', status: 'Active' },
                { code: 'FK-CEN-02', city: 'Noida', status: 'Active' },
                { code: 'FK-CEN-03', city: 'Gurugram', status: 'Active' }
            ],
            payments: [
                { month: 'Jan 2026', amount: 48000, status: 'Paid' },
                { month: 'Feb 2026', amount: 48000, status: 'Paid' },
                { month: 'Mar 2026', amount: 48000, status: 'Paid' }
            ]
        },
        {
            id: 'BIZ-102',
            name: 'Metro Mart East',
            owner: 'Aman Bedi',
            adminName: 'Shreya Nair',
            type: 'Supermarket',
            email: 'ops@metromarteast.in',
            phone: '+91-9870011102',
            status: 'Active',
            productsPlan: 'Billing + Returns',
            tenureMonths: 18,
            storesCount: 4,
            profit: 842000,
            paymentDue: 15000,
            users: [
                { name: 'Shreya Nair', role: 'Admin', status: 'Active' },
                { name: 'Hemant Rawat', role: 'Return Handler', status: 'Active' },
                { name: 'Rakesh Pal', role: 'Cashier', status: 'Active' }
            ],
            stores: [
                { code: 'MM-E-11', city: 'Kolkata', status: 'Active' },
                { code: 'MM-E-12', city: 'Howrah', status: 'Active' },
                { code: 'MM-E-13', city: 'Durgapur', status: 'Active' },
                { code: 'MM-E-14', city: 'Siliguri', status: 'Maintenance' }
            ],
            payments: [
                { month: 'Jan 2026', amount: 39000, status: 'Paid' },
                { month: 'Feb 2026', amount: 39000, status: 'Paid' },
                { month: 'Mar 2026', amount: 39000, status: 'Partial' }
            ]
        },
        {
            id: 'BIZ-103',
            name: 'DailyNeeds Hub',
            owner: 'Neha Saini',
            adminName: 'Bhavesh Gupta',
            type: 'Convenience Store',
            email: 'admin@dailyneedshub.in',
            phone: '+91-9870011103',
            status: 'Trial',
            productsPlan: 'Billing Starter',
            tenureMonths: 6,
            storesCount: 2,
            profit: 221000,
            paymentDue: 9000,
            users: [
                { name: 'Bhavesh Gupta', role: 'Admin', status: 'Active' },
                { name: 'Manju K', role: 'Cashier', status: 'Active' }
            ],
            stores: [
                { code: 'DN-H-01', city: 'Jaipur', status: 'Active' },
                { code: 'DN-H-02', city: 'Ajmer', status: 'Active' }
            ],
            payments: [
                { month: 'Jan 2026', amount: 15000, status: 'Paid' },
                { month: 'Feb 2026', amount: 15000, status: 'Paid' },
                { month: 'Mar 2026', amount: 15000, status: 'Due' }
            ]
        },
        {
            id: 'BIZ-104',
            name: 'Value Basket North',
            owner: 'Imran Khan',
            adminName: 'Nitika Arora',
            type: 'Wholesale + Retail',
            email: 'north@valuebasket.in',
            phone: '+91-9870011104',
            status: 'Active',
            productsPlan: 'Full Suite',
            tenureMonths: 44,
            storesCount: 9,
            profit: 2354000,
            paymentDue: 0,
            users: [
                { name: 'Nitika Arora', role: 'Admin', status: 'Active' },
                { name: 'Rohit Dabas', role: 'Inventory Manager', status: 'Active' },
                { name: 'Seema Arif', role: 'Return Handler', status: 'Active' },
                { name: 'Pankaj Rana', role: 'Delivery Ops', status: 'Active' },
                { name: 'Rupa S', role: 'Cashier', status: 'Active' }
            ],
            stores: [
                { code: 'VB-N-01', city: 'Chandigarh', status: 'Active' },
                { code: 'VB-N-02', city: 'Ludhiana', status: 'Active' },
                { code: 'VB-N-03', city: 'Jalandhar', status: 'Active' }
            ],
            payments: [
                { month: 'Jan 2026', amount: 69000, status: 'Paid' },
                { month: 'Feb 2026', amount: 69000, status: 'Paid' },
                { month: 'Mar 2026', amount: 69000, status: 'Paid' }
            ]
        }
    ];

    const businesses = loadList('bb_businesses', defaultBusinesses)
        .map((b, idx) => normalizeBusinessRecord(b, defaultBusinesses[idx] && defaultBusinesses[idx].id, defaultBusinesses[idx] && defaultBusinesses[idx].name));

    if (!localStorage.getItem('bb_businesses')) {
        saveList('bb_businesses', businesses);
    } else {
        // Persist normalized schema so older saved data does not break new UI.
        saveList('bb_businesses', businesses);
    }

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

    function buildBusinessSeedData(business, idx) {
        const userList = Array.isArray(business.users) ? business.users : [];
        const adminName = userList.find(u => String(u.role || '').toLowerCase() === 'admin')?.name || business.adminName || 'Store Admin';
        const cashierName = userList.find(u => String(u.role || '').toLowerCase().includes('cashier'))?.name || 'POS Counter';
        const city = Array.isArray(business.stores) && business.stores[0] ? business.stores[0].city : 'Primary City';
        const seedNum = 500 + idx * 50;

        const seedOrders = [
            { id: `ORD-${seedNum + 1}`, customer: `${city} Walk-in`, items: 3, total: 1540 + idx * 120, payment: 'UPI', status: 'Delivered', date: '17 Feb 11:10' },
            { id: `ORD-${seedNum + 2}`, customer: 'Anita Verma', items: 2, total: 980 + idx * 90, payment: 'Card', status: 'Processing', date: '17 Feb 12:35' },
            { id: `ORD-${seedNum + 3}`, customer: 'Vikram Singh', items: 1, total: 350 + idx * 70, payment: 'Cash', status: 'Pending', date: '17 Feb 13:20' },
            { id: `ORD-${seedNum + 4}`, customer: 'Suman Rao', items: 4, total: 2250 + idx * 100, payment: 'UPI', status: 'Delivered', date: '16 Feb 18:04' },
            { id: `ORD-${seedNum + 5}`, customer: 'Karan Joshi', items: 2, total: 1160 + idx * 85, payment: 'Card', status: 'Delivered', date: '16 Feb 16:40' }
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
            `B-12, Shanti Nagar, ${city}`
        ];

        const seedDeliveries = [
            { id: `DEL-${seedNum + 1}`, oid: seedOrders[0].id, customer: seedOrders[0].customer, address: addressBook[0], partner: 'Rider Team A', status: 'Delivered', etaMin: 0, updatedAt: '17 Feb 11:55' },
            { id: `DEL-${seedNum + 2}`, oid: seedOrders[1].id, customer: seedOrders[1].customer, address: addressBook[1], partner: 'Rider Team B', status: 'In Transit', etaMin: 18, updatedAt: '17 Feb 12:55' },
            { id: `DEL-${seedNum + 3}`, oid: seedOrders[2].id, customer: seedOrders[2].customer, address: addressBook[2], partner: 'Unassigned', status: 'Pending', etaMin: 32, updatedAt: '17 Feb 13:05' },
            { id: `DEL-${seedNum + 4}`, oid: seedOrders[3].id, customer: seedOrders[3].customer, address: addressBook[3], partner: 'Rider Team C', status: 'Delivered', etaMin: 0, updatedAt: '16 Feb 18:45' },
            { id: `DEL-${seedNum + 5}`, oid: seedOrders[4].id, customer: seedOrders[4].customer, address: addressBook[4], partner: 'Rider Team B', status: 'Failed', etaMin: 0, updatedAt: '16 Feb 17:05' },
            { id: `DEL-${seedNum + 6}`, oid: `ORD-${seedNum + 6}`, customer: 'Rohan Verma', address: addressBook[5], partner: 'Rider Team A', status: 'In Transit', etaMin: 10, updatedAt: '17 Feb 10:20' },
            { id: `DEL-${seedNum + 7}`, oid: `ORD-${seedNum + 7}`, customer: 'Neha Reddy', address: addressBook[6], partner: 'Rider Team C', status: 'Delivered', etaMin: 0, updatedAt: '17 Feb 09:40' },
            { id: `DEL-${seedNum + 8}`, oid: `ORD-${seedNum + 8}`, customer: 'Arjun Singh', address: addressBook[7], partner: 'Unassigned', status: 'Pending', etaMin: 40, updatedAt: '17 Feb 09:15' },
            { id: `DEL-${seedNum + 9}`, oid: `ORD-${seedNum + 9}`, customer: 'Meera Krishnan', address: addressBook[8], partner: 'Rider Team B', status: 'In Transit', etaMin: 22, updatedAt: '17 Feb 08:55' }
        ];

        const seedInventory = [
            { sku: `SKU-${seedNum + 1}`, name: 'Basmati Rice', cat: 'Grocery', supplier: 'Agarwal Traders', stock: 160 - idx * 3, price: 390 + idx * 5, status: 'In Stock' },
            { sku: `SKU-${seedNum + 2}`, name: 'Toor Dal', cat: 'Grocery', supplier: 'Sharma Wholesale', stock: 92 - idx * 4, price: 130 + idx * 4, status: 'In Stock' },
            { sku: `SKU-${seedNum + 3}`, name: 'Refined Oil', cat: 'Grocery', supplier: 'Fortune Dist.', stock: 24 - idx * 2, price: 170 + idx * 3, status: 'Low Stock' },
            { sku: `SKU-${seedNum + 4}`, name: 'Milk Pack', cat: 'Dairy', supplier: 'City Dairy', stock: 12 + idx, price: 58, status: 'Low Stock' },
            { sku: `SKU-${seedNum + 5}`, name: 'Soft Drink', cat: 'Beverages', supplier: 'Cool Bev', stock: 84 + idx * 3, price: 42, status: 'In Stock' }
        ];

        const seedReturns = [
            { id: `RET-${seedNum + 1}`, oid: seedOrders[1].id, product: seedInventory[2].name, sku: seedInventory[2].sku, cat: seedInventory[2].cat, reason: 'Damaged', amount: seedInventory[2].price, qty: 1, status: 'Pending', requestedBy: cashierName, updatedAt: '17 Feb 13:50' },
            { id: `RET-${seedNum + 2}`, oid: seedOrders[2].id, product: seedInventory[3].name, sku: seedInventory[3].sku, cat: seedInventory[3].cat, reason: 'Expired', amount: seedInventory[3].price, qty: 1, status: 'Approved', requestedBy: cashierName, updatedAt: '17 Feb 13:15' },
            { id: `RET-${seedNum + 3}`, oid: seedOrders[4].id, product: seedInventory[2].name, sku: seedInventory[2].sku, cat: seedInventory[2].cat, reason: 'Wrong Item', amount: seedInventory[2].price, qty: 1, status: 'Refunded', requestedBy: 'Walk-in', updatedAt: '17 Feb 12:40' },
            { id: `RET-${seedNum + 4}`, oid: seedOrders[0].id, product: seedInventory[4].name, sku: seedInventory[4].sku, cat: seedInventory[4].cat, reason: 'Stale', amount: seedInventory[4].price * 2, qty: 2, status: 'Pending', requestedBy: cashierName, updatedAt: '17 Feb 12:05' },
            { id: `RET-${seedNum + 5}`, oid: `ORD-${seedNum + 9}`, product: seedInventory[1].name, sku: seedInventory[1].sku, cat: seedInventory[1].cat, reason: 'Wrong Item', amount: seedInventory[1].price, qty: 1, status: 'Rejected', requestedBy: 'Walk-in', updatedAt: '17 Feb 11:35' },
            { id: `RET-${seedNum + 6}`, oid: `ORD-${seedNum + 10}`, product: seedInventory[2].name, sku: seedInventory[2].sku, cat: seedInventory[2].cat, reason: 'Damaged', amount: seedInventory[2].price, qty: 1, status: 'Approved', requestedBy: cashierName, updatedAt: '17 Feb 10:55' },
            { id: `RET-${seedNum + 7}`, oid: `ORD-${seedNum + 11}`, product: seedInventory[3].name, sku: seedInventory[3].sku, cat: seedInventory[3].cat, reason: 'Stale', amount: seedInventory[3].price, qty: 1, status: 'Refunded', requestedBy: 'Walk-in', updatedAt: '17 Feb 10:25' }
        ];

        return {
            orders: seedOrders,
            inventory: seedInventory,
            deliveries: seedDeliveries,
            returns: seedReturns,
            users: userList.length
                ? cloneRows(userList)
                : [
                    { name: adminName, role: 'Admin', status: 'Active' },
                    { name: cashierName, role: 'Cashier', status: 'Active' }
                ]
        };
    }

    const businessDataStore = loadObject('bb_business_data', {});
    businesses.forEach((business, idx) => {
        const seed = buildBusinessSeedData(business, idx);
        const existing = businessDataStore[business.id];
        if (!existing || typeof existing !== 'object') {
            businessDataStore[business.id] = seed;
            return;
        }

        businessDataStore[business.id] = {
            orders: Array.isArray(existing.orders) ? existing.orders : seed.orders,
            inventory: Array.isArray(existing.inventory) ? existing.inventory : seed.inventory,
            deliveries: Array.isArray(existing.deliveries) ? mergeSeedRecords(existing.deliveries, seed.deliveries, 'id') : seed.deliveries,
            returns: Array.isArray(existing.returns) ? mergeSeedRecords(existing.returns, seed.returns, 'id') : seed.returns,
            users: Array.isArray(existing.users) ? existing.users : seed.users
        };
    });
    saveObject('bb_business_data', businessDataStore);

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

    // Enrich small/global datasets with the latest seed records so charts/tables have enough data.
    if (!isBusinessScoped) {
        deliveries = mergeSeedRecords(deliveries, defaultDeliveries, 'id');
        returns = mergeSeedRecords(returns, defaultReturns, 'id');
        saveList('bb_deliveries', deliveries);
        saveList('bb_returns', returns);
    }

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
        if (isBusinessScoped && selectedBusiness) {
            const store = loadObject('bb_business_data', {});
            const scoped = store[selectedBusiness.id];
            if (!scoped || typeof scoped !== 'object') return;

            businessDataStore[selectedBusiness.id] = scoped;
            if (Array.isArray(scoped.orders)) orders = cloneRows(scoped.orders);
            if (Array.isArray(scoped.inventory)) inventory = cloneRows(scoped.inventory);
            if (Array.isArray(scoped.deliveries)) deliveries = cloneRows(scoped.deliveries);
            if (Array.isArray(scoped.returns)) returns = cloneRows(scoped.returns);
            if (Array.isArray(scoped.users)) users = cloneRows(scoped.users);
            return;
        }

        orders = loadList('bb_orders', orders);
        inventory = loadList('bb_inventory', inventory);
        deliveries = loadList('bb_deliveries', deliveries);
        returns = loadList('bb_returns', returns);
        users = loadList('bb_users', users);
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

        if (isBusinessScoped && selectedBusiness) {
            businessDataStore[selectedBusiness.id] = {
                orders,
                inventory,
                deliveries,
                returns,
                users
            };
            saveObject('bb_business_data', businessDataStore);
        } else {
            saveList('bb_orders', orders);
            saveList('bb_inventory', inventory);
            saveList('bb_deliveries', deliveries);
            saveList('bb_returns', returns);
            saveList('bb_users', users);
        }

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
        const jsonOrders = await loadJsonArray('data/orders.json', defaultOrders);
        const jsonInventory = await loadJsonArray('data/inventory.json', defaultInventory);
        const jsonDeliveries = await loadJsonArray('data/deliveries.json', defaultDeliveries);
        const jsonReturns = await loadJsonArray('data/returns.json', defaultReturns);
        const jsonUsers = await loadJsonArray('data/users.json', defaultUsers);
        const jsonBusinessesRaw = await loadJsonArray('data/businesses.json', defaultBusinesses);
        const jsonBusinessData = await loadJsonObject('data/business_data.json', {});
        const jsonNotifications = await loadJsonArray('data/notifications.json', DEFAULT_NOTIFICATIONS);
        const jsonBusinesses = jsonBusinessesRaw.map((b, idx) => normalizeBusinessRecord(
            b,
            defaultBusinesses[idx] && defaultBusinesses[idx].id,
            defaultBusinesses[idx] && defaultBusinesses[idx].name
        ));

        const storedNotifications = loadList(NOTIFICATIONS_STORAGE_KEY, []);
        const hasStoredNotifications = Array.isArray(storedNotifications) && storedNotifications.length > 0;
        notificationsList = normalizeNotificationsList(hasStoredNotifications ? storedNotifications : jsonNotifications, DEFAULT_NOTIFICATIONS);
        persistNotifications();

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
                orders: Array.isArray(source.orders) ? cloneRows(source.orders) : seed.orders,
                inventory: Array.isArray(source.inventory) ? cloneRows(source.inventory) : seed.inventory,
                deliveries: Array.isArray(source.deliveries) ? mergeSeedRecords(source.deliveries, seed.deliveries, 'id') : seed.deliveries,
                returns: Array.isArray(source.returns) ? mergeSeedRecords(source.returns, seed.returns, 'id') : seed.returns,
                users: Array.isArray(source.users)
                    ? cloneRows(source.users)
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

        orders = useStoredOrders ? loadList('bb_orders', jsonOrders) : cloneRows(jsonOrders);
        inventory = useStoredInventory ? loadList('bb_inventory', jsonInventory) : cloneRows(jsonInventory);
        deliveries = useStoredDeliveries ? loadList('bb_deliveries', jsonDeliveries) : cloneRows(jsonDeliveries);
        returns = useStoredReturns ? loadList('bb_returns', jsonReturns) : cloneRows(jsonReturns);
        users = useStoredUsers ? loadList('bb_users', jsonUsers) : cloneRows(jsonUsers);

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

    let notificationsList = normalizeNotificationsList(loadList(NOTIFICATIONS_STORAGE_KEY, DEFAULT_NOTIFICATIONS), DEFAULT_NOTIFICATIONS);
    saveList(NOTIFICATIONS_STORAGE_KEY, notificationsList);

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

    // Helpers
    function badge(txt, type) { return `<span class="badge b-${type}">${txt}</span>`; }
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

    const DELIVERY_PARTNER_DIRECTORY = {
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
            const status = String(r.status || 'Pending').trim() || 'Pending';
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

    const SUPPLIER_DIRECTORY = {
        'Agarwal Traders': { contact: 'Sanjay Agarwal', phone: '+91 98115 44101', email: 'sanjay@agarwaltraders.in', leadTimeDays: 2, moq: 25, rating: 4.8 },
        'Sharma Wholesale': { contact: 'Neha Sharma', phone: '+91 98917 22055', email: 'orders@sharmawholesale.in', leadTimeDays: 3, moq: 30, rating: 4.6 },
        'Fortune Dist.': { contact: 'Ritesh Jain', phone: '+91 99004 11233', email: 'north@fortunedist.in', leadTimeDays: 4, moq: 20, rating: 4.5 },
        'City Dairy': { contact: 'Mehul Shah', phone: '+91 97170 55544', email: 'supply@citydairy.in', leadTimeDays: 1, moq: 40, rating: 4.7 },
        'Cool Bev': { contact: 'Ankita Roy', phone: '+91 98180 33021', email: 'ops@coolbev.in', leadTimeDays: 2, moq: 36, rating: 4.4 }
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
            superuser: renderBusinesses, businesses: renderBusinesses, profile: renderProfile, settings: renderSettings, notifications: renderNotifications
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
            if (item.status === 'Delivered') return '<span class="text-muted text-sm">Closed</span>';
            if (item.status === 'Failed') {
                return [
                    actionBtn('Retry', `window.retryDelivery('${item.id}')`, 'margin-right:4px;'),
                    actionBtn('Assign', `window.assignDeliveryPartner('${item.id}')`, '')
                ].join('');
            }
            return [
                actionBtn('Assign', `window.assignDeliveryPartner('${item.id}')`, 'margin-right:4px;'),
                actionBtn('Mark Delivered', `window.markDeliveryDelivered('${item.id}')`, 'margin-right:4px;'),
                actionBtn('Mark Failed', `window.markDeliveryFailed('${item.id}')`, 'color: var(--red); border-color: var(--red);')
            ].join('');
        };
        const externalFor = (item) => item.partnerPhoneHref
            ? `<a class="btn btn-outline" style="padding: 4px 8px; font-size: 0.75rem;" href="${item.partnerPhoneHref}">Call Partner</a>`
            : '<span class="text-muted text-sm">No contact</span>';

        const rows = activeRows
            .map(d => {
                const updated = d.updatedAt === '-' ? '&mdash;' : d.updatedAt;
                const eta = d.etaMin === null ? '&mdash;' : `${Math.max(0, Math.round(d.etaMin))} min`;
                return `<tr>
                    <td class="cell-main">${d.id}</td>
                    <td>${d.oid}</td>
                    <td>${d.customer}</td>
                    <td>${d.address}</td>
                    <td>${d.partner}<div class="text-sm text-muted">${d.partnerAgency} • ${d.partnerPhone}</div></td>
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
            else if (s.includes('approve')) acc.approved += 1;
            else if (s.includes('reject')) acc.rejected += 1;
            else acc.pending += 1;
            acc.valueRefunded += s.includes('refund') ? Number(r.amount || 0) : 0;
            return acc;
        }, { total: 0, pending: 0, approved: 0, refunded: 0, rejected: 0, valueRefunded: 0 });

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
                    <div class="text-sm text-muted" style="margin-top:6px;">Approved ${counts.approved} &bull; Rejected ${counts.rejected}</div>
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
        content.innerHTML = `
        <div class="page-header"><h2>Orders</h2><div class="page-header-actions"><button class="btn btn-primary" id="newOrderBtnDyn">+ New Order</button></div></div>
        <section class="card"><div class="card-bd">${table(
            ['ID', 'Customer', 'Items', 'Total', 'Payment', 'Status', 'Date', 'Actions'],
            orders.map(o => `<tr><td class="cell-main">${o.id}</td><td>${o.customer}</td><td>${o.items}</td><td>₹${o.total}</td><td>${badge(o.payment, o.payment.toLowerCase())}</td><td>${statusBadge(o.status)}</td><td>${o.date}</td><td><button class="btn btn-outline" style="padding: 4px 8px; font-size: 0.75rem; margin-right: 4px;" onclick="window.editOrder('${o.id}')">Edit</button><button class="btn btn-outline" style="padding: 4px 8px; font-size: 0.75rem; color: var(--red); border-color: var(--red);" onclick="window.deleteOrder('${o.id}')">Delete</button></td></tr>`).join('')
        )}</div></section>`;
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

        content.innerHTML = `
        <div class="page-header"><h2>Inventory</h2><div class="page-header-actions"><button class="btn btn-primary" id="addProductBtnDyn">+ Add Product</button></div></div>
        <section class="grid-2">
             <div class="card"><div class="card-hd"><h3>Category Distribution</h3></div><div class="card-bd" style="position:relative;height:220px"><canvas id="invCatChart"></canvas></div></div>
             <div class="card"><div class="card-hd"><h3>Stock Levels</h3></div><div class="card-bd" style="position:relative;height:220px"><canvas id="invStockChart"></canvas></div></div>
        </section>
        <section class="card"><div class="card-bd">${table(
            ['SKU', 'Product', 'Category', 'Supplier', 'Supplier Contact', 'Lead Time', 'Stock', 'Unit Price', 'Status', 'Actions'],
            inventory.map(i => {
                const details = getSupplierDetails(i);
                const status = normalizeInventoryStatus(i.status, i.stock);
                return `<tr>
                    <td class="cell-main">${i.sku}</td>
                    <td>${i.name}</td>
                    <td>${i.cat}</td>
                    <td>${details.name}</td>
                    <td>${details.contact}<div class="text-sm text-muted">${details.phone}</div></td>
                    <td>${details.leadTimeDays} days</td>
                    <td>${i.stock}</td>
                    <td>₹${i.price}</td>
                    <td>${statusBadge(status)}</td>
                    <td><button class="btn btn-outline" style="padding: 4px 8px; font-size: 0.75rem; margin-right: 4px;" onclick="window.editProduct('${i.sku}')">Edit</button><button class="btn btn-outline" style="padding: 4px 8px; font-size: 0.75rem; color: var(--red); border-color: var(--red);" onclick="window.deleteProduct('${i.sku}')">Delete</button></td>
                </tr>`;
            }).join('')
        )}</div></section>
        <section class="card"><div class="card-hd"><h3>Supplier Directory</h3></div><div class="card-bd">${table(
            ['Supplier', 'Contact Person', 'Phone', 'Email', 'Lead Time', 'MOQ', 'Rating'],
            supplierSummaryRows || '<tr><td colspan="7" class="text-muted">No supplier details available.</td></tr>'
        )}</div></section>`;
        setTimeout(initInventoryCharts, 0);
        // Wire up dynamic Add Product button
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
                <div class="chart-tabs" id="deliveryFilters">
                    <button class="chart-tab active" type="button" data-filter="active">Active</button>
                    <button class="chart-tab" type="button" data-filter="pending">Pending</button>
                    <button class="chart-tab" type="button" data-filter="intransit">In Transit</button>
                    <button class="chart-tab" type="button" data-filter="delivered">Delivered</button>
                    <button class="chart-tab" type="button" data-filter="failed">Failed</button>
                    <button class="chart-tab" type="button" data-filter="all">All</button>
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

            if (item.status === 'Delivered') return '<span class="text-muted text-sm">Closed</span>';
            if (item.status === 'Failed') {
                return [
                    btn('Retry', `window.retryDelivery('${item.id}')`, 'margin-right:4px;'),
                    btn('Assign', `window.assignDeliveryPartner('${item.id}')`, '')
                ].join('');
            }

            return [
                btn('Assign', `window.assignDeliveryPartner('${item.id}')`, 'margin-right:4px;'),
                btn('Mark Delivered', `window.markDeliveryDelivered('${item.id}')`, 'margin-right:4px;'),
                btn('Mark Failed', `window.markDeliveryFailed('${item.id}')`, 'color: var(--red); border-color: var(--red);')
            ].join('');
        }

        function externalActionsFor(item) {
            if (!item.partnerPhoneHref) return '<span class="text-muted text-sm">No contact</span>';
            return `<a class="btn btn-outline" style="padding: 4px 8px; font-size: 0.75rem;" href="${item.partnerPhoneHref}">Call Partner</a>`;
        }

        function renderTable(filter) {
            if (!tbody) return;
            const rows = view
                .filter(d => matchesFilter(d, filter))
                .map(d => {
                    const updated = d.updatedAt === '-' ? '&mdash;' : d.updatedAt;
                    const eta = d.etaMin === null ? '&mdash;' : `${Math.max(0, Math.round(d.etaMin))} min`;
                    return `<tr>
                        <td class="cell-main">${d.id}</td>
                        <td>${d.oid}</td>
                        <td>${d.customer}</td>
                        <td>${d.address}</td>
                        <td>${d.partner}<div class="text-sm text-muted">${d.partnerAgency} • ${d.partnerPhone}</div></td>
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
            returns.map(r => `<tr><td class="cell-main">${r.id}</td><td>${r.oid}</td><td>${r.reason}</td><td>₹${r.amount}</td><td>${statusBadge(r.status)}</td><td>${r.requestedBy || '-'}</td><td>${r.updatedAt || '-'}</td><td><button class="btn btn-outline" data-action="returns" style="padding: 4px 8px; font-size: 0.75rem; margin-right: 4px;" onclick="window.approveReturn('${r.id}')">Approve</button><button class="btn btn-outline" data-action="returns" style="padding: 4px 8px; font-size: 0.75rem; margin-right: 4px;" onclick="window.refundReturn('${r.id}')">Refund</button><button class="btn btn-outline" data-action="returns" style="padding: 4px 8px; font-size: 0.75rem; color: var(--red); border-color: var(--red);" onclick="window.rejectReturn('${r.id}')">Reject</button></td></tr>`).join('')
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
            else if (s.includes('approve')) acc.approved += 1;
            else if (s.includes('reject')) acc.rejected += 1;
            else acc.pending += 1;
            acc.valueTotal += Number(r.amount || 0);
            if (s.includes('refund')) acc.valueRefunded += Number(r.amount || 0);
            if (!s.includes('refund') && !s.includes('reject')) acc.valueAtRisk += Number(r.amount || 0);
            return acc;
        }, { total: 0, pending: 0, approved: 0, refunded: 0, rejected: 0, valueTotal: 0, valueRefunded: 0, valueAtRisk: 0 });

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
                    <span class="stat-value">${counts.pending + counts.approved}</span>
                    <div class="text-sm text-muted" style="margin-top:6px;">Pending ${counts.pending} &bull; Approved ${counts.approved}</div>
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
                <div class="chart-tabs" id="returnsFilters">
                    <button class="chart-tab active" type="button" data-filter="all">All</button>
                    <button class="chart-tab" type="button" data-filter="pending">Pending</button>
                    <button class="chart-tab" type="button" data-filter="approved">Approved</button>
                    <button class="chart-tab" type="button" data-filter="refunded">Refunded</button>
                    <button class="chart-tab" type="button" data-filter="rejected">Rejected</button>
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

        function matchesFilter(item, filter) {
            const s = String(item.status || '').toLowerCase();
            if (filter === 'all') return true;
            if (filter === 'pending') return !s.includes('approve') && !s.includes('refund') && !s.includes('reject');
            if (filter === 'approved') return s.includes('approve');
            if (filter === 'refunded') return s.includes('refund');
            if (filter === 'rejected') return s.includes('reject');
            return true;
        }

        function actionsFor(item) {
            const btn = (label, onClick, extraStyles) => `<button class="btn btn-outline" data-action="returns" style="padding: 4px 8px; font-size: 0.75rem; ${extraStyles || ''}" onclick="${onClick}">${label}</button>`;
            const s = String(item.status || '').toLowerCase();

            if (s.includes('refund') || s.includes('reject')) return '<span class="text-muted text-sm">Closed</span>';
            if (s.includes('approve')) {
                return [
                    btn('Refund', `window.refundReturn('${item.id}')`, 'margin-right:4px;'),
                    btn('Reject', `window.rejectReturn('${item.id}')`, 'color: var(--red); border-color: var(--red);')
                ].join('');
            }

            return [
                btn('Approve', `window.approveReturn('${item.id}')`, 'margin-right:4px;'),
                btn('Refund', `window.refundReturn('${item.id}')`, 'margin-right:4px;'),
                btn('Reject', `window.rejectReturn('${item.id}')`, 'color: var(--red); border-color: var(--red);')
            ].join('');
        }

        function renderTable(filter) {
            if (!tbody) return;
            const rows = view
                .filter(r => matchesFilter(r, filter))
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

        const raiseBtn = document.getElementById('raiseReturnBtnDyn');
        if (raiseBtn) raiseBtn.addEventListener('click', window.raiseReturnRequest);
    }

    function renderReports() {
        const roleLabel = ROLE_LABELS[activeRoleKey] || 'Team Member';
        const scopedName = selectedBusiness ? ` - ${selectedBusiness.name}` : (activeBusinessName ? ` - ${activeBusinessName}` : '');
        const totalRevenue = orders.reduce((sum, order) => sum + Math.max(0, Number(order && order.total) || 0), 0);
        const totalReturnsValue = returns.reduce((sum, item) => sum + Math.max(0, Number(item && item.amount) || 0), 0);
        const netRevenue = Math.max(0, totalRevenue - totalReturnsValue);
        const avgOrderValue = orders.length ? Math.round(totalRevenue / orders.length) : 0;
        const deliveredOrders = orders.filter(order => normalizeOrderStatus(order && order.status) === 'Delivered').length;
        const completionRate = orders.length ? Math.round((deliveredOrders / orders.length) * 100) : 0;

        const monthlyTotals = new Map();
        getOrderTimelineEntries().forEach(entry => {
            const monthLabel = entry.date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
            monthlyTotals.set(monthLabel, (monthlyTotals.get(monthLabel) || 0) + Math.max(0, Number(entry.total) || 0));
        });
        const monthlyRows = Array.from(monthlyTotals.entries())
            .slice(-6)
            .reverse()
            .map(([label, value], idx) => `<tr>
                <td class="cell-main">${label}</td>
                <td>₹${Math.round(value).toLocaleString()}</td>
                <td>${Math.max(0, orders.length - (idx * 2))}</td>
                <td>${Math.max(0, returns.length - idx)}</td>
            </tr>`)
            .join('');

        const supplierSpendRows = inventory
            .map(item => ({
                supplier: String(item.supplier || 'Unknown Supplier').trim(),
                value: Math.max(0, Number(item.price) || 0) * Math.max(0, Number(item.stock) || 0)
            }))
            .reduce((acc, row) => {
                acc.set(row.supplier, (acc.get(row.supplier) || 0) + row.value);
                return acc;
            }, new Map());

        const supplierRows = Array.from(supplierSpendRows.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([supplier, value], idx) => `<tr>
                <td class="cell-main">#${idx + 1}</td>
                <td>${supplier}</td>
                <td>₹${Math.round(value).toLocaleString()}</td>
            </tr>`)
            .join('');

        content.innerHTML = `
        <div class="page-header">
            <h2>Reports${scopedName}</h2>
            <div class="page-header-actions">
                <button class="btn btn-outline" onclick="window.print()">Print</button>
            </div>
        </div>
        <section class="stats-grid">
            <div class="stat-card">
                <div class="stat-icon si-green"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1v22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div>
                <div class="stat-info">
                    <span class="stat-label">Net Revenue</span>
                    <span class="stat-value">₹${netRevenue.toLocaleString()}</span>
                    <div class="text-sm text-muted" style="margin-top:6px;">Role view: ${roleLabel}</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon si-blue"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/></svg></div>
                <div class="stat-info">
                    <span class="stat-label">Orders Processed</span>
                    <span class="stat-value">${orders.length}</span>
                    <div class="text-sm text-muted" style="margin-top:6px;">Delivered: ${deliveredOrders}</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon si-amber"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>
                <div class="stat-info">
                    <span class="stat-label">Avg Order Value</span>
                    <span class="stat-value">₹${avgOrderValue.toLocaleString()}</span>
                    <div class="text-sm text-muted" style="margin-top:6px;">Completion rate: ${completionRate}%</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon si-red"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg></div>
                <div class="stat-info">
                    <span class="stat-label">Return Value</span>
                    <span class="stat-value">₹${totalReturnsValue.toLocaleString()}</span>
                </div>
            </div>
        </section>
        <section class="grid-2">
            <div class="card"><div class="card-hd"><h3>Revenue Trend</h3></div><div class="card-bd" style="position:relative;height:260px"><canvas id="repRevChart"></canvas></div></div>
            <div class="card"><div class="card-hd"><h3>Order Status Mix</h3></div><div class="card-bd" style="position:relative;height:260px"><canvas id="repStatusChart"></canvas></div></div>
        </section>
        <section class="grid-2">
            <div class="card"><div class="card-hd"><h3>Payment Method Mix</h3></div><div class="card-bd" style="position:relative;height:240px"><canvas id="repPaymentChart"></canvas></div></div>
            <div class="card"><div class="card-hd"><h3>Top Supplier Stock Value</h3></div><div class="card-bd">${table(
                ['Rank', 'Supplier', 'Stock Value'],
                supplierRows || '<tr><td colspan="3" class="text-muted">No supplier records available.</td></tr>'
            )}</div></div>
        </section>
        <section class="card"><div class="card-hd"><h3>Monthly Summary</h3></div><div class="card-bd">${table(
            ['Month', 'Revenue', 'Orders', 'Returns'],
            monthlyRows || '<tr><td colspan="4" class="text-muted">No report data available yet.</td></tr>'
        )}</div></section>`;
        setTimeout(initReportCharts, 0);
    }

    function renderUsers() {
        content.innerHTML = `
        <div class="page-header"><h2>Users</h2><div class="page-header-actions"><button class="btn btn-primary" id="addUserBtnDyn">+ Add User</button></div></div>
        <section class="card"><div class="card-bd">${table(['Name', 'Email', 'Role', 'Status', 'Actions'], users.map(u => `<tr><td class="cell-main">${u.name}</td><td>${u.email || ''}</td><td>${u.role}</td><td>${statusBadge(u.status)}</td><td><button class="btn btn-outline" style="padding: 4px 8px; font-size: 0.75rem; margin-right: 4px;" onclick="window.renderUserProfile('${u.name}')">View</button><button class="btn btn-outline" style="padding: 4px 8px; font-size: 0.75rem; margin-right: 4px;" onclick="window.editUser('${u.name}')">Edit</button><button class="btn btn-outline" style="padding: 4px 8px; font-size: 0.75rem; color: var(--red); border-color: var(--red);" onclick="window.deleteUser('${u.name}')">Delete</button></td></tr>`).join(''))}</div></section>`;
        const dynBtn = document.getElementById('addUserBtnDyn');
        if (dynBtn) dynBtn.addEventListener('click', openAddUserModal);
    }

    function renderBusinesses() {
        const paymentDueTotal = businesses.reduce((sum, b) => sum + Number(b.paymentDue || 0), 0);
        const activeCount = businesses.filter(b => b.status === 'Active').length;
        const trialCount = businesses.filter(b => b.status === 'Trial').length;

        content.innerHTML = `
        <div class="page-header"><h2>Businesses Using Your Products</h2><div class="page-header-actions"><button class="btn btn-primary" data-action="businesses" onclick="window.addBusiness()">+ Add Business</button></div></div>
        <section class="stats-grid">
            <div class="stat-card"><div class="stat-icon si-blue"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18"/><rect x="4" y="3" width="7" height="14" rx="1"/><rect x="13" y="7" width="7" height="10" rx="1"/></svg></div><div class="stat-info"><span class="stat-label">Total Businesses</span><span class="stat-value">${businesses.length}</span></div></div>
            <div class="stat-card"><div class="stat-icon si-green"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg></div><div class="stat-info"><span class="stat-label">Active Stores</span><span class="stat-value">${activeCount}</span></div></div>
            <div class="stat-card"><div class="stat-icon si-amber"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div><div class="stat-info"><span class="stat-label">Trial Stores</span><span class="stat-value">${trialCount}</span></div></div>
            <div class="stat-card"><div class="stat-icon si-red"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg></div><div class="stat-info"><span class="stat-label">Pending Payments</span><span class="stat-value">₹${paymentDueTotal.toLocaleString()}</span></div></div>
        </section>
        <section class="card"><div class="card-hd"><h3>All Client Businesses</h3></div><div class="card-bd">${table(
            ['Business ID', 'Business Name', 'Using BillBhai', 'Stores', 'Profit', 'Payment Due', 'Status', 'Actions'],
            businesses.map(b => `<tr><td class="cell-main">${b.id}</td><td><button class="btn btn-outline" data-action="businesses" style="padding: 2px 8px; font-size: 0.75rem;" onclick="window.openBusinessDetails('${b.id}')">${b.name}</button></td><td>${b.tenureMonths} months</td><td>${b.storesCount}</td><td>₹${Number(b.profit || 0).toLocaleString()}</td><td>₹${Number(b.paymentDue || 0).toLocaleString()}</td><td>${statusBadge(b.status)}</td><td><button class="btn btn-outline" data-action="businesses" style="padding: 4px 8px; font-size: 0.75rem; margin-right: 4px;" onclick="window.openBusinessAdminDashboard('${b.id}')">View</button><button class="btn btn-outline" data-action="businesses" style="padding: 4px 8px; font-size: 0.75rem; margin-right: 4px;" onclick="window.editBusiness('${b.id}')">Edit</button><button class="btn btn-outline" data-action="businesses" style="padding: 4px 8px; font-size: 0.75rem; color: var(--red); border-color: var(--red);" onclick="window.deleteBusiness('${b.id}')">Delete</button></td></tr>`).join('')
        )}</div></section>`;
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

    function renderUserProfile(username) {
        const user = users.find(u => u.name === username);
        if (!user) return;

        const initial = user.name.charAt(0).toUpperCase();
        const email = user.name.toLowerCase().replace(' ', '.') + '@billbhai.com';

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
                        <div style="margin-bottom: 20px;">${statusBadge(user.status)}</div>
                    </div>
                </div>
                <div class="card">
                    <div class="card-hd"><h3 style="color: var(--red);">Admin Actions</h3></div>
                    <div class="card-bd" style="display: flex; flex-direction: column; gap: 10px;">
                        <button class="btn btn-outline" style="justify-content: center;">Change User Role</button>
                        <button class="btn btn-outline" style="justify-content: center;">Send Password Reset Link</button>
                        <button class="btn" style="justify-content: center; background: rgba(220, 53, 69, 0.1); color: var(--red); border: 1px solid rgba(220, 53, 69, 0.3);">Suspend Account</button>
                        <button class="btn" style="justify-content: center; background: var(--red-bg); color: var(--red); border: 1px solid var(--red);">Delete User</button>
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
            notifications: {
                orders: saved.notifications && typeof saved.notifications === 'object' ? Boolean(saved.notifications.orders) : true,
                inventory: saved.notifications && typeof saved.notifications === 'object' ? Boolean(saved.notifications.inventory) : true,
                returns: saved.notifications && typeof saved.notifications === 'object' ? Boolean(saved.notifications.returns) : true,
                summary: saved.notifications && typeof saved.notifications === 'object' ? Boolean(saved.notifications.summary) : false
            }
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
                        <label class="text-sm" style="display:flex;justify-content:space-between;gap:12px;align-items:center;"><span>Order Alerts</span><input id="psNotifOrders" type="checkbox" ${profile.notifications.orders ? 'checked' : ''}></label>
                        <label class="text-sm" style="display:flex;justify-content:space-between;gap:12px;align-items:center;"><span>Inventory Alerts</span><input id="psNotifInventory" type="checkbox" ${profile.notifications.inventory ? 'checked' : ''}></label>
                        <label class="text-sm" style="display:flex;justify-content:space-between;gap:12px;align-items:center;"><span>Return Alerts</span><input id="psNotifReturns" type="checkbox" ${profile.notifications.returns ? 'checked' : ''}></label>
                        <label class="text-sm" style="display:flex;justify-content:space-between;gap:12px;align-items:center;"><span>Daily Summary</span><input id="psNotifSummary" type="checkbox" ${profile.notifications.summary ? 'checked' : ''}></label>
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
                notifications: {
                    orders: Boolean(document.getElementById('psNotifOrders').checked),
                    inventory: Boolean(document.getElementById('psNotifInventory').checked),
                    returns: Boolean(document.getElementById('psNotifReturns').checked),
                    summary: Boolean(document.getElementById('psNotifSummary').checked)
                }
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

    function renderNotifications(filter) {
        const activeFilter = String(filter || 'all').trim().toLowerCase() || 'all';
        const unreadCount = notificationsList.filter(item => item.unread).length;
        const readCount = Math.max(0, notificationsList.length - unreadCount);

        const filteredRows = notificationsList.filter(item => {
            if (activeFilter === 'unread') return item.unread;
            if (activeFilter === 'read') return !item.unread;
            return true;
        });

        content.innerHTML = `
        <div class="page-header"><h2>Notifications</h2><div class="page-header-actions"><button class="btn btn-outline" id="markAllReadBtn" ${unreadCount ? '' : 'disabled'}>Mark all as read</button></div></div>
        <section class="stats-grid" style="margin-bottom:12px;">
            <div class="stat-card"><div class="stat-info"><span class="stat-label">Total</span><span class="stat-value">${notificationsList.length}</span></div></div>
            <div class="stat-card"><div class="stat-info"><span class="stat-label">Unread</span><span class="stat-value">${unreadCount}</span></div></div>
            <div class="stat-card"><div class="stat-info"><span class="stat-label">Read</span><span class="stat-value">${readCount}</span></div></div>
            <div class="stat-card"><div class="stat-info"><span class="stat-label">Actionable</span><span class="stat-value">${notificationsList.filter(item => item.unread || item.type === 'alert').length}</span></div></div>
        </section>
        <section class="card notification-center" id="notificationCenter">
            <div class="card-hd" style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
                <h3>Inbox</h3>
                <div class="chart-tabs">
                    <button class="chart-tab notif-filter ${activeFilter === 'all' ? 'active' : ''}" data-filter="all">All</button>
                    <button class="chart-tab notif-filter ${activeFilter === 'unread' ? 'active' : ''}" data-filter="unread">Unread</button>
                    <button class="chart-tab notif-filter ${activeFilter === 'read' ? 'active' : ''}" data-filter="read">Read</button>
                </div>
            </div>
            <div class="card-bd" style="padding:0;">
                ${filteredRows.length ? filteredRows.map(item => `
                    <div class="notif-row ${item.unread ? 'unread' : ''}" data-notif-id="${item.id}" style="display:grid;grid-template-columns:auto 1fr auto;gap:12px;padding:14px 18px;border-bottom:1px solid var(--border);align-items:flex-start;">
                        <div style="background:var(--${item.color || 'blue'}-bg);color:var(--${item.color || 'blue'});padding:8px;border-radius:8px;">${getNotificationIcon(item)}</div>
                        <div>
                            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                                <strong>${item.title}</strong>
                                ${item.unread ? '<span class="badge b-processing">Unread</span>' : '<span class="badge b-active">Read</span>'}
                            </div>
                            <div class="text-sm text-muted" style="margin-top:4px;">${item.desc}</div>
                            <div class="text-sm text-muted" style="margin-top:6px;">${item.time}</div>
                        </div>
                        <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;">
                            <button class="btn btn-outline" style="padding:4px 8px;font-size:0.75rem;" data-notif-action="toggle-read">${item.unread ? 'Mark read' : 'Mark unread'}</button>
                            <button class="btn btn-outline" style="padding:4px 8px;font-size:0.75rem;" data-notif-action="open">View</button>
                        </div>
                    </div>
                `).join('') : '<div style="padding:28px;" class="text-muted">No notifications in this filter.</div>'}
            </div>
        </section>`;

        const markAllBtn = document.getElementById('markAllReadBtn');
        if (markAllBtn) {
            markAllBtn.addEventListener('click', () => {
                notificationsList = notificationsList.map(item => ({ ...item, unread: false }));
                persistNotifications();
                renderNotifications(activeFilter);
            });
        }

        content.querySelectorAll('.notif-filter').forEach(btn => {
            btn.addEventListener('click', () => {
                renderNotifications(String(btn.getAttribute('data-filter') || 'all'));
            });
        });

        const center = document.getElementById('notificationCenter');
        if (center) {
            center.addEventListener('click', (event) => {
                const actionBtn = event.target.closest('[data-notif-action]');
                if (!actionBtn) return;

                const row = actionBtn.closest('[data-notif-id]');
                const notifId = row ? String(row.getAttribute('data-notif-id') || '').trim() : '';
                if (!notifId) return;

                const notification = notificationsList.find(item => item.id === notifId);
                if (!notification) return;

                const action = String(actionBtn.getAttribute('data-notif-action') || '').trim();
                if (action === 'toggle-read') {
                    notification.unread = !notification.unread;
                    persistNotifications();
                    renderNotifications(activeFilter);
                    return;
                }

                if (action === 'open') {
                    renderNotificationDetail(notifId, activeFilter);
                }
            });
        }
    }

    function renderNotificationDetail(id, returnFilter) {
        const n = notificationsList.find(x => x.id === id);
        if (!n) return;

        if (n.unread) {
            n.unread = false;
            persistNotifications();
        }

        const filterToReturn = String(returnFilter || 'all').trim().toLowerCase() || 'all';
        const changes = Array.isArray(n.changes) ? n.changes : [];
        const diffHtml = changes.length
            ? changes.map(c => `
                <div style="margin-bottom:14px;">
                    <div class="text-sm text-muted" style="margin-bottom:6px;">${c.file}</div>
                    <div class="diff-view">
                        <div class="diff-line removed">- ${c.old}</div>
                        <div class="diff-line added">+ ${c.new}</div>
                    </div>
                </div>
            `).join('')
            : '<div class="text-muted">No structured diff is attached to this notification.</div>';

        content.innerHTML = `
        <div class="page-header" style="justify-content:flex-start;gap:10px;">
            <button class="btn btn-outline" id="notifBackBtn" style="padding:8px;">Back</button>
            <h2>Notification Details</h2>
            <div class="page-header-actions" style="margin-left:auto;"><button class="btn btn-outline" id="notifToggleBtn">${n.unread ? 'Mark read' : 'Mark unread'}</button></div>
        </div>
        <div class="card" style="margin-bottom:14px;"><div class="card-bd" style="display:flex;gap:12px;align-items:flex-start;"><div style="background:var(--${n.color}-bg);color:var(--${n.color});padding:10px;border-radius:8px;">${getNotificationIcon(n)}</div><div><h3 style="margin-bottom:4px;">${n.title}</h3><div class="text-sm text-muted" style="margin-bottom:8px;">${n.time}</div><p>${n.desc}</p></div></div></div>
        <div class="card"><div class="card-hd"><h3>System Changes</h3></div><div class="card-bd">${diffHtml}</div></div>`;

        const backBtn = document.getElementById('notifBackBtn');
        if (backBtn) backBtn.addEventListener('click', () => renderNotifications(filterToReturn));

        const toggleBtn = document.getElementById('notifToggleBtn');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                n.unread = !n.unread;
                persistNotifications();
                renderNotificationDetail(id, filterToReturn);
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
        const statusCounts = { pending: 0, approved: 0, refunded: 0, rejected: 0 };

        view.forEach(r => {
            const reason = String(r.reason || '').trim() || 'Unknown';
            reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1);

            const product = String(r.product || '').trim();
            if (product && product !== '-') productCounts.set(product, (productCounts.get(product) || 0) + 1);

            const s = String(r.status || '').toLowerCase();
            if (s.includes('refund')) statusCounts.refunded += 1;
            else if (s.includes('approve')) statusCounts.approved += 1;
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
            labels: ['Pending', 'Approved', 'Refunded', 'Rejected'],
            datasets: [{
                data: [statusCounts.pending, statusCounts.approved, statusCounts.refunded, statusCounts.rejected],
                backgroundColor: [c.amber, c.purple, c.green, c.red],
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
        const trend = buildRevenueTrendWeeks(8);
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

        const statusCounts = {
            delivered: orders.filter(order => normalizeOrderStatus(order && order.status) === 'Delivered').length,
            processing: orders.filter(order => normalizeOrderStatus(order && order.status) === 'Processing').length,
            pending: orders.filter(order => normalizeOrderStatus(order && order.status) === 'Pending').length,
            cancelled: orders.filter(order => normalizeOrderStatus(order && order.status) === 'Cancelled').length
        };
        createChart('repStatusChart', 'doughnut', {
            labels: ['Delivered', 'Processing', 'Pending', 'Cancelled'],
            datasets: [{
                data: [statusCounts.delivered, statusCounts.processing, statusCounts.pending, statusCounts.cancelled],
                backgroundColor: [c.green, c.blue, c.amber, c.red]
            }]
        });

        const paymentBuckets = new Map();
        orders.forEach(order => {
            const paymentLabel = String(order && order.payment || 'Unknown').trim() || 'Unknown';
            paymentBuckets.set(paymentLabel, (paymentBuckets.get(paymentLabel) || 0) + 1);
        });
        const paymentLabels = Array.from(paymentBuckets.keys());
        const paymentValues = Array.from(paymentBuckets.values());
        createChart('repPaymentChart', 'bar', {
            labels: paymentLabels.length ? paymentLabels : ['No Data'],
            datasets: [{
                label: 'Orders',
                data: paymentValues.length ? paymentValues : [0],
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
            onSubmit(values, closeModal);
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
        overlay.querySelector('[data-action="confirm"]').addEventListener('click', () => {
            onConfirm();
            closeModal();
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

    function handleAddProduct(e) {
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
        const pData = {
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

    function handleNewOrder(e) {
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
        
        const oData = {
            id: oid,
            customer: document.getElementById('orderCustomer').value.trim(),
            items: parseInt(document.getElementById('orderItems').value, 10),
            total: parseFloat(document.getElementById('orderTotal').value),
            payment: document.getElementById('orderPayment').value,
            status: document.getElementById('orderStatus').value,
            date: existingIdx !== -1 ? orders[existingIdx].date : formatDate()
        };

        if (existingIdx !== -1) {
            orders[existingIdx] = oData;
        } else {
            orders.unshift(oData);
        }
        persistOperationalData();

        const payClass = 'b-' + oData.payment.toLowerCase();
        const statusClass = oData.status === 'Delivered' ? 'b-delivered' : oData.status === 'Processing' ? 'b-processing' : oData.status === 'Pending' ? 'b-pending' : 'b-cancelled';
        const trHtml = `<td class="cell-main">${oData.id}</td><td>${oData.customer}</td><td>${oData.items}</td><td>₹${oData.total.toLocaleString()}</td><td><span class="badge ${payClass}">${oData.payment}</span></td><td><span class="badge ${statusClass}">${oData.status}</span></td><td>${oData.date}</td><td><button class="btn btn-outline" style="padding: 4px 8px; font-size: 0.75rem; margin-right: 4px;" onclick="window.editOrder('${oData.id}')">Edit</button><button class="btn btn-outline" style="padding: 4px 8px; font-size: 0.75rem; color: var(--red); border-color: var(--red);" onclick="window.deleteOrder('${oData.id}')">Delete</button></td>`;

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
        const form = document.getElementById('addUserForm');
        if (form) {
            form.querySelectorAll('.form-group').forEach(g => g.classList.remove('has-error'));
            form.querySelectorAll('.form-control').forEach(c => c.classList.remove('error'));
            document.getElementById('userName').value = '';
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

    function handleAddUser(e) {
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
        
        const uData = {
            name: uname,
            role: document.getElementById('userRole').value,
            status: document.getElementById('userStatus').value,
            email: document.getElementById('userEmail').value.trim()
        };

        if (existingIdx !== -1) {
            users[existingIdx] = uData;
        } else {
            users.push(uData);
        }
        persistOperationalData();

        const statusClass = uData.status === 'Active' ? 'b-active' : uData.status === 'Offline' ? 'b-offline' : 'b-cancelled';
        const trHtml = `<td class="cell-main">${uData.name}</td><td>${uData.email}</td><td>${uData.role}</td><td>Just now</td><td><span class="badge ${statusClass}">${uData.status}</span></td><td><button class="btn btn-outline" style="padding: 4px 8px; font-size: 0.75rem; margin-right: 4px;" onclick="window.renderUserProfile('${uData.name}')">View</button><button class="btn btn-outline" style="padding: 4px 8px; font-size: 0.75rem; margin-right: 4px;" onclick="window.editUser('${uData.name}')">Edit</button><button class="btn btn-outline" style="padding: 4px 8px; font-size: 0.75rem; color: var(--red); border-color: var(--red);" onclick="window.deleteUser('${uData.name}')">Delete</button></td>`;

        let existingRow = null;
        document.querySelectorAll('tr').forEach(r => { if(r.children[0] && r.children[0].textContent === uname) existingRow = r; });
        
        if (existingRow) {
            existingRow.innerHTML = trHtml;
        } else {
            const tbody = document.getElementById('usersTableBody') || (document.querySelector('table.dt tbody'));
            if (tbody) {
                const tr = document.createElement('tr');
                tr.innerHTML = trHtml;
                tbody.appendChild(tr);
            }
        }

        closeAddUserModal();
        showToast(`User "${uData.name}" saved successfully!`);
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
            onConfirm: () => {
                const index = inventory.findIndex(i => i.sku === sku);
                if (index !== -1) inventory.splice(index, 1);
                persistOperationalData();
                if (currentPage === 'inventory') {
                    renderPage('inventory');
                }
                showToast(`Product "${sku}" deleted!`);
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
        if (!hasActionAccess('orders')) {
            denyAction('Order delete');
            return;
        }
        openQuickConfirmModal({
            title: 'Delete Order',
            message: `Delete Order ${id}?`,
            confirmLabel: 'Delete',
            onConfirm: () => {
                const index = orders.findIndex(i => i.id === id);
                if (index !== -1) orders.splice(index, 1);
                persistOperationalData();
                document.querySelectorAll('tr').forEach(r => { if(r.children[0] && r.children[0].textContent === id) r.remove(); });
                showToast(`Order "${id}" deleted!`);
            }
        });
    };

    window.editUser = function(name) {
        if (!hasActionAccess('users')) {
            denyAction('User update');
            return;
        }
        const u = users.find(i => i.name === name);
        if (!u) return;
        openAddUserModal();
        document.querySelector('#addUserModal h3').textContent = 'Edit User';
        document.getElementById('userName').value = u.name;
        document.getElementById('userName').readOnly = true; // Name acts as ID, so don't change
        document.getElementById('userEmail').value = u.email || '';
        document.getElementById('userRole').value = u.role;
        document.getElementById('userStatus').value = u.status;
    };
    window.deleteUser = function(name) {
        if (!hasActionAccess('users')) {
            denyAction('User delete');
            return;
        }
        openQuickConfirmModal({
            title: 'Delete User',
            message: `Delete User ${name}?`,
            confirmLabel: 'Delete',
            onConfirm: () => {
                const index = users.findIndex(i => i.name === name);
                if (index !== -1) users.splice(index, 1);
                persistOperationalData();
                document.querySelectorAll('tr').forEach(r => { if(r.children[0] && r.children[0].textContent === name) r.remove(); });
                showToast(`User "${name}" deleted!`);
            }
        });
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
            onSubmit: (values, closeModal) => {
                const productName = String(values.product || '').trim();
                const invItem = inventory.find(i => String((i && i.name) || '').trim() === productName);
                returns.unshift({
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
                });
                persistOperationalData();
                renderPage('returns');
                closeModal();
                showToast('Return request raised successfully.');
            }
        });
    };

    window.approveReturn = function(id) {
        if (!hasActionAccess('returns')) {
            denyAction('Return approve');
            return;
        }
        const item = returns.find(r => r.id === id);
        if (!item) return;
        item.status = 'Approved';
        item.updatedAt = formatDate();
        persistOperationalData();
        renderPage('returns');
        showToast(`Return ${id} approved.`);
    };

    window.refundReturn = function(id) {
        if (!hasActionAccess('returns')) {
            denyAction('Return refund');
            return;
        }
        const item = returns.find(r => r.id === id);
        if (!item) return;
        item.status = 'Refunded';
        item.updatedAt = formatDate();
        persistOperationalData();
        renderPage('returns');
        showToast(`Return ${id} refunded.`);
    };

    window.rejectReturn = function(id) {
        if (!hasActionAccess('returns')) {
            denyAction('Return reject');
            return;
        }
        const item = returns.find(r => r.id === id);
        if (!item) return;
        item.status = 'Rejected';
        item.updatedAt = formatDate();
        persistOperationalData();
        renderPage('returns');
        showToast(`Return ${id} rejected.`);
    };

    window.assignDeliveryPartner = function(id) {
        if (!hasActionAccess('delivery')) {
            denyAction('Delivery assignment');
            return;
        }
        const item = deliveries.find(d => d.id === id);
        if (!item) return;
        openQuickFormModal({
            title: `Assign Partner - ${id}`,
            submitLabel: 'Assign',
            fields: [
                { name: 'partner', label: 'Delivery Partner', type: 'text', required: true },
                { name: 'partnerPhone', label: 'Partner Phone', type: 'text', required: false, placeholder: '+91 98xxxxxx' },
                { name: 'partnerAgency', label: 'Agency / Team', type: 'text', required: false, placeholder: 'External delivery partner' },
                { name: 'partnerVehicle', label: 'Vehicle', type: 'text', required: false, placeholder: 'Bike' }
            ],
            initialValues: {
                partner: item.partner || '',
                partnerPhone: item.partnerPhone || '',
                partnerAgency: item.partnerAgency || '',
                partnerVehicle: item.partnerVehicle || ''
            },
            onSubmit: (values, closeModal) => {
                item.partner = String(values.partner).trim();
                item.partnerPhone = String(values.partnerPhone || '').trim();
                item.partnerAgency = String(values.partnerAgency || '').trim();
                item.partnerVehicle = String(values.partnerVehicle || '').trim();
                if (normalizeDeliveryStatus(item.status) !== 'Delivered') item.status = 'In Transit';
                item.updatedAt = formatDate();
                item.time = item.updatedAt.split(' ').slice(-1)[0];
                persistOperationalData();
                renderPage(currentPage);
                closeModal();
                showToast(`Partner assigned for ${id}.`);
            }
        });
    };

    window.markDeliveryDelivered = function(id) {
        if (!hasActionAccess('delivery')) {
            denyAction('Delivery close');
            return;
        }
        const item = deliveries.find(d => d.id === id);
        if (!item) return;
        item.status = 'Delivered';
        item.updatedAt = formatDate();
        item.time = item.updatedAt.split(' ').slice(-1)[0];
        item.etaMin = 0;
        persistOperationalData();
        renderPage(currentPage);
        showToast(`${id} marked delivered.`);
    };

    window.markDeliveryFailed = function(id) {
        if (!hasActionAccess('delivery')) {
            denyAction('Delivery failure');
            return;
        }
        const item = deliveries.find(d => d.id === id);
        if (!item) return;
        if (normalizeDeliveryStatus(item.status) === 'Delivered') return;
        item.status = 'Failed';
        item.updatedAt = formatDate();
        item.time = item.updatedAt.split(' ').slice(-1)[0];
        item.etaMin = 0;
        persistOperationalData();
        renderPage(currentPage);
        showToast(`${id} marked failed.`);
    };

    window.retryDelivery = function(id) {
        if (!hasActionAccess('delivery')) {
            denyAction('Delivery retry');
            return;
        }
        const item = deliveries.find(d => d.id === id);
        if (!item) return;
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
            onSubmit: (values, closeModal) => {
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
            onSubmit: (values, closeModal) => {
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
            onConfirm: () => {
                const index = businesses.findIndex(b => b.id === id);
                if (index !== -1) businesses.splice(index, 1);
                saveList('bb_businesses', businesses);
                renderPage('superuser');
                showToast(`Business "${existing.name}" deleted.`);
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

    (async function startApp() {
        try {
            await hydrateDataFromJsonFiles();
            initRealtimeSync();
            renderPage(currentPage);
        } finally {
            // Reveal UI only after initial data + page render to avoid a brief "wrong dashboard" flash.
            setAppReady(true);
        }
    })();
});

