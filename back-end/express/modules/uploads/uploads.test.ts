import express from 'express';
import request from 'supertest';
import { errorHandler } from '../../middleware/error-handler.middleware';
import { notFoundHandler } from '../../middleware/not-found.middleware';
import { requestContextMiddleware } from '../../middleware/request-context.middleware';
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

const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

describe('Uploads routes', () => {
  const app = buildTestApp();

  it('rejects an upload with no credential (403, matching NestJS)', async () => {
    const res = await request(app)
      .post('/api/uploads/image')
      .attach('image', PNG_BYTES, 'photo.png');

    expect(res.status).toBe(403);
    expect(res.body.message).toContain('Missing "x-role" header');
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
      .set('x-role', 'inventorymanager')
      .attach('image', PNG_BYTES, 'product photo.png');

    expect(res.status).toBe(201);
    expect(res.body.kind).toBe('image');
    expect(res.body.url).toMatch(/^\/uploads\/images\//);
    expect(res.body.mimeType).toBe('image/png');
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

  it('imports a product CSV and reports per-row failures (201)', async () => {
    const csv = [
      'name,category,price,supplierId,size',
      'Test Masala,Groceries,99,SUP-001,100g',
      'Broken Row,Groceries,not-a-number,SUP-001,1kg',
      ',Groceries,50,SUP-001,1kg',
    ].join('\n');

    const res = await request(app)
      .post('/api/uploads/products/csv')
      .set('x-role', 'inventorymanager')
      .attach('file', Buffer.from(csv), { filename: 'products.csv', contentType: 'text/csv' });

    expect(res.status).toBe(201);
    expect(res.body.totalRows).toBe(3);
    expect(res.body.imported).toBe(1);
    expect(res.body.failed).toBe(2);
    expect(res.body.errors[0].row).toBe(3);
  });

  it('rejects a CSV that is missing a required column (400)', async () => {
    const csv = 'name,category\nOnly Two,Groceries';

    const res = await request(app)
      .post('/api/uploads/products/csv')
      .set('x-role', 'admin')
      .attach('file', Buffer.from(csv), { filename: 'bad.csv', contentType: 'text/csv' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/missing required column/i);
  });

  it('attaches an uploaded image to an existing product', async () => {
    const res = await request(app)
      .post('/api/uploads/products/P001/image')
      .set('x-role', 'admin')
      .attach('image', PNG_BYTES, 'rice.png');

    expect(res.status).toBe(201);
    expect(res.body.product.id).toBe('P001');
    expect(res.body.product.imageUrl).toBe(res.body.upload.url);
  });

  it('404s when attaching an image to an unknown product', async () => {
    const res = await request(app)
      .post('/api/uploads/products/P999/image')
      .set('x-role', 'admin')
      .attach('image', PNG_BYTES, 'ghost.png');

    expect(res.status).toBe(404);
  });

  it('lists, fetches and deletes an upload', async () => {
    const created = await request(app)
      .post('/api/uploads/image')
      .set('x-role', 'admin')
      .attach('image', PNG_BYTES, 'temp.png');

    const id = created.body.id;

    const list = await request(app).get('/api/uploads').set('x-role', 'admin');
    expect(list.status).toBe(200);
    expect(list.body.some((entry: { id: string }) => entry.id === id)).toBe(true);

    const one = await request(app).get(`/api/uploads/${id}`).set('x-role', 'admin');
    expect(one.status).toBe(200);

    const removed = await request(app).delete(`/api/uploads/${id}`).set('x-role', 'admin');
    expect(removed.status).toBe(200);

    const gone = await request(app).get(`/api/uploads/${id}`).set('x-role', 'admin');
    expect(gone.status).toBe(404);
  });

  it('validates the upload id format (400)', async () => {
    const res = await request(app).get('/api/uploads/nonsense').set('x-role', 'admin');
    expect(res.status).toBe(400);
  });
});
