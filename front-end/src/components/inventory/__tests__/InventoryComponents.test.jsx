import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';

vi.mock('chart.js/auto', () => ({
  default: class MockChart {
    destroy() {}
  },
}));

import uiReducer, { toggleTheme } from '../../../store/slices/uiSlice.js';
import deliveryReducer from '../../../store/slices/deliverySlice.js';
import ordersReducer from '../../../store/slices/ordersSlice.js';
import productsReducer from '../../../store/slices/productsSlice.js';
import inventoryReducer from '../../../store/slices/inventorySlice.js';
import suppliersReducer from '../../../store/slices/suppliersSlice.js';
import uploadsReducer from '../../../store/slices/uploadsSlice.js';
import { patchState, registerUi } from '../../../lib/dashboard/store.js';
import InventoryContent from '../InventoryContent.jsx';
import ProductFormModal from '../ProductFormModal.jsx';
import StockActionModal from '../StockActionModal.jsx';
import DashboardPage from '../../../pages/DashboardPage.jsx';

function makeStore(preloadedState) {
  return configureStore({
    reducer: {
      ui: uiReducer,
      delivery: deliveryReducer,
      products: productsReducer,
      inventory: inventoryReducer,
      suppliers: suppliersReducer,
      uploads: uploadsReducer,
      orders: ordersReducer,
    },
    preloadedState,
  });
}

function mockJson(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const originalFetch = globalThis.fetch;

describe('Inventory Redux Component Integration (RTL + Real Store)', () => {
  beforeEach(() => {
    registerUi({
      showToast: vi.fn(),
      openConfirm: ({ onConfirm }) => onConfirm && onConfirm(),
    });
  });

  afterEach(() => {
    cleanup();
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('dispatches exact role-scoped thunks for admin, inventorymanager, cashier, and superuser', async () => {
    const requestedUrls = [];
    globalThis.fetch = vi.fn((url) => {
      const s = String(url);
      requestedUrls.push(s);
      if (s.includes('/api/inventory/low-stock')) return Promise.resolve(mockJson([]));
      if (s.includes('/api/inventory')) {
        return Promise.resolve(mockJson([
          { id: 'INV-1', productId: 'P001', productName: 'Milk', category: 'Dairy', stockAvailable: 12, reorderLevel: 5, price: 40, active: true, status: 'In Stock' },
        ]));
      }
      if (s.includes('/api/products')) return Promise.resolve(mockJson([{ id: 'P001', name: 'Milk', active: true }]));
      if (s.includes('/api/suppliers')) return Promise.resolve(mockJson([{ id: 'SUP-001', name: 'Amul' }]));
      return Promise.resolve(mockJson([]));
    });

    // 1. Admin -> inventory, products, suppliers, low-stock (NEVER /uploads)
    patchState({ roleKey: 'admin', activeBusinessId: 'BIZ-101', status: 'ready' });
    const adminStore = makeStore();
    render(
      <Provider store={adminStore}>
        <InventoryContent />
      </Provider>,
    );
    await waitFor(() => expect(requestedUrls.some((u) => u.includes('/api/suppliers'))).toBe(true));
    expect(requestedUrls.some((u) => u.includes('/api/inventory/low-stock'))).toBe(true);
    expect(requestedUrls.some((u) => u.includes('/api/uploads'))).toBe(false);
    cleanup();

    // 2. Inventory Manager -> inventory, products, suppliers, low-stock
    requestedUrls.length = 0;
    patchState({ roleKey: 'inventorymanager', activeBusinessId: 'BIZ-101', status: 'ready' });
    render(
      <Provider store={makeStore()}>
        <InventoryContent />
      </Provider>,
    );
    await waitFor(() => expect(requestedUrls.some((u) => u.includes('/api/suppliers'))).toBe(true));
    cleanup();

    // 3. Cashier -> MUST NEVER dispatch suppliers, low-stock, or movements
    requestedUrls.length = 0;
    patchState({ roleKey: 'cashier', activeBusinessId: 'BIZ-101', status: 'ready' });
    render(
      <Provider store={makeStore()}>
        <InventoryContent />
      </Provider>,
    );
    await waitFor(() => expect(requestedUrls.some((u) => u.includes('/api/inventory'))).toBe(true));
    expect(requestedUrls.some((u) => u.includes('/api/products'))).toBe(true);
    expect(requestedUrls.some((u) => u.includes('/api/suppliers'))).toBe(false);
    expect(requestedUrls.some((u) => u.includes('/api/inventory/low-stock'))).toBe(false);
    expect(requestedUrls.some((u) => u.includes('/api/inventory/movements'))).toBe(false);
    cleanup();

    // 4. Super User WITH activeBusinessId passes companyId=BIZ-102
    requestedUrls.length = 0;
    patchState({ roleKey: 'superuser', activeBusinessId: 'BIZ-102', status: 'ready' });
    render(
      <Provider store={makeStore()}>
        <InventoryContent />
      </Provider>,
    );
    await waitFor(() => expect(requestedUrls.some((u) => u.includes('companyId=BIZ-102'))).toBe(true));
    cleanup();

    // 5. Super User WITHOUT activeBusinessId (PLATFORM) omits companyId
    requestedUrls.length = 0;
    patchState({ roleKey: 'superuser', activeBusinessId: 'PLATFORM', status: 'ready' });
    render(
      <Provider store={makeStore()}>
        <InventoryContent />
      </Provider>,
    );
    await waitFor(() => expect(requestedUrls.some((u) => u.includes('/api/inventory'))).toBe(true));
    expect(requestedUrls.some((u) => u.includes('companyId='))).toBe(false);
  });

  it('ProductFormModal handles validation, inline supplier + step-B retry safety, and edit split + 409', async () => {
    let supplierCreates = 0;
    let productCreateAttempts = 0;
    let productPuts = 0;
    let inventoryPuts = 0;

    globalThis.fetch = vi.fn((url, opts) => {
      const u = String(url);
      if (u.endsWith('/api/suppliers') && opts?.method === 'POST') {
        supplierCreates += 1;
        return Promise.resolve(mockJson({ id: 'SUP-099', name: 'New Agro', version: 1 }, 201));
      }
      if (u.endsWith('/api/products') && opts?.method === 'POST') {
        productCreateAttempts += 1;
        if (productCreateAttempts === 1) {
          return Promise.resolve(mockJson({ message: 'A product called "Honey" already exists' }, 409));
        }
        return Promise.resolve(mockJson({ id: 'P099', name: 'Wild Honey', version: 1 }, 201));
      }
      if (u.endsWith('/api/products/P001') && opts?.method === 'PUT') {
        productPuts += 1;
        const body = JSON.parse(opts.body);
        if (body.name === 'Conflict Trigger') {
          return Promise.resolve(mockJson({ message: 'Product P001 was modified by someone else' }, 409));
        }
        return Promise.resolve(mockJson({ id: 'P001', name: body.name, version: 2 }));
      }
      if (u.endsWith('/api/inventory/INV-001') && opts?.method === 'PUT') {
        inventoryPuts += 1;
        if (inventoryPuts === 1) {
          return Promise.resolve(mockJson({ message: 'Shelf lock transient failure' }, 500));
        }
        return Promise.resolve(mockJson({ id: 'INV-001', productId: 'P001', productName: 'Rice', reorderLevel: 30, location: 'B2', stockAvailable: 10 }));
      }
      return Promise.resolve(mockJson({}));
    });

    const store = makeStore();
    const onSaved = vi.fn();

    // Part A: Validation + Inline "+ New supplier…" + Step-B fail + Retry without orphan supplier
    const { rerender } = render(
      <Provider store={store}>
        <ProductFormModal
          request={{ mode: 'add' }}
          suppliers={[{ id: 'SUP-001', name: 'Existing' }]}
          categories={['Groceries']}
          onClose={vi.fn()}
          onSaved={onSaved}
        />
      </Provider>,
    );

    // Check currency symbol preserved in label
    expect(screen.getByLabelText(/Selling price/i).closest('.form-group').textContent).toMatch(/₹|\$/);

    // Empty submit shows validation errors
    fireEvent.click(screen.getByRole('button', { name: 'Add product' }));
    expect(await screen.findByText('Name must be 2–80 characters.')).toBeTruthy();

    // Fill inline supplier + product that hits 409 on first try
    fireEvent.change(screen.getByLabelText(/Product name/i), { target: { value: 'Honey' } });
    fireEvent.change(screen.getByLabelText(/Category/i), { target: { value: 'Groceries' } });
    fireEvent.change(screen.getByLabelText(/Supplier \*/i), { target: { value: '__new__' } });
    fireEvent.change(screen.getByLabelText(/New supplier name/i), { target: { value: 'New Agro' } });
    fireEvent.change(screen.getByLabelText(/Supplier mobile/i), { target: { value: '9876543210' } });
    fireEvent.change(screen.getByLabelText(/Selling price/i), { target: { value: '250' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add product' }));

    // Step B fails with 409, form stays open with user input intact
    expect(await screen.findByText('A product called "Honey" already exists')).toBeTruthy();
    expect(screen.getByLabelText(/Product name/i).value).toBe('Honey');
    expect(supplierCreates).toBe(1);

    // Fix name and retry -> supplier MUST NOT be created again!
    fireEvent.change(screen.getByLabelText(/Product name/i), { target: { value: 'Wild Honey' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add product' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(expect.stringContaining('Wild Honey added')));
    expect(supplierCreates).toBe(1);

    // Part B: Edit split (PUT /products/:id succeeds, PUT /inventory/:id fails, retry skips product PUT)
    const editItem = {
      productId: 'P001',
      inventoryId: 'INV-001',
      productVersion: 1,
      name: 'Rice',
      cat: 'Groceries',
      supplierId: 'SUP-001',
      price: 100,
      gstRate: 5,
      reorderLevel: 10,
      location: 'Shelf',
      stock: 10,
    };
    rerender(
      <Provider store={store}>
        <ProductFormModal
          request={{ mode: 'edit', item: editItem }}
          suppliers={[{ id: 'SUP-001', name: 'Existing' }]}
          categories={['Groceries']}
          onClose={vi.fn()}
          onSaved={onSaved}
        />
      </Provider>,
    );

    fireEvent.change(screen.getByLabelText(/Product name/i), { target: { value: 'Basmati Rice' } });
    fireEvent.change(screen.getByLabelText(/Reorder level/i), { target: { value: '30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText(/Product details saved, but the next step failed/)).toBeTruthy();
    expect(productPuts).toBe(1);
    expect(inventoryPuts).toBe(1);

    // Retry shelf update -> MUST NOT re-dispatch PUT /products/P001
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith('Basmati Rice updated.'));
    expect(productPuts).toBe(1);
    expect(inventoryPuts).toBe(2);

    // Part C: 409 version conflict on edit keeps form open & input intact
    rerender(
      <Provider store={store}>
        <ProductFormModal
          request={{ mode: 'edit', item: { ...editItem, productVersion: 9 } }}
          suppliers={[{ id: 'SUP-001', name: 'Existing' }]}
          categories={['Groceries']}
          onClose={vi.fn()}
          onSaved={onSaved}
        />
      </Provider>,
    );
    fireEvent.change(screen.getByLabelText(/Product name/i), { target: { value: 'Conflict Trigger' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Product P001 was modified by someone else')).toBeTruthy();
    expect(screen.getByLabelText(/Product name/i).value).toBe('Conflict Trigger');
  });

  it('StockActionModal shows Saving…, keeps stock unchanged until fulfilled, and surfaces errors', async () => {
    let resolveReceive;
    globalThis.fetch = vi.fn((url) => {
      if (String(url).includes('/api/inventory/receive')) {
        return new Promise((r) => {
          resolveReceive = () =>
            r(mockJson({ id: 'INV-1', productId: 'P001', productName: 'Rice', stockAvailable: 35, reorderLevel: 10, status: 'In Stock', active: true }));
        });
      }
      return Promise.resolve(mockJson({ message: 'Stock cannot go below 0' }, 400));
    });

    const store = makeStore({
      inventory: {
        items: [{ productId: 'P001', inventoryId: 'INV-1', name: 'Rice', stock: 10, reorderLevel: 10, status: 'Low Stock', active: true }],
        lowStock: [],
        movements: [],
        selected: null,
        status: 'succeeded',
        movementsStatus: 'idle',
        saving: false,
        error: null,
        requestIds: { fetchAll: null, fetchLowStock: null, fetchMovements: null, fetchOne: null },
      },
    });
    const onSaved = vi.fn();

    const { rerender } = render(
      <Provider store={store}>
        <StockActionModal
          request={{ kind: 'receive', item: store.getState().inventory.items[0] }}
          suppliers={[{ id: 'SUP-1', name: 'Agro' }]}
          onClose={vi.fn()}
          onSaved={onSaved}
        />
      </Provider>,
    );

    fireEvent.change(screen.getByLabelText(/Units received/i), { target: { value: '25' } });
    fireEvent.click(screen.getByRole('button', { name: 'Record receipt' }));

    // Pending: Saving… shown, button disabled, stock STILL 10 (no optimistic write)
    const savingBtn = await screen.findByRole('button', { name: 'Saving…' });
    expect(savingBtn.disabled).toBe(true);
    expect(store.getState().inventory.items[0].stock).toBe(10);

    // Fulfill -> store becomes 35
    resolveReceive();
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith('Received 25 × Rice.'));
    expect(store.getState().inventory.items[0].stock).toBe(35);

    // Failure case (server 400 on adjust)
    rerender(
      <Provider store={store}>
        <StockActionModal
          request={{ kind: 'adjust', item: store.getState().inventory.items[0] }}
          suppliers={[]}
          onClose={vi.fn()}
          onSaved={onSaved}
        />
      </Provider>,
    );
    fireEvent.change(screen.getByLabelText(/Units \*/i), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save adjustment' }));
    expect(await screen.findByText('Stock cannot go below 0')).toBeTruthy();
    expect(store.getState().inventory.items[0].stock).toBe(35);
  });

  it('DashboardPage low-stock card renders selectLowStockForDashboard sorted ascending', async () => {
    localStorage.setItem('userName', 'Admin');
    localStorage.setItem('userRole', 'admin');
    localStorage.setItem('bb_auth_token', 'test-jwt');
    localStorage.setItem('activeBusinessId', 'BIZ-101');
    patchState({ roleKey: 'admin', activeBusinessId: 'BIZ-101', status: 'ready', orders: [], returns: [], deliveries: [], shell: { userName: 'Admin', avatar: 'A', roleLabel: 'Admin' } });
    globalThis.fetch = vi.fn((url) => {
      const s = String(url);
      if (s.includes('/api/reports/sales')) {
        return Promise.resolve(mockJson({ byDay: [], byPaymentMethod: {}, netSales: 0, refunds: 0, totalOrders: 0, codPending: 0, collected: 0 }));
      }
      if (s.includes('/api/inventory')) {
        return Promise.resolve(mockJson([
          { id: 'INV-1', productId: 'P1', productName: 'Flour', stockAvailable: 9, reorderLevel: 15, status: 'Low Stock', active: true },
          { id: 'INV-2', productId: 'P2', productName: 'Salt', stockAvailable: 1, reorderLevel: 10, status: 'Critical', active: true },
          { id: 'INV-3', productId: 'P3', productName: 'Sugar', stockAvailable: 50, reorderLevel: 10, status: 'In Stock', active: true },
          { id: 'INV-4', productId: 'P4', productName: 'Old Tea', stockAvailable: 0, reorderLevel: 10, status: 'Out of Stock', active: false },
        ]));
      }
      return Promise.resolve(mockJson([]));
    });

    const store = makeStore({
      inventory: {
        items: [
          { productId: 'P1', name: 'Flour', stock: 9, reorderLevel: 15, status: 'Low Stock', active: true },
          { productId: 'P2', name: 'Salt', stock: 1, reorderLevel: 10, status: 'Critical', active: true },
          { productId: 'P3', name: 'Sugar', stock: 50, reorderLevel: 10, status: 'In Stock', active: true },
          { productId: 'P4', name: 'Old Tea', stock: 0, reorderLevel: 10, status: 'Out of Stock', active: false },
        ],
        lowStock: [],
        movements: [],
        selected: null,
        status: 'succeeded',
        movementsStatus: 'idle',
        saving: false,
        error: null,
        requestIds: { fetchAll: null, fetchLowStock: null, fetchMovements: null, fetchOne: null },
      },
    });

    render(
      <MemoryRouter>
        <Provider store={store}>
          <DashboardPage />
        </Provider>
      </MemoryRouter>,
    );

    const heading = await screen.findByText('Stock that needs attention');
    const card = heading.closest('.card');
    await waitFor(() => {
      const bodyRows = Array.from(card.querySelectorAll('tbody tr'));
      expect(bodyRows).toHaveLength(2);
      expect(bodyRows[0].textContent).toContain('Salt');
      expect(bodyRows[1].textContent).toContain('Flour');
    });
  });

  it('Show inactive toggle reveals soft-deleted products, CSV partial import populates banner, and UI theme toggles do not churn rows', async () => {
    let activeFlag = true;
    globalThis.fetch = vi.fn((url, opts) => {
      const u = String(url);
      if (u.includes('/api/inventory/low-stock')) return Promise.resolve(mockJson([]));
      if (u.includes('/api/inventory')) {
        return Promise.resolve(mockJson([
          { id: 'INV-1', productId: 'P001', productName: 'Rice', category: 'Groceries', stockAvailable: 12, reorderLevel: 5, price: 40, active: activeFlag, status: 'In Stock' },
        ]));
      }
      if (u.endsWith('/api/products/P001') && opts?.method === 'DELETE') {
        activeFlag = false;
        return Promise.resolve(mockJson({ message: 'Product P001 deactivated', product: { id: 'P001', name: 'Rice', active: false, version: 2 } }));
      }
      if (u.includes('/api/products')) return Promise.resolve(mockJson([{ id: 'P001', name: 'Rice', active: activeFlag }]));
      if (u.includes('/api/suppliers')) return Promise.resolve(mockJson([{ id: 'SUP-001', name: 'Agro' }]));
      if (u.includes('/api/uploads/products/csv')) {
        return Promise.resolve(mockJson({
          file: { id: 'UPL-10', originalName: 'items.csv', kind: 'import' },
          totalRows: 2,
          imported: 1,
          failed: 1,
          createdProductIds: ['P029'],
          errors: [{ row: 2, reason: 'price must be more than 0' }],
        }, 201));
      }
      return Promise.resolve(mockJson([]));
    });

    patchState({ roleKey: 'admin', activeBusinessId: 'BIZ-101', status: 'ready' });
    const store = makeStore();

    render(
      <Provider store={store}>
        <InventoryContent />
      </Provider>,
    );

    await waitFor(() => expect(screen.getByText('Rice')).toBeTruthy());

    // Soft-delete Rice
    fireEvent.click(screen.getByRole('button', { name: 'Deactivate' }));
    await waitFor(() => expect(screen.queryByText('Rice')).toBeNull());
    expect(screen.getByText(/Show inactive \(1\)/)).toBeTruthy();

    // Toggle "Show inactive" -> Rice + Reactivate button appear!
    fireEvent.click(screen.getByLabelText(/Show inactive/i));
    expect(await screen.findByText('Rice')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reactivate' })).toBeTruthy();

    // Partial-success CSV import -> displays summary & per-row error
    const fileInput = screen.getByLabelText('Import products CSV');
    const csvFile = new File(['name,category,price,supplierId\nBad,Cat,0,SUP-001\n'], 'items.csv', { type: 'text/csv' });
    fireEvent.change(fileInput, { target: { files: [csvFile] } });
    expect(await screen.findByText(/1 imported, 1 failed/)).toBeTruthy();
    expect(screen.getByText(/Row 2: price must be more than 0/)).toBeTruthy();

    // Unrelated ui theme dispatch does not throw or alter row count
    store.dispatch(toggleTheme());
    expect(screen.getByText('Rice')).toBeTruthy();
  });
});
