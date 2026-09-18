// Constants ported verbatim from html-ref/scripts/dashboard.js.

export const ROLE_LABELS = {
  superuser: 'Super User',
  admin: 'Admin',
  cashier: 'Cashier',
  returnhandler: 'Return Handler',
  inventorymanager: 'Inventory Manager',
  deliveryops: 'Delivery Ops',
  customer: 'Customer',
};

export const ROLE_ALLOWED_PAGES = {
  superuser: ['superuser', 'businesses', 'dashboard', 'orders', 'inventory', 'delivery', 'returns', 'reports', 'users', 'profile', 'notifications', 'cashier'],
  admin: ['dashboard', 'orders', 'inventory', 'delivery', 'returns', 'reports', 'users', 'profile', 'notifications', 'cashier'],
  cashier: ['cashier', 'dashboard', 'orders', 'reports', 'profile', 'notifications'],
  returnhandler: ['dashboard', 'returns', 'orders', 'reports', 'profile', 'notifications'],
  inventorymanager: ['dashboard', 'inventory', 'reports', 'profile', 'notifications'],
  deliveryops: ['dashboard', 'delivery', 'reports', 'profile', 'notifications'],
  customer: ['cashier', 'profile', 'reports', 'notifications'],
};

export const ROLE_ACTIONS = {
  superuser: { orders: true, inventory: true, users: true, returns: true, delivery: true, businesses: true },
  admin: { orders: true, inventory: true, users: true, returns: true, delivery: true, businesses: false },
  cashier: { orders: true, inventory: false, users: false, returns: false, delivery: false, businesses: false },
  returnhandler: { orders: false, inventory: false, users: false, returns: true, delivery: false, businesses: false },
  inventorymanager: { orders: false, inventory: true, users: false, returns: false, delivery: false, businesses: false },
  deliveryops: { orders: false, inventory: false, users: false, returns: false, delivery: true, businesses: false },
  customer: { orders: false, inventory: false, users: false, returns: false, delivery: false, businesses: false },
};

// ── 3-Tier SaaS Revenue Model ─────────────────────────────────────
export const PLAN_DEFINITIONS = {
  starter: {
    key: 'starter',
    name: 'Starter Plan (Free)',
    badgeClass: 'badge-plan-starter',
    price: 0,
    limits: { maxUsers: 2, maxProducts: 300, maxStores: 1, maxInvoices: 500 },
    features: { pos: true, receipts: true, basicReports: true, delivery: false, returns: false, discounts: false, selfCheckout: false },
  },
  pro: {
    key: 'pro',
    name: 'Growth / Pro Plan',
    badgeClass: 'badge-plan-pro',
    price: 1999,
    limits: { maxUsers: 10, maxProducts: 5000, maxStores: 3, maxInvoices: Infinity },
    features: { pos: true, receipts: true, basicReports: true, delivery: true, returns: true, discounts: true, selfCheckout: false },
  },
  enterprise: {
    key: 'enterprise',
    name: 'Enterprise Plan',
    badgeClass: 'badge-plan-enterprise',
    price: 4999,
    limits: { maxUsers: Infinity, maxProducts: Infinity, maxStores: Infinity, maxInvoices: Infinity },
    features: { pos: true, receipts: true, basicReports: true, delivery: true, returns: true, discounts: true, selfCheckout: true },
  },
};

// Storage / sync keys
export const LIVE_SYNC_KEY = 'bb_live_sync_event';
export const LIVE_SYNC_CHANNEL = 'bb_live_sync';
export const FETCH_TIMEOUT_MS = 7000;
export const NOTIFICATION_STATE_STORAGE_KEY = 'bb_notification_state';
export const NOTIFICATIONS_STORAGE_KEY = 'bb_notifications';
export const PROFILE_SETTINGS_STORAGE_KEY = 'bb_profile_settings';
export const AUTH_OVERRIDE_STORAGE_KEY = 'bb_auth_overrides';
export const CUSTOMER_SESSION_NOTIFICATION_KEY = 'bb_customer_session_notifications';

// startApp() wipes these before loading from the backend (backend-only mode).
export const OPERATIONAL_STORAGE_KEYS = ['bb_orders', 'bb_inventory', 'bb_deliveries', 'bb_returns', 'bb_users', 'bb_business_data', 'bb_businesses'];

export const NOTIFICATION_CATEGORY_LABELS = {
  orders: 'Order Alerts',
  payments: 'Payment Alerts',
  inventory: 'Inventory Alerts',
  delivery: 'Delivery Alerts',
  returns: 'Return Alerts',
  users: 'User Alerts',
  businesses: 'Business Alerts',
  summary: 'Summary Alerts',
};

export const ROLE_NOTIFICATION_CONFIG = {
  superuser: [
    { key: 'businesses', label: 'Business Alerts', defaultEnabled: true },
    { key: 'payments', label: 'Payment Alerts', defaultEnabled: true },
    { key: 'users', label: 'User Alerts', defaultEnabled: true },
    { key: 'orders', label: 'Order Alerts', defaultEnabled: true },
    { key: 'inventory', label: 'Inventory Alerts', defaultEnabled: true },
    { key: 'delivery', label: 'Delivery Alerts', defaultEnabled: true },
    { key: 'returns', label: 'Return Alerts', defaultEnabled: true },
    { key: 'summary', label: 'Summary Digest', defaultEnabled: false },
  ],
  admin: [
    { key: 'orders', label: 'Order Alerts', defaultEnabled: true },
    { key: 'payments', label: 'Payment Alerts', defaultEnabled: true },
    { key: 'inventory', label: 'Inventory Alerts', defaultEnabled: true },
    { key: 'delivery', label: 'Delivery Alerts', defaultEnabled: true },
    { key: 'returns', label: 'Return Alerts', defaultEnabled: true },
    { key: 'users', label: 'User Alerts', defaultEnabled: true },
    { key: 'summary', label: 'Summary Digest', defaultEnabled: false },
  ],
  cashier: [
    { key: 'orders', label: 'Order Alerts', defaultEnabled: true },
    { key: 'payments', label: 'Payment Alerts', defaultEnabled: true },
    { key: 'returns', label: 'Return Updates', defaultEnabled: true },
  ],
  inventorymanager: [
    { key: 'inventory', label: 'Inventory Alerts', defaultEnabled: true },
    { key: 'summary', label: 'Daily Summary', defaultEnabled: false },
  ],
  deliveryops: [
    { key: 'delivery', label: 'Delivery Alerts', defaultEnabled: true },
    { key: 'summary', label: 'Queue Summary', defaultEnabled: false },
  ],
  returnhandler: [
    { key: 'returns', label: 'Return Alerts', defaultEnabled: true },
    { key: 'summary', label: 'Desk Summary', defaultEnabled: false },
  ],
  customer: [
    { key: 'orders', label: 'Order Alerts', defaultEnabled: true },
    { key: 'payments', label: 'Payment Alerts', defaultEnabled: true },
    { key: 'delivery', label: 'Delivery Alerts', defaultEnabled: true },
  ],
};

export const API_BASE_URL = 'http://localhost:4000/api';
export const API_BASE_CANDIDATES = ['http://localhost:4000/api', 'http://127.0.0.1:4000/api', '/api'];

export const DELIVERY_PARTNER_DIRECTORY = {
  'Rajesh K.': { phone: '+91 98214 44770', agency: 'SwiftDrop Logistics', vehicle: 'Bike', coverage: 'MG Road - Sector 20' },
  'Sunil M.': { phone: '+91 98104 31852', agency: 'Metro Last Mile', vehicle: 'Bike', coverage: 'Green Park - Civil Lines' },
  'Deepak R.': { phone: '+91 98739 22815', agency: 'RapidX Couriers', vehicle: 'Bike', coverage: 'Industrial Area - Lake View' },
  'Rider Team A': { phone: '+91 80109 42021', agency: 'Fleet Hub A', vehicle: 'Shared Rider Pool', coverage: 'Central Zone' },
  'Rider Team B': { phone: '+91 80109 42022', agency: 'Fleet Hub B', vehicle: 'Shared Rider Pool', coverage: 'North Zone' },
  'Rider Team C': { phone: '+91 80109 42023', agency: 'Fleet Hub C', vehicle: 'Shared Rider Pool', coverage: 'South Zone' },
};

export const SUPPLIER_DIRECTORY = {
  'Agarwal Traders': { contact: 'Sanjay Agarwal', phone: '+91 98115 44101', email: 'sanjay@agarwaltraders.in', leadTimeDays: 2, moq: 25, rating: 4.8 },
  'Sharma Wholesale': { contact: 'Neha Sharma', phone: '+91 98917 22055', email: 'orders@sharmawholesale.in', leadTimeDays: 3, moq: 30, rating: 4.6 },
  'Fortune Dist.': { contact: 'Ritesh Jain', phone: '+91 99004 11233', email: 'north@fortunedist.in', leadTimeDays: 4, moq: 20, rating: 4.5 },
  'City Dairy': { contact: 'Mehul Shah', phone: '+91 97170 55544', email: 'supply@citydairy.in', leadTimeDays: 1, moq: 40, rating: 4.7 },
  'Cool Bev': { contact: 'Ankita Roy', phone: '+91 98180 33021', email: 'ops@coolbev.in', leadTimeDays: 2, moq: 36, rating: 4.4 },
  'SnackHub Foods': { contact: 'Varun Sethi', phone: '+91 99100 77442', email: 'supply@snackhubfoods.in', leadTimeDays: 2, moq: 48, rating: 4.3 },
  'HomeSpark Supplies': { contact: 'Pallavi Jain', phone: '+91 98101 56512', email: 'care@homespark.in', leadTimeDays: 3, moq: 18, rating: 4.5 },
};

export const USER_MANAGED_ROLE_OPTIONS = ['Admin', 'Cashier', 'Return Handler', 'Inventory Manager', 'Delivery Ops', 'Customer', 'Super User'];
export const CORE_AUTH_USER_KEYS = new Set(['superuser', 'admin', 'cashier', 'returnhandler', 'inventorymanager', 'deliveryops', 'customer', 'chirag']);

export const EMAIL_PATTERN = /^[A-Za-z0-9._%+-]+@(?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,}$/;
export const PHONE_PATTERN = /^[6-9]\d{9}$/;

// <title> of each HTML page (dashboard.js rewrites it to the same value).
export const PAGE_TITLES = {
  dashboard: 'BillBhai - Dashboard',
  orders: 'BillBhai - Orders & Billing',
  inventory: 'BillBhai - Inventory',
  delivery: 'BillBhai - Delivery',
  returns: 'BillBhai - Returns & Refunds',
  reports: 'BillBhai - Reports',
  users: 'BillBhai - Users',
  profile: 'BillBhai - Profile & Settings',
  notifications: 'BillBhai - Notifications',
  superuser: 'BillBhai - Super User Portal',
  businesses: 'BillBhai - Businesses Overview',
};

// Final text of #bcPage (the nav item's <span> text, or the static HTML text when
// the page has no sidebar entry).
export const PAGE_LABELS = {
  dashboard: 'Dashboard',
  orders: 'Orders & Billing',
  inventory: 'Inventory',
  delivery: 'Delivery',
  returns: 'Returns & Refunds',
  reports: 'Reports',
  users: 'Users',
  profile: 'Profile & Settings',
  notifications: 'Notifications',
  superuser: 'Super User Portal',
  businesses: 'Businesses',
};
