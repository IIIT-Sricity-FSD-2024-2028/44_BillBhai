import express from 'express';
import request from 'supertest';
import { errorHandler } from '../../middleware/error-handler.middleware';
import { notFoundHandler } from '../../middleware/not-found.middleware';
import { signAccessToken } from '../../middleware/rbac.middleware';
import { requestContextMiddleware } from '../../middleware/request-context.middleware';
// Registers the "token belongs to a real, active user" check.
import '../users/users.service';
import { createCustomersRouter } from './customers.routes';
import { CustomersService } from './customers.service';

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use(requestContextMiddleware);
  app.use('/api/customers', createCustomersRouter());
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

/** Bearer header for a real seeded user. */
function bearer(sub: string, username: string, role: string, companyId: string): string {
  return `Bearer ${signAccessToken({ sub, username, role, companyId })}`;
}

const ACME_ADMIN = bearer('USR-001', 'admin', 'admin', 'BIZ-101');
const ACME_CASHIER = bearer('USR-002', 'cashier', 'cashier', 'BIZ-101');
const METRO_ADMIN = bearer('USR-008', 'metroadmin', 'admin', 'BIZ-102');

describe('CustomersService', () => {
  let service: CustomersService;

  beforeEach(() => {
    service = new CustomersService();
  });

  it('lists the seeded customers and scopes them by company', () => {
    const acme = service.findAll('BIZ-101');
    const metro = service.findAll('BIZ-102');
    expect(acme.length).toBeGreaterThan(0);
    expect(acme.every((c) => c.companyId === 'BIZ-101')).toBe(true);
    expect(metro.every((c) => c.companyId === 'BIZ-102')).toBe(true);
    expect(metro.map((c) => c.id)).toContain('CUS-901');
    expect(service.findAll('BIZ-999')).toEqual([]);
    expect(service.findAll().length).toBe(acme.length + metro.length);
  });

  it('throws NotFound for an unknown id', () => {
    expect(() => service.findOne('CUS-999')).toThrow('Customer CUS-999 not found');
  });

  it('normalises both sides of a phone lookup', () => {
    expect(service.findByPhone('9810001001').id).toBe('CUS-001');
    expect(service.findByPhone('+91-98100 01001').id).toBe('CUS-001');
    expect(service.findByPhone('91 9810001001').id).toBe('CUS-001');
  });

  it('does not match a number that is not a valid 10-digit mobile', () => {
    expect(() => service.findByPhone('12345')).toThrow('Customer with phone 12345 not found');
    expect(() => service.findByPhone('')).toThrow(/not found/);
  });

  it('throws NotFound when no customer carries that phone', () => {
    expect(() => service.findByPhone('9999999999')).toThrow(
      'Customer with phone 9999999999 not found',
    );
  });

  it('honours the company scope on a phone lookup', () => {
    expect(service.findByPhone('9810001001', 'BIZ-101').id).toBe('CUS-001');
    expect(() => service.findByPhone('9810001001', 'BIZ-102')).toThrow(
      'Customer with phone 9810001001 not found',
    );
  });

  it('creates a customer with a normalised mobile, a fallback name and a version stamp', () => {
    const created = service.create({ companyId: 'BIZ-101', name: '   ', mobileNo: '+91-98100 09999' }, 'cashier');

    expect(created.id).toMatch(/^CUS-\d{3}$/);
    expect(created.id).not.toMatch(/^CUS-9\d\d$/);
    expect(created.name).toBe('Customer');
    expect(created.mobileNo).toBe('9810009999');
    expect(created.email).toBe('');
    expect(created.version).toBe(1);
    expect(created.updatedBy).toBe('cashier');
    expect(service.findByPhone('9810009999').id).toBe(created.id);
  });

  it('refuses a second customer with the same phone in the same company (409)', () => {
    expect(() =>
      service.create({ companyId: 'BIZ-101', name: 'Someone Else', mobileNo: '+91 98100 01001' }),
    ).toThrow(/Rahul Sharma \(CUS-001\) already uses phone 9810001001/);
  });

  it('allows the same phone in a different company', () => {
    const created = service.create({ companyId: 'BIZ-102', name: 'Rahul (Kolkata)', mobileNo: '9810001001' });
    expect(created.companyId).toBe('BIZ-102');
    expect(service.findByPhone('9810001001', 'BIZ-102').id).toBe(created.id);
    expect(service.findByPhone('9810001001', 'BIZ-101').id).toBe('CUS-001');
  });

  it('refuses an update that moves a phone onto another customer of the company', () => {
    expect(() => service.update('CUS-002', { mobileNo: '9810001001' })).toThrow(/already uses phone/);
    // Keeping its own number is not a clash.
    expect(service.update('CUS-001', { mobileNo: '+91 9810001001' }).mobileNo).toBe('9810001001');
  });

  it('bumps the version on update and rejects a stale version (409)', () => {
    const before = service.findOne('CUS-003');
    const updated = service.update('CUS-003', { address: 'New address', version: before.version }, 'admin');
    expect(updated.version).toBe(Number(before.version) + 1);
    expect(updated.updatedBy).toBe('admin');
    expect(() => service.update('CUS-003', { address: 'Again', version: before.version })).toThrow(
      /was changed by admin/,
    );
  });

  it('ignores a companyId in an update (a customer cannot be moved to another business)', () => {
    const updated = service.update('CUS-004', { companyId: 'BIZ-102', address: 'Moved?' });
    expect(updated.companyId).toBe('BIZ-101');
    expect(updated.address).toBe('Moved?');
  });

  it('returns the legacy delete envelope', () => {
    const result = service.remove('CUS-001');
    expect(result.message).toBe('Customer CUS-001 deleted');
    expect(result.customer.id).toBe('CUS-001');
    expect(() => service.findOne('CUS-001')).toThrow('Customer CUS-001 not found');
  });

  describe('walk-in customers', () => {
    it('returns the shared seeded walk-in record of each business', () => {
      expect(service.walkIn('BIZ-101').id).toBe('CUS-900');
      expect(service.walkIn('BIZ-102').id).toBe('CUS-901');
      expect(service.walkIn('BIZ-101').mobileNo).toBe('');
    });

    it('creates one walk-in record for a new business on first use and reuses it', () => {
      const before = service.findAll().length;
      const first = service.walkIn('BIZ-777');
      const second = service.walkIn('BIZ-777');
      expect(first.name).toBe('Walk-in Customer');
      expect(first.companyId).toBe('BIZ-777');
      expect(second.id).toBe(first.id);
      expect(service.findAll().length).toBe(before + 1);
    });
  });

  describe('resolveForSale', () => {
    it('uses the walk-in record when no phone is given', () => {
      const before = service.findAll().length;
      expect(service.resolveForSale('BIZ-101', { name: 'Someone' }).id).toBe('CUS-900');
      expect(service.resolveForSale('BIZ-102', { phone: '' }).id).toBe('CUS-901');
      expect(service.resolveForSale('BIZ-101', { phone: 'not a phone' }).id).toBe('CUS-900');
      expect(service.findAll().length).toBe(before);
    });

    it('finds an existing customer by id within the business', () => {
      expect(service.resolveForSale('BIZ-101', { id: 'CUS-002' }).id).toBe('CUS-002');
    });

    it('does not hand out another business customer by id', () => {
      // CUS-101 belongs to BIZ-102; with no phone this falls back to walk-in.
      expect(service.resolveForSale('BIZ-101', { id: 'CUS-101' }).id).toBe('CUS-900');
    });

    it('does not overwrite saved details with what was typed at the till', () => {
      const resolved = service.resolveForSale('BIZ-101', {
        phone: '+91 98100 01001',
        name: 'R. Sharma',
        email: 'other@example.com',
        address: 'Somewhere else',
      });
      expect(resolved.id).toBe('CUS-001');
      expect(resolved.name).toBe('Rahul Sharma');
      expect(resolved.email).toBe('rahul@example.com');
      expect(resolved.address).toBe('12, MG Road, Sector 14');
      expect(resolved.version).toBe(1);
    });

    it('fills in only the blank details of an existing customer', () => {
      // CUS-007 Rohit Bansal has no email on file.
      const resolved = service.resolveForSale('BIZ-101', {
        phone: '9810001007',
        name: 'Somebody Else',
        email: ' rohit@example.com ',
        address: 'Different address',
      });
      expect(resolved.id).toBe('CUS-007');
      expect(resolved.email).toBe('rohit@example.com');
      expect(resolved.name).toBe('Rohit Bansal');
      expect(resolved.address).toBe('7, Karol Bagh Market');
      expect(resolved.version).toBe(2);
    });

    it('creates a customer when the phone is new to the business', () => {
      const resolved = service.resolveForSale(
        'BIZ-102',
        { phone: '9810001001', name: 'New in Kolkata', address: 'Park Street' },
        'metrocashier',
      );
      expect(resolved.id).not.toBe('CUS-001');
      expect(resolved.companyId).toBe('BIZ-102');
      expect(resolved.name).toBe('New in Kolkata');
      expect(resolved.address).toBe('Park Street');
      expect(resolved.updatedBy).toBe('metrocashier');
      // A second sale to the same phone reuses it.
      expect(service.resolveForSale('BIZ-102', { phone: '9810001001' }).id).toBe(resolved.id);
    });
  });
});

describe('Customers routes', () => {
  const app = buildTestApp();

  it('rejects a request with no credential (401)', async () => {
    const res = await request(app).get('/api/customers');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Unauthorized');
    expect(res.body.message).toBe('Please sign in to continue.');
  });

  it('rejects an invalid bearer token (401)', async () => {
    const res = await request(app).get('/api/customers').set('Authorization', 'Bearer not-a-token');
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/session has expired/);
  });

  it('rejects a token for a user that does not exist (401)', async () => {
    const res = await request(app)
      .get('/api/customers')
      .set('Authorization', bearer('USR-999', 'ghost', 'admin', 'BIZ-101'));
    expect(res.status).toBe(401);
  });

  it('rejects a role that is not permitted (403)', async () => {
    const res = await request(app).get('/api/customers').set('x-role', 'customer');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Forbidden');
  });

  it('allows a cashier to list customers (200)', async () => {
    const res = await request(app).get('/api/customers').set('x-role', 'cashier');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('limits a store user to their own business', async () => {
    const res = await request(app).get('/api/customers').set('Authorization', METRO_ADMIN);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body.every((c: { companyId: string }) => c.companyId === 'BIZ-102')).toBe(true);
  });

  it("refuses a store user asking for another business's list (403)", async () => {
    const res = await request(app)
      .get('/api/customers?companyId=BIZ-101')
      .set('Authorization', METRO_ADMIN);
    expect(res.status).toBe(403);
  });

  it("reports another business's customer as not found (404)", async () => {
    const res = await request(app).get('/api/customers/CUS-001').set('Authorization', METRO_ADMIN);
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Customer CUS-001 not found');
  });

  it("does not let a store user edit or delete another business's customer", async () => {
    const put = await request(app)
      .put('/api/customers/CUS-001')
      .set('Authorization', METRO_ADMIN)
      .send({ address: 'Hijacked' });
    expect(put.status).toBe(404);

    const del = await request(app).delete('/api/customers/CUS-001').set('Authorization', METRO_ADMIN);
    expect(del.status).toBe(404);

    const own = await request(app).get('/api/customers/CUS-001').set('Authorization', ACME_ADMIN);
    expect(own.status).toBe(200);
    expect(own.body.address).toBe('12, MG Road, Sector 14');
  });

  it('scopes the phone lookup to the business of the caller', async () => {
    const own = await request(app).get('/api/customers/phone/9810001001').set('Authorization', ACME_CASHIER);
    expect(own.status).toBe(200);
    expect(own.body.id).toBe('CUS-001');

    const other = await request(app).get('/api/customers/phone/9810001001').set('Authorization', METRO_ADMIN);
    expect(other.status).toBe(404);
  });

  it('does not let /:id swallow the phone lookup', async () => {
    const res = await request(app).get('/api/customers/phone/9810001001').set('x-role', 'cashier');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('CUS-001');
  });

  it('normalises a formatted number on the phone lookup (200)', async () => {
    const res = await request(app)
      .get(`/api/customers/phone/${encodeURIComponent('+91-98100 01001')}`)
      .set('x-role', 'customer');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('CUS-001');
  });

  it('rejects a malformed phone on the lookup (400)', async () => {
    const res = await request(app).get('/api/customers/phone/12345').set('x-role', 'cashier');
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/10-digit Indian mobile/);
  });

  it('returns 404 for an unknown customer id', async () => {
    const res = await request(app).get('/api/customers/CUS-999').set('x-role', 'admin');
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Customer CUS-999 not found');
  });

  it('returns a validation error for a malformed id (400)', async () => {
    const res = await request(app).get('/api/customers/not-an-id').set('x-role', 'admin');
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Validation failed/);
  });

  it('returns 400 with field detail when creating an invalid customer', async () => {
    const res = await request(app)
      .post('/api/customers')
      .set('x-role', 'cashier')
      .send({ companyId: 'BIZ-101', mobileNo: '123' });
    expect(res.status).toBe(400);
    expect(res.body.details).toBeDefined();
  });

  it('requires a companyId from a cross-company caller (400)', async () => {
    const res = await request(app)
      .post('/api/customers')
      .set('x-role', 'cashier')
      .send({ name: 'No Company', mobileNo: '9811100001' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('companyId is required');
  });

  it("files a store user's new customer under their own business (201)", async () => {
    const res = await request(app)
      .post('/api/customers')
      .set('Authorization', ACME_CASHIER)
      .send({ name: 'Tina Roy', mobileNo: '+91 98111 00002' });
    expect(res.status).toBe(201);
    expect(res.body.companyId).toBe('BIZ-101');
    expect(res.body.mobileNo).toBe('9811100002');
    expect(res.body.updatedBy).toBe('cashier');
  });

  it('refuses a store user creating a customer for another business (403)', async () => {
    const res = await request(app)
      .post('/api/customers')
      .set('Authorization', ACME_CASHIER)
      .send({ companyId: 'BIZ-102', name: 'Elsewhere', mobileNo: '9811100003' });
    expect(res.status).toBe(403);
  });

  it('refuses a duplicate phone within the business (409)', async () => {
    const res = await request(app)
      .post('/api/customers')
      .set('Authorization', ACME_CASHIER)
      .send({ name: 'Dup', mobileNo: '9810001002' });
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/Priya Patel \(CUS-002\) already uses phone 9810001002/);
  });

  it('rejects an empty update body (400)', async () => {
    const res = await request(app).put('/api/customers/CUS-001').set('x-role', 'cashier').send({});
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/At least one field must be supplied/);
  });

  it('rejects a stale version on update (409)', async () => {
    const res = await request(app)
      .put('/api/customers/CUS-005')
      .set('Authorization', ACME_ADMIN)
      .send({ address: 'Stale write', version: 99 });
    expect(res.status).toBe(409);
    expect(res.body.details).toEqual({ currentVersion: 1 });
  });

  it('only lets an admin delete customers (403 for cashier)', async () => {
    const res = await request(app).delete('/api/customers/CUS-006').set('Authorization', ACME_CASHIER);
    expect(res.status).toBe(403);
  });
});
