import assert from 'node:assert/strict';
import { configureStore } from '@reduxjs/toolkit';
import rootStore from '../../store.js';
import { injectStore } from '../../storeBridge.js';
import { clearSession } from '../../../lib/dashboard/session.js';
import { toggleTheme } from '../uiSlice.js';
import productsReducer, {
  clearProductsError,
  clearSelectedProduct,
  resetProducts,
  fetchProductsThunk,
  fetchProductByIdThunk,
  fetchProductCategoriesThunk,
  fetchProductByBarcodeThunk,
  fetchProductActivityThunk,
  createProductThunk,
  updateProductThunk,
  deleteProductThunk,
  selectAllProducts,
  selectActiveProducts,
  selectProductCategories,
  selectDerivedProductCategories,
  selectSelectedProduct,
  selectActivityByProduct,
  selectProductsSaving,
} from '../productsSlice.js';
import suppliersReducer, {
  clearSuppliersError,
  clearSelectedSupplier,
  resetSuppliers,
  fetchSuppliersThunk,
  fetchSupplierByIdThunk,
  createSupplierThunk,
  updateSupplierThunk,
  deleteSupplierThunk,
  selectAllSuppliers,
  selectSortedSuppliers,
  selectSelectedSupplier,
  selectSuppliersSaving,
} from '../suppliersSlice.js';
import uploadsReducer, {
  clearUploadsError,
  clearLastImportSummary,
  resetUploads,
  fetchUploadsThunk,
  fetchUploadByIdThunk,
  uploadImageThunk,
  importProductsCsvThunk,
  attachProductImageThunk,
  deleteUploadThunk,
  selectAllUploads,
  selectImageUploads,
  selectImportUploads,
  selectLastImportSummary,
  selectLastUploaded,
  selectSelectedUpload,
  selectUploadsUploading,
  selectUploadsError,
} from '../uploadsSlice.js';

console.log('🧪 Starting unit test suite for productsSlice, suppliersSlice, uploadsSlice & cross-slice logout...\n');

if (typeof globalThis.localStorage === 'undefined') {
  const map = new Map();
  globalThis.localStorage = {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    clear: () => map.clear(),
  };
}
if (typeof globalThis.sessionStorage === 'undefined') {
  const smap = new Map();
  globalThis.sessionStorage = {
    getItem: (k) => (smap.has(k) ? smap.get(k) : null),
    setItem: (k, v) => smap.set(k, String(v)),
    removeItem: (k) => smap.delete(k),
    clear: () => smap.clear(),
  };
}

const originalFetch = globalThis.fetch;
function mockRes(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ============================================================================
// PART 1: productsSlice (CRUD, soft-delete, 409, race guard, selectors)
// ============================================================================
{
  const store = configureStore({ reducer: { products: productsReducer } });

  let resolveSlow;
  let resolveFast;
  let callNum = 0;

  globalThis.fetch = (url, opts) => {
    const u = String(url);
    if (u.includes('/categories')) return Promise.resolve(mockRes(['Dairy', 'Groceries']));
    if (u.includes('/barcode/8901200001')) return Promise.resolve(mockRes({ id: 'P001', name: 'Basmati Rice', active: true, category: 'Groceries' }));
    if (u.includes('/activity')) return Promise.resolve(mockRes([{ id: 'ACT-1', summary: 'Price updated' }]));
    if (u.endsWith('/api/products/P001') && (!opts?.method || opts.method === 'GET')) {
      return Promise.resolve(mockRes({ id: 'P001', name: 'Basmati Rice', active: true, category: 'Groceries', version: 2 }));
    }
    if (u.endsWith('/api/products') && opts?.method === 'POST') {
      return Promise.resolve(mockRes({ id: 'P050', name: 'Poha', active: true, category: 'Groceries', version: 1 }, 201));
    }
    if (u.endsWith('/api/products/P050') && opts?.method === 'PUT') {
      return Promise.resolve(mockRes({ message: 'Product P050 was modified elsewhere' }, 409));
    }
    if (u.endsWith('/api/products/P050') && opts?.method === 'DELETE') {
      return Promise.resolve(mockRes({ message: 'Product P050 deactivated', product: { id: 'P050', name: 'Poha', active: false, category: 'Groceries', version: 2 } }));
    }
    callNum += 1;
    if (callNum === 1) {
      return new Promise((r) => {
        resolveSlow = () => r(mockRes([{ id: 'P001', name: 'Stale Rice', active: true, category: 'Groceries' }]));
      });
    }
    return new Promise((r) => {
      resolveFast = () => r(mockRes([{ id: 'P001', name: 'Fresh Rice', active: true, category: 'Groceries' }]));
    });
  };

  try {
    // Overlapping fetchProductsThunk out-of-order check
    const pSlow = store.dispatch(fetchProductsThunk({ includeInactive: 'true' }));
    const pFast = store.dispatch(fetchProductsThunk({ includeInactive: 'true' }));
    resolveFast();
    await pFast;
    resolveSlow();
    await pSlow;
    assert.equal(selectAllProducts(store.getState())[0].name, 'Fresh Rice');

    await store.dispatch(fetchProductCategoriesThunk());
    assert.deepEqual(selectProductCategories(store.getState()), ['Dairy', 'Groceries']);

    await store.dispatch(fetchProductByIdThunk('P001'));
    assert.equal(selectSelectedProduct(store.getState()).id, 'P001');

    await store.dispatch(fetchProductByBarcodeThunk({ barcode: '8901200001' }));
    await store.dispatch(fetchProductActivityThunk({ productId: 'P001' }));
    assert.equal(selectActivityByProduct(store.getState()).P001.length, 1);

    // DB-first pending check
    const pendingCreate = store.dispatch(createProductThunk({ name: 'Poha', category: 'Groceries', price: 45, supplierId: 'SUP-001' }));
    assert.equal(selectProductsSaving(store.getState()), true);
    assert.equal(selectAllProducts(store.getState()).length, 1, 'Pending create must not insert product optimistically');
    await pendingCreate.unwrap();
    assert.equal(selectProductsSaving(store.getState()), false);
    assert.equal(selectAllProducts(store.getState()).length, 2);

    // 409 version conflict on update
    let conflictErr = null;
    try {
      await store.dispatch(updateProductThunk({ id: 'P050', body: { price: 99, version: 0 } })).unwrap();
    } catch (err) {
      conflictErr = err;
    }
    assert.equal(conflictErr.status, 409);
    assert.ok(conflictErr.message.includes('modified elsewhere'));

    // Soft-delete preserves record with active=false
    await store.dispatch(deleteProductThunk('P050')).unwrap();
    assert.equal(selectAllProducts(store.getState()).length, 2, 'Soft-delete keeps deactivated item for Show Inactive');
    assert.equal(selectActiveProducts(store.getState()).length, 1);
    assert.deepEqual(selectDerivedProductCategories(store.getState()), ['Groceries']);

    store.dispatch(clearSelectedProduct());
    store.dispatch(clearProductsError());
    assert.equal(selectSelectedProduct(store.getState()), null);

    store.dispatch(resetProducts());
    assert.equal(selectAllProducts(store.getState()).length, 0);
    console.log('✓ Test 1: productsSlice CRUD, soft-delete, 409 conflict & race guard passed');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

// ============================================================================
// PART 2: suppliersSlice (CRUD, 409 conflict, sorted memoization)
// ============================================================================
{
  const store = configureStore({ reducer: { suppliers: suppliersReducer } });
  globalThis.fetch = (url, opts) => {
    const u = String(url);
    if (u.endsWith('/api/suppliers') && (!opts?.method || opts.method === 'GET')) {
      return Promise.resolve(mockRes([{ id: 'SUP-002', name: 'Zebra Foods', version: 1 }, { id: 'SUP-001', name: 'Alpha Dairy', version: 1 }]));
    }
    if (u.endsWith('/api/suppliers/SUP-001') && (!opts?.method || opts.method === 'GET')) {
      return Promise.resolve(mockRes({ id: 'SUP-001', name: 'Alpha Dairy', version: 1 }));
    }
    if (u.endsWith('/api/suppliers') && opts?.method === 'POST') {
      return Promise.resolve(mockRes({ id: 'SUP-003', name: 'Beta Spices', version: 1 }, 201));
    }
    if (u.endsWith('/api/suppliers/SUP-003') && opts?.method === 'PUT') {
      return Promise.resolve(mockRes({ id: 'SUP-003', name: 'Beta Spices Co', version: 2 }));
    }
    if (u.endsWith('/api/suppliers/SUP-001') && opts?.method === 'DELETE') {
      return Promise.resolve(mockRes({ message: 'Alpha Dairy is linked to 3 product(s)' }, 409));
    }
    if (u.endsWith('/api/suppliers/SUP-003') && opts?.method === 'DELETE') {
      return Promise.resolve(mockRes({ message: 'Supplier SUP-003 deleted' }));
    }
    throw new Error(`Unexpected URL ${u}`);
  };

  try {
    await store.dispatch(fetchSuppliersThunk()).unwrap();
    const sorted1 = selectSortedSuppliers(store.getState());
    const sorted2 = selectSortedSuppliers(store.getState());
    assert.equal(sorted1, sorted2, 'selectSortedSuppliers returns identical reference');
    assert.deepEqual(sorted1.map((s) => s.name), ['Alpha Dairy', 'Zebra Foods']);

    await store.dispatch(fetchSupplierByIdThunk('SUP-001')).unwrap();
    assert.equal(selectSelectedSupplier(store.getState()).id, 'SUP-001');

    const pCreate = store.dispatch(createSupplierThunk({ name: 'Beta Spices', mobileNo: '9876543210' }));
    assert.equal(selectSuppliersSaving(store.getState()), true);
    await pCreate.unwrap();
    assert.equal(selectSuppliersSaving(store.getState()), false);
    assert.equal(selectAllSuppliers(store.getState()).length, 3);

    await store.dispatch(updateSupplierThunk({ id: 'SUP-003', body: { name: 'Beta Spices Co', version: 1 } })).unwrap();
    assert.ok(selectAllSuppliers(store.getState()).some((s) => s.name === 'Beta Spices Co'));

    let linkedErr = null;
    try {
      await store.dispatch(deleteSupplierThunk('SUP-001')).unwrap();
    } catch (err) {
      linkedErr = err;
    }
    assert.equal(linkedErr.status, 409);

    await store.dispatch(deleteSupplierThunk('SUP-003')).unwrap();
    assert.equal(selectAllSuppliers(store.getState()).length, 2);

    store.dispatch(clearSelectedSupplier());
    store.dispatch(clearSuppliersError());
    store.dispatch(resetSuppliers());
    assert.equal(selectAllSuppliers(store.getState()).length, 0);
    console.log('✓ Test 2: suppliersSlice CRUD, 409 linked-product guard & sorted memoization passed');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

// ============================================================================
// PART 3: uploadsSlice (image, partial CSV import, attach image, error handling)
// ============================================================================
{
  const store = configureStore({ reducer: { uploads: uploadsReducer } });
  const partialSummary = {
    file: { id: 'UPL-002', originalName: 'bulk.csv', kind: 'import' },
    totalRows: 3,
    imported: 2,
    failed: 1,
    createdProductIds: ['P030', 'P031'],
    errors: [{ row: 3, reason: 'price must be more than 0' }],
  };

  globalThis.fetch = (url, opts) => {
    const u = String(url);
    if (u.endsWith('/api/uploads') && (!opts?.method || opts.method === 'GET')) {
      return Promise.resolve(mockRes([{ id: 'UPL-001', kind: 'image' }]));
    }
    if (u.endsWith('/api/uploads/UPL-001') && (!opts?.method || opts.method === 'GET')) {
      return Promise.resolve(mockRes({ id: 'UPL-001', kind: 'image', originalName: 'pic.png' }));
    }
    if (u.endsWith('/api/uploads/image')) {
      return Promise.resolve(mockRes({ id: 'UPL-003', kind: 'image', url: '/uploads/images/pic.png' }, 201));
    }
    if (u.endsWith('/api/uploads/products/csv')) {
      return Promise.resolve(mockRes(partialSummary, 201));
    }
    if (u.endsWith('/api/uploads/products/P001/image')) {
      return Promise.resolve(mockRes({ product: { id: 'P001', imageUrl: '/uploads/images/p1.png' }, upload: { id: 'UPL-004', kind: 'image' } }, 201));
    }
    if (u.endsWith('/api/uploads/UPL-099')) {
      return Promise.resolve(mockRes({ message: 'Unsupported file type "text/plain"' }, 400));
    }
    if (u.endsWith('/api/uploads/UPL-001') && opts?.method === 'DELETE') {
      return Promise.resolve(mockRes({ message: 'Deleted' }));
    }
    throw new Error(`Unexpected URL ${u}`);
  };

  try {
    await store.dispatch(fetchUploadsThunk()).unwrap();
    await store.dispatch(fetchUploadByIdThunk('UPL-001')).unwrap();
    assert.equal(selectSelectedUpload(store.getState()).id, 'UPL-001');

    const imgBlob = new Blob(['png'], { type: 'image/png' });
    const upPromise = store.dispatch(uploadImageThunk(imgBlob));
    assert.equal(selectUploadsUploading(store.getState()), true);
    await upPromise.unwrap();
    assert.equal(selectUploadsUploading(store.getState()), false);
    assert.equal(selectLastUploaded(store.getState()).id, 'UPL-003');

    const csvBlob = new Blob(['name,category,price,supplierId\nTea,Drinks,50,SUP-001\n'], { type: 'text/csv' });
    await store.dispatch(importProductsCsvThunk({ file: csvBlob, companyId: 'BIZ-101' })).unwrap();
    assert.equal(selectLastImportSummary(store.getState()).imported, 2);
    assert.equal(selectLastImportSummary(store.getState()).failed, 1);
    assert.equal(selectLastImportSummary(store.getState()).errors[0].row, 3);

    await store.dispatch(attachProductImageThunk({ productId: 'P001', file: imgBlob })).unwrap();
    assert.equal(selectImageUploads(store.getState()).length, 3);
    assert.equal(selectImportUploads(store.getState()).length, 1);

    await store.dispatch(deleteUploadThunk('UPL-001')).unwrap();
    assert.equal(selectAllUploads(store.getState()).some((u) => u.id === 'UPL-001'), false);

    store.dispatch(clearLastImportSummary());
    assert.equal(selectLastImportSummary(store.getState()), null);

    let badErr = null;
    try {
      await store.dispatch(deleteUploadThunk('UPL-099')).unwrap();
    } catch (err) {
      badErr = err;
    }
    assert.equal(badErr.status, 400);

    store.dispatch(clearUploadsError());
    assert.equal(selectUploadsError(store.getState()), null);

    store.dispatch(resetUploads());
    assert.equal(selectAllUploads(store.getState()).length, 0);
    console.log('✓ Test 3: uploadsSlice image, partial CSV summary, attach & delete passed');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

// ============================================================================
// PART 4: Root Store Cross-Slice Logout Reset (clearSession resets ALL 4 slices)
// ============================================================================
{
  injectStore(rootStore);
  rootStore.dispatch(toggleTheme());
  const themeBefore = rootStore.getState().ui.theme;

  rootStore.dispatch({
    type: fetchProductsThunk.fulfilled.type,
    meta: { requestId: rootStore.getState().products.requestIds.fetchAll },
    payload: [{ id: 'P1', name: 'Prod' }],
  });

  // Populate via real mock fetch
  globalThis.fetch = (url) => {
    const u = String(url);
    if (u.includes('/products')) return Promise.resolve(mockRes([{ id: 'P1', name: 'Prod', active: true }]));
    if (u.includes('/suppliers')) return Promise.resolve(mockRes([{ id: 'SUP-1', name: 'Vendor' }]));
    if (u.includes('/uploads')) return Promise.resolve(mockRes([{ id: 'UPL-1', kind: 'image' }]));
    return Promise.resolve(mockRes([{ id: 'INV-1', productId: 'P1', productName: 'Prod', stockAvailable: 10, active: true }]));
  };

  try {
    await rootStore.dispatch(fetchProductsThunk());
    await rootStore.dispatch(fetchSuppliersThunk());
    await rootStore.dispatch(fetchUploadsThunk());

    assert.equal(rootStore.getState().products.items.length, 1);
    assert.equal(rootStore.getState().suppliers.items.length, 1);
    assert.equal(rootStore.getState().uploads.items.length, 1);

    clearSession();

    assert.equal(rootStore.getState().products.items.length, 0);
    assert.equal(rootStore.getState().inventory.items.length, 0);
    assert.equal(rootStore.getState().suppliers.items.length, 0);
    assert.equal(rootStore.getState().uploads.items.length, 0);
    assert.equal(rootStore.getState().ui.theme, themeBefore, 'Logout must keep user UI theme preference');
    console.log('✓ Test 4: clearSession() resets all 4 domain slices cleanly while preserving UI state');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

console.log('\n========================================================================');
console.log('🎉 ALL PRODUCTS, SUPPLIERS, UPLOADS & ROOT STORE TESTS PASSED!');
console.log('========================================================================\n');
