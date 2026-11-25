import assert from 'node:assert/strict';
import { productsRepo } from '../productsRepo.js';
import { inventoryRepo, mapInventoryRow } from '../inventoryRepo.js';
import { suppliersRepo } from '../suppliersRepo.js';
import { uploadsRepo } from '../uploadsRepo.js';

console.log('🧪 Starting unit test suite for 1:1 Repositories & http.js multipart handling...\n');

const originalFetch = globalThis.fetch;

function mockResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function captureFetch(responseFactory, run) {
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    return responseFactory(String(url), options);
  };
  try {
    const result = await run();
    return { result, calls };
  } finally {
    globalThis.fetch = originalFetch;
  }
}

// ============================================================================
// PART 1: productsRepo (7 endpoints)
// ============================================================================
{
  const { result, calls } = await captureFetch(
    () => mockResponse([{ id: 'P001', name: 'Rice' }]),
    () => productsRepo.getAll({ category: 'Groceries', companyId: 'BIZ-101', includeInactive: 'true' }),
  );
  assert.equal(result.length, 1);
  assert.equal(calls[0].options.method, 'GET');
  assert.ok(calls[0].url.includes('/api/products?'));
  assert.ok(calls[0].url.includes('category=Groceries'));
  assert.ok(calls[0].url.includes('companyId=BIZ-101'));
  assert.ok(calls[0].url.includes('includeInactive=true'));

  const byId = await captureFetch(() => mockResponse({ id: 'P001' }), () => productsRepo.getById('P001'));
  assert.ok(byId.calls[0].url.endsWith('/api/products/P001'));

  const cats = await captureFetch(() => mockResponse(['Dairy', 'Groceries']), () => productsRepo.getCategories({ companyId: 'BIZ-101' }));
  assert.deepEqual(cats.result, ['Dairy', 'Groceries']);
  assert.ok(cats.calls[0].url.includes('/api/products/categories?companyId=BIZ-101'));

  const byCode = await captureFetch(
    () => mockResponse({ id: 'P001' }),
    () => productsRepo.getByBarcode('890/12', { companyId: 'BIZ-101' }),
  );
  assert.ok(byCode.calls[0].url.includes('/api/products/barcode/890%2F12?companyId=BIZ-101'));

  const created = await captureFetch(
    () => mockResponse({ id: 'P029', name: 'Oats' }, 201),
    () => productsRepo.create({ name: 'Oats', price: 120 }),
  );
  assert.equal(created.calls[0].options.method, 'POST');
  assert.equal(created.calls[0].options.headers['Content-Type'], 'application/json');
  assert.equal(JSON.parse(created.calls[0].options.body).name, 'Oats');

  const updated = await captureFetch(
    () => mockResponse({ id: 'P029', price: 130 }),
    () => productsRepo.update('P029', { price: 130, version: 1 }),
  );
  assert.equal(updated.calls[0].options.method, 'PUT');
  assert.ok(updated.calls[0].url.endsWith('/api/products/P029'));

  const removed = await captureFetch(
    () => mockResponse({ message: 'Product P029 deactivated', product: { id: 'P029', active: false } }),
    () => productsRepo.remove('P029'),
  );
  assert.equal(removed.calls[0].options.method, 'DELETE');
  assert.equal(removed.result.product.active, false);
  console.log('✓ Test 1: productsRepo covers all 7 /api/products endpoints & query encoding');
}

// ============================================================================
// PART 2: inventoryRepo (9 endpoints + mapInventoryRow normalization)
// ============================================================================
{
  const rawRow = {
    id: 'INV-001',
    productId: 'P001',
    productName: 'Basmati Rice',
    category: 'Groceries',
    stockAvailable: 42,
    reorderLevel: 15,
    price: 120,
    supplierName: 'Agro',
    active: true,
    status: 'In Stock',
  };

  const all = await captureFetch(() => mockResponse([rawRow]), () => inventoryRepo.getAll({ companyId: 'BIZ-101' }));
  assert.ok(all.calls[0].url.includes('/api/inventory?companyId=BIZ-101'));
  assert.equal(all.result[0].stock, 42);
  assert.equal(all.result[0].inventoryId, 'INV-001');

  const one = await captureFetch(() => mockResponse(rawRow), () => inventoryRepo.getById('INV-001'));
  assert.ok(one.calls[0].url.endsWith('/api/inventory/INV-001'));
  assert.equal(one.result.name, 'Basmati Rice');

  const byProd = await captureFetch(() => mockResponse(rawRow), () => inventoryRepo.getByProductId('P001'));
  assert.ok(byProd.calls[0].url.endsWith('/api/inventory/product/P001'));
  assert.equal(byProd.result.cat, 'Groceries');

  const low = await captureFetch(() => mockResponse([{ ...rawRow, stockAvailable: 5, status: 'Low Stock' }]), () => inventoryRepo.getLowStock({ companyId: 'BIZ-101' }));
  assert.ok(low.calls[0].url.includes('/api/inventory/low-stock?companyId=BIZ-101'));
  assert.equal(low.result[0].status, 'Low Stock');

  const moves = await captureFetch(
    () => mockResponse([{ id: 'MOV-1', quantity: -2 }]),
    () => inventoryRepo.getMovements({ productId: 'P001', type: 'sale', limit: 100 }),
  );
  assert.ok(moves.calls[0].url.includes('/api/inventory/movements?'));
  assert.ok(moves.calls[0].url.includes('productId=P001'));
  assert.ok(moves.calls[0].url.includes('type=sale'));
  assert.ok(moves.calls[0].url.includes('limit=100'));

  const adj = await captureFetch(
    () => mockResponse({ ...rawRow, stockAvailable: 39 }),
    () => inventoryRepo.adjustStock({ productId: 'P001', adjustment: -3, reason: 'Damaged' }),
  );
  assert.equal(adj.calls[0].options.method, 'POST');
  assert.ok(adj.calls[0].url.endsWith('/api/inventory/adjust'));
  assert.equal(adj.result.stock, 39);

  const rec = await captureFetch(
    () => mockResponse({ ...rawRow, stockAvailable: 60 }),
    () => inventoryRepo.receiveStock({ productId: 'P001', quantity: 21, supplierId: '', note: '   ' }),
  );
  const recBody = JSON.parse(rec.calls[0].options.body);
  assert.equal('supplierId' in recBody, false, 'Empty supplierId omitted');
  assert.equal('note' in recBody, false, 'Blank note omitted');
  assert.equal(rec.result.stock, 60);

  const upd = await captureFetch(
    () => mockResponse({ ...rawRow, reorderLevel: 25, location: 'Aisle 2' }),
    () => inventoryRepo.update('INV-001', { reorderLevel: 25, location: 'Aisle 2' }),
  );
  assert.equal(upd.calls[0].options.method, 'PUT');
  assert.equal(upd.result.reorderLevel, 25);

  const del = await captureFetch(() => mockResponse({ message: 'Inventory deleted', inventory: rawRow }), () => inventoryRepo.remove('INV-001'));
  assert.equal(del.calls[0].options.method, 'DELETE');
  assert.equal(typeof mapInventoryRow, 'function');
  console.log('✓ Test 2: inventoryRepo covers all 9 /api/inventory endpoints & row mapping');
}

// ============================================================================
// PART 3: suppliersRepo (5 endpoints)
// ============================================================================
{
  const list = await captureFetch(() => mockResponse([{ id: 'SUP-001', name: 'Amul' }]), () => suppliersRepo.getAll({ companyId: 'BIZ-101' }));
  assert.ok(list.calls[0].url.includes('/api/suppliers?companyId=BIZ-101'));

  const one = await captureFetch(() => mockResponse({ id: 'SUP-001' }), () => suppliersRepo.getById('SUP-001'));
  assert.ok(one.calls[0].url.endsWith('/api/suppliers/SUP-001'));

  const created = await captureFetch(() => mockResponse({ id: 'SUP-010' }, 201), () => suppliersRepo.create({ name: 'Metro Wholesale', mobileNo: '9876543210' }));
  assert.equal(created.calls[0].options.method, 'POST');

  const updated = await captureFetch(() => mockResponse({ id: 'SUP-010', leadTimeDays: 3 }), () => suppliersRepo.update('SUP-010', { leadTimeDays: 3, version: 1 }));
  assert.equal(updated.calls[0].options.method, 'PUT');

  const removed = await captureFetch(() => mockResponse({ message: 'Deleted' }), () => suppliersRepo.remove('SUP-010'));
  assert.equal(removed.calls[0].options.method, 'DELETE');
  console.log('✓ Test 3: suppliersRepo covers all 5 /api/suppliers endpoints');
}

// ============================================================================
// PART 4: uploadsRepo (6 endpoints) + http.js FormData multipart handling
// ============================================================================
{
  const fakeImage = new Blob(['png-bytes'], { type: 'image/png' });
  const fakeCsv = new Blob(['name,category,price,supplierId\nTea,Beverages,80,SUP-001\n'], { type: 'text/csv' });

  const imgRes = await captureFetch(
    () => mockResponse({ id: 'UPL-001', url: '/uploads/images/photo.png', kind: 'image' }, 201),
    () => uploadsRepo.uploadImage(fakeImage),
  );
  assert.equal(imgRes.calls[0].options.method, 'POST');
  assert.ok(imgRes.calls[0].url.endsWith('/api/uploads/image'));
  assert.equal(imgRes.calls[0].options.headers['Content-Type'], undefined, 'FormData must NOT set Content-Type: application/json');
  assert.ok(imgRes.calls[0].options.body instanceof FormData, 'Body must stay FormData');
  assert.ok(imgRes.calls[0].options.body.get('image'), 'Field name must be "image" for uploadProductImage');

  const csvRes = await captureFetch(
    () => mockResponse({ imported: 1, failed: 0, createdProductIds: ['P030'] }, 201),
    () => uploadsRepo.importProductsCsv(fakeCsv, 'BIZ-101'),
  );
  assert.ok(csvRes.calls[0].url.endsWith('/api/uploads/products/csv'));
  assert.equal(csvRes.calls[0].options.headers['Content-Type'], undefined);
  assert.ok(csvRes.calls[0].options.body.get('file'), 'Field name must be "file" for uploadProductCsv');
  assert.equal(csvRes.calls[0].options.body.get('companyId'), 'BIZ-101');

  const attachRes = await captureFetch(
    () => mockResponse({ product: { id: 'P001' }, upload: { id: 'UPL-002' } }, 201),
    () => uploadsRepo.attachProductImage('P001', fakeImage),
  );
  assert.ok(attachRes.calls[0].url.endsWith('/api/uploads/products/P001/image'));
  assert.ok(attachRes.calls[0].options.body.get('image'));

  const listRes = await captureFetch(() => mockResponse([]), () => uploadsRepo.getAll('import'));
  assert.ok(listRes.calls[0].url.endsWith('/api/uploads?kind=import'));

  const oneRes = await captureFetch(() => mockResponse({ id: 'UPL-001' }), () => uploadsRepo.getById('UPL-001'));
  assert.ok(oneRes.calls[0].url.endsWith('/api/uploads/UPL-001'));

  const delRes = await captureFetch(() => mockResponse({ message: 'Upload deleted' }), () => uploadsRepo.remove('UPL-001'));
  assert.equal(delRes.calls[0].options.method, 'DELETE');
  console.log('✓ Test 4: uploadsRepo & http.js FormData multipart handling cover all 6 /api/uploads endpoints');
}

// ============================================================================
// PART 5: Error Propagation Contract Across Repos
// ============================================================================
{
  let caught = null;
  await captureFetch(
    () => mockResponse({ message: 'Product P001 was modified by someone else' }, 409),
    async () => {
      try {
        await productsRepo.update('P001', { price: 200, version: 0 });
      } catch (err) {
        caught = err;
      }
    },
  );
  assert.ok(caught instanceof Error);
  assert.equal(caught.status, 409);
  assert.equal(caught.message, 'Product P001 was modified by someone else');
  console.log('✓ Test 5: Repositories preserve HTTP status & server error message on 409/4xx failures');
}

console.log('\n========================================================================');
console.log('🎉 ALL REPOSITORY & HTTP MULTIPART TESTS PASSED FLAWLESSLY!');
console.log('========================================================================\n');
