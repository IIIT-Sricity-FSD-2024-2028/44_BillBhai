document.addEventListener('DOMContentLoaded', () => {
    const subtitleEl = document.getElementById('brandSubtitle');
    const text = 'ORDER & BILLING SYSTEM';
    let ci = 0;

    function typeText() {
        if (!subtitleEl) return;
        if (ci <= text.length) {
            subtitleEl.textContent = text.substring(0, ci);
            ci += 1;
            setTimeout(typeText, 60 + Math.random() * 40);
        }
    }

    setTimeout(typeText, 600);

    const card = document.getElementById('loginCard');
    if (card) {
        card.addEventListener('mousemove', (e) => {
            const r = card.getBoundingClientRect();
            const rx = ((e.clientY - r.top - (r.height / 2)) / (r.height / 2)) * -3;
            const ry = ((e.clientX - r.left - (r.width / 2)) / (r.width / 2)) * 3;
            card.style.transform = `perspective(1000px) rotateX(${rx}deg) rotateY(${ry}deg)`;
        });

        card.addEventListener('mouseleave', () => {
            card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0)';
            card.style.transition = 'transform 0.5s ease';
            setTimeout(() => {
                card.style.transition = '';
            }, 500);
        });
    }

    const toggleBtn = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('password');
    if (toggleBtn && passwordInput) {
        toggleBtn.addEventListener('click', () => {
            const isPassword = passwordInput.type === 'password';
            passwordInput.type = isPassword ? 'text' : 'password';
            toggleBtn.classList.toggle('showing', isPassword);
        });
    }

    const loginForm = document.getElementById('loginForm');
    const usernameInput = document.getElementById('username');
    const btnLogin = document.getElementById('btnLogin');
    const loginError = document.getElementById('loginError');
    const forgotLink = document.querySelector('.forgot-link');

    const LOGIN_API_URL = 'http://localhost:3000/api/auth/login';
    const LOGIN_TIMEOUT_MS = 10000;

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
        if (r === 'superuser') return 'superuser.html';
        if (r === 'admin') return 'dashboard.html';
        if (r === 'cashier') return 'cashier.html';
        if (r === 'returnhandler') return 'returns.html';
        if (r === 'inventorymanager') return 'inventory.html';
        if (r === 'deliveryops') return 'delivery.html';
        if (r === 'customer') return 'cashier.html';
        return 'dashboard.html';
    }

    function validateForm() {
        if (!usernameInput || !passwordInput || !loginError) return null;

        loginError.textContent = '';
        document.querySelectorAll('.input-group').forEach((g) => g.classList.remove('error', 'shake'));

        const username = usernameInput.value.trim();
        const password = passwordInput.value.trim();
        let hasError = false;

        if (!username) {
            const g = document.getElementById('usernameGroup');
            if (g) {
                g.classList.add('error', 'shake');
                g.addEventListener('animationend', () => g.classList.remove('shake'), { once: true });
            }
            hasError = true;
        }

        if (!password) {
            const g = document.getElementById('passwordGroup');
            if (g) {
                g.classList.add('error', 'shake');
                g.addEventListener('animationend', () => g.classList.remove('shake'), { once: true });
            }
            hasError = true;
        }

        if (hasError) return null;
        return { username, password };
    }

    async function backendLogin(credentials) {
        const controller = typeof AbortController === 'function' ? new AbortController() : null;
        const timeoutId = setTimeout(() => {
            if (controller) controller.abort();
        }, LOGIN_TIMEOUT_MS);

        try {
            const response = await fetch(LOGIN_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(credentials),
                signal: controller ? controller.signal : undefined
            });
            return response;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    async function handleLoginSubmit(event) {
        event.preventDefault();
        const credentials = validateForm();
        if (!credentials || !btnLogin || !loginError) return;

        btnLogin.classList.add('loading');
        btnLogin.disabled = true;

        try {
            const response = await backendLogin(credentials);

            if (!response.ok) {
                const pg = document.getElementById('passwordGroup');
                if (pg) {
                    pg.classList.add('error', 'shake');
                    pg.addEventListener('animationend', () => pg.classList.remove('shake'), { once: true });
                }

                loginError.textContent = response.status === 401
                    ? 'Incorrect username or password.'
                    : 'Authentication failed from backend. Please try again.';
                btnLogin.classList.remove('loading');
                btnLogin.disabled = false;
                return;
            }

            const userRecord = await response.json();
            const normalizedRole = roleToKey(userRecord.role);

            localStorage.setItem('userRole', normalizedRole);
            localStorage.setItem('userName', userRecord.username);

            const businessScopedRoles = ['admin', 'cashier', 'inventorymanager', 'deliveryops', 'returnhandler', 'customer'];
            if (businessScopedRoles.includes(normalizedRole)) {
                localStorage.setItem('activeBusinessId', userRecord.companyId || 'BIZ-101');
                localStorage.removeItem('activeBusinessName');
            } else {
                localStorage.removeItem('activeBusinessId');
                localStorage.removeItem('activeBusinessName');
            }

            localStorage.setItem('currentUser', JSON.stringify({
                id: userRecord.id,
                username: userRecord.username,
                name: userRecord.username,
                role: normalizedRole,
                email: userRecord.email || '',
                companyId: userRecord.companyId || null
            }));

            if (normalizedRole === 'customer') {
                sessionStorage.setItem('bb_customer_session_id', `customer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
                sessionStorage.setItem('bb_customer_session_notifications', '[]');
            } else {
                sessionStorage.removeItem('bb_customer_session_id');
                sessionStorage.removeItem('bb_customer_session_notifications');
            }

            setTimeout(() => {
                btnLogin.classList.remove('loading');
                btnLogin.classList.add('success');
                setTimeout(() => {
                    window.location.href = routeByRole(normalizedRole);
                }, 800);
            }, 1200);
        } catch (error) {
            console.error('Login error:', error);
            loginError.textContent = 'Backend is unavailable. Start backend server and try again.';
            btnLogin.classList.remove('loading');
            btnLogin.disabled = false;
        }
    }

    if (loginForm) {
        loginForm.addEventListener('submit', handleLoginSubmit);
    }

    if (forgotLink && loginError) {
        forgotLink.addEventListener('click', (event) => {
            event.preventDefault();
            loginError.textContent = 'Password reset is backend-managed. Please contact system admin.';
        });
    }

    document.querySelectorAll('.input-group input').forEach((input) => {
        input.addEventListener('focus', () => {
            const parent = input.closest('.input-group');
            if (parent) parent.classList.remove('error');
        });
    });
});
