// Operational state for the dashboard family of pages - the React port of the
// page-level variables in dashboard.js (orders, inventory, deliveries, returns,
// users, businesses, selectedBusiness, activeRoleKey, ...), plus startApp(),
// persistOperationalData(), realtime sync and the plan/subscription actions.
//
// Every DashboardLayout mount behaves like one HTML page load: it calls
// beginPageSession(), which resets the state and re-fetches from the backend.
import { useSyncExternalStore } from 'react';
import {
  LIVE_SYNC_CHANNEL,
  LIVE_SYNC_KEY,
  PLAN_DEFINITIONS,
  ROLE_ACTIONS,
} from './constants.js';
import { apiRequest, fetchOperationalData, mutationErrorMessage, setApiActiveRole } from './api.js';
import {
  writeNotificationReadState,
  writeNotificationsRead,
  writeProfileSettingsRecord,
} from './notifications.js';
import { saveList } from './storage.js';

const COLLECTIONS = ['orders', 'inventory', 'deliveries', 'returns', 'users', 'businesses'];

function createInitialState(boot) {
  const b = boot || {};
  return {
    status: 'idle', // 'idle' | 'booting' | 'ready'
    page: b.page || 'dashboard',
    roleKey: b.roleKey || 'customer',
    activeBusinessId: b.activeBusinessId || '',
    activeBusinessName: b.activeBusinessName || '',
    sessionCompanyId: b.sessionCompanyId || '',
    orders: [],
    inventory: [],
    deliveries: [],
    returns: [],
    users: [],
    businesses: [],
    // Never set in backend-only mode (kept for parity with the original).
    selectedBusiness: null,
    isBusinessScoped: false,
    businessDataStore: {},
    shell: {
      userName: '',
      avatar: '',
      roleLabel: '',
      email: '',
      bcBusinessName: '',
      planBadgeVisible: false,
      proPills: { delivery: false, returns: false },
      ...(b.shell || {}),
      ...(b.shell ? { planBadgeVisible: !b.scopedAtBoot, proPills: b.proPills } : {}),
    },
    // cancelSubscription() without a business record only flips the profile badge.
    subscriptionCancelledFlag: false,
    // Bumped whenever something the notification dropdown reads from storage changes.
    notificationsVersion: 0,
    // Bumped by renderPage(): DashboardLayout re-mounts the page content.
    renderNonce: 0,
  };
}

let state = createInitialState(null);
const listeners = new Set();

function emit() {
  listeners.forEach((listener) => listener());
}

export function getState() {
  return state;
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Low-level escape hatch: shallow-merge `patch` into the state and re-render. */
export function patchState(patch) {
  state = { ...state, ...patch };
  emit();
}

/** React hook: the whole (immutable) store snapshot. */
export function useDashboardStore() {
  return useSyncExternalStore(subscribe, getState, getState);
}

// ── UI bridge (DashboardLayout registers its modal/toast host here) ──
const noopUi = {
  showToast: () => {},
  openQuickForm: () => {},
  openConfirm: () => {},
  openPlanUpgrade: () => {},
  showCredentialsModal: () => {},
};
let uiApi = noopUi;

export function registerUi(api) {
  uiApi = api || noopUi;
  return () => {
    if (uiApi === api) uiApi = noopUi;
  };
}

export function ui() {
  return uiApi;
}

export function showToast(message) {
  uiApi.showToast(message);
}

export function showMutationError(actionLabel, error) {
  console.warn(`${actionLabel} failed`, error);
  showToast(mutationErrorMessage(actionLabel, error));
}

// ── Permissions ──────────────────────────────────────────────────────
export function hasActionAccess(moduleKey) {
  const actions = ROLE_ACTIONS[state.roleKey] || ROLE_ACTIONS.customer;
  return !!actions[moduleKey];
}

export function hasOrderDeleteAccess() {
  return state.roleKey === 'admin' || state.roleKey === 'superuser';
}

export function denyAction(actionLabel) {
  // eslint-disable-next-line no-alert
  alert(`Access denied: ${actionLabel} is not allowed for your role.`);
}

// ── Realtime sync + persistence ──────────────────────────────────────
let session = { gen: 0, sourceId: '', channel: null, debounceTimer: null };
let generation = 0;

export function publishDataSync(domains) {
  const payload = {
    sourceId: session.sourceId,
    at: Date.now(),
    businessId: state.isBusinessScoped && state.selectedBusiness ? state.selectedBusiness.id : '',
    domains: Array.isArray(domains) && domains.length ? domains : ['orders', 'inventory', 'deliveries', 'returns', 'users'],
  };
  localStorage.setItem(LIVE_SYNC_KEY, JSON.stringify(payload));
  if (session.channel) {
    try {
      session.channel.postMessage(payload);
    } catch (err) {
      // Ignore channel failures and keep localStorage sync active.
    }
  }
}

function shouldApplyIncomingSync(payload) {
  if (!payload || typeof payload !== 'object') return false;
  if (String(payload.sourceId || '') === session.sourceId) return false;
  const incomingBusinessId = String(payload.businessId || '').trim();
  if (state.isBusinessScoped && state.selectedBusiness) return incomingBusinessId === state.selectedBusiness.id;
  return true;
}

function handleIncomingSync(payload) {
  if (!shouldApplyIncomingSync(payload)) return;
  if (session.debounceTimer) clearTimeout(session.debounceTimer);
  // loadOperationalSnapshotFromStorage() is a no-op in backend-only mode, so an
  // incoming sync just re-renders the current page.
  session.debounceTimer = setTimeout(() => renderPage(), 120);
}

function initRealtimeSync(current) {
  const onStorage = (event) => {
    if (event.key !== LIVE_SYNC_KEY || !event.newValue) return;
    try {
      handleIncomingSync(JSON.parse(event.newValue));
    } catch (err) {
      // Ignore malformed payloads.
    }
  };
  window.addEventListener('storage', onStorage);

  if ('BroadcastChannel' in window) {
    try {
      const channel = new BroadcastChannel(LIVE_SYNC_CHANNEL);
      channel.addEventListener('message', (event) => handleIncomingSync(event && event.data));
      current.channel = channel;
    } catch (err) {
      current.channel = null;
    }
  }

  return () => {
    window.removeEventListener('storage', onStorage);
    if (current.debounceTimer) clearTimeout(current.debounceTimer);
    if (current.channel) {
      try { current.channel.close(); } catch (err) { /* no-op */ }
      current.channel = null;
    }
  };
}

/**
 * persistOperationalData({ silentSync, domains }): re-renders the
 * notification dropdown and (unless silentSync) broadcasts a live-sync event
 * so other open tabs re-render.
 */
export function persistOperationalData(options) {
  const opts = options && typeof options === 'object' ? options : {};
  state = { ...state, notificationsVersion: state.notificationsVersion + 1 };
  emit();
  if (!opts.silentSync) publishDataSync(opts.domains);
}

/** renderPage(): re-mounts the page content (fresh DOM, charts, filters) like
 *  the original renderPage(currentPage). */
export function renderPage() {
  state = { ...state, renderNonce: state.renderNonce + 1 };
  emit();
}

/**
 * Immutable collection update + persist.
 *   updateCollection('orders', rows => rows.filter(o => o.id !== id));
 *   updateCollection('users', nextRows, { persist: false });
 * options: { persist = true, silentSync = false, domains }
 */
export function updateCollection(name, updater, options) {
  if (!COLLECTIONS.includes(name)) throw new Error(`Unknown collection: ${name}`);
  const opts = options && typeof options === 'object' ? options : {};
  const next = typeof updater === 'function' ? updater(state[name]) : updater;
  state = { ...state, [name]: Array.isArray(next) ? next : [] };
  emit();
  if (opts.persist !== false) persistOperationalData(opts);
  return state[name];
}

/** Replace a collection without persisting (same as updateCollection(..., { persist: false })). */
export function setCollection(name, rows) {
  return updateCollection(name, rows, { persist: false });
}

export function setShell(patch) {
  state = { ...state, shell: { ...state.shell, ...patch } };
  emit();
}

export function bumpNotifications() {
  state = { ...state, notificationsVersion: state.notificationsVersion + 1 };
  emit();
}

// Notification read state (+ dropdown refresh)
export function setNotificationReadState(notificationId, isRead) {
  writeNotificationReadState(state, notificationId, isRead);
  bumpNotifications();
}

export function markNotificationsRead(ids, isRead) {
  writeNotificationsRead(state, ids, isRead);
  bumpNotifications();
}

/** saveProfileSettingsRecord(record): storage + header name/avatar/breadcrumb + dropdown. */
export function saveProfileSettings(record) {
  writeProfileSettingsRecord(state, record);
  const shellPatch = {
    userName: record.fullName,
    avatar: record.fullName.charAt(0).toUpperCase(),
  };
  if (record.location) shellPatch.bcBusinessName = record.location;
  state = {
    ...state,
    shell: { ...state.shell, ...shellPatch },
    notificationsVersion: state.notificationsVersion + 1,
  };
  emit();
}

// ── Plans ────────────────────────────────────────────────────────────
export function getActiveCompanyPlan(businesses = state.businesses) {
  let planKey = 'pro';
  const activeBizId = localStorage.getItem('activeBusinessId');
  if (activeBizId && Array.isArray(businesses)) {
    const biz = businesses.find((b) => b && b.id === activeBizId);
    if (biz) {
      const raw = String(biz.plan || biz.productsPlan || '').toLowerCase();
      if (raw.includes('enterprise')) planKey = 'enterprise';
      else if (raw.includes('starter')) planKey = 'starter';
      else planKey = 'pro';
    }
  } else {
    const localSaved = localStorage.getItem('activeBusinessPlan');
    if (localSaved && PLAN_DEFINITIONS[localSaved]) planKey = localSaved;
  }
  return PLAN_DEFINITIONS[planKey] || PLAN_DEFINITIONS.pro;
}

function findActiveBusiness() {
  const activeBizId = localStorage.getItem('activeBusinessId');
  if (!activeBizId) return null;
  return state.businesses.find((b) => b && b.id === activeBizId) || null;
}

function replaceBusiness(updated) {
  state = { ...state, businesses: state.businesses.map((b) => (b && b.id === updated.id ? updated : b)) };
}

export async function switchCompanyPlan(targetPlanKey) {
  const targetPlan = PLAN_DEFINITIONS[targetPlanKey];
  if (!targetPlan) return;
  localStorage.setItem('activeBusinessPlan', targetPlanKey);

  const biz = findActiveBusiness();
  let updated = null;
  if (biz) {
    updated = { ...biz, plan: targetPlanKey, productsPlan: targetPlan.name, monthlyPrice: targetPlan.price, subscriptionStatus: 'Active' };
    try {
      await apiRequest(`/companies/${encodeURIComponent(String(biz.id))}`, {
        method: 'PUT',
        role: 'superuser',
        body: { plan: targetPlanKey, productsPlan: targetPlan.name, monthlyPrice: targetPlan.price, subscriptionStatus: 'Active' },
      });
    } catch (err) {
      console.warn('Could not sync company plan to backend:', err);
    }
  }

  if (updated) replaceBusiness(updated);
  // renderHeaderPlanBadge() creates the badge even when start-up skipped it.
  state = { ...state, shell: { ...state.shell, planBadgeVisible: true }, subscriptionCancelledFlag: false };
  emit();
  showToast(`Subscription switched to ${targetPlan.name}!`);
  renderPage();
}

export function openPlanUpgradeModal() {
  uiApi.openPlanUpgrade();
}

export function cancelSubscription() {
  uiApi.openConfirm({
    title: 'Cancel Subscription',
    message: 'Are you sure you want to cancel your active plan? Your account will downgrade to Starter Plan limits at the end of the billing period.',
    confirmLabel: 'Confirm Cancellation',
    cancelLabel: 'Keep My Plan', // ignored by openQuickConfirmModal (always "Cancel"), kept for parity
    onConfirm: async () => {
      const biz = findActiveBusiness();
      if (biz) {
        const updated = { ...biz, subscriptionStatus: 'Cancelled' };
        try {
          await apiRequest(`/companies/${encodeURIComponent(String(biz.id))}`, {
            method: 'PUT',
            role: 'superuser',
            body: { subscriptionStatus: 'Cancelled' },
          });
        } catch (err) { /* ignore */ }
        replaceBusiness(updated);
      }
      state = { ...state, subscriptionCancelledFlag: true };
      emit();
      showToast('Subscription cancelled. You may reactivate anytime.');
      return true;
    },
  });
}

export function checkUserPlanCap() {
  const activePlan = getActiveCompanyPlan();
  if (state.users.length >= activePlan.limits.maxUsers) {
    uiApi.openConfirm({
      title: 'Team Member Limit Reached',
      message: `Your ${activePlan.name} allows up to ${activePlan.limits.maxUsers} staff users (current: ${state.users.length}). Upgrade your plan to add more team members.`,
      confirmLabel: 'Upgrade Plan',
      cancelLabel: 'Close',
      onConfirm: () => {
        uiApi.openPlanUpgrade();
        return true;
      },
    });
    return false;
  }
  return true;
}

export function checkProductPlanCap() {
  const activePlan = getActiveCompanyPlan();
  if (state.inventory.length >= activePlan.limits.maxProducts) {
    uiApi.openConfirm({
      title: 'Product Catalog Limit Reached',
      message: `Your ${activePlan.name} allows up to ${activePlan.limits.maxProducts} products (current: ${state.inventory.length}). Upgrade your plan to expand your catalog.`,
      confirmLabel: 'Upgrade Plan',
      cancelLabel: 'Close',
      onConfirm: () => {
        uiApi.openPlanUpgrade();
        return true;
      },
    });
    return false;
  }
  return true;
}

function quotaLevel(percent) {
  return percent >= 90 ? 'danger' : (percent >= 70 ? 'warning' : '');
}

/**
 * Data behind updateProfileSubscriptionCard(). Render with:
 *   badge  className={`badge ${v.badgeClass}`}
 *   price  {v.price}<small style={{fontSize:'0.78rem',fontWeight:400,color:'var(--text-muted)'}}>{v.priceSuffix}</small>
 *   status className={v.cancelled ? 'badge b-outofstock' : 'badge b-active'} text {v.cancelled ? 'Cancelled' : 'Active'}
 *   quota  `${q.count} / ${q.max} Used`, bar style width `${q.percent}%`, className `quota-meter-fill ${q.level}`
 */
export function getProfileSubscriptionView(s = state) {
  const activePlan = getActiveCompanyPlan(s.businesses);
  const activeBizId = localStorage.getItem('activeBusinessId');
  const biz = activeBizId && Array.isArray(s.businesses) ? s.businesses.find((b) => b && b.id === activeBizId) || null : null;

  let badgeClassName = 'b-active';
  if (activePlan.key === 'starter') badgeClassName = 'b-pending';
  if (activePlan.key === 'enterprise') badgeClassName = 'b-processing';

  const cancelled = biz ? String(biz.subscriptionStatus || '').toLowerCase() === 'cancelled' : s.subscriptionCancelledFlag;

  const usersCount = s.users.length;
  const usersPercent = activePlan.limits.maxUsers === Infinity ? 10 : Math.min(100, Math.round((usersCount / activePlan.limits.maxUsers) * 100));
  const prodCount = s.inventory.length;
  const prodPercent = activePlan.limits.maxProducts === Infinity ? 5 : Math.min(100, Math.round((prodCount / activePlan.limits.maxProducts) * 100));
  const storesCount = (biz && biz.storesCount) || 1;
  const storesPercent = activePlan.limits.maxStores === Infinity ? 20 : Math.min(100, Math.round((storesCount / activePlan.limits.maxStores) * 100));

  return {
    plan: activePlan,
    badgeClass: badgeClassName,
    name: activePlan.name,
    price: activePlan.price === 0 ? '₹0' : `₹${activePlan.price.toLocaleString()}`,
    priceSuffix: activePlan.price === 0 ? '/Free Forever' : '/month',
    renewalText: `Renews on ${(biz && biz.renewalDate) || '30 Sept 2026'}`,
    cancelled,
    users: { count: usersCount, max: activePlan.limits.maxUsers === Infinity ? 'Unlimited' : activePlan.limits.maxUsers, percent: usersPercent, level: quotaLevel(usersPercent) },
    products: { count: prodCount, max: activePlan.limits.maxProducts === Infinity ? 'Unlimited' : activePlan.limits.maxProducts.toLocaleString(), percent: prodPercent, level: quotaLevel(prodPercent) },
    stores: { count: storesCount, max: activePlan.limits.maxStores === Infinity ? 'Unlimited' : activePlan.limits.maxStores, percent: storesPercent, level: quotaLevel(storesPercent) },
  };
}

/** selectedBusiness ? selectedBusiness.name : activeBusinessName (used in page titles). */
export function getScopedBusinessName(s = state) {
  return s.selectedBusiness ? s.selectedBusiness.name : s.activeBusinessName;
}

// ── startApp() ───────────────────────────────────────────────────────
async function loadOperationalDataFromBackend(gen) {
  try {
    const result = await fetchOperationalData({
      activeBusinessId: state.activeBusinessId,
      roleKey: state.roleKey,
      sessionCompanyId: state.sessionCompanyId,
      existingBusinesses: state.businesses,
    });
    if (gen !== generation) return 'stale';
    if (!result) return false;

    const patch = {
      inventory: result.inventory,
      orders: result.orders,
      deliveries: result.deliveries,
      returns: result.returns,
      users: result.users,
    };
    if (result.businesses) {
      patch.businesses = result.businesses;
      saveList('bb_businesses', result.businesses);
    }
    state = { ...state, ...patch };
    persistOperationalData({ silentSync: true });
    return true;
  } catch (error) {
    console.warn('Backend sync unavailable, using local fallback.', error);
    return false;
  }
}

/**
 * Starts one "page load": resets the state from the boot context, starts
 * realtime sync and loads data from the backend. `onReady` fires once the
 * initial data (or the empty fallback) is in place. Returns a dispose function.
 */
export function beginPageSession(boot, { onReady } = {}) {
  generation += 1;
  const gen = generation;
  setApiActiveRole(boot.roleKey);

  state = { ...createInitialState(boot), status: 'booting' };
  const current = { gen, sourceId: `${Date.now()}-${Math.random().toString(36).slice(2)}`, channel: null, debounceTimer: null };
  session = current;
  emit();

  const disposeSync = initRealtimeSync(current);

  (async () => {
    try {
      const loaded = await loadOperationalDataFromBackend(gen);
      if (loaded === 'stale' || gen !== generation) return;
      if (!loaded) throw new Error('Backend unavailable: dashboard requires in-memory server data.');
    } catch (err) {
      if (gen !== generation) return;
      console.error('Dashboard startup failed in backend-only mode.', err);
      state = {
        ...state,
        businesses: [],
        selectedBusiness: null,
        isBusinessScoped: false,
        businessDataStore: {},
        orders: [],
        inventory: [],
        deliveries: [],
        returns: [],
        users: [],
        // Lab 1 plan: say so openly instead of silently showing empty data.
        loadError: 'Could not reach the BillBhai API at http://localhost:4000. Start the backend and retry.',
      };
      emit();
      showToast('Backend is required. Start the API server to load dashboard data.');
    }
    if (gen !== generation) return;
    state = { ...state, status: 'ready' };
    emit();
    if (onReady) onReady();
  })();

  return () => {
    disposeSync();
    if (generation === gen) generation += 1;
  };
}
