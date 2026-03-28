document.addEventListener('DOMContentLoaded', () => {


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

    function normalizeRole(role) {
        return String(role || '').toLowerCase().replace(/\s+/g, '');
    }

    function routeByRole(role) {
        const r = normalizeRole(role);
        if (r === 'superuser' || r === 'super') return 'superuser.html';
        if (r === 'admin') return 'dashboard.html';
        if (r === 'cashier') return 'orders.html';
        if (r === 'returnhandler') return 'returns.html';
        if (r === 'inventorymanager') return 'inventory.html';
        if (r === 'deliveryops') return 'delivery.html';
        if (r === 'customer') return 'profile.html';
        return 'dashboard.html';
    }

    const USERS = {
        'superuser': { password: 'super123', role: 'Admin', name: 'Legacy Admin Account' },
        'admin': { password: 'admin123', role: 'Admin', name: 'Store Admin' },
        'cashier': { password: 'cashier123', role: 'Cashier', name: 'POS Cashier' },
        'returnhandler': { password: 'return123', role: 'Return Handler', name: 'Returns Desk' },
        'inventorymanager': { password: 'inventory123', role: 'Inventory Manager', name: 'Inventory Lead' },
        'deliveryops': { password: 'delivery123', role: 'Delivery Ops', name: 'Delivery Manager' },
        'customer': { password: 'customer123', role: 'Customer', name: 'Self Checkout User' },
        'chirag': { password: 'chirag1234', role: 'Super User', name: 'Chirag' }
    };

    const USER_ALIASES = {
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
    };

    function resolveUserKey(input) {
        const normalized = String(input || '').trim().toLowerCase();
        if (!normalized) return '';
        if (Object.prototype.hasOwnProperty.call(USERS, normalized)) return normalized;
        return USER_ALIASES[normalized] || '';
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
        if (!Object.prototype.hasOwnProperty.call(USERS, u) || USERS[u].password !== p) {
            const pg = document.getElementById('passwordGroup');
            pg.classList.add('error', 'shake');
            pg.addEventListener('animationend', () => pg.classList.remove('shake'), { once: true });
            loginError.textContent = 'Incorrect username or password.';
            return;
        }

        // Store session state
        localStorage.setItem('userRole', USERS[u].role);
        localStorage.setItem('userName', USERS[u].name);
        // Reset tenant context on every fresh login. Super User sets this when opening a business.
        localStorage.removeItem('activeBusinessId');
        localStorage.removeItem('activeBusinessName');
        localStorage.setItem('currentUser', JSON.stringify({
            username: u,
            name: USERS[u].name,
            role: normalizeRole(USERS[u].role)
        }));

        btnLogin.classList.add('loading'); btnLogin.disabled = true;
        setTimeout(() => {
            btnLogin.classList.remove('loading'); btnLogin.classList.add('success');
            setTimeout(() => { window.location.href = routeByRole(USERS[u].role); }, 800);
        }, 1800);
    });

    document.querySelectorAll('.input-group input').forEach(input => {
        input.addEventListener('focus', () => input.closest('.input-group').classList.remove('error'));
    });


});
