import bcrypt from 'bcryptjs';
import express from 'express';
import request from 'supertest';
import { errorHandler } from '../../middleware/error-handler.middleware';
import { notFoundHandler } from '../../middleware/not-found.middleware';
import { signAccessToken } from '../../middleware/rbac.middleware';
import { requestContextMiddleware } from '../../middleware/request-context.middleware';
import { activityService } from '../activity/activity.service';
import { companiesService } from '../companies/companies.service';
import { createUsersRouter } from './users.routes';
import { usersService, UsersService } from './users.service';

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use(requestContextMiddleware);
  app.use('/api/users', createUsersRouter());
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

/** Bearer header for a real seeded (or created) user, signed like a login would. */
function bearer(id: string): string {
  const user = usersService.findOne(id);
  return `Bearer ${signAccessToken({ sub: user.id, username: user.username, role: user.role, companyId: user.companyId })}`;
}

let seq = 0;
function newStaff(overrides: Record<string, unknown> = {}) {
  seq += 1;
  return {
    name: `Test Staff ${seq}`,
    role: 'cashier',
    email: `staff${seq}@test-billbhai.in`,
    mobileNo: `98765${String(43210 + seq).padStart(5, '0')}`,
    username: `teststaff${seq}`,
    ...overrides,
  };
}

const ADMIN = 'USR-001'; // BIZ-101 admin
const CASHIER = 'USR-002'; // BIZ-101 cashier
const SUPER = 'USR-006'; // chirag, platform super user
const METRO_ADMIN = 'USR-008'; // BIZ-102 admin
const METRO_CASHIER = 'USR-009'; // BIZ-102 cashier

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(() => {
    service = new UsersService();
  });

  it('never exposes the password hash', () => {
    const users = service.findAll();
    expect(users.length).toBeGreaterThan(0);
    users.forEach((user) => {
      expect(user).not.toHaveProperty('password');
    });
  });

  it('stores seeded credentials as bcrypt hashes, not plain text', () => {
    const raw = service.findByUsernameInternal('admin');
    expect(raw).not.toBeNull();
    expect(raw?.password).not.toBe('admin123');
    expect(raw?.password.startsWith('$2')).toBe(true);
  });

  it('finds a user by username or email, case insensitively', () => {
    expect(service.findByUsernameInternal('ADMIN')?.id).toBe('USR-001');
    expect(service.findByUsernameInternal('admin@billbhai.com')?.id).toBe('USR-001');
    expect(service.findByUsernameInternal('nobody')).toBeNull();
  });

  it('filters by company and role', () => {
    const metro = service.findAll('BIZ-102');
    expect(metro.map((u) => u.id).sort()).toEqual(['USR-008', 'USR-009']);
    expect(service.findAll('BIZ-101', 'admin').map((u) => u.id)).toEqual(['USR-001']);
  });

  it('throws NotFound for an unknown id', () => {
    expect(() => service.findOne('USR-999')).toThrow('User USR-999 not found');
  });

  it('rejects a duplicate username', async () => {
    await expect(
      service.create({
        companyId: 'BIZ-101',
        name: 'Duplicate Admin',
        role: 'admin',
        email: 'brand-new@billbhai.com',
        mobileNo: '9999999999',
        username: 'admin',
        password: 'secret123',
      }),
    ).rejects.toThrow('Username "admin" is already taken');
  });

  it('rejects a duplicate email', async () => {
    await expect(
      service.create({
        companyId: 'BIZ-101',
        name: 'Another Person',
        role: 'cashier',
        email: 'cashier@billbhai.com',
        mobileNo: '9999999999',
        username: 'brandnewname',
        password: 'secret123',
      }),
    ).rejects.toThrow('cashier@billbhai.com is already used by another account');
  });

  it('hashes the password of a newly created user and returns no temporary password', async () => {
    const created = await service.create({
      companyId: 'BIZ-101',
      name: 'New Cashier',
      role: 'cashier',
      email: 'new.cashier@billbhai.com',
      mobileNo: '9812345678',
      username: 'newcashier',
      password: 'secret123',
    });

    expect(created).not.toHaveProperty('password');
    expect(created).not.toHaveProperty('temporaryPassword');
    expect(created.id).toBe('USR-010');
    expect(created.version).toBe(1);
    const raw = service.findByUsernameInternal('newcashier');
    expect(raw?.password).not.toBe('secret123');
    expect(await bcrypt.compare('secret123', raw!.password)).toBe(true);
  });

  it('generates a readable temporary password when none is given', async () => {
    const created = await service.create({
      companyId: 'BIZ-101',
      name: 'No Password',
      role: 'cashier',
      email: 'nopass@billbhai.com',
      mobileNo: '9812345679',
      username: 'nopass',
    });

    expect(created.temporaryPassword).toMatch(/^[a-z]{4}\d{4}$/);
    const raw = service.findByUsernameInternal('nopass');
    expect(await bcrypt.compare(created.temporaryPassword!, raw!.password)).toBe(true);
  });

  it('rejects a stale version on update (409)', async () => {
    await expect(service.update('USR-002', { name: 'Komal S', version: 99 })).rejects.toMatchObject({
      statusCode: 409,
    });
    const updated = await service.update('USR-002', { name: 'Komal S', version: 1 }, 'admin');
    expect(updated.version).toBe(2);
    expect(updated.updatedBy).toBe('admin');
  });

  it('checks the current password before changing it', async () => {
    await expect(service.changeOwnPassword('USR-002', 'wrong', 'newpass123')).rejects.toThrow(
      'Your current password is not correct',
    );
    await expect(service.changeOwnPassword('USR-002', 'cashier123', 'cashier123')).rejects.toThrow(
      'Choose a password different from the current one',
    );
    await service.changeOwnPassword('USR-002', 'cashier123', 'newpass123');
    const raw = service.findByUsernameInternal('cashier');
    expect(await bcrypt.compare('newpass123', raw!.password)).toBe(true);
  });

  it('counts staff without customers or super users', () => {
    // BIZ-101 seeds 5 staff + 1 customer login.
    expect(service.staffCount('BIZ-101')).toBe(5);
    expect(service.staffCount('BIZ-102')).toBe(2);
  });
});

describe('Users routes', () => {
  const app = buildTestApp();

  describe('credentials', () => {
    it('rejects a request with no credential (401)', async () => {
      const res = await request(app).get('/api/users');
      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Please sign in to continue.');
    });

    it('rejects an invalid bearer token (401)', async () => {
      const res = await request(app).get('/api/users').set('Authorization', 'Bearer not-a-token');
      expect(res.status).toBe(401);
    });

    it('rejects a role that is not permitted (403)', async () => {
      const res = await request(app).get('/api/users').set('Authorization', bearer(CASHIER));
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Forbidden');
    });

    it('rejects a token whose role no longer matches the account (401)', async () => {
      const forged = signAccessToken({ sub: CASHIER, username: 'cashier', role: 'admin', companyId: 'BIZ-101' });
      const res = await request(app).get('/api/users').set('Authorization', `Bearer ${forged}`);
      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/role has changed/);
    });

    it('rejects a token for an account that does not exist (401)', async () => {
      const ghost = signAccessToken({ sub: 'USR-777', username: 'ghost', role: 'admin', companyId: 'BIZ-101' });
      const res = await request(app).get('/api/users').set('Authorization', `Bearer ${ghost}`);
      expect(res.status).toBe(401);
    });
  });

  describe('scoping', () => {
    it('shows a store admin only their own staff and never a super user', async () => {
      const res = await request(app).get('/api/users').set('Authorization', bearer(ADMIN));
      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThan(0);
      res.body.forEach((u: { companyId: string; role: string; password?: string }) => {
        expect(u.companyId).toBe('BIZ-101');
        expect(u.role).not.toBe('superuser');
        expect(u.password).toBeUndefined();
      });
    });

    it('refuses a store admin asking for another company (403)', async () => {
      const res = await request(app).get('/api/users?companyId=BIZ-102').set('Authorization', bearer(ADMIN));
      expect(res.status).toBe(403);
    });

    it('lets the super user see every company, including super users', async () => {
      const res = await request(app).get('/api/users').set('Authorization', bearer(SUPER));
      expect(res.status).toBe(200);
      const ids = res.body.map((u: { id: string }) => u.id);
      expect(ids).toEqual(expect.arrayContaining(['USR-001', 'USR-006', 'USR-008']));

      const metro = await request(app).get('/api/users?companyId=BIZ-102').set('Authorization', bearer(SUPER));
      expect(metro.body.map((u: { id: string }) => u.id).sort()).toEqual(['USR-008', 'USR-009']);
    });

    it("reports another company's user as not found (404)", async () => {
      const read = await request(app).get(`/api/users/${METRO_CASHIER}`).set('Authorization', bearer(ADMIN));
      expect(read.status).toBe(404);

      const edit = await request(app)
        .put(`/api/users/${METRO_CASHIER}`)
        .set('Authorization', bearer(ADMIN))
        .send({ name: 'Hijacked' });
      expect(edit.status).toBe(404);
      expect(usersService.findOne(METRO_CASHIER).name).toBe('Tanmay Das');

      const del = await request(app).delete(`/api/users/${METRO_CASHIER}`).set('Authorization', bearer(ADMIN));
      expect(del.status).toBe(404);
    });

    it('hides the platform super user from a store admin (404)', async () => {
      const res = await request(app).get(`/api/users/${SUPER}`).set('Authorization', bearer(ADMIN));
      expect(res.status).toBe(404);
    });

    it('refuses a store admin touching a super user in their own company (403)', async () => {
      const planted = await usersService.create({
        companyId: 'BIZ-101',
        name: 'Planted Super',
        role: 'superuser',
        email: 'planted.super@billbhai.com',
        mobileNo: '9812300000',
        username: 'plantedsuper',
        password: 'secret123',
      });
      const list = await request(app).get('/api/users').set('Authorization', bearer(ADMIN));
      expect(list.body.map((u: { id: string }) => u.id)).not.toContain(planted.id);

      const read = await request(app).get(`/api/users/${planted.id}`).set('Authorization', bearer(ADMIN));
      expect(read.status).toBe(403);
      const del = await request(app).delete(`/api/users/${planted.id}`).set('Authorization', bearer(ADMIN));
      expect(del.status).toBe(403);
      expect(usersService.findOne(planted.id).id).toBe(planted.id);
    });
  });

  describe('creating staff', () => {
    it('creates a user in the admin’s own company and returns a one-time temporary password', async () => {
      const res = await request(app)
        .post('/api/users')
        .set('Authorization', bearer(ADMIN))
        .send(newStaff());
      expect(res.status).toBe(201);
      expect(res.body.companyId).toBe('BIZ-101');
      expect(res.body.status).toBe('Active');
      expect(res.body.temporaryPassword).toMatch(/^[a-z]{4}\d{4}$/);
      expect(res.body.password).toBeUndefined();

      const raw = usersService.findByUsernameInternal(res.body.username);
      expect(await bcrypt.compare(res.body.temporaryPassword, raw!.password)).toBe(true);

      const log = activityService.find({ entity: 'user', entityId: res.body.id });
      expect(log[0]).toMatchObject({ action: 'create', companyId: 'BIZ-101', by: 'admin' });

      // Not returned again on read.
      const read = await request(app).get(`/api/users/${res.body.id}`).set('Authorization', bearer(ADMIN));
      expect(read.body.temporaryPassword).toBeUndefined();
    });

    it('does not return a temporary password when one is set', async () => {
      const res = await request(app)
        .post('/api/users')
        .set('Authorization', bearer(ADMIN))
        .send(newStaff({ password: 'chosen123' }));
      expect(res.status).toBe(201);
      expect(res.body.temporaryPassword).toBeUndefined();
    });

    it('refuses a store admin creating staff for another company (403)', async () => {
      const res = await request(app)
        .post('/api/users')
        .set('Authorization', bearer(ADMIN))
        .send(newStaff({ companyId: 'BIZ-102' }));
      expect(res.status).toBe(403);
    });

    it('only lets the platform super user create a super user', async () => {
      const byAdmin = await request(app)
        .post('/api/users')
        .set('Authorization', bearer(ADMIN))
        .send(newStaff({ role: 'superuser' }));
      expect(byAdmin.status).toBe(403);
      expect(byAdmin.body.message).toMatch(/Only the platform super user/);

      const bySuper = await request(app)
        .post('/api/users')
        .set('Authorization', bearer(SUPER))
        .send(newStaff({ role: 'superuser', companyId: 'PLATFORM' }));
      expect(bySuper.status).toBe(201);
      expect(bySuper.body.role).toBe('superuser');
    });

    it('requires a companyId from a cross-company caller (400)', async () => {
      const res = await request(app).post('/api/users').set('Authorization', bearer(SUPER)).send(newStaff());
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('companyId is required');
    });

    it('refuses staff for a business that does not exist (400)', async () => {
      const res = await request(app)
        .post('/api/users')
        .set('Authorization', bearer(SUPER))
        .send(newStaff({ companyId: 'BIZ-999' }));
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Business BIZ-999 does not exist');
    });

    it('enforces the plan staff limit', async () => {
      // BIZ-102 has 2 staff; the Starter plan allows 2.
      companiesService.changePlan('BIZ-102', 'starter');
      try {
        const res = await request(app)
          .post('/api/users')
          .set('Authorization', bearer(METRO_ADMIN))
          .send(newStaff());
        expect(res.status).toBe(403);
        expect(res.body.message).toMatch(/allows 2 staff accounts/);
        expect(usersService.findAll('BIZ-102')).toHaveLength(2);
      } finally {
        companiesService.changePlan('BIZ-102', 'pro');
      }
      const ok = await request(app).post('/api/users').set('Authorization', bearer(METRO_ADMIN)).send(newStaff());
      expect(ok.status).toBe(201);
      expect(ok.body.companyId).toBe('BIZ-102');
    });

    it('rejects a duplicate username (409)', async () => {
      const res = await request(app)
        .post('/api/users')
        .set('Authorization', bearer(ADMIN))
        .send(newStaff({ username: 'cashier' }));
      expect(res.status).toBe(409);
    });

    it('returns 400 with field detail when creating an invalid user', async () => {
      const res = await request(app)
        .post('/api/users')
        .set('Authorization', bearer(ADMIN))
        .send({ username: 'x', role: 'wizard' });
      expect(res.status).toBe(400);
      expect(res.body.details).toBeDefined();
    });

    it('rejects a mobile number that is not a 10-digit Indian mobile (400)', async () => {
      const res = await request(app)
        .post('/api/users')
        .set('Authorization', bearer(ADMIN))
        .send(newStaff({ mobileNo: '12345' }));
      expect(res.status).toBe(400);
    });
  });

  describe('editing and removing staff', () => {
    it('refuses self-demotion, self-suspension and self-deletion (403)', async () => {
      const demote = await request(app)
        .put(`/api/users/${ADMIN}`)
        .set('Authorization', bearer(ADMIN))
        .send({ role: 'cashier' });
      expect(demote.status).toBe(403);
      expect(demote.body.message).toBe('You cannot change your own role');

      const suspend = await request(app)
        .put(`/api/users/${ADMIN}`)
        .set('Authorization', bearer(ADMIN))
        .send({ status: 'Suspended' });
      expect(suspend.status).toBe(403);
      expect(suspend.body.message).toBe('You cannot suspend yourself');

      const del = await request(app).delete(`/api/users/${ADMIN}`).set('Authorization', bearer(ADMIN));
      expect(del.status).toBe(403);
      expect(del.body.message).toBe('You cannot delete your own account');

      expect(usersService.findOne(ADMIN)).toMatchObject({ role: 'admin', status: 'Active' });
    });

    it('lets an admin edit their own name', async () => {
      const res = await request(app)
        .put(`/api/users/${ADMIN}`)
        .set('Authorization', bearer(ADMIN))
        .send({ name: 'Arjun M' });
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Arjun M');
    });

    it('protects the last active admin of a business (409)', async () => {
      const suspend = await request(app)
        .put(`/api/users/${METRO_ADMIN}`)
        .set('Authorization', bearer(SUPER))
        .send({ status: 'Suspended' });
      expect(suspend.status).toBe(409);

      const demote = await request(app)
        .put(`/api/users/${METRO_ADMIN}`)
        .set('Authorization', bearer(SUPER))
        .send({ role: 'cashier' });
      expect(demote.status).toBe(409);

      const del = await request(app).delete(`/api/users/${METRO_ADMIN}`).set('Authorization', bearer(SUPER));
      expect(del.status).toBe(409);
      expect(del.body.message).toMatch(/only active admin/);
    });

    it('allows removing an admin once another active admin exists', async () => {
      const second = await request(app)
        .post('/api/users')
        .set('Authorization', bearer(METRO_ADMIN))
        .send(newStaff({ role: 'admin', password: 'second123' }));
      expect(second.status).toBe(201);

      const res = await request(app)
        .put(`/api/users/${second.body.id}`)
        .set('Authorization', bearer(METRO_ADMIN))
        .send({ role: 'cashier' });
      expect(res.status).toBe(200);
      expect(res.body.role).toBe('cashier');
    });

    it('refuses a store admin promoting someone to super user (403)', async () => {
      const res = await request(app)
        .put(`/api/users/${CASHIER}`)
        .set('Authorization', bearer(ADMIN))
        .send({ role: 'superuser' });
      expect(res.status).toBe(403);
      expect(usersService.findOne(CASHIER).role).toBe('cashier');
    });

    it('ends the session of a suspended or deleted account', async () => {
      const created = await request(app)
        .post('/api/users')
        .set('Authorization', bearer(ADMIN))
        .send(newStaff({ password: 'staff1234' }));
      const token = bearer(created.body.id);

      const before = await request(app).get('/api/users/me').set('Authorization', token);
      expect(before.status).toBe(200);
      expect(before.body.id).toBe(created.body.id);

      const suspend = await request(app)
        .put(`/api/users/${created.body.id}`)
        .set('Authorization', bearer(ADMIN))
        .send({ status: 'Suspended' });
      expect(suspend.status).toBe(200);

      const after = await request(app).get('/api/users/me').set('Authorization', token);
      expect(after.status).toBe(401);
      expect(after.body.message).toMatch(/not active/);

      const del = await request(app).delete(`/api/users/${created.body.id}`).set('Authorization', bearer(ADMIN));
      expect(del.status).toBe(200);
      expect(del.body.message).toBe(`User ${created.body.id} deleted`);

      const gone = await request(app).get('/api/users/me').set('Authorization', token);
      expect(gone.status).toBe(401);
      expect(gone.body.message).toMatch(/no longer exists/);
    });

    it('rejects an empty update body (400)', async () => {
      const res = await request(app).put(`/api/users/${CASHIER}`).set('Authorization', bearer(ADMIN)).send({});
      expect(res.status).toBe(400);
    });

    it('returns a validation error for a malformed id (400)', async () => {
      const res = await request(app).get('/api/users/not-an-id').set('Authorization', bearer(ADMIN));
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Validation failed/);
    });
  });

  describe('passwords and profile', () => {
    it('resets a staff password and returns the new temporary one once', async () => {
      const res = await request(app)
        .post(`/api/users/${CASHIER}/reset-password`)
        .set('Authorization', bearer(ADMIN));
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(CASHIER);
      expect(res.body.temporaryPassword).toMatch(/^[a-z]{4}\d{4}$/);
      const raw = usersService.findByUsernameInternal('cashier');
      expect(await bcrypt.compare(res.body.temporaryPassword, raw!.password)).toBe(true);
      expect(await bcrypt.compare('cashier123', raw!.password)).toBe(false);
    });

    it("refuses resetting another company's user password (404)", async () => {
      const res = await request(app)
        .post(`/api/users/${METRO_CASHIER}/reset-password`)
        .set('Authorization', bearer(ADMIN));
      expect(res.status).toBe(404);
    });

    it('returns the signed-in user from GET /me for any role', async () => {
      const res = await request(app).get('/api/users/me').set('Authorization', bearer('USR-005'));
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id: 'USR-005', role: 'returnhandler', companyId: 'BIZ-101' });
      expect(res.body.password).toBeUndefined();
    });

    it('checks the current password on PUT /me/password', async () => {
      const token = bearer(METRO_CASHIER);
      const wrong = await request(app)
        .put('/api/users/me/password')
        .set('Authorization', token)
        .send({ currentPassword: 'nope', newPassword: 'newmetro123' });
      expect(wrong.status).toBe(400);
      expect(wrong.body.message).toBe('Your current password is not correct');

      const short = await request(app)
        .put('/api/users/me/password')
        .set('Authorization', token)
        .send({ currentPassword: 'metro123', newPassword: '123' });
      expect(short.status).toBe(400);

      const ok = await request(app)
        .put('/api/users/me/password')
        .set('Authorization', token)
        .send({ currentPassword: 'metro123', newPassword: 'newmetro123' });
      expect(ok.status).toBe(200);
      const raw = usersService.findByUsernameInternal('metrocashier');
      expect(await bcrypt.compare('newmetro123', raw!.password)).toBe(true);
    });

    it('stamps every response with a correlation id', async () => {
      const res = await request(app).get('/api/users').set('Authorization', bearer(ADMIN));
      expect(res.headers['x-request-id']).toBeDefined();
    });
  });
});
