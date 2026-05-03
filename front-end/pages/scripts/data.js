/**
 * data.js - Core POS data store
 * Loads POS catalog from backend and keeps transient session state in-memory.
 */

const DataStore = (() => {
    'use strict';

    const CUSTOMER_SESSION_NOTIFICATION_KEY = 'bb_customer_session_notifications';
    const LIVE_SYNC_KEY = 'bb_live_sync';
    const LIVE_SYNC_CHANNEL = 'bb_live_sync_channel';
    const syncSourceId = (() => {
        try {
            return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
                ? crypto.randomUUID()
                : `sync-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        } catch (error) {
            return `sync-${Date.now()}`;
        }
    })();

    const DEFAULT_CATALOG = [];
    const DEFAULT_CHECKOUT_SETTINGS = {
        deliveryCharge: 0
    };

    let catalog = clone(DEFAULT_CATALOG);
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

    function saveOrders() {
        try {
            localStorage.setItem('bb_pos_orders', JSON.stringify(Array.isArray(orders) ? orders : []));
        } catch (error) {}
    }

    function loadStoredValue(key, fallbackValue, parseJson) {
        try {
            const raw = localStorage.getItem(key);
            if (!raw) return clone(fallbackValue);
            if (!parseJson) return raw;
            const parsed = JSON.parse(raw);
            return parsed === null || parsed === undefined ? clone(fallbackValue) : parsed;
        } catch (error) {
            return clone(fallbackValue);
        }
    }

    function normalizePhone(value) {
        return String(value || '').replace(/\D/g, '').slice(0, 10);
    }

    function normalizeRoleKey(role) {
        return String(role || '').toLowerCase().replace(/\s+/g, '');
    }

    function saveCustomers() {
        try {
            localStorage.setItem('bb_pos_customers', JSON.stringify(customers && typeof customers === 'object' ? customers : {}));
        } catch (error) {}
    }

    function mapBackendCustomersToLookup(rows) {
        const next = {};
        (Array.isArray(rows) ? rows : []).forEach((row) => {
            const phone = normalizePhone(row && row.mobileNo);
            if (phone.length !== 10) return;
            next[phone] = {
                id: String(row && row.id || '').trim(),
                phone,
                name: String(row && row.name || '').trim(),
                email: String(row && row.email || '').trim(),
                address: String(row && row.address || '').trim(),
                notes: '',
                preferredDeliveryOption: 'pickup',
                deliveryPartner: '',
                deliveryPartnerPhone: '',
                lastOrderId: '',
                lastOrderAt: '',
                orderCount: Number((customers[phone] && customers[phone].orderCount) || 0)
            };
        });
        return next;
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
            id: String(order && (order.customerId || order.backendCustomerId || order.id) || existing.id || '').trim(),
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

    async function loadProductsFromBackend() {
        const userRole = localStorage.getItem('userRole') || 'cashier';
        const response = await fetch('http://localhost:3000/api/products', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'x-role': userRole
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to load products from backend (HTTP ${response.status})`);
        }

        const products = await response.json();
        if (!Array.isArray(products)) {
            throw new Error('Products response is not an array');
        }

        catalog = products.map((p) => ({
            id: p.id,
            name: p.name,
            category: p.category,
            price: p.price,
            barcode: p.barcode,
            size: p.size,
            description: p.description,
            image: p.image || `images/${p.id}.png`,
            options: Array.isArray(p.options) && p.options.length
                ? p.options.map((opt) => ({
                    label: String(opt && opt.label || opt && opt.size || p.size || 'Unit').trim() || 'Unit',
                    price: Number(opt && opt.price)
                })).filter((opt) => Number.isFinite(opt.price) && opt.price >= 0)
                : [{
                    label: String(p.size || 'Unit').trim() || 'Unit',
                    price: Number(p.price)
                }]
        }));
        catalog = catalog.filter((item) =>
            item &&
            Array.isArray(item.options) &&
            item.options.length > 0 &&
            Number.isFinite(Number(item.options[0].price))
        );

        if (!catalog.length) {
            throw new Error('No valid products returned by backend');
        }
    }

    async function loadCustomersFromBackend() {
        const userRole = localStorage.getItem('userRole') || 'cashier';
        const companyId = String(localStorage.getItem('activeBusinessId') || 'BIZ-101').trim() || 'BIZ-101';
        const response = await fetch(`http://localhost:3000/api/customers?companyId=${encodeURIComponent(companyId)}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'x-role': userRole
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to load customers from backend (HTTP ${response.status})`);
        }

        const rows = await response.json();
        const backendCustomers = mapBackendCustomersToLookup(rows);
        customers = { ...customers, ...backendCustomers };
        saveCustomers();
    }

    function resolveBusinessContext() {
        const fallbackId = 'BIZ-101';
        const currentScopedId = String(localStorage.getItem('activeBusinessId') || '').trim();
        const currentScopedName = String(localStorage.getItem('activeBusinessName') || '').trim();
        return {
            id: currentScopedId || fallbackId,
            name: currentScopedName || 'FreshKart Central'
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
            companyId: String(order.companyId || '').trim(),
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
        const operationalStore = loadStoredValue('bb_business_data', {}, true);
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
        orders = loadStoredValue('bb_pos_orders', [], true);
        customers = loadStoredValue('bb_pos_customers', {}, true);

        await loadProductsFromBackend();
        try {
            await loadCustomersFromBackend();
        } catch (error) {
            // Backend customer preload is best-effort; cached customers still work.
        }
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

    async function applyPromo(code, subtotal) {
        const upper = String(code || '').trim().toUpperCase();
        const safeSubtotal = Math.max(0, Number(subtotal) || 0);
        if (!upper) return { active: false, discount: 0, error: 'Enter a promo code.' };

        try {
            const role = localStorage.getItem('userRole') || 'cashier';
            const response = await fetch('http://localhost:3000/api/orders/promotions/validate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-role': role
                },
                body: JSON.stringify({ code: upper, subtotal: safeSubtotal })
            });
            const payload = await response.json();
            if (!response.ok || !payload || !payload.valid) {
                return { active: false, discount: 0, error: 'Invalid code' };
            }
            return {
                active: true,
                code: upper,
                discount: Math.max(0, Number(payload.discount) || 0)
            };
        } catch (error) {
            return { active: false, discount: 0, error: 'Promo validation failed.' };
        }
    }

    function generateId() {
        return 'ORD-' + (orders.length + 5001 + Date.now().toString().slice(-3));
    }

    function createOrder(customerData, cartItems, discountApplied, options) {
        const opts = options && typeof options === 'object' ? options : {};
        const backendOrder = opts.backendOrder && typeof opts.backendOrder === 'object' ? opts.backendOrder : null;
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
        const backendItems = Array.isArray(backendOrder && backendOrder.items) ? backendOrder.items : [];
        const backendItemCount = backendItems.reduce((sum, item) => sum + Math.max(0, Number(item && item.quantity || 0)), 0);
        const itemCount = backendItemCount || cartItems.reduce((sum, item) => sum + (Math.max(1, Number(item.qty) || 1)), 0);
        const order = {
            id: String(backendOrder && backendOrder.id || generateId()).trim(),
            companyId: String(backendOrder && backendOrder.companyId || businessContext.id).trim(),
            customerId: String(opts.customerId || (backendOrder && (backendOrder.customerId || backendOrder.customer)) || (customerData && customerData.id) || '').trim(),
            customer: String((backendOrder && (backendOrder.customerName || backendOrder.customer)) || (customerData && customerData.name) || '').trim(),
            phone: normalizePhone((backendOrder && (backendOrder.customerPhone || backendOrder.mobileNo)) || (customerData && customerData.phone) || ''),
            email: String((backendOrder && backendOrder.customerEmail) || (customerData && customerData.email) || '').trim(),
            address: String((backendOrder && (backendOrder.customerAddress || backendOrder.address)) || (customerData && customerData.address) || '').trim(),
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
            status: String(backendOrder && backendOrder.status || orderStatus).trim() || orderStatus,
            paymentMethod,
            date: String(backendOrder && backendOrder.orderDate || new Date().toISOString()).trim()
        };

        if (deliveryOption !== 'delivery') {
            order.deliveryPartner = '';
            order.deliveryPartnerPhone = '';
        }

        const computedTotal = Math.max(0, order.subtotal - order.discount + order.deliveryCharge);
        order.total = Math.max(0, Number(backendOrder && backendOrder.total || computedTotal));
        order.itemsCount = itemCount;
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
