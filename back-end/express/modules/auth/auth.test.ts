import express from 'express';
import request from 'supertest';
import { errorHandler } from '../../middleware/error-handler.middleware';
import { requestContextMiddleware } from '../../middleware/request-context.middleware';
import { createAuthRouter } from './auth.routes';
import { AuthService } from './auth.service';

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use(requestContextMiddleware);
  app.use('/api/auth', createAuthRouter());
  app.use(errorHandler);
  return app;
}

describe('AuthService', () => {
  const service = new AuthService();

  it('accepts a valid seeded credential', async () => {
    const user = await service.validateCredentials({
      username: 'admin',
      password: 'admin123',
    });
    expect(user.role).toBe('admin');
    expect(user).not.toHaveProperty('password');
  });

  it('rejects a wrong password', async () => {
    await expect(
      service.validateCredentials({ username: 'admin', password: 'wrong' }),
    ).rejects.toThrow('Invalid username or password');
  });

  it('gives the same message for an unknown username', async () => {
    await expect(
      service.validateCredentials({ username: 'ghost', password: 'whatever' }),
    ).rejects.toThrow('Invalid username or password');
  });

  it('issues a usable bearer token on login', async () => {
    const result = await service.login({ username: 'cashier', password: 'cashier123' });
    expect(result.tokenType).toBe('Bearer');
    expect(result.accessToken.split('.')).toHaveLength(3);
  });
});

describe('Auth routes', () => {
  const app = buildTestApp();

  it('logs in and returns a token (200)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin123' });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.password).toBeUndefined();
  });

  it('rejects bad credentials with 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'nope' });

    expect(res.status).toBe(401);
  });

  it('rejects a missing field with 400', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: 'admin' });
    expect(res.status).toBe(400);
  });

  it('accepts the issued token on a protected route', async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin123' });

    const res = await request(app)
      .get('/api/auth/profile')
      .set('Authorization', `Bearer ${login.body.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.actor.source).toBe('jwt');
    expect(res.body.actor.role).toBe('admin');
  });

  it('rejects a forged token', async () => {
    const res = await request(app)
      .get('/api/auth/profile')
      .set('Authorization', 'Bearer not.a.real.token');

    expect(res.status).toBe(401);
  });
});
