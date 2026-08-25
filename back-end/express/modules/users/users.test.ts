import express from 'express';
import request from 'supertest';
import { errorHandler } from '../../middleware/error-handler.middleware';
import { notFoundHandler } from '../../middleware/not-found.middleware';
import { requestContextMiddleware } from '../../middleware/request-context.middleware';
import { createUsersRouter } from './users.routes';
import { UsersService } from './users.service';

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use(requestContextMiddleware);
  app.use('/api/users', createUsersRouter());
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

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
    ).rejects.toThrow('Username or email is already in use');
  });

  it('hashes the password of a newly created user', async () => {
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
    expect(service.findByUsernameInternal('newcashier')?.password).not.toBe('secret123');
  });
});

describe('Users routes', () => {
  const app = buildTestApp();

  it('rejects a request with no credential (403, matching NestJS)', async () => {
    const res = await request(app).get('/api/users');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Forbidden');
    expect(res.body.message).toContain('Missing "x-role" header');
  });

  it('rejects a role that is not permitted (403)', async () => {
    const res = await request(app).get('/api/users').set('x-role', 'cashier');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Forbidden');
  });

  it('allows an admin to list users (200)', async () => {
    const res = await request(app).get('/api/users').set('x-role', 'admin');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('returns a validation error for a malformed id (400)', async () => {
    const res = await request(app).get('/api/users/not-an-id').set('x-role', 'admin');
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Validation failed/);
  });

  it('returns 400 with field detail when creating an invalid user', async () => {
    const res = await request(app)
      .post('/api/users')
      .set('x-role', 'admin')
      .send({ username: 'x', role: 'wizard' });

    expect(res.status).toBe(400);
    expect(res.body.details).toBeDefined();
  });

  it('stamps every response with a correlation id', async () => {
    const res = await request(app).get('/api/users').set('x-role', 'admin');
    expect(res.headers['x-request-id']).toBeDefined();
  });
});
