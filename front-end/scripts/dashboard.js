document.addEventListener('DOMContentLoaded', () => {
    // Logo is always dark mode
    const sidebarLogo = document.querySelector('.sidebar-brand-img');
    if (sidebarLogo) sidebarLogo.src = '../public/logo.png';

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
        superuser: ['superuser', 'businesses', 'dashboard', 'orders', 'inventory', 'delivery', 'returns', 'reports', 'users', 'settings', 'profile', 'notifications'],
        admin: ['dashboard', 'orders', 'inventory', 'profile', 'notifications'],
        cashier: ['dashboard', 'orders', 'profile', 'notifications'],
        returnhandler: ['dashboard', 'returns', 'orders', 'profile', 'notifications'],
        inventorymanager: ['dashboard', 'inventory', 'reports', 'profile', 'notifications'],
        deliveryops: ['dashboard', 'delivery', 'orders', 'profile', 'notifications'],
        customer: ['profile', 'notifications']
    };

    const ROLE_ACTIONS = {
        superuser: { orders: true, inventory: true, users: true, returns: true, delivery: true, businesses: true },
        admin: { orders: true, inventory: true, users: false, returns: false, delivery: false, businesses: false },
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
            item.style.display = allowedPages.includes(page) ? '' : 'none';
            item.classList.toggle('active', page === currentPage);
        });

        const bcPageEl = document.getElementById('bcPage');
        if (bcPageEl) {
            const activeItem = document.querySelector(`.nav-item[data-page="${currentPage}"] span`);
            if (activeItem) bcPageEl.textContent = activeItem.textContent;
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
    applyRoleBasedUI();

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

    navItems.forEach(item => {
        // Highlight active item based on current page
        if (item.dataset.page === currentPage) {
            item.classList.add('active');
            const span = item.querySelector('span');
            if (span && bcPage) bcPage.textContent = span.textContent;
        } else {
            item.classList.remove('active');
        }

        item.addEventListener('click', () => {
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
        { id: 'DEL-901', oid: 'ORD-4821', partner: 'Rajesh K.', status: 'Delivered', time: '14:10' },
        { id: 'DEL-900', oid: 'ORD-4820', partner: 'Sunil M.', status: 'Out for Delivery', time: '-' }
    ];

    const defaultReturns = [
        { id: 'RET-201', oid: 'ORD-4810', reason: 'Damaged', amount: 420, status: 'Approved', requestedBy: 'Walk-in', updatedAt: '17 Feb 11:10' },
        { id: 'RET-200', oid: 'ORD-4805', reason: 'Wrong Item', amount: 155, status: 'Refunded', requestedBy: 'Walk-in', updatedAt: '16 Feb 15:30' }
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

    const activeBusinessId = String(localStorage.getItem('activeBusinessId') || '').trim();
    const activeBusinessName = String(localStorage.getItem('activeBusinessName') || '').trim();

    function cloneRows(rows) {
        return JSON.parse(JSON.stringify(rows));
    }

    function buildBusinessSeedData(business, idx) {
        const userList = Array.isArray(business.users) ? business.users : [];
        const adminName = userList.find(u => String(u.role || '').toLowerCase() === 'admin')?.name || business.adminName || 'Store Admin';
        const cashierName = userList.find(u => String(u.role || '').toLowerCase().includes('cashier'))?.name || 'POS Counter';
        const city = Array.isArray(business.stores) && business.stores[0] ? business.stores[0].city : 'Primary City';
        const seedNum = 500 + idx * 50;

        return {
            orders: [
                { id: `ORD-${seedNum + 1}`, customer: `${city} Walk-in`, items: 3, total: 1540 + idx * 120, payment: 'UPI', status: 'Delivered', date: '17 Feb 11:10' },
                { id: `ORD-${seedNum + 2}`, customer: 'Anita Verma', items: 2, total: 980 + idx * 90, payment: 'Card', status: 'Processing', date: '17 Feb 12:35' },
                { id: `ORD-${seedNum + 3}`, customer: 'Vikram Singh', items: 1, total: 350 + idx * 70, payment: 'Cash', status: 'Pending', date: '17 Feb 13:20' },
                { id: `ORD-${seedNum + 4}`, customer: 'Suman Rao', items: 4, total: 2250 + idx * 100, payment: 'UPI', status: 'Delivered', date: '16 Feb 18:04' },
                { id: `ORD-${seedNum + 5}`, customer: 'Karan Joshi', items: 2, total: 1160 + idx * 85, payment: 'Card', status: 'Delivered', date: '16 Feb 16:40' }
            ],
            inventory: [
                { sku: `SKU-${seedNum + 1}`, name: 'Basmati Rice', cat: 'Grocery', supplier: 'Agarwal Traders', stock: 160 - idx * 3, price: 390 + idx * 5, status: 'In Stock' },
                { sku: `SKU-${seedNum + 2}`, name: 'Toor Dal', cat: 'Grocery', supplier: 'Sharma Wholesale', stock: 92 - idx * 4, price: 130 + idx * 4, status: 'In Stock' },
                { sku: `SKU-${seedNum + 3}`, name: 'Refined Oil', cat: 'Grocery', supplier: 'Fortune Dist.', stock: 24 - idx * 2, price: 170 + idx * 3, status: 'Low Stock' },
                { sku: `SKU-${seedNum + 4}`, name: 'Milk Pack', cat: 'Dairy', supplier: 'City Dairy', stock: 12 + idx, price: 58, status: 'Low Stock' },
                { sku: `SKU-${seedNum + 5}`, name: 'Soft Drink', cat: 'Beverages', supplier: 'Cool Bev', stock: 84 + idx * 3, price: 42, status: 'In Stock' }
            ],
            deliveries: [
                { id: `DEL-${seedNum + 1}`, oid: `ORD-${seedNum + 1}`, partner: 'Rider Team A', status: 'Delivered', time: '11:55' },
                { id: `DEL-${seedNum + 2}`, oid: `ORD-${seedNum + 2}`, partner: 'Rider Team B', status: 'Out for Delivery', time: '-' },
                { id: `DEL-${seedNum + 3}`, oid: `ORD-${seedNum + 4}`, partner: 'Rider Team C', status: 'Delivered', time: '18:45' }
            ],
            returns: [
                { id: `RET-${seedNum + 1}`, oid: `ORD-${seedNum + 5}`, reason: 'Damaged', amount: 220 + idx * 10, status: 'Approved', requestedBy: cashierName, updatedAt: '16 Feb 17:40' },
                { id: `RET-${seedNum + 2}`, oid: `ORD-${seedNum + 3}`, reason: 'Wrong Item', amount: 180 + idx * 8, status: 'Pending', requestedBy: cashierName, updatedAt: '17 Feb 13:50' }
            ],
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
            deliveries: Array.isArray(existing.deliveries) ? existing.deliveries : seed.deliveries,
            returns: Array.isArray(existing.returns) ? existing.returns : seed.returns,
            users: Array.isArray(existing.users) ? existing.users : seed.users
        };
    });
    saveObject('bb_business_data', businessDataStore);

    const selectedBusiness = activeBusinessId ? businesses.find(b => b.id === activeBusinessId) : null;
    const isBusinessScoped = !!selectedBusiness;
    const businessScopedData = isBusinessScoped ? businessDataStore[selectedBusiness.id] : null;

    if (activeBusinessId && !selectedBusiness) {
        localStorage.removeItem('activeBusinessId');
        localStorage.removeItem('activeBusinessName');
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

    function persistOperationalData() {
        if (isBusinessScoped && selectedBusiness) {
            businessDataStore[selectedBusiness.id] = {
                orders,
                inventory,
                deliveries,
                returns,
                users
            };
            saveObject('bb_business_data', businessDataStore);
            return;
        }

        saveList('bb_orders', orders);
        saveList('bb_inventory', inventory);
        saveList('bb_deliveries', deliveries);
        saveList('bb_returns', returns);
        saveList('bb_users', users);
    }

    async function hydrateDataFromJsonFiles() {
        const jsonOrders = await loadJsonArray('../data/orders.json', defaultOrders);
        const jsonInventory = await loadJsonArray('../data/inventory.json', defaultInventory);
        const jsonDeliveries = await loadJsonArray('../data/deliveries.json', defaultDeliveries);
        const jsonReturns = await loadJsonArray('../data/returns.json', defaultReturns);
        const jsonUsers = await loadJsonArray('../data/users.json', defaultUsers);
        const jsonBusinessesRaw = await loadJsonArray('../data/businesses.json', defaultBusinesses);
        const jsonBusinessData = await loadJsonObject('../data/business_data.json', {});
        const jsonBusinesses = jsonBusinessesRaw.map((b, idx) => normalizeBusinessRecord(b, defaultBusinesses[idx] && defaultBusinesses[idx].id, defaultBusinesses[idx] && defaultBusinesses[idx].name));

        const hasOrders = localStorage.getItem('bb_orders') !== null;
        const hasInventory = localStorage.getItem('bb_inventory') !== null;
        const hasDeliveries = localStorage.getItem('bb_deliveries') !== null;
        const hasReturns = localStorage.getItem('bb_returns') !== null;
        const hasUsers = localStorage.getItem('bb_users') !== null;
        const hasBusinesses = localStorage.getItem('bb_businesses') !== null;
        const hasBusinessData = localStorage.getItem('bb_business_data') !== null;

        if (!isBusinessScoped) {
            if (!hasOrders) orders = jsonOrders;
            if (!hasInventory) inventory = jsonInventory;
            if (!hasDeliveries) deliveries = jsonDeliveries;
            if (!hasReturns) returns = jsonReturns;
            if (!hasUsers) users = jsonUsers;
            persistOperationalData();
        }

        if (!hasBusinesses) {
            businesses.splice(0, businesses.length, ...jsonBusinesses);
            saveList('bb_businesses', businesses);
        }

        Object.keys(jsonBusinessData).forEach((bizId) => {
            if (!jsonBusinessData[bizId] || typeof jsonBusinessData[bizId] !== 'object') return;
            if (!hasBusinessData || !businessDataStore[bizId]) {
                businessDataStore[bizId] = jsonBusinessData[bizId];
            }
        });
        if (!hasBusinessData) {
            saveObject('bb_business_data', businessDataStore);
        }

        if (isBusinessScoped && selectedBusiness && businessDataStore[selectedBusiness.id]) {
            const scoped = businessDataStore[selectedBusiness.id];
            orders = Array.isArray(scoped.orders) ? scoped.orders : orders;
            inventory = Array.isArray(scoped.inventory) ? scoped.inventory : inventory;
            deliveries = Array.isArray(scoped.deliveries) ? scoped.deliveries : deliveries;
            returns = Array.isArray(scoped.returns) ? scoped.returns : returns;
            users = Array.isArray(scoped.users) ? scoped.users : users;
        }
    }

    const notificationsList = [
        {
            id: 'NOTIF-001',
            title: 'New Order #4821 Received',
            type: 'order',
            time: '2 mins ago',
            desc: 'Order contains 3 items. Total: ₹1250 (Paid via UPI).',
            icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/></svg>',
            color: 'blue',
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
            changes: [
                { file: 'inventory/SKU-05/quantity', old: '15', new: '5' },
                { file: 'inventory/SKU-05/status', old: 'In Stock', new: 'Low Stock' }
            ]
        }
    ];

    // Helpers
    function badge(txt, type) { return `<span class="badge b-${type}">${txt}</span>`; }
    function statusBadge(s) { return badge(s, s.toLowerCase().replace(/ /g, '')); }
    function table(hdrs, rows) { return `<div class="tbl-wrap"><table class="dt"><thead><tr>${hdrs.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>`; }

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
        const totalSales = orders.reduce((a, o) => a + o.total, 0);
        const scopedName = selectedBusiness ? selectedBusiness.name : activeBusinessName;
        content.innerHTML = `
        <div class="page-header"><h2>Dashboard${scopedName ? ` - ${scopedName}` : ''}</h2><div class="page-header-actions"><button class="btn btn-outline" onclick="window.print()">Print</button></div></div>
        <section class="stats-grid">
            <div class="stat-card"><div class="stat-icon si-green"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div><div class="stat-info"><span class="stat-label">Revenue</span><span class="stat-value">₹${totalSales.toLocaleString()}</span></div></div>
            <div class="stat-card"><div class="stat-icon si-blue"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/></svg></div><div class="stat-info"><span class="stat-label">Orders</span><span class="stat-value">${orders.length}</span></div></div>
            <div class="stat-card"><div class="stat-icon si-red"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg></div><div class="stat-info"><span class="stat-label">Returns</span><span class="stat-value">${returns.length}</span></div></div>
            <div class="stat-card"><div class="stat-icon si-amber"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg></div><div class="stat-info"><span class="stat-label">Alerts</span><span class="stat-value">${inventory.filter(i => i.status !== 'In Stock').length}</span></div></div>
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
        content.innerHTML = `
        <div class="page-header"><h2>Inventory</h2><div class="page-header-actions"><button class="btn btn-primary" id="addProductBtnDyn">+ Add Product</button></div></div>
        <section class="grid-2">
             <div class="card"><div class="card-hd"><h3>Category Distribution</h3></div><div class="card-bd" style="position:relative;height:220px"><canvas id="invCatChart"></canvas></div></div>
             <div class="card"><div class="card-hd"><h3>Stock Levels</h3></div><div class="card-bd" style="position:relative;height:220px"><canvas id="invStockChart"></canvas></div></div>
        </section>
        <section class="card"><div class="card-bd">${table(
            ['SKU', 'Product', 'Category', 'Supplier', 'Stock', 'Unit Price', 'Status', 'Actions'],
            inventory.map(i => `<tr><td class="cell-main">${i.sku}</td><td>${i.name}</td><td>${i.cat}</td><td>${i.supplier || '-'}</td><td>${i.stock}</td><td>₹${i.price}</td><td>${statusBadge(i.status)}</td><td><button class="btn btn-outline" style="padding: 4px 8px; font-size: 0.75rem; margin-right: 4px;" onclick="window.editProduct('${i.sku}')">Edit</button><button class="btn btn-outline" style="padding: 4px 8px; font-size: 0.75rem; color: var(--red); border-color: var(--red);" onclick="window.deleteProduct('${i.sku}')">Delete</button></td></tr>`).join('')
        )}</div></section>`;
        setTimeout(initInventoryCharts, 0);
        // Wire up dynamic Add Product button
        const dynBtn = document.getElementById('addProductBtnDyn');
        if (dynBtn) dynBtn.addEventListener('click', openAddProductModal);
    }

    function renderDelivery() {
        content.innerHTML = `
        <div class="page-header"><h2>Delivery</h2></div>
        <section class="card"><div class="card-bd">${table(
            ['ID', 'Order', 'Partner', 'Status', 'Time', 'Actions'],
            deliveries.map(d => {
                const canMarkDelivered = d.status !== 'Delivered';
                return `<tr><td class="cell-main">${d.id}</td><td>${d.oid}</td><td>${d.partner}</td><td>${statusBadge(d.status)}</td><td>${d.time}</td><td><button class="btn btn-outline" data-action="delivery" style="padding: 4px 8px; font-size: 0.75rem; margin-right: 4px;" onclick="window.assignDeliveryPartner('${d.id}')">Assign</button>${canMarkDelivered ? `<button class="btn btn-outline" data-action="delivery" style="padding: 4px 8px; font-size: 0.75rem;" onclick="window.markDeliveryDelivered('${d.id}')">Mark Delivered</button>` : '<span class="text-muted text-sm">Closed</span>'}</td></tr>`;
            }).join('')
        )}</div></section>`;
    }

    function renderReturns() {
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

    function renderReports() {
        content.innerHTML = `
        <div class="page-header"><h2>Reports</h2></div>
        <section class="card"><div class="card-hd"><h3>Monthly Revenue (Projected)</h3></div><div class="card-bd" style="position:relative;height:300px"><canvas id="repRevChart"></canvas></div></section>`;
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
        <div class="page-header"><h2>Businesses Using Your Products</h2><div class="page-header-actions"><button class="btn btn-primary" data-action="businesses" onclick="window.addBusiness()">+ Add Business</button><button class="btn btn-outline" onclick="window.location.href='reports.html'">View Revenue Reports</button></div></div>
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

    function renderProfile() {
        content.innerHTML = `
        <div class="page-header"><h2>My Profile</h2></div>
        <section class="grid-2">
            <div style="display: flex; flex-direction: column; gap: 20px;">
                <div class="card">
                    <div class="card-bd" style="text-align: center; padding-top: 30px;">
                        <div style="width: 80px; height: 80px; border-radius: 50%; background: linear-gradient(135deg, var(--accent), var(--amber)); margin: 0 auto 16px; display: flex; align-items: center; justify-content: center; font-size: 2rem; color: #fff; font-weight: 700;">A</div>
                        <h3 style="font-size: 1.2rem; margin-bottom: 4px;">Admin Demo</h3>
                        <p class="text-muted" style="margin-bottom: 20px;">Head of Ops • admindemo@billbhai.com</p>
                        <button class="btn btn-outline" style="width: 100%; justify-content: center;">Edit Profile</button>
                    </div>
                </div>
                <div class="card">
                    <div class="card-hd"><h3>Security</h3></div>
                    <div class="card-bd">
                        <div class="form-group">
                            <label class="form-label">Current Password</label>
                            <input type="password" class="form-control" placeholder="••••••••">
                        </div>
                        <div class="form-group">
                            <label class="form-label">New Password</label>
                            <input type="password" class="form-control" placeholder="••••••••">
                        </div>
                        <button class="btn btn-primary" style="width: 100%; justify-content: center;">Update Password</button>
                    </div>
                </div>
            </div>
            <div class="card">
                <div class="card-hd"><h3>Recent Activity</h3></div>
                <div class="card-bd">
                    <div class="timeline">
                        <div class="timeline-item">
                            <div class="timeline-marker"></div>
                            <div class="timeline-time">Today, 14:30</div>
                            <div class="timeline-content">Approved Return <strong>#RET-201</strong></div>
                        </div>
                        <div class="timeline-item">
                            <div class="timeline-marker"></div>
                            <div class="timeline-time">Yesterday, 18:45</div>
                            <div class="timeline-content">Generated Monthly Sales Report</div>
                        </div>
                        <div class="timeline-item">
                            <div class="timeline-marker"></div>
                            <div class="timeline-time">15 Feb, 09:12</div>
                            <div class="timeline-content">Updated inventory stock for <strong>SKU-05</strong></div>
                        </div>
                        <div class="timeline-item">
                            <div class="timeline-marker"></div>
                            <div class="timeline-time">14 Feb, 10:00</div>
                            <div class="timeline-content">System login from new IP Address</div>
                        </div>
                    </div>
                </div>
            </div>
        </section>`;
    }

    function renderSettings() {
        content.innerHTML = `
        <div class="page-header"><h2>Settings</h2><div class="page-header-actions"><button class="btn btn-primary">Save Changes</button></div></div>
        <section class="card" style="padding: 20px;">
            <div class="settings-layout">
                <div class="settings-nav">
                    <button class="settings-tab active"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> General</button>
                    <button class="settings-tab"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg> Store Details</button>
                    <button class="settings-tab"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg> Notifications</button>
                </div>
                <div>
                    <h3 style="font-size: 1.1rem; margin-bottom: 20px;">General Preferences</h3>
                    <div class="form-group" style="max-width: 400px;">
                        <label class="form-label">Language</label>
                        <select class="form-control"><option>English (US)</option><option>Hindi</option></select>
                    </div>
                    <div class="form-group" style="max-width: 400px;">
                        <label class="form-label">Currency Symbol</label>
                        <select class="form-control"><option>₹ (INR)</option><option>$ (USD)</option></select>
                    </div>
                    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid var(--border);">
                        <div style="display: flex; justify-content: space-between; align-items: center; max-width: 400px;">
                            <div>
                                <div style="font-weight: 500;">Two-Factor Authentication</div>
                                <div class="text-sm text-muted">Require 2FA for all admin logins</div>
                            </div>
                            <label class="switch"><input type="checkbox" checked><span class="slider"></span></label>
                        </div>
                    </div>
                </div>
            </div>
        </section>`;
    }

    function renderNotifications() {
        content.innerHTML = `
        <div class="page-header"><h2>Notifications</h2><div class="page-header-actions"><button class="btn btn-outline">Mark all as read</button></div></div>
        <div class="card">
            <div class="card-hd" style="padding: 0;">
                <div style="display: flex; border-bottom: 1px solid var(--border);">
                    <button style="padding: 14px 20px; border: none; background: none; color: var(--accent); border-bottom: 2px solid var(--accent); font-weight: 600; cursor: pointer;">All</button>
                    <button style="padding: 14px 20px; border: none; background: none; color: var(--text-muted); font-weight: 500; cursor: pointer;">Unread</button>
                </div>
            </div>
            <div class="card-bd" style="padding: 0;">
                ${notificationsList.map(n => `
                <div class="notif-item" onclick="renderNotificationDetail('${n.id}')" style="display: flex; gap: 16px; padding: 16px 20px; border-bottom: 1px solid var(--border); align-items: flex-start; cursor: pointer; transition: background 0.2s;">
                    <div style="background: var(--${n.color}-bg); color: var(--${n.color}); padding: 10px; border-radius: 8px; flex-shrink: 0;">${n.icon}</div>
                    <div style="flex: 1;">
                        <div style="font-weight: 600; color: var(--text-primary); transition: color 0.2s;">${n.title}</div>
                        <div class="text-sm text-muted" style="margin-top: 2px;">${n.desc}</div>
                    </div>
                    <div class="text-sm text-muted">${n.time}</div>
                </div>`).join('')}
            </div>
        </div>`;
    }

    function renderNotificationDetail(id) {
        const n = notificationsList.find(x => x.id === id);
        if (!n) return;

        let diffHtml = '';
        n.changes.forEach(c => {
            diffHtml += `
            <div style="margin-bottom: 24px;">
                <div style="font-family: monospace; font-size: 0.85rem; color: var(--text-muted); margin-bottom: 8px; padding-bottom: 4px; border-bottom: 1px solid var(--border);">
                    File: <strong>${c.file}</strong>
                </div>
                <div class="diff-view">
                    <div class="diff-line removed">- ${c.old}</div>
                    <div class="diff-line added">+ ${c.new}</div>
                </div>
            </div>`;
        });

        content.innerHTML = `
        <div class="page-header" style="justify-content: flex-start; gap: 16px;">
            <button class="btn btn-outline" style="padding: 8px;" onclick="document.querySelector('.nav-item[data-page=\\'notifications\\']').click()"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg></button>
            <h2>Event Details</h2>
        </div>
        <div class="card" style="margin-bottom: 24px;">
            <div class="card-bd" style="display: flex; gap: 16px; align-items: flex-start;">
                <div style="background: var(--${n.color}-bg); color: var(--${n.color}); padding: 14px; border-radius: 8px; flex-shrink: 0;">${n.icon}</div>
                <div>
                    <h3 style="margin-bottom: 4px; font-size: 1.2rem;">${n.title}</h3>
                    <div style="color: var(--text-muted); margin-bottom: 12px;">ID: ${n.id} • ${n.time}</div>
                    <p style="color: var(--text-primary);">${n.desc}</p>
                </div>
            </div>
        </div>
        <div class="card">
            <div class="card-hd"><h3>System Changes (Diff)</h3></div>
            <div class="card-bd" style="background: #1e1e1e; border-radius: 0 0 var(--radius) var(--radius); padding: 24px;">
                ${diffHtml}
            </div>
        </div>`;
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
        createChart('dashSalesChart', 'line', {
            labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            datasets: [{ label: 'Revenue', data: [12500, 15000, 11000, 18000, 22000, 24580, 21000], borderColor: c.red, backgroundColor: 'rgba(220,53,69,0.1)', tension: 0.4, fill: true }]
        });
        createChart('dashStatusChart', 'doughnut', {
            labels: ['Delivered', 'Processing', 'Returns'],
            datasets: [{ data: [65, 25, 10], backgroundColor: [c.green, c.blue, c.red], borderWidth: 0 }]
        }, { plugins: { legend: { position: 'right', labels: { color: c.text } } } });
    }

    function initInventoryCharts() {
        const c = getColors();
        createChart('invCatChart', 'pie', {
            labels: ['Grocery', 'Dairy', 'Beverages'],
            datasets: [{ data: [5, 3, 2], backgroundColor: [c.amber, c.blue, c.green], borderWidth: 0 }]
        }, { plugins: { legend: { position: 'right', labels: { color: c.text } } } });

        createChart('invStockChart', 'bar', {
            labels: ['Rice', 'Dal', 'Oil', 'Flour', 'Sugar'],
            datasets: [{ label: 'Stock Level', data: [145, 230, 18, 95, 5], backgroundColor: [c.green, c.green, c.red, c.green, c.red] }]
        });
    }

    function initReturnCharts() {
        const c = getColors();
        createChart('retReasonChart', 'bar', {
            labels: ['Damaged', 'Wrong Item', 'Expired', 'Stale'],
            datasets: [{ label: 'Count', data: [5, 3, 2, 1], backgroundColor: c.red }]
        }, { indexAxis: 'y' });

        createChart('retStatusChart', 'doughnut', {
            labels: ['Approved', 'Refunded', 'Rejected'],
            datasets: [{ data: [4, 2, 1], backgroundColor: [c.green, c.blue, c.red], borderWidth: 0 }]
        }, { plugins: { legend: { position: 'right', labels: { color: c.text } } } });
    }

    function initReportCharts() {
        const c = getColors();
        createChart('repRevChart', 'line', {
            labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
            datasets: [{ label: 'Projected Revenue', data: [120000, 145000, 138000, 160000], borderColor: c.blue, backgroundColor: 'rgba(100,181,246,0.1)', fill: true }]
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

        if (!valid) return;

        const stock = parseInt(document.getElementById('prodStock').value, 10);
        const selectedStatus = document.getElementById('prodStatus').value;
        const sku = document.getElementById('prodSku').value || getNextSku();

        const existingIdx = inventory.findIndex(i => i.sku === sku);
        const pData = {
            sku: sku,
            name: document.getElementById('prodName').value.trim(),
            cat: document.getElementById('prodCategory').value,
            supplier: document.getElementById('prodSupplier').value.trim(),
            price: parseFloat(document.getElementById('prodPrice').value),
            stock: stock,
            status: determineStatus(stock, selectedStatus)
        };

        if (existingIdx !== -1) {
            inventory[existingIdx] = pData;
        } else {
            inventory.push(pData);
        }
        persistOperationalData();

        // Update DOM row if editing, else append
        const statusClass = pData.status === 'In Stock' ? 'b-active' : pData.status === 'Low Stock' ? 'b-pending' : pData.status === 'Critical' ? 'b-cancelled' : 'b-inactive';
        const trHtml = `<td class="cell-main">${pData.sku}</td><td>${pData.name}</td><td>${pData.cat}</td><td>${pData.supplier}</td><td>${pData.stock}</td><td>₹${pData.price}</td><td><span class="badge ${statusClass}">${pData.status}</span></td><td><button class="btn btn-outline" style="padding: 4px 8px; font-size: 0.75rem; margin-right: 4px;" onclick="window.editProduct('${pData.sku}')">Edit</button><button class="btn btn-outline" style="padding: 4px 8px; font-size: 0.75rem; color: var(--red); border-color: var(--red);" onclick="window.deleteProduct('${pData.sku}')">Delete</button></td>`;
        
        let existingRow = null;
        document.querySelectorAll('tr').forEach(r => { if(r.children[0] && r.children[0].textContent === sku) existingRow = r; });
        
        if (existingRow) {
            existingRow.innerHTML = trHtml;
        } else {
            const tbody = document.getElementById('inventoryTableBody') || (document.querySelector('table.dt tbody'));
            if (tbody) {
                const tr = document.createElement('tr');
                tr.innerHTML = trHtml;
                tbody.appendChild(tr);
            }
        }

        if (currentPage === 'inventory') {
            if (activeCharts.length) {
                activeCharts.forEach(c => c.destroy());
                activeCharts = [];
            }
            initInventoryCharts();
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
        document.getElementById('prodSku').value = p.sku;
        document.getElementById('prodName').value = p.name;
        document.getElementById('prodCategory').value = p.cat;
        document.getElementById('prodSupplier').value = p.supplier || '';
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
                document.querySelectorAll('tr').forEach(r => { if(r.children[0] && r.children[0].textContent === sku) r.remove(); });
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
        openQuickFormModal({
            title: 'Raise Return Request',
            submitLabel: 'Create',
            fields: [
                { name: 'oid', label: 'Order ID', type: 'text', required: true, placeholder: 'ORD-4821' },
                { name: 'reason', label: 'Reason', type: 'select', required: true, options: ['Damaged', 'Wrong Item', 'Expired', 'Stale'] },
                { name: 'amount', label: 'Refund Amount', type: 'number', required: true, min: 0, step: 0.01 }
            ],
            initialValues: { reason: 'Damaged', amount: 0 },
            onSubmit: (values, closeModal) => {
                returns.unshift({
                    id: getNextReturnId(),
                    oid: String(values.oid).trim().toUpperCase(),
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
                { name: 'partner', label: 'Delivery Partner', type: 'text', required: true }
            ],
            initialValues: { partner: item.partner || '' },
            onSubmit: (values, closeModal) => {
                item.partner = String(values.partner).trim();
                if (item.status === 'Pending') item.status = 'Out for Delivery';
                item.time = formatDate().split(' ').slice(-1)[0];
                persistOperationalData();
                renderPage('delivery');
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
        item.time = formatDate().split(' ').slice(-1)[0];
        persistOperationalData();
        renderPage('delivery');
        showToast(`${id} marked delivered.`);
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
        await hydrateDataFromJsonFiles();
        renderPage(currentPage);
    })();
});
