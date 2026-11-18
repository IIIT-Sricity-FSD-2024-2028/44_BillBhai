import express from 'express';
import request from 'supertest';
import { errorHandler } from '../../middleware/error-handler.middleware';
import { notFoundHandler } from '../../middleware/not-found.middleware';
import { signAccessToken } from '../../middleware/rbac.middleware';
import { requestContextMiddleware } from '../../middleware/request-context.middleware';
import { activityService } from '../activity/activity.service';
import { usersService } from '../users/users.service';
import { createCompaniesRouter } from './companies.routes';
import { companiesService, CompaniesService } from './companies.service';

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use(requestContextMiddleware);
  app.use('/api/companies', createCompaniesRouter());
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

function bearer(id: string): string {
  const user = usersService.findOne(id);
  return `Bearer ${signAccessToken({ sub: user.id, username: user.username, role: user.role, companyId: user.companyId })}`;
}

const ADMIN = 'USR-001'; // BIZ-101 admin
const CASHIER = 'USR-002';
const SUPER = 'USR-006';
const METRO_ADMIN = 'USR-008'; // BIZ-102 admin

function registration(n: number, overrides: { company?: object; admin?: object; plan?: string } = {}) {
  return {
    company: {
      name: `Test Store ${n}`,
      email: `store${n}@teststore.in`,
      phone: '9876500000',
      ...(overrides.company || {}),
    },
    ...(overrides.plan ? { plan: overrides.plan } : {}),
    admin: {
      name: `Owner ${n}`,
      email: `owner${n}@teststore.in`,
      mobileNo: '9876500001',
      username: `owner${n}`,
      password: 'store1234',
      ...(overrides.admin || {}),
    },
  };
}

describe('CompaniesService', () => {
  let service: CompaniesService;

  beforeEach(() => {
    service = new CompaniesService();
  });

  it('lists the seeded companies', () => {
    const companies = service.findAll();
    expect(companies.map((c) => c.id)).toEqual(expect.arrayContaining(['BIZ-101', 'BIZ-102']));
    expect(companies[0].id).toBe('BIZ-101');
  });

  it('throws NotFound for an unknown id', () => {
    expect(() => service.findOne('BIZ-999')).toThrow('Company BIZ-999 not found');
  });

  it('rejects a duplicate company name or email', () => {
    expect(() =>
      service.create({ name: 'freshkart central', email: 'brand-new@freshkart.in', phone: '9870011999' }),
    ).toThrow('A business called "FreshKart Central" already exists');

    expect(() =>
      service.create({ name: 'Brand New Retail', email: 'CENTRAL@freshkart.in', phone: '9870011999' }),
    ).toThrow('A business is already registered with CENTRAL@freshkart.in');
  });

  it('applies the documented defaults to a new company (Starter plan)', () => {
    const created = service.create({ name: 'Brand New Retail', email: 'hello@brandnew.in', phone: '+91-9870011999' });

    expect(created.id).toMatch(/^BIZ-\d+$/);
    expect(created.status).toBe('Active');
    expect(created.plan).toBe('starter');
    expect(created.productsPlan).toBe('Starter Plan (Free)');
    expect(created.monthlyPrice).toBe(0);
    expect(created.subscriptionStatus).toBe('Active');
    expect(created.renewalDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(created.profit).toBe(0);
    expect(created.paymentDue).toBe(0);
    expect(created.storesCount).toBe(1);
    expect(created.tenureMonths).toBe(0);
    expect(created.version).toBe(1);
  });

  it('keeps plan key, name and price together on a plan change', () => {
    const updated = service.changePlan('BIZ-101', 'enterprise', 'chirag');
    expect(updated.plan).toBe('enterprise');
    expect(updated.productsPlan).toBe('Enterprise Plan');
    expect(updated.monthlyPrice).toBe(4999);
    expect(updated.subscriptionStatus).toBe('Active');
    expect(updated.updatedBy).toBe('chirag');
  });

  it('marks the subscription cancelled', () => {
    expect(service.cancelSubscription('BIZ-102').subscriptionStatus).toBe('Cancelled');
  });

  it('rejects an update made from a stale version (409)', () => {
    expect(() => service.update('BIZ-101', { phone: '9870000000', version: 42 })).toThrow(/since you opened it/);
  });

  it('returns the legacy delete envelope', () => {
    const result = service.remove('BIZ-101');
    expect(result.message).toBe('Company BIZ-101 deleted');
    expect(result.company.id).toBe('BIZ-101');
    expect(() => service.findOne('BIZ-101')).toThrow('Company BIZ-101 not found');
  });
});

describe('Companies routes', () => {
  const app = buildTestApp();

  describe('access', () => {
    it('rejects a request with no credential (401)', async () => {
      const res = await request(app).get('/api/companies');
      expect(res.status).toBe(401);
    });

    it('rejects a store admin listing every company (403)', async () => {
      const res = await request(app).get('/api/companies').set('Authorization', bearer(ADMIN));
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Forbidden');
    });

    it('rejects a cashier reading the company (403)', async () => {
      const res = await request(app).get('/api/companies/BIZ-101').set('Authorization', bearer(CASHIER));
      expect(res.status).toBe(403);
    });

    it('allows the super user to list companies (200)', async () => {
      const res = await request(app).get('/api/companies').set('Authorization', bearer(SUPER));
      expect(res.status).toBe(200);
      expect(res.body.map((c: { id: string }) => c.id)).toEqual(expect.arrayContaining(['BIZ-101', 'BIZ-102']));
    });

    it('lets an admin read their own company but not another (404)', async () => {
      const own = await request(app).get('/api/companies/BIZ-101').set('Authorization', bearer(ADMIN));
      expect(own.status).toBe(200);
      expect(own.body.id).toBe('BIZ-101');

      const other = await request(app).get('/api/companies/BIZ-102').set('Authorization', bearer(ADMIN));
      expect(other.status).toBe(404);
    });

    it('returns 404 for an unknown company id', async () => {
      const res = await request(app).get('/api/companies/BIZ-999').set('Authorization', bearer(SUPER));
      expect(res.status).toBe(404);
      expect(res.body.message).toBe('Company BIZ-999 not found');
    });

    it('returns a validation error for a malformed id (400)', async () => {
      const res = await request(app).get('/api/companies/not-an-id').set('Authorization', bearer(SUPER));
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Validation failed/);
    });
  });

  describe('editing', () => {
    it('lets an admin edit the basic details of their own company', async () => {
      const res = await request(app)
        .put('/api/companies/BIZ-101')
        .set('Authorization', bearer(ADMIN))
        .send({ phone: '9870099999', address: 'New address, Delhi' });
      expect(res.status).toBe(200);
      expect(res.body.phone).toBe('9870099999');
      expect(res.body.updatedBy).toBe('admin');

      const log = activityService.find({ entity: 'company', entityId: 'BIZ-101' });
      expect(log[0]).toMatchObject({ action: 'update', by: 'admin' });
      expect(log[0].changes).toHaveProperty('phone');
    });

    it('refuses an admin changing subscription or money fields (403)', async () => {
      const priceBefore = companiesService.findOne('BIZ-101').monthlyPrice;
      const res = await request(app)
        .put('/api/companies/BIZ-101')
        .set('Authorization', bearer(ADMIN))
        .send({ monthlyPrice: 0, subscriptionStatus: 'Active', phone: '9870011111' });
      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/monthlyPrice/);
      expect(res.body.message).toMatch(/subscriptionStatus/);
      expect(companiesService.findOne('BIZ-101').monthlyPrice).toBe(priceBefore);
      expect(companiesService.findOne('BIZ-101').phone).toBe('9870099999');
    });

    it('refuses an admin changing status or plan through PUT (403)', async () => {
      const status = await request(app)
        .put('/api/companies/BIZ-101')
        .set('Authorization', bearer(ADMIN))
        .send({ status: 'Suspended' });
      expect(status.status).toBe(403);

      const plan = await request(app)
        .put('/api/companies/BIZ-101')
        .set('Authorization', bearer(ADMIN))
        .send({ plan: 'enterprise' });
      expect(plan.status).toBe(403);
      expect(companiesService.findOne('BIZ-101').plan).toBe('pro');
    });

    it("refuses an admin editing another company (404)", async () => {
      const res = await request(app)
        .put('/api/companies/BIZ-102')
        .set('Authorization', bearer(ADMIN))
        .send({ phone: '9870011111' });
      expect(res.status).toBe(404);
    });

    it('lets the super user change subscription fields', async () => {
      const res = await request(app)
        .put('/api/companies/BIZ-102')
        .set('Authorization', bearer(SUPER))
        .send({ paymentDue: 1999, subscriptionStatus: 'Past Due' });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ paymentDue: 1999, subscriptionStatus: 'Past Due' });
    });

    it('validates the GSTIN and stores it upper-cased', async () => {
      const bad = await request(app)
        .put('/api/companies/BIZ-101')
        .set('Authorization', bearer(ADMIN))
        .send({ gstNo: '07ABC123' });
      expect(bad.status).toBe(400);
      expect(JSON.stringify(bad.body)).toMatch(/GSTIN/);

      const ok = await request(app)
        .put('/api/companies/BIZ-101')
        .set('Authorization', bearer(ADMIN))
        .send({ gstNo: '07aabcf9999k1z5' });
      expect(ok.status).toBe(200);
      expect(ok.body.gstNo).toBe('07AABCF9999K1Z5');
    });

    it('rejects a name already used by another business (409)', async () => {
      const res = await request(app)
        .put('/api/companies/BIZ-101')
        .set('Authorization', bearer(ADMIN))
        .send({ name: 'Metro Mart East' });
      expect(res.status).toBe(409);
    });

    it('rejects a stale version (409)', async () => {
      const res = await request(app)
        .put('/api/companies/BIZ-101')
        .set('Authorization', bearer(ADMIN))
        .send({ phone: '9870011111', version: 1 });
      expect(res.status).toBe(409);
    });

    it('rejects an empty update body (400)', async () => {
      const res = await request(app).put('/api/companies/BIZ-101').set('Authorization', bearer(SUPER)).send({});
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/At least one field must be supplied/);
    });

    it('returns 400 with field detail when creating an invalid company', async () => {
      const res = await request(app)
        .post('/api/companies')
        .set('Authorization', bearer(SUPER))
        .send({ name: 'x', email: 'not-an-email', phone: '123' });
      expect(res.status).toBe(400);
      expect(res.body.details).toBeDefined();
    });

    it('refuses a store admin creating a company (403)', async () => {
      const res = await request(app)
        .post('/api/companies')
        .set('Authorization', bearer(ADMIN))
        .send({ name: 'Sneaky Store', email: 'sneaky@store.in', phone: '9876543210' });
      expect(res.status).toBe(403);
    });
  });

  describe('plans and subscription', () => {
    it('lets an admin change their own plan', async () => {
      const res = await request(app)
        .post('/api/companies/BIZ-102/plan')
        .set('Authorization', bearer(METRO_ADMIN))
        .send({ plan: 'enterprise' });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        plan: 'enterprise',
        productsPlan: 'Enterprise Plan',
        monthlyPrice: 4999,
        subscriptionStatus: 'Active',
      });
    });

    it('rejects an unknown plan (400)', async () => {
      const res = await request(app)
        .post('/api/companies/BIZ-102/plan')
        .set('Authorization', bearer(METRO_ADMIN))
        .send({ plan: 'platinum' });
      expect(res.status).toBe(400);
    });

    it("refuses changing another company's plan (404)", async () => {
      const res = await request(app)
        .post('/api/companies/BIZ-101/plan')
        .set('Authorization', bearer(METRO_ADMIN))
        .send({ plan: 'starter' });
      expect(res.status).toBe(404);
      expect(companiesService.findOne('BIZ-101').plan).toBe('pro');
    });

    it('cancels the subscription of the admin’s own company', async () => {
      const res = await request(app)
        .post('/api/companies/BIZ-102/cancel-subscription')
        .set('Authorization', bearer(METRO_ADMIN))
        .send({ reason: 'Closing the store' });
      expect(res.status).toBe(200);
      expect(res.body.subscriptionStatus).toBe('Cancelled');

      const other = await request(app)
        .post('/api/companies/BIZ-101/cancel-subscription')
        .set('Authorization', bearer(METRO_ADMIN))
        .send({});
      expect(other.status).toBe(404);
      expect(companiesService.findOne('BIZ-101').subscriptionStatus).toBe('Active');
    });
  });

  describe('public registration', () => {
    it('creates the business and its admin together and signs the admin in', async () => {
      const res = await request(app).post('/api/companies/register').send(registration(1, { plan: 'pro' }));
      expect(res.status).toBe(201);
      expect(res.body.company).toMatchObject({
        name: 'Test Store 1',
        plan: 'pro',
        monthlyPrice: 1999,
        adminName: 'Owner 1',
        owner: 'Owner 1',
      });
      const companyId = res.body.company.id;
      expect(res.body.session).toMatchObject({
        username: 'owner1',
        role: 'admin',
        companyId,
        plan: 'pro',
        businessName: 'Test Store 1',
        tokenType: 'Bearer',
      });
      expect(res.body.session.accessToken).toEqual(expect.any(String));
      expect(res.body.session.password).toBeUndefined();

      const admins = usersService.findAll(companyId, 'admin');
      expect(admins).toHaveLength(1);
      expect(admins[0].status).toBe('Active');

      // The returned session works straight away.
      const own = await request(app)
        .get(`/api/companies/${companyId}`)
        .set('Authorization', `Bearer ${res.body.session.accessToken}`);
      expect(own.status).toBe(200);
      const foreign = await request(app)
        .get('/api/companies/BIZ-101')
        .set('Authorization', `Bearer ${res.body.session.accessToken}`);
      expect(foreign.status).toBe(404);
    });

    it('defaults to the Starter plan', async () => {
      const res = await request(app).post('/api/companies/register').send(registration(2));
      expect(res.status).toBe(201);
      expect(res.body.company.plan).toBe('starter');
      expect(res.body.company.monthlyPrice).toBe(0);
      expect(res.body.session.plan).toBe('starter');
    });

    it('refuses a business name that already exists (409) and creates no admin', async () => {
      const res = await request(app)
        .post('/api/companies/register')
        .send(registration(3, { company: { name: 'FreshKart Central' } }));
      expect(res.status).toBe(409);
      expect(usersService.findByUsernameInternal('owner3')).toBeNull();
    });

    it('refuses a username already taken (409) and leaves no orphan business', async () => {
      const before = companiesService.findAll().length;
      const res = await request(app)
        .post('/api/companies/register')
        .send(registration(4, { admin: { username: 'admin' } }));
      expect(res.status).toBe(409);
      expect(companiesService.findAll()).toHaveLength(before);
      expect(companiesService.findAll().some((c) => c.name === 'Test Store 4')).toBe(false);
    });

    it('rejects a weak password or bad GSTIN (400)', async () => {
      const weak = await request(app)
        .post('/api/companies/register')
        .send(registration(5, { admin: { password: 'password' } }));
      expect(weak.status).toBe(400);

      const gst = await request(app)
        .post('/api/companies/register')
        .send(registration(6, { company: { gstNo: 'NOT-A-GSTIN' } }));
      expect(gst.status).toBe(400);
      expect(companiesService.findAll().some((c) => c.name === 'Test Store 6')).toBe(false);
    });
  });

  describe('removal', () => {
    it('lets the super user remove a business and suspends its staff', async () => {
      const reg = await request(app).post('/api/companies/register').send(registration(7));
      const companyId = reg.body.company.id;

      const byAdmin = await request(app)
        .delete(`/api/companies/${companyId}`)
        .set('Authorization', `Bearer ${reg.body.session.accessToken}`);
      expect(byAdmin.status).toBe(403);

      const res = await request(app).delete(`/api/companies/${companyId}`).set('Authorization', bearer(SUPER));
      expect(res.status).toBe(200);
      expect(res.body.message).toBe(`Company ${companyId} deleted`);
      expect(usersService.findAll(companyId).every((u) => u.status === 'Suspended')).toBe(true);

      // The removed business's admin is signed out.
      const after = await request(app)
        .get(`/api/companies/${companyId}`)
        .set('Authorization', `Bearer ${reg.body.session.accessToken}`);
      expect(after.status).toBe(401);
    });
  });
});
