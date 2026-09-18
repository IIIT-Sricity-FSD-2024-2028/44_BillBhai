// React hooks over the dashboard store. These are the ONLY way page code should
// read the signed-in user/role and the operational data (no localStorage reads
// in pages). They work anywhere under a <DashboardLayout> (including its
// `afterMain` slot).
import { useCallback, useMemo, useState } from 'react';
import { ROLE_ACTIONS, ROLE_LABELS } from './constants.js';
import { apiRequest } from './api.js';
import { getActiveNotifications, loadProfileSettingsRecord } from './notifications.js';
import {
  cancelSubscription,
  checkProductPlanCap,
  checkUserPlanCap,
  denyAction,
  getActiveCompanyPlan,
  getProfileSubscriptionView,
  getScopedBusinessName,
  getState,
  markNotificationsRead,
  persistOperationalData,
  publishDataSync,
  renderPage,
  saveProfileSettings,
  setCollection,
  setNotificationReadState,
  showMutationError,
  switchCompanyPlan,
  ui,
  updateCollection,
  useDashboardStore,
} from './store.js';

/**
 * Signed-in user / role / business scope (the shared session source).
 * { roleKey, roleLabel, userName, avatar, headerRoleLabel, email,
 *   activeBusinessId, activeBusinessName, scopedBusinessName, sessionCompanyId, page, ready }
 */
export function useSession() {
  const s = useDashboardStore();
  return useMemo(() => ({
    roleKey: s.roleKey,
    roleLabel: ROLE_LABELS[s.roleKey] || '',
    userName: s.shell.userName,
    avatar: s.shell.avatar,
    headerRoleLabel: s.shell.roleLabel,
    email: s.shell.email,
    activeBusinessId: s.activeBusinessId,
    activeBusinessName: s.activeBusinessName,
    scopedBusinessName: getScopedBusinessName(s),
    sessionCompanyId: s.sessionCompanyId,
    page: s.page,
    ready: s.status === 'ready',
  }), [s]);
}

/**
 * Everything a page needs from the engine. See README.md for the full contract.
 */
export function useDashboard() {
  const s = useDashboardStore();
  return useMemo(() => {
    const actions = ROLE_ACTIONS[s.roleKey] || ROLE_ACTIONS.customer;
    return {
      // data snapshot (immutable - never mutate these arrays/objects)
      state: s,
      orders: s.orders,
      inventory: s.inventory,
      deliveries: s.deliveries,
      returns: s.returns,
      users: s.users,
      businesses: s.businesses,
      ready: s.status === 'ready',
      // session
      roleKey: s.roleKey,
      page: s.page,
      scopedBusinessName: getScopedBusinessName(s),
      // permissions
      hasActionAccess: (moduleKey) => !!actions[moduleKey],
      hasOrderDeleteAccess: () => s.roleKey === 'admin' || s.roleKey === 'superuser',
      denyAction,
      // plans
      activePlan: getActiveCompanyPlan(s.businesses),
      switchCompanyPlan,
      cancelSubscription,
      checkUserPlanCap,
      checkProductPlanCap,
      getProfileSubscriptionView: () => getProfileSubscriptionView(s),
      openPlanUpgrade: () => ui().openPlanUpgrade(),
      // UI
      showToast: (msg) => ui().showToast(msg),
      showMutationError,
      openQuickForm: (config) => ui().openQuickForm(config),
      openConfirm: (config) => ui().openConfirm(config),
      showCredentialsModal: (title, credential) => ui().showCredentialsModal(title, credential),
      // mutations
      updateCollection,
      setCollection,
      persistOperationalData,
      publishDataSync,
      renderPage,
      apiRequest,
      // notifications / profile
      getActiveNotifications: () => getActiveNotifications(getState()),
      setNotificationReadState,
      markNotificationsRead,
      loadProfileSettingsRecord: () => loadProfileSettingsRecord(getState()),
      saveProfileSettings,
    };
  }, [s]);
}

/** Active notifications (recomputed when data / read state changes). */
export function useNotifications() {
  const s = useDashboardStore();
  return useMemo(() => {
    try {
      return getActiveNotifications(s);
    } catch (err) {
      console.error('Failed to build notifications.', err);
      return [];
    }
  }, [s.roleKey, s.orders, s.inventory, s.deliveries, s.returns, s.users, s.businesses, s.notificationsVersion, s.shell]); // eslint-disable-line react-hooks/exhaustive-deps
}

/**
 * Generic resource hook: list + create/update/remove against the backend,
 * with `saving`/`error` state. Local rows are updated immutably and persisted
 * (notification refresh + live-sync broadcast) after a successful call.
 *
 * create(body, { path, role, toRow(response, body) => row | false, prepend, persist, silentSync, domains })
 * update(id, body, { path, role, apply(row, response, body) => row, persist })
 * remove(id, { path, role, persist })
 * All three return the API response and re-throw backend errors (so callers
 * can showMutationError(label, err) exactly where the original did).
 */
function persistOpts(opts) {
  return { persist: opts.persist !== false, silentSync: opts.silentSync, domains: opts.domains };
}

export function useResource(collection, { basePath, idKey = 'id' } = {}) {
  const s = useDashboardStore();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const run = useCallback(async (fn) => {
    setSaving(true);
    setError(null);
    try {
      return await fn();
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setSaving(false);
    }
  }, []);

  const matches = useCallback((row, id) => String(row && row[idKey]) === String(id), [idKey]);

  const create = useCallback((body, opts = {}) => run(async () => {
    const response = await apiRequest(opts.path || basePath, { method: 'POST', role: opts.role, body });
    if (opts.toRow !== false) {
      const row = opts.toRow ? opts.toRow(response, body) : response;
      updateCollection(collection, (rows) => (opts.prepend ? [row, ...rows] : [...rows, row]), persistOpts(opts));
    }
    return response;
  }), [basePath, collection, run]);

  const update = useCallback((id, body, opts = {}) => run(async () => {
    const response = await apiRequest(opts.path || `${basePath}/${encodeURIComponent(String(id))}`, { method: 'PUT', role: opts.role, body });
    updateCollection(collection, (rows) => rows.map((row) => (matches(row, id)
      ? (opts.apply ? opts.apply(row, response, body) : { ...row, ...body })
      : row)), persistOpts(opts));
    return response;
  }), [basePath, collection, matches, run]);

  const remove = useCallback((id, opts = {}) => run(async () => {
    const response = await apiRequest(opts.path || `${basePath}/${encodeURIComponent(String(id))}`, { method: 'DELETE', role: opts.role });
    updateCollection(collection, (rows) => rows.filter((row) => !matches(row, id)), persistOpts(opts));
    return response;
  }), [basePath, collection, matches, run]);

  return {
    rows: s[collection],
    loading: s.status !== 'ready',
    saving,
    error,
    create,
    update,
    remove,
    /** Local-only immutable update (+ persist unless { persist: false }). */
    setRows: (updater, options) => updateCollection(collection, updater, options),
  };
}

export const useOrders = () => useResource('orders', { basePath: '/orders' });
/** Inventory rows are keyed by `sku`; pass `{ path }` for backend ids (inventoryId/productId). */
export const useInventory = () => useResource('inventory', { basePath: '/inventory', idKey: 'sku' });
export const useDeliveries = () => useResource('deliveries', { basePath: '/deliveries' });
export const useReturns = () => useResource('returns', { basePath: '/returns' });
export const useUsers = () => useResource('users', { basePath: '/users' });
export const useBusinesses = () => useResource('businesses', { basePath: '/companies' });
