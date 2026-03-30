/**
 * data.js - Core POS data store
 * Loads editable cashier catalog/promos from JSON and syncs POS orders into
 * the same local business datasets used by the admin dashboards.
 */

const DataStore = (() => {
    'use strict';

    const STORAGE_KEY = 'bb_pos_orders';
    const CUSTOMER_STORAGE_KEY = 'bb_pos_customers';
    const CASHIER_DATA_PATH = 'data/cashier_data.json';
    const LIVE_SYNC_KEY = 'bb_live_sync_event';
    const LIVE_SYNC_CHANNEL = 'bb_live_sync';
    const syncSourceId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const DEFAULT_CATALOG = [
        { id: 'P001', name: 'Basmati Rice', category: 'Groceries', image: '🍚', options: [{ label: '1kg', price: 85 }, { label: '2kg', price: 160 }, { label: '5kg', price: 380 }] },
        { id: 'P002', name: 'Toor Dal', category: 'Groceries', image: '🫘', options: [{ label: '500g', price: 65 }, { label: '1kg', price: 120 }, { label: '2kg', price: 230 }] },
        { id: 'P003', name: 'Refined Oil', category: 'Groceries', image: '🛢️', options: [{ label: '500ml', price: 80 }, { label: '1L', price: 155 }, { label: '5L', price: 750 }] },
        { id: 'P004', name: 'Amul Butter', category: 'Dairy', image: '🧈', options: [{ label: '100g', price: 60 }, { label: '500g', price: 275 }] },
        { id: 'P005', name: 'Milk', category: 'Dairy', image: '🥛', options: [{ label: '500ml', price: 32 }, { label: '1L', price: 60 }] },
        { id: 'P006', name: 'Bread Loaf', category: 'Snacks', image: '🍞', options: [{ label: 'Regular', price: 45 }, { label: 'Family Pack', price: 80 }] },
        { id: 'P007', name: 'Maggi Noodles', category: 'Snacks', image: '🍜', options: [{ label: 'Single', price: 14 }, { label: 'Pack of 4', price: 54 }, { label: 'Pack of 12', price: 168 }] },
        { id: 'P008', name: 'Tea Powder', category: 'Beverages', image: '🍵', options: [{ label: '250g', price: 160 }, { label: '500g', price: 310 }] },
        { id: 'P009', name: 'Coffee Jar', category: 'Beverages', image: '☕', options: [{ label: '50g', price: 95 }, { label: '100g', price: 180 }] }
    ];

    const DEFAULT_PROMOS = {
        WELCOME10: { type: 'percent', value: 10 },
        FLAT50: { type: 'fixed', value: 50 }
    };

    let catalog = clone(DEFAULT_CATALOG);
    let promos = { ...DEFAULT_PROMOS };
    let orders = [];
    let customers = {};

    function clone(value) {
        return JSON.parse(JSON.stringify(value));
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

    async function loadCashierDataFromJson() {
        try {
            const response = await fetch(CASHIER_DATA_PATH, { cache: 'no-store' });
            if (!response.ok) return;

            const parsed = await response.json();
            if (!parsed || typeof parsed !== 'object') return;

            if (Array.isArray(parsed.catalog) && parsed.catalog.length) {
                catalog = clone(parsed.catalog);
            }

            if (parsed.promos && typeof parsed.promos === 'object' && !Array.isArray(parsed.promos)) {
                promos = { ...parsed.promos };
            }
        } catch (err) {
            // Keep fallback defaults when JSON is unavailable.
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

        await loadCashierDataFromJson();
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
        const deliveryOption = String(customerData && customerData.deliveryOption || 'pickup').toLowerCase() === 'delivery'
            ? 'delivery'
            : 'pickup';
        const order = {
            id: generateId(),
            customer: String(customerData && customerData.name || '').trim(),
            phone: normalizePhone(customerData && customerData.phone || ''),
            email: String(customerData && customerData.email || '').trim(),
            address: String(customerData && customerData.address || '').trim(),
            notes: String(customerData && customerData.notes || '').trim(),
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
            promoCode: discountApplied.active ? discountApplied.code : null,
            total: 0,
            status: 'Processing',
            paymentMethod: 'Pending',
            date: new Date().toISOString()
        };

        if (deliveryOption !== 'delivery') {
            order.deliveryPartner = '';
            order.deliveryPartnerPhone = '';
        }

        order.total = order.subtotal - order.discount;
        orders.unshift(order);
        saveOrders();
        upsertCustomerProfile(order);
        syncOperationalData(order, cartItems);
        return order;
    }

    function getSessionContext() {
        const businessContext = resolveBusinessContext();
        return {
            businessId: businessContext.id,
            businessName: businessContext.name,
            userName: String(localStorage.getItem('userName') || 'Cashier').trim() || 'Cashier'
        };
    }

    return {
        init,
        getCategories,
        searchCatalog,
        applyPromo,
        getCustomerByPhone,
        createOrder,
        getSessionContext
    };
})();
