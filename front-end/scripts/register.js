document.addEventListener('DOMContentLoaded', () => {

    // ===== Typewriter subtitle =====
    const subtitleEl = document.getElementById('brandSubtitle');
    if (subtitleEl) {
        const text = subtitleEl.dataset.text || 'CREATE YOUR ACCOUNT';
        let ci = 0;
        function typeText() {
            if (ci <= text.length) {
                subtitleEl.textContent = text.substring(0, ci);
                ci++;
                setTimeout(typeText, 55 + Math.random() * 35);
            }
        }
        setTimeout(typeText, 500);
    }

    // ===== 3D tilt card effect =====
    const card = document.querySelector('.register-card');
    if (card) {
        card.addEventListener('mousemove', e => {
            const r = card.getBoundingClientRect();
            const rx = ((e.clientY - r.top - r.height / 2) / (r.height / 2)) * -2;
            const ry = ((e.clientX - r.left - r.width / 2) / (r.width / 2)) * 2;
            card.style.transform = `perspective(1200px) rotateX(${rx}deg) rotateY(${ry}deg)`;
        });
        card.addEventListener('mouseleave', () => {
            card.style.transform = 'perspective(1200px) rotateX(0) rotateY(0)';
            card.style.transition = 'transform 0.5s ease';
            setTimeout(() => { card.style.transition = ''; }, 500);
        });
    }

    // ===== Password toggle(s) =====
    document.querySelectorAll('.toggle-password').forEach(btn => {
        btn.addEventListener('click', () => {
            const input = btn.closest('.input-group').querySelector('input');
            const isP = input.type === 'password';
            input.type = isP ? 'text' : 'password';
            btn.classList.toggle('showing', isP);
        });
    });

    // ===== Password strength meter =====
    const passwordInput = document.getElementById('password');
    const strengthBars = document.querySelectorAll('.strength-bar');
    const strengthLabel = document.querySelector('.strength-label');

    if (passwordInput && strengthBars.length) {
        passwordInput.addEventListener('input', () => {
            const val = passwordInput.value;
            let score = 0;
            if (val.length >= 6) score++;
            if (val.length >= 8) score++;
            if (/[A-Z]/.test(val)) score++;
            if (/[0-9]/.test(val)) score++;
            if (/[^A-Za-z0-9]/.test(val)) score++;

            // Map score 0-5 to level 0-4
            const level = Math.min(score, 4);
            const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
            const classes = ['', '', 'medium', 'medium', 'strong'];

            strengthBars.forEach((bar, i) => {
                bar.classList.remove('active', 'medium', 'strong');
                if (i < level) {
                    bar.classList.add('active');
                    if (classes[level]) bar.classList.add(classes[level]);
                }
            });

            if (strengthLabel) {
                strengthLabel.textContent = val ? labels[level] || '' : '';
            }
        });
    }

    // ===== Real-time password match =====
    const confirmInput = document.getElementById('confirmPassword');
    if (confirmInput && passwordInput) {
        confirmInput.addEventListener('input', () => {
            const group = confirmInput.closest('.input-group');
            if (confirmInput.value && confirmInput.value !== passwordInput.value) {
                group.classList.add('error');
                const errEl = group.querySelector('.field-error');
                if (errEl) { errEl.textContent = 'Passwords do not match'; errEl.style.display = 'block'; }
            } else {
                group.classList.remove('error');
                const errEl = group.querySelector('.field-error');
                if (errEl) { errEl.style.display = 'none'; }
            }
        });
    }

    // ===== Clear error on focus =====
    document.querySelectorAll('.input-group input, .input-group select').forEach(input => {
        input.addEventListener('focus', () => {
            const group = input.closest('.input-group');
            group.classList.remove('error', 'shake');
            const errEl = group.querySelector('.field-error');
            if (errEl) errEl.style.display = 'none';
        });
    });

    // ===== Form submission validation =====
    const form = document.getElementById('registerForm');
    const btnRegister = document.getElementById('btnRegister');
    const formError = document.getElementById('formError');

    if (form && btnRegister) {
        form.addEventListener('submit', e => {
            e.preventDefault();
            if (formError) formError.textContent = '';
            document.querySelectorAll('.input-group').forEach(g => g.classList.remove('error', 'shake'));

            let hasError = false;

            // Validate required fields
            form.querySelectorAll('[required]').forEach(field => {
                if (!field.value.trim()) {
                    const group = field.closest('.input-group');
                    if (group) {
                        group.classList.add('error', 'shake');
                        group.addEventListener('animationend', () => group.classList.remove('shake'), { once: true });
                    }
                    hasError = true;
                }
            });

            // Validate email
            const emailInput = form.querySelector('input[type="email"]');
            if (emailInput && emailInput.value.trim()) {
                const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailPattern.test(emailInput.value.trim())) {
                    const group = emailInput.closest('.input-group');
                    group.classList.add('error', 'shake');
                    const errEl = group.querySelector('.field-error');
                    if (errEl) { errEl.textContent = 'Please enter a valid email'; errEl.style.display = 'block'; }
                    group.addEventListener('animationend', () => group.classList.remove('shake'), { once: true });
                    hasError = true;
                }
            }

            // Validate phone
            const phoneInput = form.querySelector('input[type="tel"]');
            if (phoneInput && phoneInput.value.trim()) {
                const phonePattern = /^[6-9]\d{9}$/;
                if (!phonePattern.test(phoneInput.value.trim().replace(/\s/g, ''))) {
                    const group = phoneInput.closest('.input-group');
                    group.classList.add('error', 'shake');
                    const errEl = group.querySelector('.field-error');
                    if (errEl) { errEl.textContent = 'Enter a valid 10-digit Indian mobile number'; errEl.style.display = 'block'; }
                    group.addEventListener('animationend', () => group.classList.remove('shake'), { once: true });
                    hasError = true;
                }
            }

            // Validate password match
            const pw = document.getElementById('password');
            const cpw = document.getElementById('confirmPassword');
            if (pw && cpw && pw.value && cpw.value && pw.value !== cpw.value) {
                const group = cpw.closest('.input-group');
                group.classList.add('error', 'shake');
                const errEl = group.querySelector('.field-error');
                if (errEl) { errEl.textContent = 'Passwords do not match'; errEl.style.display = 'block'; }
                group.addEventListener('animationend', () => group.classList.remove('shake'), { once: true });
                hasError = true;
            }

            // Validate password length
            if (pw && pw.value && pw.value.length < 6) {
                const group = pw.closest('.input-group');
                group.classList.add('error', 'shake');
                const errEl = group.querySelector('.field-error');
                if (errEl) { errEl.textContent = 'Password must be at least 6 characters'; errEl.style.display = 'block'; }
                group.addEventListener('animationend', () => group.classList.remove('shake'), { once: true });
                hasError = true;
            }

            // Validate terms checkbox
            const termsCheckbox = document.getElementById('agreeTerms');
            if (termsCheckbox && !termsCheckbox.checked) {
                if (formError) formError.textContent = 'Please accept the Terms & Conditions';
                hasError = true;
            }

            if (hasError) return;

            // Simulate success
            btnRegister.classList.add('loading');
            btnRegister.disabled = true;

            setTimeout(() => {
                btnRegister.classList.remove('loading');
                btnRegister.classList.add('success');
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 1000);
            }, 2000);
        });
    }

});
