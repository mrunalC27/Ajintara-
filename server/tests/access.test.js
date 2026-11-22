// Checks who is allowed in, and that bad input gets a clear 400.
// None of these reach the real database, so they run anywhere.
import { describe, it, expect, vi, beforeAll } from 'vitest';
import request from 'supertest';
import { todayIST, addDaysIST } from '../src/utils/ist.js';

vi.hoisted(() => {
  process.env.JWT_SECRET = 'test-secret';
});

const users = [];
vi.mock('../src/models/User.js', () => ({
  ROLES: ['guest', 'partner', 'admin'],
  User: {
    findOne: async ({ email }) => users.find((u) => u.email === email) || null,
    findById: async (id) => users.find((u) => u._id === id) || null,
    create: async (data) => {
      const user = { _id: String(users.length + 1), isBlocked: false, ...data };
      users.push(user);
      return user;
    },
  },
}));

let app;
const tokens = {};
const fakeId = '507f1f77bcf86cd799439011';
const auth = (role) => ({ Authorization: `Bearer ${tokens[role]}` });

beforeAll(async () => {
  app = (await import('../src/app.js')).default;
  for (const role of ['guest', 'partner']) {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ name: `Test ${role}`, email: `${role}@test.com`, password: 'password123', role });
    tokens[role] = res.body.token;
  }
  // Admins can't sign up by themselves, so promote one directly
  const res = await request(app)
    .post('/api/auth/signup')
    .send({ name: 'Test admin', email: 'admin@test.com', password: 'password123' });
  tokens.admin = res.body.token;
  users.find((u) => u.email === 'admin@test.com').role = 'admin';
});

describe('not logged in -> 401', () => {
  it.each([
    ['get', '/api/partner/properties'],
    ['post', '/api/partner/properties'],
    ['get', '/api/admin/properties'],
    ['patch', `/api/admin/properties/${fakeId}/approve`],
  ])('%s %s', async (method, url) => {
    const res = await request(app)[method](url);
    expect(res.status).toBe(401);
  });
});

describe('wrong role -> 403', () => {
  it('guest cannot use partner routes', async () => {
    for (const [method, url] of [
      ['get', '/api/partner/properties'],
      ['post', '/api/partner/properties'],
      ['post', `/api/partner/properties/${fakeId}/room-types`],
      ['put', `/api/partner/room-types/${fakeId}/dates`],
    ]) {
      const res = await request(app)[method](url).set(auth('guest'));
      expect(res.status, `${method} ${url}`).toBe(403);
    }
  });

  it('guest cannot use admin routes', async () => {
    for (const [method, url] of [
      ['get', '/api/admin/properties'],
      ['patch', `/api/admin/properties/${fakeId}/approve`],
      ['patch', `/api/admin/properties/${fakeId}/reject`],
    ]) {
      const res = await request(app)[method](url).set(auth('guest'));
      expect(res.status, `${method} ${url}`).toBe(403);
    }
  });

  it('partner cannot approve their own hotel', async () => {
    const res = await request(app).patch(`/api/admin/properties/${fakeId}/approve`).set(auth('partner'));
    expect(res.status).toBe(403);
  });

  it('admin cannot use partner routes', async () => {
    const res = await request(app).get('/api/partner/properties').set(auth('admin'));
    expect(res.status).toBe(403);
  });
});

describe('bad input -> clear 400', () => {
  it('property without images', async () => {
    const res = await request(app)
      .post('/api/partner/properties')
      .set(auth('partner'))
      .send({ name: 'Sea View', city: 'Goa', address: '12 Beach Road', images: [] });
    expect(res.status).toBe(400);
    expect(res.body.details[0].field).toBe('images');
  });

  it('room type with decimal price', async () => {
    const res = await request(app)
      .post(`/api/partner/properties/${fakeId}/room-types`)
      .set(auth('partner'))
      .send({ name: 'Deluxe', basePrice: 10.5, totalRooms: 3, maxGuests: 2 });
    expect(res.status).toBe(400);
  });

  it('date change with nothing to change', async () => {
    const res = await request(app)
      .put(`/api/partner/room-types/${fakeId}/dates`)
      .set(auth('partner'))
      .send({ from: addDaysIST(todayIST(), 1), to: addDaysIST(todayIST(), 2) });
    expect(res.status).toBe(400);
  });

  it('calendar without dates', async () => {
    const res = await request(app).get(`/api/partner/room-types/${fakeId}/calendar`).set(auth('partner'));
    expect(res.status).toBe(400);
  });

  it('reject without a reason', async () => {
    const res = await request(app)
      .patch(`/api/admin/properties/${fakeId}/reject`)
      .set(auth('admin'))
      .send({});
    expect(res.status).toBe(400);
  });

  it('admin list with a made-up status', async () => {
    const res = await request(app).get('/api/admin/properties?status=banana').set(auth('admin'));
    expect(res.status).toBe(400);
  });
});

describe('public search input', () => {
  const t = todayIST();
  const ok = { city: 'Goa', checkIn: addDaysIST(t, 3), checkOut: addDaysIST(t, 5) };
  const qs = (o) => new URLSearchParams(o).toString();

  it('missing city', async () => {
    const res = await request(app).get(`/api/properties/search?${qs({ checkIn: ok.checkIn, checkOut: ok.checkOut })}`);
    expect(res.status).toBe(400);
  });
  it('check-in in the past', async () => {
    const res = await request(app).get(`/api/properties/search?${qs({ ...ok, checkIn: addDaysIST(t, -3) })}`);
    expect(res.status).toBe(400);
  });
  it('check-out before check-in', async () => {
    const res = await request(app).get(
      `/api/properties/search?${qs({ ...ok, checkIn: addDaysIST(t, 5), checkOut: addDaysIST(t, 3) })}`
    );
    expect(res.status).toBe(400);
    expect(res.body.details[0].field).toBe('checkOut');
  });
  it('too many nights', async () => {
    const res = await request(app).get(`/api/properties/search?${qs({ ...ok, checkOut: addDaysIST(t, 60) })}`);
    expect(res.status).toBe(400);
  });
  it('details with only one date', async () => {
    const res = await request(app).get(`/api/properties/${fakeId}?checkIn=${ok.checkIn}`);
    expect(res.status).toBe(400);
  });
});

it('unknown route -> 404', async () => {
  const res = await request(app).get('/api/nothing-here');
  expect(res.status).toBe(404);
});
