import { createSlice } from '@reduxjs/toolkit';

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
} = uiSlice.actions;

export const selectCurrentTheme = (state) => state.ui.theme;
export const selectCurrentCurrency = (state) => state.ui.currency;
export const selectToastState = (state) => state.ui.toast;
export const selectSidebarState = (state) => ({
  collapsed: state.ui.sidebarCollapsed,
  mobileOpen: state.ui.mobileDrawerOpen,
});

export default uiSlice.reducer;
