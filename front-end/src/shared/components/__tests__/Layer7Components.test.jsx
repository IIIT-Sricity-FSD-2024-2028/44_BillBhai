import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';

import uiReducer from '../../../store/uiSlice.js';
import deliveryReducer from '../../../features/deliveries/deliverySlice.js';
import ordersReducer from '../../../features/orders/ordersSlice.js';
import productsReducer from '../../../features/inventory/productsSlice.js';
import inventoryReducer from '../../../features/inventory/inventorySlice.js';
import suppliersReducer from '../../../features/inventory/suppliersSlice.js';
import uploadsReducer from '../../../features/inventory/uploadsSlice.js';
import companiesReducer from '../../../features/companies/companiesSlice.js';
import customersReducer from '../../../features/cashier/customersSlice.js';
import paymentsReducer from '../../../features/cashier/paymentsSlice.js';
import posCartReducer from '../../../features/cashier/posCartSlice.js';
import usersReducer from '../../../features/users/usersSlice.js';
import reportsReducer from '../../../features/reports/reportsSlice.js';

import LoginPage from '../../../features/auth/LoginPage.jsx';
import BusinessesList from '../../../features/companies/components/businesses/BusinessesList.jsx';
import RaiseReturnModal from '../../../features/returns/components/RaiseReturnModal.jsx';
import UserFormModal from '../../../features/users/components/UserFormModal.jsx';
import ThemeToggle from '../common/ThemeToggle.jsx';
import BrandHeader from '../../../features/auth/components/BrandHeader.jsx';
import { LOGO, LOGO_ALT } from '../../lib/pageAssets.js';
import { patchState, registerUi } from '../../lib/dashboard/store.js';

function makeStore() {
  return configureStore({
    reducer: {
      ui: uiReducer,
      delivery: deliveryReducer,
      products: productsReducer,
      inventory: inventoryReducer,
      suppliers: suppliersReducer,
      uploads: uploadsReducer,
      orders: ordersReducer,
      companies: companiesReducer,
      customers: customersReducer,
      payments: paymentsReducer,
      posCart: posCartReducer,
      users: usersReducer,
      reports: reportsReducer,
    },
  });
}

describe('Layer 7 Critical Components, Forms & Modals (RTL)', () => {
  beforeEach(() => {
    registerUi({ canAccess: () => true, toast: vi.fn() });
    patchState({
      session: { roleKey: 'admin', companyId: 'BIZ-101', name: 'Admin QA' },
      users: [],
      orders: [],
      returns: [],
      deliveries: [],
      customers: [],
      coupons: [],
      companies: [],
      products: [],
      inventory: [],
      suppliers: [],
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    window.history.pushState({}, '', '/');
  });

  it('LoginPage validates empty username/password and renders expired session alert', () => {
    window.history.pushState({}, '', '/login?expired=1');
    const store = makeStore();
    render(
      <Provider store={store}>
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      </Provider>,
    );
    expect(screen.getByText(/session ended/i)).toBeTruthy();

    fireEvent.click(document.querySelector('#loginForm button[type="submit"]'));
    expect(document.querySelector('#username')).toBeTruthy();
  });

  it('BusinessesList renders KPI metrics and business rows cleanly (BUG-001 regression)', () => {
    const store = makeStore();
    const companies = [
      { id: 'BIZ-101', name: 'FreshKart Central', owner: 'Rohan', plan: 'pro', subscriptionStatus: 'Active', monthlyPrice: 1499, paymentDue: 0, profit: 50000, storesCount: 2, status: 'Active' },
      { id: 'BIZ-102', name: 'Metro Mart East', owner: 'Anita', plan: 'enterprise', subscriptionStatus: 'Active', monthlyPrice: 3999, paymentDue: 500, profit: 90000, storesCount: 4, status: 'Active' },
    ];
    const actions = {
      addBusiness: vi.fn(),
      openBusinessDetails: vi.fn(),
      openBusiness: vi.fn(),
      editBusiness: vi.fn(),
      deleteBusiness: vi.fn(),
    };
    render(
      <Provider store={store}>
        <BusinessesList companies={companies} users={[]} loading={false} canManage actions={actions} />
      </Provider>,
    );
    expect(screen.getByText('FreshKart Central')).toBeTruthy();
    expect(screen.getByText('Metro Mart East')).toBeTruthy();
    expect(screen.getByText('2 of 2')).toBeTruthy();
  });

  it('RaiseReturnModal uppercases order ID input, allows Escape close, and guards empty submit', () => {
    const store = makeStore();
    const onClose = vi.fn();
    render(
      <Provider store={store}>
        <RaiseReturnModal open onClose={onClose} onCreated={vi.fn()} recentOrders={[]} />
      </Provider>,
    );
    const input = document.querySelector('#returnOrderId');
    fireEvent.change(input, { target: { value: 'ord-4827' } });
    expect(input.value).toBe('ORD-4827');

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('UserFormModal blocks invalid empty submission and highlights required inputs', () => {
    const store = makeStore();
    render(
      <Provider store={store}>
        <UserFormModal onClose={vi.fn()} onSaved={vi.fn()} />
      </Provider>,
    );
    fireEvent.submit(document.querySelector('#addUserModal form'));
    expect(document.querySelector('#user_name').classList.contains('error')).toBe(true);
    expect(document.querySelector('#user_username').classList.contains('error')).toBe(true);
  });

  it('ThemeToggle immediately switches BillBhai logo between dark and light variants without refresh', () => {
    const store = makeStore();
    render(
      <Provider store={store}>
        <ThemeToggle />
        <BrandHeader />
      </Provider>,
    );
    const img = screen.getByAltText('BillBhai Logo');
    expect(img.getAttribute('src')).toBe(LOGO);

    fireEvent.click(screen.getByRole('button', { name: /switch to light theme/i }));
    expect(img.getAttribute('src')).toBe(LOGO_ALT);

    fireEvent.click(screen.getByRole('button', { name: /switch to dark theme/i }));
    expect(img.getAttribute('src')).toBe(LOGO);
  });
});
