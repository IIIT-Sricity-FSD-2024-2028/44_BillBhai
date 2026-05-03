/**
 * data.js - Core POS data store
 * Loads editable cashier catalog/promos from JSON and syncs POS orders into
 * the same local business datasets used by the admin dashboards.
 */

const DataStore = (() => {
    'use strict';

    const STORAGE_KEY = 'bb_pos_orders';
    const CUSTOMER_STORAGE_KEY = 'bb_pos_customers';
    const CUSTOMER_SESSION_NOTIFICATION_KEY = 'bb_customer_session_notifications';
    const CASHIER_DATA_PATH = 'data/cashier_data.json';
    const FETCH_TIMEOUT_MS = 7000;
    const LIVE_SYNC_KEY = 'bb_live_sync_event';
    const LIVE_SYNC_CHANNEL = 'bb_live_sync';
    const syncSourceId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const DEFAULT_CATALOG = [];
    const DEFAULT_PROMOS = {};
    const DEFAULT_CHECKOUT_SETTINGS = {
        deliveryCharge: 0
    };

    let catalog = clone(DEFAULT_CATALOG);
    let promos = { ...DEFAULT_PROMOS };
    let checkoutSettings = { ...DEFAULT_CHECKOUT_SETTINGS };
    let orders = [];
    let customers = {};

    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function mergeCatalogProducts(preferredRows, fallbackRows) {
        const map = new Map();
        (Array.isArray(fallbackRows) ? fallbackRows : []).forEach(item => {
            if (!item || typeof item !== 'object') return;
            const key = String(item.id || '').trim();
            if (!key) return;
            map.set(key, clone(item));
        });
        (Array.isArray(preferredRows) ? preferredRows : []).forEach(item => {
            if (!item || typeof item !== 'object') return;
            const key = String(item.id || '').trim();
            if (!key) return;
            map.set(key, { ...(map.get(key) || {}), ...clone(item) });
        });
        return Array.from(map.values());
    }

    function loadStoredValue(key, fallback, expectArray) {
        try {
            const raw = localStorage.getItem(key);
            if (!raw) return expectArray ? clone(fallback) : { ...fallback };
            const parsed = JSON.parse(raw);
            if (expectArray) return Array.isArray(parsed) ? parsed : clone(fallback);
            return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : { ...fallback };
        } catch (err) {
            return expectArray ? clone(fallback) : { ...fallback };
        }
    }

    function saveOrders() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
    }

    function normalizePhone(value) {
        return String(value || '').replace(/\D/g, '').slice(0, 10);
    }

    function normalizeRoleKey(role) {
        return String(role || '').toLowerCase().replace(/\s+/g, '');
    }

    function saveCustomers() {
        localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify(customers));
    }

    function getCustomerByPhone(phone) {
        const normalized = normalizePhone(phone);
        if (normalized.length !== 10) return null;
        if (!Object.prototype.hasOwnProperty.call(customers, normalized)) return null;
        return clone(customers[normalized]);
    }

    function upsertCustomerProfile(order) {
        const phone = normalizePhone(order && order.phone);
        if (phone.length !== 10) return;

        const existing = customers[phone] && typeof customers[phone] === 'object'
            ? customers[phone]
            : {};

        customers[phone] = {
            ...existing,
            phone,
            name: String(order && order.customer || existing.name || '').trim(),
            email: String(order && order.email || existing.email || '').trim(),
            address: String(order && order.address || existing.address || '').trim(),
            notes: String(order && order.notes || existing.notes || '').trim(),
            preferredDeliveryOption: String(order && order.deliveryOption || existing.preferredDeliveryOption || 'pickup').toLowerCase(),
            deliveryPartner: String(order && order.deliveryPartner || existing.deliveryPartner || '').trim(),
            deliveryPartnerPhone: String(order && order.deliveryPartnerPhone || existing.deliveryPartnerPhone || '').trim(),
            lastOrderId: String(order && order.id || existing.lastOrderId || '').trim(),
            lastOrderAt: String(order && order.date || existing.lastOrderAt || '').trim(),
            orderCount: Number(existing.orderCount || 0) + 1
        };
        saveCustomers();
    }

    function formatOrderMoment() {
        const now = new Date();
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        return `${now.getDate()} ${months[now.getMonth()]} ${hh}:${mm}`;
    }

    function appendCustomerSessionNotifications(order, businessContext) {
        const roleKey = normalizeRoleKey(localStorage.getItem('userRole'));
        if (roleKey !== 'customer') return;

        let notifications = [];
        try {
            const raw = sessionStorage.getItem(CUSTOMER_SESSION_NOTIFICATION_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                notifications = Array.isArray(parsed) ? parsed : [];
            }
        } catch (err) {
            notifications = [];
        }

        const timestamp = Date.now();
        const timeLabel = formatOrderMoment();
        const safeBusinessName = String(businessContext && businessContext.name || 'BillBhai').trim() || 'BillBhai';
        const nextNotifications = [
            {
                id: `customer-order-${order.id}`,
                category: 'orders',
                priority: 'medium',
                title: `${order.id} created`,
                desc: `Your self-checkout order at ${safeBusinessName} is set to ${order.checkoutMode === 'takeaway_now' ? 'take away now' : (order.checkoutMode === 'cod_delivery' ? 'cash on delivery' : 'prepaid delivery')}.`,
                time: timeLabel,
                sortTimeMs: timestamp,
                detailRows: [
                    { label: 'Business', value: safeBusinessName },
                    { label: 'Order', value: order.id },
                    { label: 'Customer', value: order.customer || '-' },
                    { label: 'Total', value: `Rs ${Math.max(0, Number(order.total || 0)).toLocaleString()}` },
                    { label: 'Delivery Option', value: order.deliveryOption || 'pickup' },
                    { label: 'Payment', value: order.paymentMethod || 'Pending' }
                ]
            },
            {
                id: `customer-payment-${order.id}`,
                category: 'payments',
                priority: 'high',
                title: `Payment pending for ${order.id}`,
                desc: order.paymentMethod === 'COD'
                    ? `Payment of Rs ${Math.max(0, Number(order.total || 0)).toLocaleString()} will be collected on delivery.`
                    : `Checkout mode recorded as ${order.paymentMethod || 'Pending'} for Rs ${Math.max(0, Number(order.total || 0)).toLocaleString()}.`,
                time: timeLabel,
                sortTimeMs: timestamp - 1,
                detailRows: [
                    { label: 'Order', value: order.id },
                    { label: 'Amount', value: `Rs ${Math.max(0, Number(order.total || 0)).toLocaleString()}` },
                    { label: 'Status', value: order.paymentMethod || 'Pending' }
                ]
            }
        ];

        if (String(order && order.deliveryOption || '').toLowerCase() === 'delivery') {
            nextNotifications.push({
                id: `customer-delivery-${order.id}`,
                category: 'delivery',
                priority: 'medium',
                title: `Delivery queued for ${order.id}`,
                desc: `${order.deliveryPartner || 'Store team'} will coordinate delivery to ${order.address || 'your saved address'}.`,
                time: timeLabel,
                sortTimeMs: timestamp - 2,
                detailRows: [
                    { label: 'Order', value: order.id },
                    { label: 'Delivery Partner', value: order.deliveryPartner || 'Pending assignment' },
                    { label: 'Partner Phone', value: order.deliveryPartnerPhone || '-' },
                    { label: 'Address', value: order.address || '-' }
                ]
            });
        }

        sessionStorage.setItem(
            CUSTOMER_SESSION_NOTIFICATION_KEY,
            JSON.stringify([...nextNotifications, ...notifications].slice(0, 25))
        );
    }

    function getNextDeliveryId(rows) {
        const numbers = (Array.isArray(rows) ? rows : [])
            .map(item => parseInt(String(item && item.id || '').replace(/[^\d]/g, ''), 10))
            .filter(num => Number.isFinite(num));
        const base = numbers.length ? Math.max(...numbers) + 1 : 901;
        return `DEL-${base}`;
    }

    function buildDeliveryRecord(order, existingRows) {
        if (String(order && order.deliveryOption || '').toLowerCase() !== 'delivery') return null;
        const formattedNow = formatOrderMoment();
        const hasPartner = String(order && order.deliveryPartner || '').trim().length > 0;

        return {
            id: getNextDeliveryId(existingRows),
            oid: String(order && order.id || '').trim(),
            customer: String(order && order.customer || '').trim(),
            address: String(order && order.address || 'Address to be confirmed').trim(),
            partner: String(order && order.deliveryPartner || '').trim(),
            partnerPhone: String(order && order.deliveryPartnerPhone || '').trim(),
            status: hasPartner ? 'In Transit' : 'Pending',
            etaMin: hasPartner ? 40 : null,
            time: formattedNow.slice(-5),
            updatedAt: formattedNow
        };
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

    async function loadCashierDataFromJson() {
        const parsed = await fetchJsonWithTimeout(CASHIER_DATA_PATH);
        if (!parsed || typeof parsed !== 'object') return;

        if (Array.isArray(parsed.catalog)) {
            catalog = mergeCatalogProducts(parsed.catalog, DEFAULT_CATALOG);
        }

        if (parsed.promos && typeof parsed.promos === 'object' && !Array.isArray(parsed.promos)) {
            promos = { ...parsed.promos };
        }

        if (parsed.settings && typeof parsed.settings === 'object' && !Array.isArray(parsed.settings)) {
            const parsedCharge = Number(parsed.settings.deliveryCharge);
            checkoutSettings = {
                ...DEFAULT_CHECKOUT_SETTINGS,
                ...parsed.settings,
                deliveryCharge: Number.isFinite(parsedCharge) && parsedCharge > 0 ? parsedCharge : 0
            };
        }
    }

    async function loadProductsFromBackend() {
        try {
            const userRole = localStorage.getItem('userRole') || 'cashier';
            const response = await fetch('http://localhost:3000/api/products', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'x-role': userRole
                }
            });

            if (!response.ok) {
                console.warn('Failed to load products from backend, falling back to JSON');
                await loadCashierDataFromJson();
                return;
            }

            const products = await response.json();
            if (Array.isArray(products)) {
                catalog = products.map((p) => ({
                    id: p.id,
                    name: p.name,
                    category: p.category,
                    price: p.price,
                    barcode: p.barcode,
                    size: p.size,
                    description: p.description,
                    image: `images/${p.id}.png`
                }));
                return;
            }

            await loadCashierDataFromJson();
        } catch (error) {
            console.error('Error loading products from backend:', error);
            await loadCashierDataFromJson();
        }
    }

    function resolveBusinessContext() {
        const fallbackId = 'BIZ-101';
        const currentScopedId = String(localStorage.getItem('activeBusinessId') || '').trim();
        const currentScopedName = String(localStorage.getItem('activeBusinessName') || '').trim();
        const businesses = loadStoredValue('bb_businesses', [], true);
        const normalizedBusinesses = businesses.filter(item => item && typeof item === 'object');
        const validCurrent = currentScopedId && normalizedBusinesses.find(item => String(item.id || '').trim() === currentScopedId);
        const fallbackBusiness = normalizedBusinesses[0] || { id: fallbackId, name: 'FreshKart Central' };
        const activeBusiness = validCurrent || fallbackBusiness;

        return {
            id: String(activeBusiness.id || currentScopedId || fallbackId).trim() || fallbackId,
            name: String(activeBusiness.name || currentScopedName || 'FreshKart Central').trim() || 'FreshKart Central'
        };
    }

    function normalizeInventoryStatus(stockValue) {
        const stock = Math.max(0, Number(stockValue) || 0);
        if (stock <= 0) return 'Out of Stock';
        if (stock <= 10) return 'Critical';
        if (stock <= 30) return 'Low Stock';
        return 'In Stock';
    }

    function publishDataSync(domains, businessId) {
        const payload = {
            sourceId: syncSourceId,
            at: new Date().toISOString(),
            businessId: String(businessId || '').trim(),
            domains: Array.isArray(domains) ? domains : []
        };

        try {
            localStorage.setItem(LIVE_SYNC_KEY, JSON.stringify(payload));
        } catch (err) {
            // localStorage sync is best-effort only.
        }

        try {
            const channel = new BroadcastChannel(LIVE_SYNC_CHANNEL);
            channel.postMessage(payload);
            channel.close();
        } catch (err) {
            // BroadcastChannel is optional in older browsers.
        }
    }

    function buildOperationalOrder(order, cartItems) {
        return {
            id: order.id,
            customer: order.customer,
            items: cartItems.reduce((sum, item) => sum + (Math.max(1, Number(item.qty) || 1)), 0),
            total: order.total,
            payment: order.paymentMethod || 'Pending',
            status: order.status || 'Processing',
            date: order.date
        };
    }

    function applyInventoryAdjustments(inventoryRows, cartItems) {
        if (!Array.isArray(inventoryRows)) return;

        cartItems.forEach(item => {
            const baseName = String(item && item.name || '').split(' (')[0].trim().toLowerCase();
            if (!baseName) return;

            const inventoryItem = inventoryRows.find(row => String(row && row.name || '').trim().toLowerCase() === baseName);
            if (!inventoryItem) return;

            const qty = Math.max(1, Number(item && item.qty) || 1);
            inventoryItem.stock = Math.max(0, Number(inventoryItem.stock || 0) - qty);
            inventoryItem.status = normalizeInventoryStatus(inventoryItem.stock);
        });
    }

    function syncScopedOperationalData(order, cartItems) {
        const businessContext = resolveBusinessContext();
        const operationalStore = loadStoredValue('bb_business_data', {}, false);
        const scoped = operationalStore[businessContext.id] && typeof operationalStore[businessContext.id] === 'object'
            ? operationalStore[businessContext.id]
            : { orders: [], inventory: [], deliveries: [], returns: [], users: [] };

        const scopedOrders = Array.isArray(scoped.orders) ? scoped.orders : [];
        const scopedInventory = Array.isArray(scoped.inventory) ? scoped.inventory : [];
        const scopedDeliveries = Array.isArray(scoped.deliveries) ? scoped.deliveries : [];

        scopedOrders.unshift(buildOperationalOrder(order, cartItems));
        applyInventoryAdjustments(scopedInventory, cartItems);
        const deliveryRecord = buildDeliveryRecord(order, scopedDeliveries);
        if (deliveryRecord) scopedDeliveries.unshift(deliveryRecord);

        operationalStore[businessContext.id] = {
            ...scoped,
            orders: scopedOrders,
            inventory: scopedInventory,
            deliveries: scopedDeliveries
        };

        localStorage.setItem('bb_business_data', JSON.stringify(operationalStore));
        localStorage.setItem('activeBusinessId', businessContext.id);
        localStorage.setItem('activeBusinessName', businessContext.name);
        publishDataSync(['orders', 'inventory', 'deliveries'], businessContext.id);
    }

    function syncTopLevelFallback(order, cartItems) {
        const storedOrders = loadStoredValue('bb_orders', [], true);
        const storedInventory = loadStoredValue('bb_inventory', [], true);
        const storedDeliveries = loadStoredValue('bb_deliveries', [], true);

        storedOrders.unshift(buildOperationalOrder(order, cartItems));
        applyInventoryAdjustments(storedInventory, cartItems);
        const deliveryRecord = buildDeliveryRecord(order, storedDeliveries);
        if (deliveryRecord) storedDeliveries.unshift(deliveryRecord);

        localStorage.setItem('bb_orders', JSON.stringify(storedOrders));
        localStorage.setItem('bb_inventory', JSON.stringify(storedInventory));
        localStorage.setItem('bb_deliveries', JSON.stringify(storedDeliveries));
        publishDataSync(['orders', 'inventory', 'deliveries'], '');
    }

    function syncOperationalData(order, cartItems) {
        const businessContext = resolveBusinessContext();
        if (businessContext.id) {
            syncScopedOperationalData(order, cartItems);
        } else {
            syncTopLevelFallback(order, cartItems);
        }
    }

    async function init() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) orders = parsed;
            }
        } catch (err) {
            orders = [];
        }

        try {
            const rawCustomers = localStorage.getItem(CUSTOMER_STORAGE_KEY);
            if (rawCustomers) {
                const parsedCustomers = JSON.parse(rawCustomers);
                if (parsedCustomers && typeof parsedCustomers === 'object' && !Array.isArray(parsedCustomers)) {
                    customers = parsedCustomers;
                }
            }
        } catch (err) {
            customers = {};
        }

        await loadProductsFromBackend();
    }

    function getCategories() {
        const categories = new Set(catalog.map(product => product.category));
        return ['All', ...Array.from(categories)];
    }

    function searchCatalog(query, category) {
        let results = catalog;
        if (category && category !== 'All') {
            results = results.filter(product => product.category === category);
        }
        if (query) {
            const normalizedQuery = query.toLowerCase();
            results = results.filter(product =>
                String(product.name || '').toLowerCase().includes(normalizedQuery) ||
                String(product.category || '').toLowerCase().includes(normalizedQuery)
            );
        }
        return results;
    }

    function applyPromo(code, subtotal) {
        if (!code) return { active: false, discount: 0 };
        const upper = code.trim().toUpperCase();
        if (!promos[upper]) return { active: false, discount: 0, error: 'Invalid code' };

        const promo = promos[upper];
        let discount = 0;
        if (promo.type === 'percent') {
            discount = (subtotal * promo.value) / 100;
        } else if (promo.type === 'fixed') {
            discount = promo.value;
        }

        if (discount > subtotal) discount = subtotal;
        return { active: true, code: upper, discount };
    }

    function generateId() {
        return 'ORD-' + (orders.length + 5001 + Date.now().toString().slice(-3));
    }

    function createOrder(customerData, cartItems, discountApplied) {
        const businessContext = resolveBusinessContext();
        const checkoutMode = String(customerData && customerData.checkoutMode || '').trim().toLowerCase();
        const deliveryOption = checkoutMode === 'prepaid_delivery' || checkoutMode === 'cod_delivery'
            ? 'delivery'
            : (String(customerData && customerData.deliveryOption || 'pickup').toLowerCase() === 'delivery' ? 'delivery' : 'pickup');
        const requestedDeliveryCharge = Math.max(0, Number(customerData && customerData.deliveryCharge || 0));
        const deliveryCharge = deliveryOption === 'delivery' ? requestedDeliveryCharge : 0;
        const paymentMethod = checkoutMode === 'prepaid_delivery'
            ? 'Paid Upfront'
            : (checkoutMode === 'cod_delivery' ? 'COD' : (String(customerData && customerData.paymentMethod || 'Counter Paid').trim() || 'Counter Paid'));
        const orderStatus = checkoutMode === 'takeaway_now'
            ? 'Delivered'
            : (String(customerData && customerData.orderStatus || 'Processing').trim() || 'Processing');
        const order = {
            id: generateId(),
            customer: String(customerData && customerData.name || '').trim(),
            phone: normalizePhone(customerData && customerData.phone || ''),
            email: String(customerData && customerData.email || '').trim(),
            address: String(customerData && customerData.address || '').trim(),
            notes: String(customerData && customerData.notes || '').trim(),
            checkoutMode: checkoutMode || (deliveryOption === 'delivery' ? 'prepaid_delivery' : 'takeaway_now'),
            deliveryOption,
            deliveryPartner: String(customerData && customerData.deliveryPartner || '').trim(),
            deliveryPartnerPhone: String(customerData && customerData.deliveryPartnerPhone || '').trim(),
            items: cartItems.map(item => ({
                id: item.id,
                name: item.name,
                price: item.price,
                qty: item.qty
            })),
            subtotal: cartItems.reduce((sum, item) => sum + (item.price * item.qty), 0),
            discount: discountApplied.active ? discountApplied.discount : 0,
            deliveryCharge,
            promoCode: discountApplied.active ? discountApplied.code : null,
            total: 0,
            status: orderStatus,
            paymentMethod,
            date: new Date().toISOString()
        };

        if (deliveryOption !== 'delivery') {
            order.deliveryPartner = '';
            order.deliveryPartnerPhone = '';
        }

        order.total = Math.max(0, order.subtotal - order.discount + order.deliveryCharge);
        orders.unshift(order);
        saveOrders();
        upsertCustomerProfile(order);
        syncOperationalData(order, cartItems);
        appendCustomerSessionNotifications(order, businessContext);
        return order;
    }

    function getSessionContext() {
        const businessContext = resolveBusinessContext();
        const roleKey = normalizeRoleKey(localStorage.getItem('userRole') || 'cashier') || 'cashier';
        const isCustomerTerminal = roleKey === 'customer';
        const storedName = String(localStorage.getItem('userName') || '').trim();
        return {
            businessId: businessContext.id,
            businessName: businessContext.name,
            userName: storedName || (isCustomerTerminal ? 'Self Checkout' : 'Cashier'),
            roleKey,
            roleLabel: isCustomerTerminal ? 'Self Checkout' : (String(localStorage.getItem('userRole') || 'Cashier').trim() || 'Cashier'),
            isCustomerTerminal
        };
    }

    return {
        init,
        getCategories,
        searchCatalog,
        applyPromo,
        getCheckoutSettings: () => ({ ...checkoutSettings }),
        getCustomerByPhone,
        createOrder,
        getSessionContext
    };
})();
