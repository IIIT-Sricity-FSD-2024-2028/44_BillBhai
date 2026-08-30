document.addEventListener('DOMContentLoaded', () => {
    const API_BASE_URL = 'http://localhost:4000/api';

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

    function toTitleCase(value) {
        return String(value || '')
            .replace(/[_-]+/g, ' ')
            .trim()
            .split(/\s+/)
            .filter(Boolean)
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
            .join(' ');
    }

    const EMAIL_PATTERN = /^[A-Za-z0-9._%+-]+@(?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,}$/;
    const PHONE_PATTERN = /^[6-9]\d{9}$/;

    function normalizePhoneDigits(value) {
        return String(value || '').replace(/\D/g, '');
    }

    function isValidEmailAddress(value) {
        return EMAIL_PATTERN.test(String(value || '').trim());
    }

    function isValidPhoneNumber(value) {
        return PHONE_PATTERN.test(normalizePhoneDigits(value));
    }

    function deriveAdminUsername(ownerName, email) {
        const emailSeed = String(email || '').trim().split('@')[0].toLowerCase().replace(/[^a-z0-9._-]/g, '');
        if (emailSeed) return emailSeed;
        const ownerSeed = String(ownerName || '').trim().toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9._-]/g, '');
        return ownerSeed || `owner${Date.now().toString().slice(-4)}`;
    }

    async function createBusinessAccount(payload) {
        const companyPayload = {
            name: payload.businessName,
            owner: payload.ownerName,
            adminName: payload.ownerName,
            type: toTitleCase(payload.businessType),
            email: payload.email,
            phone: payload.phone,
            gstNo: payload.gstin || undefined,
            address: 'India',
            plan: 'starter',
            productsPlan: 'Starter Plan (Free)',
            subscriptionStatus: 'Active',
            monthlyPrice: 0,
            renewalDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            tenureMonths: 0,
            storesCount: 1
        };

        const companyResponse = await fetch(`${API_BASE_URL}/companies`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-role': 'superuser'
            },
            body: JSON.stringify(companyPayload)
        });
        
        if (!companyResponse.ok) {
            let errorMsg = 'Company creation failed';
            let conflictField = null;
            try {
                const errJson = await companyResponse.json();
                if (errJson && errJson.message) {
                    errorMsg = errJson.message;
                    if (companyResponse.status === 409) {
                        if (/email/i.test(errJson.message)) conflictField = 'email';
                        else if (/name/i.test(errJson.message)) conflictField = 'businessName';
                        errorMsg = 'A business with this name or email address is already registered.';
                    }
                }
            } catch (e) {
                const bodyText = await companyResponse.text().catch(() => '');
                errorMsg = bodyText || errorMsg;
            }
            const err = new Error(errorMsg);
            err.status = companyResponse.status;
            err.conflictField = conflictField;
            throw err;
        }
        const companyRecord = await companyResponse.json();

        const username = deriveAdminUsername(payload.ownerName, payload.email);
        const userPayload = {
            companyId: String(companyRecord && companyRecord.id || '').trim(),
            name: payload.ownerName,
            role: 'admin',
            email: payload.email,
            mobileNo: payload.phone,
            username,
            password: payload.password
        };

        const userResponse = await fetch(`${API_BASE_URL}/users`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-role': 'superuser'
            },
            body: JSON.stringify(userPayload)
        });
        
        if (!userResponse.ok) {
            let errorMsg = 'Admin user creation failed';
            try {
                const errJson = await userResponse.json();
                if (errJson && errJson.message) {
                    errorMsg = errJson.message;
                    if (userResponse.status === 409) {
                        errorMsg = 'An account with this username or email already exists.';
                    }
                }
            } catch (e) {
                const bodyText = await userResponse.text().catch(() => '');
                errorMsg = bodyText || errorMsg;
            }
            const err = new Error(errorMsg);
            err.status = userResponse.status;
            throw err;
        }
        const userRecord = await userResponse.json();

        return {
            company: companyRecord,
            user: userRecord,
            username,
            password: payload.password
        };
    }

    // ===== Form submission validation =====
    const form = document.getElementById('registerForm');
    const btnRegister = document.getElementById('btnRegister');
    const formError = document.getElementById('formError');

    if (form && btnRegister) {
        form.addEventListener('submit', async e => {
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
                if (!isValidEmailAddress(emailInput.value)) {
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
                if (!isValidPhoneNumber(phoneInput.value)) {
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

            const submitPayload = {
                businessName: document.getElementById('businessName').value.trim(),
                ownerName: document.getElementById('ownerName').value.trim(),
                email: document.getElementById('email').value.trim().toLowerCase(),
                phone: normalizePhoneDigits(document.getElementById('phone').value),
                gstin: document.getElementById('gstin').value.trim(),
                businessType: document.getElementById('businessType').value.trim(),
                password: document.getElementById('password').value
            };

            btnRegister.classList.add('loading');
            btnRegister.disabled = true;
            try {
                const created = await createBusinessAccount(submitPayload);
                sessionStorage.setItem('bb_recent_business_signup', JSON.stringify({
                    createdAt: new Date().toISOString(),
                    businessId: created.company && created.company.id,
                    businessName: created.company && created.company.name,
                    ownerName: submitPayload.ownerName,
                    username: created.username,
                    password: created.password,
                    email: submitPayload.email,
                    phone: submitPayload.phone
                }));
                btnRegister.classList.remove('loading');
                btnRegister.classList.add('success');
                setTimeout(() => {
                    window.location.href = 'choose-plan.html';
                }, 800);
            } catch (error) {
                console.error('Business registration failed:', error);
                if (formError) {
                    const cleanMsg = (error && error.message) || 'Could not create business account right now.';
                    const isConflict = error && error.status === 409;
                    
                    formError.innerHTML = `
                        <div style="display:flex;align-items:flex-start;gap:12px;padding:12px 16px;background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.35);border-radius:10px;color:#fca5a5;text-align:left;animation:shake 0.4s ease;margin:8px 0 16px;">
                            <svg style="flex-shrink:0;margin-top:2px;" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                            <div style="flex:1;">
                                <div style="font-weight:700;color:#fee2e2;font-size:0.86rem;margin-bottom:2px;">${isConflict ? 'Business Already Registered' : 'Registration Failed'}</div>
                                <div style="font-size:0.8rem;color:#fca5a5;line-height:1.4;">${cleanMsg}</div>
                                ${isConflict ? '<div style="margin-top:8px;"><a href="login.html" style="color:#60a5fa;font-weight:600;text-decoration:none;font-size:0.82rem;display:inline-flex;align-items:center;gap:4px;">Sign in to your existing account &rarr;</a></div>' : ''}
                            </div>
                        </div>
                    `;

                    // Highlight offending field
                    if (error && error.conflictField === 'email') {
                        const eg = document.getElementById('emailGroup');
                        if (eg) {
                            eg.classList.add('error', 'shake');
                            const errEl = eg.querySelector('.field-error');
                            if (errEl) { errEl.textContent = 'Email already in use'; errEl.style.display = 'block'; }
                        }
                    } else if (error && error.conflictField === 'businessName') {
                        const bg = document.getElementById('businessNameGroup');
                        if (bg) {
                            bg.classList.add('error', 'shake');
                            const errEl = bg.querySelector('.field-error');
                            if (errEl) { errEl.textContent = 'Business name already taken'; errEl.style.display = 'block'; }
                        }
                    }
                }
                btnRegister.classList.remove('loading');
                btnRegister.disabled = false;
            }
        });
    }
});
