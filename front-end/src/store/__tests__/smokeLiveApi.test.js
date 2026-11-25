import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

console.log('🧪 Starting LIVE Express API Smoke Test (Real Express + Real JWT + Zero Mocks)...\n');

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

const backEndDir = path.resolve(process.cwd(), '../back-end');
const uploadTmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'billbhai-smoke-uploads-'));

function startLiveExpress() {
  return new Promise((resolve, reject) => {
    const bootScript = [
      "import { createApp } from './express/app';",
      'const app = createApp();',
      "const server = app.listen(0, '127.0.0.1', () => {",
      '  const addr = server.address();',
      "  if (addr && typeof addr === 'object') console.log('SMOKE_PORT=' + addr.port);",
      '});',
    ].join(' ');

    const tsNodeBin = path.join(backEndDir, 'node_modules/.bin/ts-node');
    const child = spawn(tsNodeBin, ['--files', '-P', 'express/tsconfig.json', '-e', bootScript], {
      cwd: backEndDir,
      env: {
        ...process.env,
        NODE_ENV: 'test',
        PERSIST: 'false',
        UPLOAD_DIR: uploadTmpDir,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`Timed out booting Express smoke server.\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`));
    }, 15000);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
      const match = stdout.match(/SMOKE_PORT=(\d+)/);
      if (match) {
        clearTimeout(timer);
        resolve({ child, port: Number(match[1]) });
      }
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('exit', (code) => {
      clearTimeout(timer);
      if (!stdout.includes('SMOKE_PORT=')) {
        reject(new Error(`Express smoke server exited (${code}).\nSTDERR:\n${stderr}`));
      }
    });
  });
}

const { child, port } = await startLiveExpress();
process.env.VITE_API_URL = `http://127.0.0.1:${port}/api`;

try {
  // Dynamically import after VITE_API_URL is set so http.js targets the live ephemeral server.
  const { api, setAuthToken, resetRedirectGuard } = await import('../../shared/lib/http.js');
  const { injectStore } = await import('../storeBridge.js');
  const { default: store } = await import('../store.js');
  const { clearSession } = await import('../../shared/lib/dashboard/session.js');
  const { productsRepo } = await import('../../features/inventory/productsRepo.js');
  const { inventoryRepo } = await import('../../features/inventory/inventoryRepo.js');
  const { suppliersRepo } = await import('../../features/inventory/suppliersRepo.js');
  const { uploadsRepo } = await import('../../features/inventory/uploadsRepo.js');
  const {
    fetchProductsThunk,
    createProductThunk,
    updateProductThunk,
    deleteProductThunk,
  } = await import('../../features/inventory/productsSlice.js');
  const {
    fetchInventoryThunk,
    fetchLowStockThunk,
    fetchMovementsThunk,
    receiveStockThunk,
    adjustStockThunk,
    updateInventoryThunk,
    deleteInventoryThunk,
  } = await import('../../features/inventory/inventorySlice.js');
  const {
    fetchSuppliersThunk,
    createSupplierThunk,
    deleteSupplierThunk,
  } = await import('../../features/inventory/suppliersSlice.js');
  const {
    fetchUploadsThunk,
    uploadImageThunk,
    importProductsCsvThunk,
    attachProductImageThunk,
    deleteUploadThunk,
  } = await import('../../features/inventory/uploadsSlice.js');

  injectStore(store);

  async function loginAs(username, password) {
    resetRedirectGuard();
    const res = await api('/auth/login', {
      method: 'POST',
      anonymous: true,
      body: { username, password },
    });
    setAuthToken(res.accessToken);
    return res;
  }

  async function expectStatus(fn, expectedStatus, label) {
    let err = null;
    try {
      await fn();
    } catch (e) {
      err = e;
    }
    assert.ok(err, `Expected error (${expectedStatus}) for ${label}`);
    assert.equal(err.status, expectedStatus, `${label}: expected HTTP ${expectedStatus}, got ${err.status} (${err.message})`);
  }

  // Capture initial seed counts as Admin for end-of-test DB cleanliness proof
  await loginAs('admin', 'admin123');
  const initialProducts = await productsRepo.getAll({ includeInactive: 'true' });
  const initialInventory = await inventoryRepo.getAll();
  const initialSuppliers = await suppliersRepo.getAll();
  const initialUploads = await uploadsRepo.getAll();

  // ============================================================================
  // 1. LIVE RBAC MATRIX + CROSS-COMPANY 403 GUARD
  // ============================================================================
  await loginAs('cashier', 'cashier123');
  assert.ok((await inventoryRepo.getAll()).length > 0, 'Cashier can read /inventory');
  assert.ok((await productsRepo.getAll()).length > 0, 'Cashier can read /products');
  await expectStatus(() => suppliersRepo.getAll(), 403, 'cashier GET /suppliers');
  await expectStatus(() => inventoryRepo.getLowStock(), 403, 'cashier GET /inventory/low-stock');
  await expectStatus(() => inventoryRepo.getMovements(), 403, 'cashier GET /inventory/movements');
  await expectStatus(() => inventoryRepo.adjustStock({ productId: 'P001', adjustment: -1, reason: 'test' }), 403, 'cashier POST /inventory/adjust');
  await expectStatus(() => productsRepo.create({ name: 'Nope', category: 'X', price: 10, supplierId: 'SUP-001' }), 403, 'cashier POST /products');
  await expectStatus(() => uploadsRepo.getAll(), 403, 'cashier GET /uploads');

  await loginAs('admin', 'admin123');
  await expectStatus(() => productsRepo.getAll({ companyId: 'BIZ-102' }), 403, 'store admin cross-company GET /products?companyId=BIZ-102');
  await expectStatus(() => inventoryRepo.getAll({ companyId: 'BIZ-102' }), 403, 'store admin cross-company GET /inventory?companyId=BIZ-102');

  await loginAs('inventorymanager', 'inventory123');
  assert.ok((await suppliersRepo.getAll()).length > 0, 'inventorymanager can read /suppliers');
  await expectStatus(() => uploadsRepo.getAll(), 403, 'inventorymanager GET /uploads');
  await expectStatus(() => inventoryRepo.remove('INV-001'), 403, 'inventorymanager DELETE /inventory/:id');

  await loginAs('chirag', 'chirag1234');
  const allBizProducts = await productsRepo.getAll({ includeInactive: 'true' });
  const biz102Products = await productsRepo.getAll({ companyId: 'BIZ-102', includeInactive: 'true' });
  assert.ok(allBizProducts.length > biz102Products.length, 'Superuser unscoped sees multiple businesses');
  assert.ok(biz102Products.every((p) => p.companyId === 'BIZ-102'), 'Superuser with companyId sees strictly BIZ-102');
  console.log('✓ Smoke 1: Live RBAC matrix + store cross-company 403 + superuser scoping verified');

  // ============================================================================
  // 2. END-TO-END REDUX THUNK ROUNDTRIP (DB-FIRST + 409 + 400 + CLEANUP)
  // ============================================================================
  await loginAs('inventorymanager', 'inventory123');
  await store.dispatch(fetchInventoryThunk()).unwrap();
  await store.dispatch(fetchProductsThunk({ includeInactive: 'true' })).unwrap();
  await store.dispatch(fetchSuppliersThunk()).unwrap();
  await store.dispatch(fetchLowStockThunk()).unwrap();

  const createdSup = await store.dispatch(
    createSupplierThunk({
      name: 'Smoke Test Supplier',
      mobileNo: '9876543210',
      leadTimeDays: 2,
      moq: 5,
    }),
  ).unwrap();
  assert.ok(createdSup.id.startsWith('SUP-'));

  const createdProd = await store.dispatch(
    createProductThunk({
      name: 'Smoke Test Quinoa',
      category: 'Grains',
      supplierId: createdSup.id,
      price: 220,
      costPrice: 160,
      openingStock: 10,
      reorderLevel: 15,
      location: 'Rack Z',
    }),
  ).unwrap();
  assert.ok(createdProd.id.startsWith('P'));

  await store.dispatch(fetchInventoryThunk()).unwrap();
  const invRow = store.getState().inventory.items.find((i) => i.productId === createdProd.id);
  assert.ok(invRow, 'Creating product opened live paired inventory row');
  assert.equal(invRow.stock, 10);

  // Receive +20 -> stock 30
  await store.dispatch(receiveStockThunk({ productId: createdProd.id, quantity: 20, supplierId: createdSup.id, note: 'Smoke challan' })).unwrap();
  assert.equal(store.getState().inventory.items.find((i) => i.productId === createdProd.id).stock, 30);

  // Adjust -5 -> stock 25
  await store.dispatch(adjustStockThunk({ productId: createdProd.id, adjustment: -5, reason: 'Smoke check' })).unwrap();
  assert.equal(store.getState().inventory.items.find((i) => i.productId === createdProd.id).stock, 25);

  // Movements ledger confirms DB audit trail
  const moves = await store.dispatch(fetchMovementsThunk({ productId: createdProd.id, limit: 20 })).unwrap();
  assert.ok(moves.length >= 3, 'Opening, receive, and adjust movements persisted in DB');

  // Negative stock rejected (400) and Redux stock stays 25
  let negErr = null;
  try {
    await store.dispatch(adjustStockThunk({ productId: createdProd.id, adjustment: -999, reason: 'Impossible' })).unwrap();
  } catch (e) {
    negErr = e;
  }
  assert.equal(negErr.status, 400);
  assert.equal(store.getState().inventory.items.find((i) => i.productId === createdProd.id).stock, 25);

  // Stale version conflict (409) on PUT /products/:id
  await store.dispatch(updateProductThunk({ id: createdProd.id, body: { price: 240, version: createdProd.version } })).unwrap();
  let staleErr = null;
  try {
    await store.dispatch(updateProductThunk({ id: createdProd.id, body: { price: 250, version: createdProd.version } })).unwrap();
  } catch (e) {
    staleErr = e;
  }
  assert.equal(staleErr.status, 409);

  // Shelf update
  await store.dispatch(updateInventoryThunk({ id: invRow.inventoryId, body: { reorderLevel: 8, location: 'Rack A' } })).unwrap();
  assert.equal(store.getState().inventory.items.find((i) => i.productId === createdProd.id).location, 'Rack A');

  // Admin: DELETE /inventory/:id returns 409 while active OR while stock > 0, then 200 after deactivation + zeroing stock!
  await loginAs('admin', 'admin123');
  let delConflictErr = null;
  try {
    await store.dispatch(deleteInventoryThunk(invRow.inventoryId)).unwrap();
  } catch (e) {
    delConflictErr = e;
  }
  assert.equal(delConflictErr.status, 409);

  await store.dispatch(deleteProductThunk(createdProd.id)).unwrap();
  let stockConflictErr = null;
  try {
    await store.dispatch(deleteInventoryThunk(invRow.inventoryId)).unwrap();
  } catch (e) {
    stockConflictErr = e;
  }
  assert.equal(stockConflictErr.status, 409);

  await store.dispatch(adjustStockThunk({ productId: createdProd.id, adjustment: -25, reason: 'Smoke cleanup to zero' })).unwrap();
  await store.dispatch(deleteInventoryThunk(invRow.inventoryId)).unwrap();
  assert.equal(store.getState().inventory.items.some((i) => i.productId === createdProd.id), false);
  console.log('✓ Smoke 2: Live Redux thunk CRUD roundtrip + 400 negative stock + 409 version & delete guards passed');

  // ============================================================================
  // 3. LIVE MULTIPART UPLOADS (PNG + PARTIAL CSV + NEGATIVE CASES) & CLEANUP
  // ============================================================================
  const pngHeader = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const pngBlob = new Blob([pngHeader], { type: 'image/png' });
  const uploadedImg = await store.dispatch(uploadImageThunk(pngBlob)).unwrap();
  assert.ok(uploadedImg.id.startsWith('UPL-'));

  const tempImgProduct = await store.dispatch(
    createProductThunk({
      name: 'Smoke Image Target',
      category: 'Grains',
      supplierId: createdSup.id,
      price: 100,
      openingStock: 0,
      reorderLevel: 1,
      location: 'Rack Z',
    }),
  ).unwrap();
  const attached = await store.dispatch(attachProductImageThunk({ productId: tempImgProduct.id, file: pngBlob })).unwrap();
  assert.ok(attached.upload.id.startsWith('UPL-'));
  const tempImgInv = await inventoryRepo.getByProductId(tempImgProduct.id);
  await store.dispatch(deleteProductThunk(tempImgProduct.id)).unwrap();
  await store.dispatch(deleteInventoryThunk(tempImgInv.inventoryId)).unwrap();

  const csvBody = [
    'name,category,price,supplierId',
    `Smoke CSV Valid,Snacks,55,${createdSup.id}`,
    `Smoke CSV Invalid,Snacks,0,${createdSup.id}`,
  ].join('\n');
  const csvBlob = new Blob([csvBody], { type: 'text/csv' });
  const csvSummary = await store.dispatch(importProductsCsvThunk({ file: csvBlob })).unwrap();
  assert.equal(csvSummary.imported, 1);
  assert.equal(csvSummary.failed, 1);
  assert.equal(csvSummary.errors.length, 1);
  assert.equal(csvSummary.createdProductIds.length, 1);

  // Wrong field name, wrong MIME type, oversized (>5MB) -> real Express/multer 400 errors surfaced
  const badFieldForm = new FormData();
  badFieldForm.append('wrongField', pngBlob, 'bad.png');
  await expectStatus(() => api('/uploads/image', { method: 'POST', body: badFieldForm }), 400, 'wrong multipart field name');

  const wrongMimeBlob = new Blob(['plain text'], { type: 'text/plain' });
  let mimeErr = null;
  try {
    await store.dispatch(uploadImageThunk(wrongMimeBlob)).unwrap();
  } catch (e) {
    mimeErr = e;
  }
  assert.equal(mimeErr.status, 400);

  const oversizedBuf = new Uint8Array(5 * 1024 * 1024 + 1024);
  oversizedBuf.set(pngHeader, 0);
  const oversizedBlob = new Blob([oversizedBuf], { type: 'image/png' });
  let sizeErr = null;
  try {
    await store.dispatch(uploadImageThunk(oversizedBlob)).unwrap();
  } catch (e) {
    sizeErr = e;
  }
  assert.equal(sizeErr.status, 400);
  assert.ok(sizeErr.message.includes('5MB') || sizeErr.message.toLowerCase().includes('larger'));

  // Clean up CSV-created product & inventory, uploaded files, and smoke supplier!
  const csvProdId = csvSummary.createdProductIds[0];
  const csvInv = await inventoryRepo.getByProductId(csvProdId);
  await store.dispatch(deleteProductThunk(csvProdId)).unwrap();
  await store.dispatch(deleteInventoryThunk(csvInv.inventoryId)).unwrap();

  // Deleting supplier while still linked to (inactive) products returns 409 Conflict;
  // reassigning those products unlinks it cleanly so DELETE /suppliers/:id succeeds (200).
  let linkedSupErr = null;
  try {
    await store.dispatch(deleteSupplierThunk(createdSup.id)).unwrap();
  } catch (e) {
    linkedSupErr = e;
  }
  assert.equal(linkedSupErr.status, 409);

  const fallbackSupplierId = initialSuppliers[0].id;
  for (const pid of [createdProd.id, tempImgProduct.id, csvProdId]) {
    const p = await productsRepo.getById(pid);
    await store.dispatch(updateProductThunk({ id: pid, body: { supplierId: fallbackSupplierId, version: p.version } })).unwrap();
  }
  await store.dispatch(deleteSupplierThunk(createdSup.id)).unwrap();
  await store.dispatch(deleteUploadThunk(uploadedImg.id)).unwrap();
  await store.dispatch(deleteUploadThunk(attached.upload.id)).unwrap();
  await store.dispatch(deleteUploadThunk(csvSummary.file.id)).unwrap();

  // Verify DB seed counts are back to original baseline (no orphan test records!)
  await store.dispatch(fetchUploadsThunk()).unwrap();
  assert.equal((await inventoryRepo.getAll()).length, initialInventory.length, 'Inventory count matches initial seed');
  assert.equal((await suppliersRepo.getAll()).length, initialSuppliers.length, 'Suppliers count matches initial seed');
  assert.equal((await uploadsRepo.getAll()).length, initialUploads.length, 'Uploads count matches initial seed');

  // Verify deactivated test products left zero active extra products
  const finalActiveCount = (await productsRepo.getAll({ includeInactive: 'false' })).length;
  const initialActiveCount = initialProducts.filter((p) => p.active !== false).length;
  assert.equal(finalActiveCount, initialActiveCount, 'Active product count matches initial seed');

  clearSession();
  console.log('✓ Smoke 3: Live PNG/CSV multipart uploads, multer error checks, and full DB cleanup verified');
  console.log('\n========================================================================');
  console.log('🎉 LIVE EXPRESS API SMOKE SUITE PASSED 100% WITH REAL SERVER & REAL JWT!');
  console.log('========================================================================\n');
} finally {
  child.kill('SIGTERM');
  fs.rmSync(uploadTmpDir, { recursive: true, force: true });
}
