import { createSlice, createSelector } from '@reduxjs/toolkit';

let modalSeq = 0;

const initialState = {
  theme: (() => {
    try {
      const saved = localStorage.getItem('billbhai-theme');
      return saved === 'light' || saved === 'dark' ? saved : 'dark';
    } catch {
      return 'dark';
    }
  })(),
  sidebarCollapsed: false,
  mobileDrawerOpen: false,
  toast: {
    show: false,
    message: '',
    type: 'success',
  },
  modals: [],
  readNotificationIds: (() => {
    try {
      const saved = localStorage.getItem('billbhai_read_notifications');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  })(),
  currency: (() => {
    try {
      const saved = localStorage.getItem('userCurrency');
      return saved === 'USD' || saved === 'INR' ? saved : 'INR';
    } catch {
      return 'INR';
    }
  })(),
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setCurrency(state, action) {
      const currency = action.payload === 'USD' ? 'USD' : 'INR';
      state.currency = currency;
      try {
        localStorage.setItem('userCurrency', currency);
      } catch {}
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('currency-changed', { detail: currency }));
      }
    },

    toggleTheme(state) {
      const next = state.theme === 'dark' ? 'light' : 'dark';
      state.theme = next;
      try {
        localStorage.setItem('billbhai-theme', next);
      } catch { /* private mode */ }
      if (typeof document !== 'undefined') {
        document.documentElement.dataset.theme = next;
        document.documentElement.style.colorScheme = next;
      }
    },
    setTheme(state, action) {
      const theme = action.payload;
      if (theme !== 'dark' && theme !== 'light') return;
      state.theme = theme;
      try {
        localStorage.setItem('billbhai-theme', theme);
      } catch { /* private mode */ }
      if (typeof document !== 'undefined') {
        document.documentElement.dataset.theme = theme;
        document.documentElement.style.colorScheme = theme;
      }
    },

    toggleSidebar(state) {
      state.sidebarCollapsed = !state.sidebarCollapsed;
    },
    setSidebarCollapsed(state, action) {
      state.sidebarCollapsed = Boolean(action.payload);
    },
    setMobileDrawer(state, action) {
      state.mobileDrawerOpen = Boolean(action.payload);
    },

    showToast(state, action) {
      const { message = '', type = 'success' } = action.payload || {};
      state.toast = { show: true, message, type };
    },
    hideToast(state) {
      state.toast = { ...state.toast, show: false };
    },

    openModal(state, action) {
      const { kind, config } = action.payload || {};
      state.modals.push({ id: ++modalSeq, kind, config });
    },
    closeModal(state, action) {
      const id = action.payload;
      state.modals = state.modals.filter((m) => m.id !== id);
    },

    markNotificationRead(state, action) {
      const id = String(action.payload);
      if (!state.readNotificationIds.includes(id)) {
        state.readNotificationIds.push(id);
        try {
          localStorage.setItem('billbhai_read_notifications', JSON.stringify(state.readNotificationIds));
        } catch {}
      }
    },
    markAllNotificationsRead(state, action) {
      const ids = Array.isArray(action.payload) ? action.payload.map(String) : [];
      const set = new Set([...state.readNotificationIds, ...ids]);
      state.readNotificationIds = Array.from(set);
      try {
        localStorage.setItem('billbhai_read_notifications', JSON.stringify(state.readNotificationIds));
      } catch {}
    },
  },
});

export const {
  setCurrency,
  toggleTheme,
  setTheme,
  toggleSidebar,
  setSidebarCollapsed,
  setMobileDrawer,
  showToast,
  hideToast,
  openModal,
  closeModal,
  markNotificationRead,
  markAllNotificationsRead,
} = uiSlice.actions;

export const selectCurrentTheme = (state) => state.ui?.theme || 'dark';
export const selectCurrentCurrency = (state) => state.ui?.currency || 'INR';
export const selectToastState = (state) => state.ui?.toast || { show: false, message: '', type: 'success' };
export const selectSidebarState = (state) => ({
  collapsed: Boolean(state.ui?.sidebarCollapsed),
  mobileOpen: Boolean(state.ui?.mobileDrawerOpen),
});
export const selectModals = (state) => state.ui?.modals || [];
export const selectReadNotificationIds = (state) => state.ui?.readNotificationIds || [];

export const selectReduxNotifications = createSelector(
  [
    (state) => state.orders?.orders || [],
    (state) => state.inventory?.products || [],
    (state) => state.deliveries?.items || [],
    (state) => state.returns?.items || [],
    selectReadNotificationIds,
  ],
  (orders, inventory, deliveries, returns, readIds) => {
    const list = [];
    const readSet = new Set((readIds || []).map(String));

    // Inventory low-stock alerts
    inventory.forEach((p) => {
      const stock = Number(p.stock || 0);
      const reorder = Number(p.reorderLevel || 0);
      if (stock <= reorder) {
        const id = `notif_lowstock_${p.productId || p.id}`;
        list.push({
          id,
          title: `Low stock: ${p.name || p.productName || 'Item'}`,
          message: `${stock} left (reorder at ${reorder})`,
          category: 'inventory',
          priority: stock === 0 ? 'critical' : 'high',
          priorityRank: stock === 0 ? 4 : 3,
          unread: !readSet.has(id),
          time: 'Current snapshot',
          sortTimeMs: Date.now(),
        });
      }
    });

    // Returns awaiting decision
    returns.forEach((r) => {
      if (r.status === 'Pending' || r.status === 'Approved') {
        const id = `notif_return_${r.id}`;
        list.push({
          id,
          title: `Return ${r.status}: ${r.id}`,
          message: `Order #${r.orderId} · ${r.reason || 'Pending resolution'}`,
          category: 'returns',
          priority: r.status === 'Approved' ? 'high' : 'medium',
          priorityRank: r.status === 'Approved' ? 3 : 2,
          unread: !readSet.has(id),
          time: 'Current snapshot',
          sortTimeMs: Date.now(),
        });
      }
    });

    // Failed delivery alerts
    deliveries.forEach((d) => {
      if (d.status === 'Failed Attempt') {
        const id = `notif_deliv_fail_${d.id}`;
        list.push({
          id,
          title: `Delivery Failed: ${d.id}`,
          message: `${d.customer || 'Customer'} · ${d.failureReason || 'Action required'}`,
          category: 'delivery',
          priority: 'critical',
          priorityRank: 4,
          unread: !readSet.has(id),
          time: 'Current snapshot',
          sortTimeMs: Date.now(),
        });
      }
    });

    return list.sort((a, b) => b.priorityRank - a.priorityRank);
  },
);

export default uiSlice.reducer;
