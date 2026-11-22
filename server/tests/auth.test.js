// Tests login, roles, blocked users and the login limit.
// The User database is replaced with a simple in-memory list so these run anywhere.
import { describe, it, expect, vi, beforeAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';

vi.hoisted(() => {
  process.env.LOGIN_RATE_LIMIT_MAX = '5';
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
beforeAll(async () => {
  app = (await import('../src/app.js')).default;
});

async function signup(body) {
  return request(app).post('/api/auth/signup').send(body);
}

describe('health', () => {
  it('answers ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
  it('sends safe headers (helmet)', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});

describe('signup', () => {
  it('creates a guest and never returns the password', async () => {
    const res = await signup({ name: 'Gita Guest', email: 'guest@test.com', password: 'password123' });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('guest');
    expect(res.body.token).toBeTruthy();
    expect(JSON.stringify(res.body)).not.toContain('password123');
  });

  it('stores a hashed password, not the real one', () => {
    expect(users[0].passwordHash).not.toBe('password123');
    expect(users[0].passwordHash.startsWith('$2')).toBe(true);
  });

  it('blocks the same email twice (409)', async () => {
    const res = await signup({ name: 'Gita Again', email: 'GUEST@test.com', password: 'password123' });
    expect(res.status).toBe(409);
  });

  it('refuses to let someone sign up as admin (400)', async () => {
    const res = await signup({ name: 'Sneaky', email: 's@test.com', password: 'password123', role: 'admin' });
    expect(res.status).toBe(400);
  });

  it('gives clear messages for bad input (400)', async () => {
    const res = await signup({ name: 'A', email: 'nope', password: '123' });
    expect(res.status).toBe(400);
    expect(res.body.details.length).toBe(3);
  });
});

describe('roles', () => {
  let guestToken;
  let partnerToken;

  beforeAll(async () => {
    const g = await request(app).post('/api/auth/login').send({ email: 'guest@test.com', password: 'password123' });
    guestToken = g.body.token;
    const p = await signup({ name: 'Pia Partner', email: 'partner@test.com', password: 'password123', role: 'partner' });
    partnerToken = p.body.token;
  });

  it('no token -> 401', async () => {
    const res = await request(app).get('/api/partner/ping');
    expect(res.status).toBe(401);
  });

  it('fake token -> 401', async () => {
    const res = await request(app).get('/api/partner/ping').set('Authorization', 'Bearer abc.def.ghi');
    expect(res.status).toBe(401);
  });

  it('guest calling a partner route -> 403', async () => {
    const res = await request(app).get('/api/partner/ping').set('Authorization', `Bearer ${guestToken}`);
    expect(res.status).toBe(403);
  });

  it('partner calling a partner route -> 200', async () => {
    const res = await request(app).get('/api/partner/ping').set('Authorization', `Bearer ${partnerToken}`);
    expect(res.status).toBe(200);
  });

  it('/me returns the logged-in user', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${guestToken}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('guest@test.com');
  });
});

describe('blocked users', () => {
  it('cannot log in (403)', async () => {
    await signup({ name: 'Bad Bob', email: 'bob@test.com', password: 'password123' });
    users.find((u) => u.email === 'bob@test.com').isBlocked = true;
    const res = await request(app).post('/api/auth/login').send({ email: 'bob@test.com', password: 'password123' });
    expect(res.status).toBe(403);
  });

  it('is stopped right away even with an old token (403)', async () => {
    const s = await signup({ name: 'Cara', email: 'cara@test.com', password: 'password123', role: 'partner' });
    users.find((u) => u.email === 'cara@test.com').isBlocked = true;
    const res = await request(app).get('/api/partner/ping').set('Authorization', `Bearer ${s.body.token}`);
    expect(res.status).toBe(403);
  });
});

describe('login', () => {
  it('wrong password gives the same message as unknown email (401)', async () => {
    const a = await request(app).post('/api/auth/login').send({ email: 'guest@test.com', password: 'wrong-pass' });
    const b = await request(app).post('/api/auth/login').send({ email: 'nobody@test.com', password: 'wrong-pass' });
    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
    expect(a.body.error).toBe(b.body.error);
  });

  it('is rate limited after too many tries (429)', async () => {
    let last;
    for (let i = 0; i < 10; i++) {
      last = await request(app).post('/api/auth/login').send({ email: 'guest@test.com', password: 'wrong-pass' });
    }
    expect(last.status).toBe(429);
  });
});

describe('cors', () => {
  it('only ever names our own frontend as allowed', async () => {
    // The server always answers "only localhost:5173 is allowed".
    // A browser on evil.com sees that it does not match and blocks the call.
    const bad = await request(app).get('/api/health').set('Origin', 'http://evil.com');
    expect(bad.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(bad.headers['access-control-allow-origin']).not.toBe('http://evil.com');
  });
});

it('keeps bcrypt working with the stored hash', async () => {
  expect(await bcrypt.compare('password123', users[0].passwordHash)).toBe(true);
});
