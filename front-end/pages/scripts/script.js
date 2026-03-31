document.addEventListener('DOMContentLoaded', async () => {


    const subtitleEl = document.getElementById('brandSubtitle');
    const text = 'ORDER & BILLING SYSTEM';
    let ci = 0;
    function typeText() {
        if (ci <= text.length) { subtitleEl.textContent = text.substring(0, ci); ci++; setTimeout(typeText, 60 + Math.random() * 40); }
    }
    setTimeout(typeText, 600);

    const card = document.getElementById('loginCard');
    card.addEventListener('mousemove', e => {
        const r = card.getBoundingClientRect();
        const rx = ((e.clientY - r.top - r.height / 2) / (r.height / 2)) * -3;
        const ry = ((e.clientX - r.left - r.width / 2) / (r.width / 2)) * 3;
        card.style.transform = `perspective(1000px) rotateX(${rx}deg) rotateY(${ry}deg)`;
    });
    card.addEventListener('mouseleave', () => {
        card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0)';
        card.style.transition = 'transform 0.5s ease';
        setTimeout(() => { card.style.transition = ''; }, 500);
    });

    const toggleBtn = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('password');
    toggleBtn.addEventListener('click', () => {
        const isP = passwordInput.type === 'password';
        passwordInput.type = isP ? 'text' : 'password';
        toggleBtn.classList.toggle('showing', isP);
    });

    const loginForm = document.getElementById('loginForm');
    const usernameInput = document.getElementById('username');
    const btnLogin = document.getElementById('btnLogin');
    const loginError = document.getElementById('loginError');
    const forgotLink = document.querySelector('.forgot-link');
    const AUTH_OVERRIDE_STORAGE_KEY = 'bb_auth_overrides';
    const FETCH_TIMEOUT_MS = 7000;

    function normalizeRole(role) {
        return String(role || '').toLowerCase().replace(/\s+/g, '');
    }

    function roleToKey(role) {
        const r = normalizeRole(role);
        if (r === 'superuser' || r === 'super') return 'superuser';
        if (r === 'admin' || r === 'opshead' || r === 'storemanager' || r === 'accountant' || r === 'supportagent') return 'admin';
        if (r === 'cashier') return 'cashier';
        if (r === 'returnhandler' || r === 'returns') return 'returnhandler';
        if (r === 'inventorymanager' || r === 'inventory') return 'inventorymanager';
        if (r === 'deliveryops' || r === 'deliverymanager' || r === 'delivery' || r === 'deliverydriver') return 'deliveryops';
        if (r === 'customer' || r === 'user') return 'customer';
        return 'admin';
    }

    function routeByRole(role) {
        const r = roleToKey(role);
        if (r === 'superuser' || r === 'super') return 'superuser.html';
        if (r === 'admin') return 'dashboard.html';
        if (r === 'cashier') return 'cashier.html';
        if (r === 'returnhandler') return 'returns.html';
        if (r === 'inventorymanager') return 'inventory.html';
        if (r === 'deliveryops') return 'delivery.html';
        if (r === 'customer') return 'cashier.html';
        return 'dashboard.html';
    }

    const DEFAULT_AUTH_CONFIG = {
        users: {
            superuser: { password: 'super123', role: 'Super User', name: 'Legacy Admin Account' },
            admin: { password: 'admin123', role: 'Admin', name: 'Store Admin' },
            cashier: { password: 'cashier123', role: 'Cashier', name: 'POS Cashier' },
            returnhandler: { password: 'return123', role: 'Return Handler', name: 'Returns Desk' },
            inventorymanager: { password: 'inventory123', role: 'Inventory Manager', name: 'Inventory Lead' },
            deliveryops: { password: 'delivery123', role: 'Delivery Ops', name: 'Delivery Manager' },
            customer: { password: 'customer123', role: 'Customer', name: 'Self Checkout User' },
            chirag: { password: 'chirag1234', role: 'Super User', name: 'Chirag' }
        },
        aliases: {
            super: 'superuser',
            'superuser@billbhai.com': 'superuser',
            'admin@billbhai.com': 'admin',
            'cashier@billbhai.com': 'cashier',
            returns: 'returnhandler',
            'returnhandler@billbhai.com': 'returnhandler',
            inventory: 'inventorymanager',
            'inventorymanager@billbhai.com': 'inventorymanager',
            delivery: 'deliveryops',
            'deliveryops@billbhai.com': 'deliveryops',
            user: 'customer',
            'customer@billbhai.com': 'customer',
            'chirag@billbhai.com': 'chirag'
        }
    };

    let authConfig = {
        users: { ...DEFAULT_AUTH_CONFIG.users },
        aliases: { ...DEFAULT_AUTH_CONFIG.aliases }
    };

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

    async function loadAuthConfig() {
        const parsed = await fetchJsonWithTimeout('data/auth_users.json');
        if (!parsed || typeof parsed !== 'object') {
            authConfig = {
                users: { ...DEFAULT_AUTH_CONFIG.users },
                aliases: { ...DEFAULT_AUTH_CONFIG.aliases }
            };
            return;
        }

        const users = parsed.users && typeof parsed.users === 'object' && !Array.isArray(parsed.users)
            ? parsed.users
            : DEFAULT_AUTH_CONFIG.users;
        const aliases = parsed.aliases && typeof parsed.aliases === 'object' && !Array.isArray(parsed.aliases)
            ? parsed.aliases
            : DEFAULT_AUTH_CONFIG.aliases;

        authConfig = {
            users: { ...users },
            aliases: { ...aliases }
        };
    }

    await loadAuthConfig();

    function resolveUserKey(input) {
        const normalized = String(input || '').trim().toLowerCase();
        if (!normalized) return '';
        if (Object.prototype.hasOwnProperty.call(authConfig.users, normalized)) return normalized;
        const aliasMatch = authConfig.aliases[normalized];
        if (aliasMatch) return aliasMatch;

        const overrides = loadAuthOverrides();
        if (Object.prototype.hasOwnProperty.call(overrides, normalized)) return normalized;

        const dynamicMatch = Object.keys(overrides).find(key => {
            const record = overrides[key] && typeof overrides[key] === 'object' ? overrides[key] : {};
            const username = String(record.username || '').trim().toLowerCase();
            const email = String(record.email || '').trim().toLowerCase();
            return username === normalized || email === normalized;
        });

        return dynamicMatch || '';
    }

    function loadAuthOverrides() {
        try {
            const raw = localStorage.getItem(AUTH_OVERRIDE_STORAGE_KEY);
            if (!raw) return {};
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
        } catch (err) {
            return {};
        }
    }

    function saveAuthOverrides(overrides) {
        localStorage.setItem(AUTH_OVERRIDE_STORAGE_KEY, JSON.stringify(overrides));
    }

    function resolveUserRecord(userKey) {
        const overrides = loadAuthOverrides();
        const hasBaseRecord = Object.prototype.hasOwnProperty.call(authConfig.users, userKey);
        const baseRecord = hasBaseRecord ? (authConfig.users[userKey] || {}) : {};
        const overrideRecord = overrides[userKey] && typeof overrides[userKey] === 'object'
            ? overrides[userKey]
            : {};

        if (!hasBaseRecord && !Object.keys(overrideRecord).length) return null;

        const resolvedRole = String(overrideRecord.role || baseRecord.role || 'Customer').trim();
        const resolvedName = String(overrideRecord.name || baseRecord.name || userKey).trim() || userKey;

        return {
            ...baseRecord,
            ...overrideRecord,
            role: resolvedRole,
            name: resolvedName,
            status: String(overrideRecord.status || baseRecord.status || 'Active').trim() || 'Active',
            email: String(overrideRecord.email || '').trim(),
            username: String(overrideRecord.username || userKey).trim() || userKey,
            password: String(overrideRecord.password || baseRecord.password || '').trim()
        };
    }

    function resolveScopedBusinessId() {
        const fallbackId = 'BIZ-101';
        const currentScopedId = String(localStorage.getItem('activeBusinessId') || '').trim();

        try {
            const raw = localStorage.getItem('bb_businesses');
            if (!raw) return currentScopedId || fallbackId;

            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed) || !parsed.length) return currentScopedId || fallbackId;

            const normalizedBusinesses = parsed
                .map(item => String(item && item.id || '').trim())
                .filter(Boolean);
            if (!normalizedBusinesses.length) return currentScopedId || fallbackId;

            if (currentScopedId && normalizedBusinesses.includes(currentScopedId)) {
                return currentScopedId;
            }
            return normalizedBusinesses[0];
        } catch (err) {
            return currentScopedId || fallbackId;
        }
    }

    loginForm.addEventListener('submit', e => {
        e.preventDefault();
        document.querySelectorAll('.input-group').forEach(g => g.classList.remove('error', 'shake'));
        loginError.textContent = '';
        const u = resolveUserKey(usernameInput.value), p = passwordInput.value.trim();
        let err = false;
        if (!u) { const g = document.getElementById('usernameGroup'); g.classList.add('error', 'shake'); g.addEventListener('animationend', () => g.classList.remove('shake'), { once: true }); err = true; }
        if (!p) { const g = document.getElementById('passwordGroup'); g.classList.add('error', 'shake'); g.addEventListener('animationend', () => g.classList.remove('shake'), { once: true }); err = true; }
        if (err) return;
        const userRecord = resolveUserRecord(u);
        if (!userRecord || userRecord.password !== p) {
            const pg = document.getElementById('passwordGroup');
            pg.classList.add('error', 'shake');
            pg.addEventListener('animationend', () => pg.classList.remove('shake'), { once: true });
            loginError.textContent = 'Incorrect username or password.';
            return;
        }

        const accountStatus = normalizeRole(userRecord.status || 'active');
        if (accountStatus === 'suspended' || accountStatus === 'inactive') {
            loginError.textContent = 'This account is currently suspended. Contact an administrator.';
            return;
        }

        // Store session state
        localStorage.setItem('userRole', userRecord.role);
        localStorage.setItem('userName', userRecord.name);
        const normalizedRole = roleToKey(userRecord.role);

        // Tenant context:
        // - Operational roles are scoped to exactly one business.
        // - Super User chooses a business from the portal when needed.
        const businessScopedRoles = ['admin', 'cashier', 'inventorymanager', 'deliveryops', 'returnhandler', 'customer'];
        if (businessScopedRoles.includes(normalizedRole)) {
            localStorage.setItem('activeBusinessId', resolveScopedBusinessId());
            localStorage.removeItem('activeBusinessName');
        } else {
            localStorage.removeItem('activeBusinessId');
            localStorage.removeItem('activeBusinessName');
        }
        localStorage.setItem('currentUser', JSON.stringify({
            username: u,
            name: userRecord.name,
            role: normalizedRole
        }));

        if (normalizedRole === 'customer') {
            sessionStorage.setItem('bb_customer_session_id', `customer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
            sessionStorage.setItem('bb_customer_session_notifications', '[]');
        } else {
            sessionStorage.removeItem('bb_customer_session_id');
            sessionStorage.removeItem('bb_customer_session_notifications');
        }

        btnLogin.classList.add('loading'); btnLogin.disabled = true;
        setTimeout(() => {
            btnLogin.classList.remove('loading'); btnLogin.classList.add('success');
            setTimeout(() => { window.location.href = routeByRole(userRecord.role); }, 800);
        }, 1800);
    });

    if (forgotLink) {
        forgotLink.addEventListener('click', (event) => {
            event.preventDefault();
            const lookupInput = window.prompt('Enter your username or email to reset password:');
            if (!lookupInput) return;

            const userKey = resolveUserKey(lookupInput);
            if (!userKey) {
                loginError.textContent = 'No account found for the entered username/email.';
                return;
            }

            const newPassword = window.prompt('Enter your new password (minimum 6 characters):');
            if (!newPassword) return;
            if (newPassword.trim().length < 6) {
                loginError.textContent = 'Password reset failed: minimum length is 6.';
                return;
            }

            const confirmPassword = window.prompt('Confirm your new password:');
            if (confirmPassword !== newPassword) {
                loginError.textContent = 'Password reset failed: confirmation does not match.';
                return;
            }

            const overrides = loadAuthOverrides();
            overrides[userKey] = {
                ...(overrides[userKey] || {}),
                password: newPassword.trim()
            };
            saveAuthOverrides(overrides);

            usernameInput.value = lookupInput.trim();
            passwordInput.value = '';
            loginError.textContent = '';
            window.alert('Password reset successful. Please sign in with your new password.');
        });
    }

    document.querySelectorAll('.input-group input').forEach(input => {
        input.addEventListener('focus', () => input.closest('.input-group').classList.remove('error'));
    });


});
