/**
 * ui.js - POS Grid & Wizard DOM Manager
 */

const UI = (() => {
    'use strict';

    let el = {};
    let cart = [];
    let currentDiscount = { active: false, discount: 0 };
    let currentCategory = 'All';
    let searchQuery = '';
    let currentCustomerProfile = null;

    let callbacks = { onCheckout: null };

    function cacheElements() {
        el = {
            step1: document.getElementById('step-1-customer'),
            step2: document.getElementById('step-2-pos'),
            step3: document.getElementById('step-3-payment'),

            // Step 1 Form
            custForm: document.getElementById('customerForm'),
            inpName: document.getElementById('cName'),
            inpPhone: document.getElementById('cPhone'),
            inpEmail: document.getElementById('cEmail'),
            inpAddress: document.getElementById('cAddress'),
            inpNotes: document.getElementById('cNotes'),
            selDeliveryOption: document.getElementById('cDeliveryOption'),
            inpDeliveryPartner: document.getElementById('cDeliveryPartner'),
            inpDeliveryPartnerPhone: document.getElementById('cDeliveryPartnerPhone'),
            lookupHint: document.getElementById('customerLookupHint'),
            deliveryPartnerFields: document.getElementById('deliveryPartnerFields'),

            errName: document.getElementById('errName'),
            errPhone: document.getElementById('errPhone'),
            errEmail: document.getElementById('errEmail'),
            errAddress: document.getElementById('errAddress'),

            // Step 2 Catalog
            catList: document.getElementById('categoryFilters'),
            searchInp: document.getElementById('posSearch'),
            prodGrid: document.getElementById('productGrid'),

            // Step 2 Cart Sidebar
            cartList: document.getElementById('cartItemsList'),
            subSpan: document.getElementById('subSpan'),
            discSpan: document.getElementById('discSpan'),
            totSpan: document.getElementById('totSpan'),
            btnCheckout: document.getElementById('btnCheckout'),

            // Step 2 Discount
            inpPromo: document.getElementById('promoCode'),
            btnPromo: document.getElementById('applyPromoBtn'),
            errPromo: document.getElementById('promoError'),
            promoInputBlock: document.getElementById('promoInputBlock'),
            promoAppliedTag: document.getElementById('promoAppliedTag'),
            promoAppliedCode: document.getElementById('promoAppliedCode'),
            btnRemovePromo: document.getElementById('removePromoBtn'),

            // Context Menu
            menu: document.getElementById('contextMenu'),

            // Step 3 Actions
            btnReset: document.getElementById('btnResetFlow')
        };
    }

    function sanitizePhone(value) {
        return String(value || '').replace(/\D/g, '').slice(0, 10);
    }

    function setLookupHint(type, text) {
        if (!el.lookupHint) return;
        el.lookupHint.className = 'text-sm';

        if (type === 'existing') {
            el.lookupHint.classList.add('lookup-existing');
        } else if (type === 'new') {
            el.lookupHint.classList.add('lookup-new');
        } else {
            el.lookupHint.classList.add('text-muted');
        }

        el.lookupHint.textContent = text;
    }

    function showStep(stepNum) {
        if (!el.step1 || !el.step2 || !el.step3) return;

        el.step1.classList.remove('active');
        el.step2.classList.remove('active');
        el.step3.classList.remove('active');

        if (stepNum === 1) el.step1.classList.add('active');
        if (stepNum === 2) el.step2.classList.add('active');
        if (stepNum === 3) el.step3.classList.add('active');
    }

    function toggleDeliveryFields() {
        if (!el.selDeliveryOption || !el.deliveryPartnerFields) return;
        const isDelivery = String(el.selDeliveryOption.value || 'pickup').toLowerCase() === 'delivery';
        el.deliveryPartnerFields.style.display = isDelivery ? 'block' : 'none';
        if (!isDelivery && el.errAddress) el.errAddress.textContent = '';
    }

    function applyCustomerProfile(profile) {
        if (!profile) return;

        if (el.inpName) el.inpName.value = String(profile.name || '').trim();
        if (el.inpEmail) el.inpEmail.value = String(profile.email || '').trim();
        if (el.inpAddress) el.inpAddress.value = String(profile.address || '').trim();
        if (el.inpNotes) el.inpNotes.value = String(profile.notes || '').trim();

        if (el.selDeliveryOption) {
            const option = String(profile.preferredDeliveryOption || 'pickup').toLowerCase();
            el.selDeliveryOption.value = option === 'delivery' ? 'delivery' : 'pickup';
        }

        if (el.inpDeliveryPartner) {
            el.inpDeliveryPartner.value = String(profile.deliveryPartner || '').trim();
        }
        if (el.inpDeliveryPartnerPhone) {
            el.inpDeliveryPartnerPhone.value = String(profile.deliveryPartnerPhone || '').trim();
        }

        toggleDeliveryFields();
    }

    function runCustomerLookup() {
        if (!el.inpPhone) return;
        const phone = sanitizePhone(el.inpPhone.value);
        el.inpPhone.value = phone;

        if (phone.length < 10) {
            currentCustomerProfile = null;
            setLookupHint('info', 'Enter a 10-digit phone number to check existing customer records.');
            return;
        }

        const profile = DataStore.getCustomerByPhone(phone);
        const hadExistingProfile = Boolean(currentCustomerProfile);
        currentCustomerProfile = profile;

        if (profile) {
            applyCustomerProfile(profile);
            setLookupHint('existing', `Existing customer found: ${profile.name}. Details auto-filled.`);
        } else {
            if (hadExistingProfile) {
                if (el.inpEmail) el.inpEmail.value = '';
                if (el.inpAddress) el.inpAddress.value = '';
                if (el.inpNotes) el.inpNotes.value = '';
                if (el.selDeliveryOption) el.selDeliveryOption.value = 'pickup';
                if (el.inpDeliveryPartner) el.inpDeliveryPartner.value = '';
                if (el.inpDeliveryPartnerPhone) el.inpDeliveryPartnerPhone.value = '';
                toggleDeliveryFields();
            }
            setLookupHint('new', 'No existing profile found. Creating a new customer record after checkout.');
        }
    }

    function getCustomerPayload() {
        return {
            name: String(el.inpName && el.inpName.value || '').trim(),
            phone: sanitizePhone(el.inpPhone && el.inpPhone.value || ''),
            email: String(el.inpEmail && el.inpEmail.value || '').trim(),
            address: String(el.inpAddress && el.inpAddress.value || '').trim(),
            notes: String(el.inpNotes && el.inpNotes.value || '').trim(),
            deliveryOption: String(el.selDeliveryOption && el.selDeliveryOption.value || 'pickup').toLowerCase(),
            deliveryPartner: String(el.inpDeliveryPartner && el.inpDeliveryPartner.value || '').trim(),
            deliveryPartnerPhone: String(el.inpDeliveryPartnerPhone && el.inpDeliveryPartnerPhone.value || '').trim(),
            isExistingCustomer: Boolean(currentCustomerProfile)
        };
    }

    function resetPOS() {
        if (el.inpName) el.inpName.value = '';
        if (el.inpPhone) el.inpPhone.value = '';
        if (el.inpEmail) el.inpEmail.value = '';
        if (el.inpAddress) el.inpAddress.value = '';
        if (el.inpNotes) el.inpNotes.value = '';
        if (el.selDeliveryOption) el.selDeliveryOption.value = 'pickup';
        if (el.inpDeliveryPartner) el.inpDeliveryPartner.value = '';
        if (el.inpDeliveryPartnerPhone) el.inpDeliveryPartnerPhone.value = '';

        if (el.errName) el.errName.textContent = '';
        if (el.errPhone) el.errPhone.textContent = '';
        if (el.errEmail) el.errEmail.textContent = '';
        if (el.errAddress) el.errAddress.textContent = '';

        currentCustomerProfile = null;
        toggleDeliveryFields();
        setLookupHint('info', 'Enter a 10-digit phone number to check existing customer records.');

        cart = [];
        currentDiscount = { active: false, discount: 0 };
        currentCategory = 'All';
        searchQuery = '';

        if (el.searchInp) el.searchInp.value = '';
        if (el.inpPromo) el.inpPromo.value = '';
        if (el.errPromo) el.errPromo.textContent = '';

        if (el.promoInputBlock) el.promoInputBlock.style.display = 'flex';
        if (el.promoAppliedTag) el.promoAppliedTag.style.display = 'none';
        if (el.promoAppliedCode) el.promoAppliedCode.textContent = '';

        showStep(1);
        renderCart();
        updateCartTotal();
    }

    function bindStep1() {
        if (!el.custForm) return;

        el.custForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const customerPayload = getCustomerPayload();
            const validation = Validator.validateCustomerStep(customerPayload);

            if (el.errName) el.errName.textContent = validation.errors.name || '';
            if (el.errPhone) el.errPhone.textContent = validation.errors.phone || '';
            if (el.errEmail) el.errEmail.textContent = validation.errors.email || '';
            if (el.errAddress) el.errAddress.textContent = validation.errors.address || '';

            if (validation.isValid) {
                renderCategories();
                renderCatalog();
                showStep(2);
            }
        });

        if (el.inpName) {
            el.inpName.addEventListener('input', () => {
                if (el.errName) el.errName.textContent = '';
            });
        }

        if (el.inpPhone) {
            el.inpPhone.addEventListener('input', () => {
                if (el.errPhone) el.errPhone.textContent = '';
                runCustomerLookup();
            });

            el.inpPhone.addEventListener('blur', runCustomerLookup);
        }

        if (el.inpEmail) {
            el.inpEmail.addEventListener('input', () => {
                if (el.errEmail) el.errEmail.textContent = '';
            });
        }

        if (el.inpAddress) {
            el.inpAddress.addEventListener('input', () => {
                if (el.errAddress) el.errAddress.textContent = '';
            });
        }

        if (el.selDeliveryOption) {
            el.selDeliveryOption.addEventListener('change', () => {
                toggleDeliveryFields();
                if (el.errAddress) el.errAddress.textContent = '';
            });
        }
    }

    function renderCategories() {
        const cats = DataStore.getCategories();
        if (!el.catList) return;
        el.catList.innerHTML = '';

        cats.forEach(c => {
            const btn = document.createElement('button');
            btn.className = `cat-btn ${c === currentCategory ? 'active' : ''}`;
            btn.textContent = c;
            btn.addEventListener('click', () => {
                currentCategory = c;
                document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                renderCatalog();
            });
            el.catList.appendChild(btn);
        });
    }

    function renderCatalog() {
        const products = DataStore.searchCatalog(searchQuery, currentCategory);
        if (!el.prodGrid) return;

        el.prodGrid.innerHTML = '';

        if (products.length === 0) {
            el.prodGrid.innerHTML = '<div class="empty-state">No products found.</div>';
            return;
        }

        products.forEach(p => {
            const card = document.createElement('div');
            card.className = 'prod-card';
            const defaultOpt = p.options[0];
            card.innerHTML = `
                <div class="prod-img">${p.image}</div>
                <div class="prod-info">
                    <div class="prod-name">${p.name} (${defaultOpt.label})</div>
                    <div class="prod-price">\u20B9${defaultOpt.price.toFixed(2)}</div>
                </div>
            `;

            card.addEventListener('click', (event) => {
                if (event.button === 0) addToCart(p);
            });

            card.addEventListener('contextmenu', (event) => {
                event.preventDefault();
                showContextMenu(event.pageX, event.pageY, p);
            });

            let pressTimer;
            card.addEventListener('touchstart', (event) => {
                pressTimer = window.setTimeout(() => {
                    const touch = event.touches[0];
                    showContextMenu(touch.pageX, touch.pageY, p);
                }, 600);
            });
            card.addEventListener('touchend', () => clearTimeout(pressTimer));
            card.addEventListener('touchmove', () => clearTimeout(pressTimer));

            el.prodGrid.appendChild(card);
        });
    }

    function showContextMenu(x, y, product) {
        if (!el.menu) return;
        el.menu.innerHTML = '';

        product.options.forEach(opt => {
            const item = document.createElement('div');
            item.className = 'context-menu-item';
            item.innerHTML = `
                <span class="cmi-label">${opt.label}</span>
                <span class="cmi-price">\u20B9${opt.price.toFixed(2)}</span>
            `;
            item.addEventListener('click', (event) => {
                event.stopPropagation();
                addToCart(product, opt);
                hideContextMenu();
            });
            el.menu.appendChild(item);
        });

        el.menu.style.display = 'block';
        el.menu.style.left = `${x}px`;
        el.menu.style.top = `${y}px`;

        const bounds = el.menu.getBoundingClientRect();
        if (x + bounds.width > window.innerWidth) el.menu.style.left = `${x - bounds.width}px`;
        if (y + bounds.height > window.innerHeight) el.menu.style.top = `${y - bounds.height}px`;
    }

    function hideContextMenu() {
        if (el.menu) el.menu.style.display = 'none';
    }

    function bindContextMenuGlobal() {
        document.addEventListener('click', () => hideContextMenu());
        window.addEventListener('scroll', () => hideContextMenu(), true);
    }

    function bindSearch() {
        if (!el.searchInp) return;
        el.searchInp.addEventListener('input', (event) => {
            searchQuery = event.target.value;
            renderCatalog();
        });
    }

    function addToCart(product, option) {
        const opt = option || product.options[0];
        const cartId = `${product.id}-${opt.label}`;
        const existing = cart.find(c => c.cartId === cartId);

        if (existing) {
            existing.qty += 1;
        } else {
            cart.push({
                cartId,
                id: product.id,
                name: `${product.name} (${opt.label})`,
                price: opt.price,
                qty: 1
            });
        }

        renderCart();
    }

    function updateCartQty(cartId, delta) {
        const item = cart.find(c => c.cartId === cartId);
        if (!item) return;

        item.qty += delta;
        if (item.qty <= 0) {
            cart = cart.filter(c => c.cartId !== cartId);
        }

        renderCart();
    }

    function renderCart() {
        if (!el.cartList || !el.btnCheckout) return;

        el.cartList.innerHTML = '';

        if (cart.length === 0) {
            el.cartList.innerHTML = '<div class="cart-empty text-muted">Cart is empty. Click items to add.</div>';
            el.btnCheckout.disabled = true;
        } else {
            el.btnCheckout.disabled = false;
        }

        cart.forEach(c => {
            const row = document.createElement('div');
            row.className = 'cart-item';
            row.innerHTML = `
                <div class="c-info">
                    <div class="c-name">${c.name}</div>
                    <div class="c-price">\u20B9${(c.price * c.qty).toFixed(2)}</div>
                </div>
                <div class="c-actions">
                    <button class="qty-btn dec" data-id="${c.cartId}">-</button>
                    <span>${c.qty}</span>
                    <button class="qty-btn inc" data-id="${c.cartId}">+</button>
                </div>
            `;
            el.cartList.appendChild(row);
        });

        document.querySelectorAll('.qty-btn').forEach(button => {
            button.addEventListener('click', (event) => {
                const id = event.target.getAttribute('data-id');
                const delta = event.target.classList.contains('inc') ? 1 : -1;
                updateCartQty(id, delta);
            });
        });

        updateCartTotal();
    }

    function bindPromo() {
        if (!el.btnPromo || !el.inpPromo || !el.errPromo) return;

        el.btnPromo.addEventListener('click', () => {
            const code = el.inpPromo.value.trim();
            if (!code) return;

            el.errPromo.textContent = '';

            if (cart.length === 0) {
                el.errPromo.textContent = 'Add items to the cart before applying a promo code.';
                return;
            }

            const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
            const res = DataStore.applyPromo(code, subtotal);

            if (res.active) {
                currentDiscount = res;
                if (el.promoInputBlock) el.promoInputBlock.style.display = 'none';
                if (el.promoAppliedTag) el.promoAppliedTag.style.display = 'flex';
                if (el.promoAppliedCode) el.promoAppliedCode.textContent = code.toUpperCase();
                updateCartTotal();
                return;
            }

            el.errPromo.textContent = res.error || 'Invalid Code';
            currentDiscount = { active: false, discount: 0 };
            updateCartTotal();
        });

        el.inpPromo.addEventListener('input', () => {
            el.errPromo.textContent = '';
        });

        if (el.btnRemovePromo) {
            el.btnRemovePromo.addEventListener('click', () => {
                currentDiscount = { active: false, discount: 0 };
                el.inpPromo.value = '';
                el.errPromo.textContent = '';
                if (el.promoAppliedTag) el.promoAppliedTag.style.display = 'none';
                if (el.promoInputBlock) el.promoInputBlock.style.display = 'flex';
                if (el.promoAppliedCode) el.promoAppliedCode.textContent = '';
                updateCartTotal();
            });
        }
    }

    function updateCartTotal() {
        const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

        if (currentDiscount.active) {
            const res = DataStore.applyPromo(currentDiscount.code, subtotal);
            currentDiscount = res;
        }

        const total = subtotal - currentDiscount.discount;

        if (el.subSpan) el.subSpan.textContent = `\u20B9${subtotal.toFixed(2)}`;
        if (el.discSpan) el.discSpan.textContent = `- \u20B9${currentDiscount.discount.toFixed(2)}`;
        if (el.totSpan) el.totSpan.textContent = `\u20B9${total.toFixed(2)}`;
    }

    function bindCheckout() {
        if (!el.btnCheckout || !el.btnReset) return;

        el.btnCheckout.addEventListener('click', () => {
            if (cart.length === 0) return;

            if (callbacks.onCheckout) {
                callbacks.onCheckout({
                    customer: getCustomerPayload(),
                    cart,
                    discount: currentDiscount
                });
            }

            showStep(3);
        });

        el.btnReset.addEventListener('click', () => {
            resetPOS();
        });
    }

    function init() {
        cacheElements();
        bindStep1();
        bindSearch();
        bindPromo();
        bindCheckout();
        bindContextMenuGlobal();
        toggleDeliveryFields();
        resetPOS();
    }

    return {
        init,
        setCallbacks: cbs => callbacks = { ...callbacks, ...cbs }
    };
})();
