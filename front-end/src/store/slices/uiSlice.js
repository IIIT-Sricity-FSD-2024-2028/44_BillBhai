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
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {

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
  toggleTheme,
  setTheme,
  toggleSidebar,
  setSidebarCollapsed,
  setMobileDrawer,
  showToast,
  hideToast,
} = uiSlice.actions;

export const selectCurrentTheme = (state) => state.ui.theme;
export const selectToastState = (state) => state.ui.toast;
export const selectSidebarState = (state) => ({
  collapsed: state.ui.sidebarCollapsed,
  mobileOpen: state.ui.mobileDrawerOpen,
});

export default uiSlice.reducer;
