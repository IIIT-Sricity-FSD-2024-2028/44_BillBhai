import express from 'express';
import request from 'supertest';
import { errorHandler } from '../../middleware/error-handler.middleware';
import { notFoundHandler } from '../../middleware/not-found.middleware';
import { signAccessToken } from '../../middleware/rbac.middleware';
import { requestContextMiddleware } from '../../middleware/request-context.middleware';
import { usersService } from '../users/users.service';
import { createActivityRouter } from './activity.routes';
import { ActivityService } from './activity.service';

function bearer(id: string): string {
  const user = usersService.findOne(id);
  return `Bearer ${signAccessToken({ sub: user.id, username: user.username, role: user.role, companyId: user.companyId })}`;
}

describe('ActivityService', () => {
  let service: ActivityService;

  beforeEach(() => {
    service = new ActivityService();
  });

  it('numbers entries and stamps the time', () => {
    const first = service.log({
      companyId: 'BIZ-101',
      entity: 'order',
      entityId: 'ORD-1',
      action: 'create',
      summary: 'x',
      by: 'admin',
    });
    const second = service.log({
      companyId: 'BIZ-101',
      entity: 'order',
      entityId: 'ORD-1',
      action: 'update',
      summary: 'y',
      by: 'admin',
    });
    expect(first.id).toBe('ACT-000001');
    expect(second.id).toBe('ACT-000002');
    expect(new Date(first.at).toString()).not.toBe('Invalid Date');
  });

  it('returns newest first, filtered and limited', () => {
    for (let i = 0; i < 5; i += 1) {
      service.log({ companyId: 'BIZ-101', entity: 'product', entityId: `P00${i}`, action: 'update', summary: `${i}`, by: 'a' });
    }
    service.log({ companyId: 'BIZ-102', entity: 'product', entityId: 'P101', action: 'update', summary: 'm', by: 'b' });

    const all = service.find({});
    expect(all).toHaveLength(6);
    expect(all[0].entityId).toBe('P101');
    expect(service.find({ companyId: 'BIZ-101' })).toHaveLength(5);
    expect(service.find({ entityId: 'P003' }).map((e) => e.summary)).toEqual(['3']);
    expect(service.find({ limit: 2 })).toHaveLength(2);
  });

  it('returns copies, so callers cannot rewrite history', () => {
    service.log({ companyId: 'BIZ-101', entity: 'user', entityId: 'USR-1', action: 'create', summary: 'orig', by: 'a' });
    service.find({})[0].summary = 'tampered';
    expect(service.find({})[0].summary).toBe('orig');
  });

  it('keeps at most 5000 entries', () => {
    for (let i = 0; i < 5005; i += 1) {
      service.log({ companyId: 'BIZ-101', entity: 'x', entityId: String(i), action: 'a', summary: '', by: 'a' });
    }
    expect(service.dump().entries).toHaveLength(5000);
    expect(service.find({ limit: 500 })[0].entityId).toBe('5004');
  });
});

describe('Activity routes', () => {
  const service = new ActivityService();
  const app = express();
  app.use(express.json());
  app.use(requestContextMiddleware);
  app.use('/api/activity', createActivityRouter(service));
  app.use(notFoundHandler);
  app.use(errorHandler);

  beforeAll(() => {
    service.log({ companyId: 'BIZ-101', entity: 'order', entityId: 'ORD-4829', action: 'create', summary: 'Sale', by: 'cashier' });
    service.log({ companyId: 'BIZ-101', entity: 'order', entityId: 'ORD-4829', action: 'update', summary: 'Phone changed', by: 'admin' });
    service.log({ companyId: 'BIZ-101', entity: 'product', entityId: 'P001', action: 'update', summary: 'Price changed', by: 'admin' });
    service.log({ companyId: 'BIZ-102', entity: 'order', entityId: 'ORD-9001', action: 'create', summary: 'Metro sale', by: 'metrocashier' });
  });

  it('rejects a request with no credential (401)', async () => {
    const res = await request(app).get('/api/activity');
    expect(res.status).toBe(401);
  });

  it('refuses the customer role (403)', async () => {
    const res = await request(app).get('/api/activity').set('Authorization', bearer('USR-007'));
    expect(res.status).toBe(403);
  });

  it('shows a store user only their own business', async () => {
    const res = await request(app).get('/api/activity').set('Authorization', bearer('USR-002'));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);
    res.body.forEach((e: { companyId: string }) => expect(e.companyId).toBe('BIZ-101'));
  });

  it('filters by entity and entityId, newest first', async () => {
    const res = await request(app)
      .get('/api/activity?entity=order&entityId=ORD-4829')
      .set('Authorization', bearer('USR-001'));
    expect(res.status).toBe(200);
    expect(res.body.map((e: { action: string }) => e.action)).toEqual(['update', 'create']);

    const products = await request(app).get('/api/activity?entity=product').set('Authorization', bearer('USR-003'));
    expect(products.body).toHaveLength(1);
    expect(products.body[0].entityId).toBe('P001');
  });

  it("does not leak another business's history through entityId", async () => {
    const res = await request(app).get('/api/activity?entityId=ORD-9001').set('Authorization', bearer('USR-001'));
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('refuses a store user asking for another company (403)', async () => {
    const res = await request(app).get('/api/activity?companyId=BIZ-102').set('Authorization', bearer('USR-001'));
    expect(res.status).toBe(403);
  });

  it('lets the super user read every business or pick one', async () => {
    const all = await request(app).get('/api/activity').set('Authorization', bearer('USR-006'));
    expect(all.body).toHaveLength(4);
    const metro = await request(app).get('/api/activity?companyId=BIZ-102').set('Authorization', bearer('USR-006'));
    expect(metro.body).toHaveLength(1);
    expect(metro.body[0].entityId).toBe('ORD-9001');
  });

  it('honours limit and validates it', async () => {
    const one = await request(app).get('/api/activity?limit=1').set('Authorization', bearer('USR-006'));
    expect(one.body).toHaveLength(1);
    const bad = await request(app).get('/api/activity?limit=0').set('Authorization', bearer('USR-006'));
    expect(bad.status).toBe(400);
  });
});
