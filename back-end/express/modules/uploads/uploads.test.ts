import express from 'express';
import request from 'supertest';
import { errorHandler } from '../../middleware/error-handler.middleware';
import { notFoundHandler } from '../../middleware/not-found.middleware';
import { signAccessToken } from '../../middleware/rbac.middleware';
import { requestContextMiddleware } from '../../middleware/request-context.middleware';
// Registers the "token belongs to a real, active user" check.
import '../users/users.service';
import { inventoryService } from '../inventory/inventory.service';
import { productsService } from '../products/products.service';
import { createUploadsRouter } from './uploads.routes';

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use(requestContextMiddleware);
  app.use('/api/uploads', createUploadsRouter());
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

function bearer(sub: string, username: string, role: string, companyId: string): string {
  return `Bearer ${signAccessToken({ sub, username, role, companyId })}`;
}

const ACME_ADMIN = bearer('USR-001', 'admin', 'admin', 'BIZ-101');
const ACME_INVENTORY = bearer('USR-003', 'inventorymanager', 'inventorymanager', 'BIZ-101');

const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

function csvFile(lines: string[]) {
  return [Buffer.from(lines.join('\n')), { filename: 'products.csv', contentType: 'text/csv' }] as const;
}

describe('Uploads routes', () => {
  const app = buildTestApp();

  it('rejects an upload with no credential (401)', async () => {
    const res = await request(app).post('/api/uploads/image').attach('image', PNG_BYTES, 'photo.png');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Unauthorized');
    expect(res.body.message).toBe('Please sign in to continue.');
  });

  it('rejects a role that may not upload (403)', async () => {
    const res = await request(app)
      .post('/api/uploads/image')
      .set('x-role', 'cashier')
      .attach('image', PNG_BYTES, 'photo.png');
    expect(res.status).toBe(403);
  });

  it('accepts a PNG and returns a servable url (201)', async () => {
    const res = await request(app)
      .post('/api/uploads/image')
      .set('Authorization', ACME_INVENTORY)
      .attach('image', PNG_BYTES, 'product photo.png');

    expect(res.status).toBe(201);
    expect(res.body.kind).toBe('image');
    expect(res.body.url).toMatch(/^\/uploads\/images\//);
    expect(res.body.mimeType).toBe('image/png');
    expect(res.body.uploadedBy).toBe('inventorymanager');
  });

  it('sanitises a hostile filename so it cannot escape the upload directory', async () => {
    const res = await request(app)
      .post('/api/uploads/image')
      .set('x-role', 'admin')
      .attach('image', PNG_BYTES, '../../../etc/passwd.png');

    expect(res.status).toBe(201);
    expect(res.body.storedName).not.toContain('..');
    expect(res.body.storedName).not.toContain('/');
  });

  it('rejects a disallowed MIME type with the standard error envelope (400)', async () => {
    const res = await request(app)
      .post('/api/uploads/image')
      .set('x-role', 'admin')
      .attach('image', Buffer.from('#!/bin/sh\necho hi\n'), 'script.sh');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Bad Request');
    expect(res.body.message).toMatch(/Unsupported file type|Upload failed/);
    expect(res.body.requestId).toBeDefined();
  });

  it('returns 400 when no file is attached at all', async () => {
    const res = await request(app).post('/api/uploads/image').set('x-role', 'admin');
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/No file received/);
  });

  describe('product CSV import', () => {
    it('imports good rows, opens their stock rows and reports every bad row (201)', async () => {
      const res = await request(app)
        .post('/api/uploads/products/csv')
        .set('x-role', 'inventorymanager')
        .field('companyId', 'BIZ-101')
        .attach(
          'file',
          ...csvFile([
            'name,category,price,supplierId,size,openingStock,reorderLevel,location',
            'Test Masala,Groceries,99,SUP-001,100g,25,5,Shelf Z9',
            'Broken Row,Groceries,not-a-number,SUP-001,1kg,0,5,Shelf',
            ',Groceries,50,SUP-001,1kg,0,5,Shelf',
            'Ghost Supplier Item,Groceries,50,SUP-999,1kg,0,5,Shelf',
            'Wrong Business Item,Groceries,50,SUP-101,1kg,0,5,Shelf',
            'Basmati Rice,Groceries,50,SUP-001,1kg,0,5,Shelf',
          ]),
        );

      expect(res.status).toBe(201);
      expect(res.body.totalRows).toBe(6);
      expect(res.body.imported).toBe(1);
      expect(res.body.failed).toBe(5);
      expect(res.body.file.kind).toBe('import');

      const reasons = Object.fromEntries(
        (res.body.errors as Array<{ row: number; reason: string }>).map((e) => [e.row, e.reason]),
      );
      // Rows go through the same product schema as the Add Product form.
      expect(reasons[3]).toMatch(/price: price must be a number/);
      expect(reasons[4]).toMatch(/name|category|supplierId/);
      expect(reasons[5]).toBe('Supplier SUP-999 does not exist');
      expect(reasons[6]).toBe('Supplier SUP-101 does not belong to this business');
      expect(reasons[7]).toMatch(/A product called "Basmati Rice" already exists \(P001\)/);

      const [productId] = res.body.createdProductIds as string[];
      const product = productsService.findOne(productId);
      expect(product.companyId).toBe('BIZ-101');
      expect(product.name).toBe('Test Masala');
      expect(product.price).toBe(99);
      expect(product.active).toBe(true);

      const stock = inventoryService.findByProduct(productId);
      expect(stock.companyId).toBe('BIZ-101');
      expect(stock.stockAvailable).toBe(25);
      expect(stock.reorderLevel).toBe(5);
      expect(stock.location).toBe('Shelf Z9');
    });

    it("files a store user's import under their own business", async () => {
      const res = await request(app)
        .post('/api/uploads/products/csv')
        .set('Authorization', ACME_ADMIN)
        .attach('file', ...csvFile(['name,category,price,supplierId', 'Store Scoped Item,Snacks,45,SUP-005']));

      expect(res.status).toBe(201);
      expect(res.body.imported).toBe(1);
      expect(productsService.findOne(res.body.createdProductIds[0]).companyId).toBe('BIZ-101');
      // No opening stock column: the stock row still exists, at zero.
      expect(inventoryService.findByProduct(res.body.createdProductIds[0]).stockAvailable).toBe(0);
    });

    it('refuses a store user importing into another business (403)', async () => {
      const res = await request(app)
        .post('/api/uploads/products/csv')
        .set('Authorization', ACME_ADMIN)
        .field('companyId', 'BIZ-102')
        .attach('file', ...csvFile(['name,category,price,supplierId', 'Sneaky Item,Groceries,10,SUP-101']));

      expect(res.status).toBe(403);
      expect(productsService.findAll({ companyId: 'BIZ-102' }).some((p) => p.name === 'Sneaky Item')).toBe(false);
    });

    it('requires a companyId from a cross-company caller (400)', async () => {
      const res = await request(app)
        .post('/api/uploads/products/csv')
        .set('x-role', 'admin')
        .attach('file', ...csvFile(['name,category,price,supplierId', 'No Company,Groceries,10,SUP-001']));

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('companyId is required');
    });

    it('rejects a CSV that is missing a required column (400)', async () => {
      const res = await request(app)
        .post('/api/uploads/products/csv')
        .set('Authorization', ACME_ADMIN)
        .attach('file', ...csvFile(['name,category', 'Only Two,Groceries']));

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/missing required column\(s\): price, supplierId/i);
    });

    it('rejects a CSV with a header and no data rows (400)', async () => {
      const res = await request(app)
        .post('/api/uploads/products/csv')
        .set('Authorization', ACME_ADMIN)
        .attach('file', ...csvFile(['name,category,price,supplierId']));

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/at least one data row/);
    });

    it('keeps the import away from a cashier (403)', async () => {
      const res = await request(app)
        .post('/api/uploads/products/csv')
        .set('x-role', 'cashier')
        .attach('file', ...csvFile(['name,category,price,supplierId', 'X,Y,1,SUP-001']));
      expect(res.status).toBe(403);
    });
  });

  it('attaches an uploaded image to an existing product', async () => {
    const res = await request(app)
      .post('/api/uploads/products/P001/image')
      .set('Authorization', ACME_ADMIN)
      .attach('image', PNG_BYTES, 'rice.png');

    expect(res.status).toBe(201);
    expect(res.body.product.id).toBe('P001');
    expect(res.body.product.imageUrl).toBe(res.body.upload.url);
    expect(productsService.findOne('P001').imageUrl).toBe(res.body.upload.url);
  });

  it('404s when attaching an image to an unknown product', async () => {
    const res = await request(app)
      .post('/api/uploads/products/P999/image')
      .set('x-role', 'admin')
      .attach('image', PNG_BYTES, 'ghost.png');

    expect(res.status).toBe(404);
  });

  it('lists (with a kind filter), fetches and deletes an upload', async () => {
    const created = await request(app)
      .post('/api/uploads/image')
      .set('x-role', 'admin')
      .attach('image', PNG_BYTES, 'temp.png');
    const id = created.body.id;

    const list = await request(app).get('/api/uploads').set('x-role', 'admin');
    expect(list.status).toBe(200);
    expect(list.body.some((entry: { id: string }) => entry.id === id)).toBe(true);

    const images = await request(app).get('/api/uploads?kind=image').set('x-role', 'admin');
    expect(images.body.every((entry: { kind: string }) => entry.kind === 'image')).toBe(true);
    const imports = await request(app).get('/api/uploads?kind=import').set('x-role', 'admin');
    expect(imports.body.every((entry: { kind: string }) => entry.kind === 'import')).toBe(true);
    expect(imports.body.length).toBeGreaterThan(0);

    const one = await request(app).get(`/api/uploads/${id}`).set('x-role', 'admin');
    expect(one.status).toBe(200);

    const removed = await request(app).delete(`/api/uploads/${id}`).set('x-role', 'admin');
    expect(removed.status).toBe(200);
    expect(removed.body.message).toBe(`Upload ${id} deleted`);

    const gone = await request(app).get(`/api/uploads/${id}`).set('x-role', 'admin');
    expect(gone.status).toBe(404);
  });

  it('rejects an unknown kind filter (400)', async () => {
    const res = await request(app).get('/api/uploads?kind=video').set('x-role', 'admin');
    expect(res.status).toBe(400);
  });

  it('validates the upload id format (400)', async () => {
    const res = await request(app).get('/api/uploads/nonsense').set('x-role', 'admin');
    expect(res.status).toBe(400);
  });
});
