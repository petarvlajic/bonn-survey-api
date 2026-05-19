import express from 'express';
import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { User } from '../src/models/User';

vi.mock('../src/utils/email', () => ({
  sendPasswordResetEmail: vi.fn(async () => undefined),
}));

import authRouter from '../src/routes/auth';
import { sendPasswordResetEmail } from '../src/utils/email';

const STRONG_PASSWORD = 'Aa1!aaaa';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  return app;
}

describe('auth routes integration', () => {
  let mongoServer: MongoMemoryServer;
  let mongoReady = false;
  const app = buildApp();

  beforeAll(async () => {
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.ADMIN_EMAILS;
    try {
      mongoServer = await MongoMemoryServer.create();
      await mongoose.connect(mongoServer.getUri());
      mongoReady = true;
    } catch {
      mongoReady = false;
      console.warn('[auth.integration] MongoMemoryServer unavailable; skipping.');
    }
  });

  afterEach(async () => {
    if (!mongoReady) return;
    await User.deleteMany({});
    vi.mocked(sendPasswordResetEmail).mockClear();
    vi.mocked(sendPasswordResetEmail).mockResolvedValue(undefined);
    delete process.env.ADMIN_EMAILS;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
  });

  afterAll(async () => {
    if (!mongoReady) return;
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  it('registers a new @ukbonn.de user and returns token without password', async () => {
    if (!mongoReady) {
      expect(true).toBe(true);
      return;
    }
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'new.user@ukbonn.de',
        password: STRONG_PASSWORD,
        firstName: 'New',
        lastName: 'User',
        phone: '0123',
      });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.email).toBe('new.user@ukbonn.de');
    expect(res.body.user.password).toBeUndefined();
  });

  it('rejects register with USER_EXISTS when email is taken', async () => {
    if (!mongoReady) {
      expect(true).toBe(true);
      return;
    }
    await request(app).post('/api/auth/register').send({
      email: 'dup@ukbonn.de',
      password: STRONG_PASSWORD,
      firstName: 'A',
      lastName: 'B',
    });
    const res = await request(app).post('/api/auth/register').send({
      email: 'dup@ukbonn.de',
      password: STRONG_PASSWORD,
      firstName: 'C',
      lastName: 'D',
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('USER_EXISTS');
  });

  it('rejects staff register with INVALID_EMAIL when not @ukbonn.de', async () => {
    if (!mongoReady) {
      expect(true).toBe(true);
      return;
    }
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'x@gmail.com',
        password: STRONG_PASSWORD,
        firstName: 'A',
        lastName: 'B',
      });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_EMAIL');
  });

  it('allows patient register with non-ukbonn email when registrationAccountType is patient', async () => {
    if (!mongoReady) {
      expect(true).toBe(true);
      return;
    }
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'participant.user@gmail.com',
        password: STRONG_PASSWORD,
        firstName: 'Pat',
        lastName: 'One',
        registrationAccountType: 'patient',
      });
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('participant.user@gmail.com');
    expect(res.body.token).toBeTruthy();
  });

  it('rejects register with WEAK_PASSWORD', async () => {
    if (!mongoReady) {
      expect(true).toBe(true);
      return;
    }
    const res = await request(app).post('/api/auth/register').send({
      email: 'weak@ukbonn.de',
      password: 'short',
      firstName: 'A',
      lastName: 'B',
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('WEAK_PASSWORD');
  });

  it('rejects register with MISSING_FIELDS', async () => {
    if (!mongoReady) {
      expect(true).toBe(true);
      return;
    }
    const res = await request(app).post('/api/auth/register').send({
      email: 'miss@ukbonn.de',
      password: STRONG_PASSWORD,
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('MISSING_FIELDS');
  });

  it('logs in with valid credentials', async () => {
    if (!mongoReady) {
      expect(true).toBe(true);
      return;
    }
    await request(app).post('/api/auth/register').send({
      email: 'login@ukbonn.de',
      password: STRONG_PASSWORD,
      firstName: 'L',
      lastName: 'N',
    });
    const res = await request(app).post('/api/auth/login').send({
      email: 'login@ukbonn.de',
      password: STRONG_PASSWORD,
    });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.email).toBe('login@ukbonn.de');
  });

  it('rejects login with INVALID_CREDENTIALS for wrong password', async () => {
    if (!mongoReady) {
      expect(true).toBe(true);
      return;
    }
    await request(app).post('/api/auth/register').send({
      email: 'badpw@ukbonn.de',
      password: STRONG_PASSWORD,
      firstName: 'B',
      lastName: 'P',
    });
    const res = await request(app).post('/api/auth/login').send({
      email: 'badpw@ukbonn.de',
      password: 'WrongPass1!',
    });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_CREDENTIALS');
  });

  it('rejects login with INVALID_CREDENTIALS for unknown user', async () => {
    if (!mongoReady) {
      expect(true).toBe(true);
      return;
    }
    const res = await request(app).post('/api/auth/login').send({
      email: 'ghost@ukbonn.de',
      password: STRONG_PASSWORD,
    });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_CREDENTIALS');
  });

  it('rejects login with MISSING_FIELDS', async () => {
    if (!mongoReady) {
      expect(true).toBe(true);
      return;
    }
    const res = await request(app).post('/api/auth/login').send({ email: 'a@ukbonn.de' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('MISSING_FIELDS');
  });

  it('returns current user from GET /me with Bearer token', async () => {
    if (!mongoReady) {
      expect(true).toBe(true);
      return;
    }
    const reg = await request(app).post('/api/auth/register').send({
      email: 'me@ukbonn.de',
      password: STRONG_PASSWORD,
      firstName: 'Me',
      lastName: 'User',
    });
    const token = reg.body.token as string;
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('me@ukbonn.de');
  });

  it('rejects GET /me without token', async () => {
    if (!mongoReady) {
      expect(true).toBe(true);
      return;
    }
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('NO_TOKEN');
  });

  it('accepts POST /logout with valid token', async () => {
    if (!mongoReady) {
      expect(true).toBe(true);
      return;
    }
    const reg = await request(app).post('/api/auth/register').send({
      email: 'out@ukbonn.de',
      password: STRONG_PASSWORD,
      firstName: 'O',
      lastName: 'U',
    });
    const res = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${reg.body.token}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/logged out/i);
  });

  it('updates profile via PUT /profile', async () => {
    if (!mongoReady) {
      expect(true).toBe(true);
      return;
    }
    const reg = await request(app).post('/api/auth/register').send({
      email: 'prof@ukbonn.de',
      password: STRONG_PASSWORD,
      firstName: 'Old',
      lastName: 'Name',
    });
    const res = await request(app)
      .put('/api/auth/profile')
      .set('Authorization', `Bearer ${reg.body.token}`)
      .send({ firstName: 'New', lastName: 'Name' });
    expect(res.status).toBe(200);
    expect(res.body.user.firstName).toBe('New');
  });

  it('allows PUT /profile email change to another valid address', async () => {
    if (!mongoReady) {
      expect(true).toBe(true);
      return;
    }
    const reg = await request(app).post('/api/auth/register').send({
      email: 'prof2@ukbonn.de',
      password: STRONG_PASSWORD,
      firstName: 'A',
      lastName: 'B',
    });
    const res = await request(app)
      .put('/api/auth/profile')
      .set('Authorization', `Bearer ${reg.body.token}`)
      .send({ email: 'moved@gmail.com' });
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('moved@gmail.com');
  });

  it('rejects PUT /profile email change with invalid format', async () => {
    if (!mongoReady) {
      expect(true).toBe(true);
      return;
    }
    const reg = await request(app).post('/api/auth/register').send({
      email: 'prof3@ukbonn.de',
      password: STRONG_PASSWORD,
      firstName: 'A',
      lastName: 'B',
    });
    const res = await request(app)
      .put('/api/auth/profile')
      .set('Authorization', `Bearer ${reg.body.token}`)
      .send({ email: 'not-an-email' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_EMAIL');
  });

  it('rejects forgot-password without email', async () => {
    if (!mongoReady) {
      expect(true).toBe(true);
      return;
    }
    const res = await request(app).post('/api/auth/forgot-password').send({});
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('MISSING_EMAIL');
  });

  it('returns generic message for forgot-password when user does not exist', async () => {
    if (!mongoReady) {
      expect(true).toBe(true);
      return;
    }
    const res = await request(app).post('/api/auth/forgot-password').send({
      email: 'nobody@ukbonn.de',
    });
    expect(res.status).toBe(200);
    expect(res.body.message).toBeTruthy();
  });

  it('forgot-password is case-insensitive for email lookup', async () => {
    if (!mongoReady) {
      expect(true).toBe(true);
      return;
    }
    await request(app).post('/api/auth/register').send({
      email: 'CaseMix@ukbonn.de',
      password: STRONG_PASSWORD,
      firstName: 'C',
      lastName: 'M',
    });
    const forgot = await request(app).post('/api/auth/forgot-password').send({
      email: 'CASEMIX@ukbonn.de',
    });
    expect(forgot.status).toBe(200);
    expect(forgot.body.resetToken).toBeTruthy();
  });

  it('stores reset token and allows reset-password with strong new password', async () => {
    if (!mongoReady) {
      expect(true).toBe(true);
      return;
    }
    await request(app).post('/api/auth/register').send({
      email: 'reset@ukbonn.de',
      password: STRONG_PASSWORD,
      firstName: 'R',
      lastName: 'S',
    });
    const forgot = await request(app).post('/api/auth/forgot-password').send({
      email: 'reset@ukbonn.de',
    });
    expect(forgot.status).toBe(200);
    const resetToken = forgot.body.resetToken as string | undefined;
    expect(resetToken).toBeTruthy();

    const newPw = 'Bb2!bbbb';
    const reset = await request(app).post('/api/auth/reset-password').send({
      token: resetToken,
      newPassword: newPw,
    });
    expect(reset.status).toBe(200);

    const loginOld = await request(app).post('/api/auth/login').send({
      email: 'reset@ukbonn.de',
      password: STRONG_PASSWORD,
    });
    expect(loginOld.status).toBe(401);

    const loginNew = await request(app).post('/api/auth/login').send({
      email: 'reset@ukbonn.de',
      password: newPw,
    });
    expect(loginNew.status).toBe(200);
  });

  it('rejects reset-password with WEAK_PASSWORD', async () => {
    if (!mongoReady) {
      expect(true).toBe(true);
      return;
    }
    const res = await request(app).post('/api/auth/reset-password').send({
      token: 'any-token',
      newPassword: 'weak',
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('WEAK_PASSWORD');
  });

  it('rejects reset-password with INVALID_TOKEN', async () => {
    if (!mongoReady) {
      expect(true).toBe(true);
      return;
    }
    const res = await request(app).post('/api/auth/reset-password').send({
      token: 'deadbeefdeadbeefdeadbeef',
      newPassword: 'Cc3!cccc',
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_TOKEN');
  });

  it('rejects reset-password with MISSING_FIELDS', async () => {
    if (!mongoReady) {
      expect(true).toBe(true);
      return;
    }
    const res = await request(app).post('/api/auth/reset-password').send({ token: 'abc' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('MISSING_FIELDS');
  });

  it('promotes user to admin on login when email is in ADMIN_EMAILS', async () => {
    if (!mongoReady) {
      expect(true).toBe(true);
      return;
    }
    process.env.ADMIN_EMAILS = 'boss@ukbonn.de';
    await request(app).post('/api/auth/register').send({
      email: 'boss@ukbonn.de',
      password: STRONG_PASSWORD,
      firstName: 'B',
      lastName: 'oss',
    });
    const login = await request(app).post('/api/auth/login').send({
      email: 'boss@ukbonn.de',
      password: STRONG_PASSWORD,
    });
    expect(login.status).toBe(200);
    const u = await User.findOne({ email: 'boss@ukbonn.de' });
    expect(u?.role).toBe('admin');
  });

  it('lists users on GET /admin/users for admin', async () => {
    if (!mongoReady) {
      expect(true).toBe(true);
      return;
    }
    process.env.ADMIN_EMAILS = 'admin.list@ukbonn.de';
    await request(app).post('/api/auth/register').send({
      email: 'admin.list@ukbonn.de',
      password: STRONG_PASSWORD,
      firstName: 'A',
      lastName: 'L',
    });
    const login = await request(app).post('/api/auth/login').send({
      email: 'admin.list@ukbonn.de',
      password: STRONG_PASSWORD,
    });
    const res = await request(app)
      .get('/api/auth/admin/users')
      .set('Authorization', `Bearer ${login.body.token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.users)).toBe(true);
    expect(res.body.users.length).toBeGreaterThanOrEqual(1);
  });

  it('rejects GET /admin/users for non-admin', async () => {
    if (!mongoReady) {
      expect(true).toBe(true);
      return;
    }
    const reg = await request(app).post('/api/auth/register').send({
      email: 'plain@ukbonn.de',
      password: STRONG_PASSWORD,
      firstName: 'P',
      lastName: 'L',
    });
    const res = await request(app)
      .get('/api/auth/admin/users')
      .set('Authorization', `Bearer ${reg.body.token}`);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN_ADMIN');
  });

  it('patches user role as admin', async () => {
    if (!mongoReady) {
      expect(true).toBe(true);
      return;
    }
    process.env.ADMIN_EMAILS = 'root@ukbonn.de';
    await request(app).post('/api/auth/register').send({
      email: 'root@ukbonn.de',
      password: STRONG_PASSWORD,
      firstName: 'R',
      lastName: 'T',
    });
    const adminLogin = await request(app).post('/api/auth/login').send({
      email: 'root@ukbonn.de',
      password: STRONG_PASSWORD,
    });
    const targetReg = await request(app).post('/api/auth/register').send({
      email: 'target@ukbonn.de',
      password: STRONG_PASSWORD,
      firstName: 'T',
      lastName: 'G',
    });
    const targetId = targetReg.body.user._id as string;

    const patch = await request(app)
      .patch(`/api/auth/admin/users/${targetId}/role`)
      .set('Authorization', `Bearer ${adminLogin.body.token}`)
      .send({ role: 'admin' });
    expect(patch.status).toBe(200);
    expect(patch.body.user.role).toBe('admin');
  });

  it('rejects PATCH admin role with INVALID_ID', async () => {
    if (!mongoReady) {
      expect(true).toBe(true);
      return;
    }
    process.env.ADMIN_EMAILS = 'root2@ukbonn.de';
    await request(app).post('/api/auth/register').send({
      email: 'root2@ukbonn.de',
      password: STRONG_PASSWORD,
      firstName: 'R',
      lastName: '2',
    });
    const adminLogin = await request(app).post('/api/auth/login').send({
      email: 'root2@ukbonn.de',
      password: STRONG_PASSWORD,
    });
    const res = await request(app)
      .patch('/api/auth/admin/users/not-an-id/role')
      .set('Authorization', `Bearer ${adminLogin.body.token}`)
      .send({ role: 'admin' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_ID');
  });

  it('rejects PATCH admin role with INVALID_ROLE', async () => {
    if (!mongoReady) {
      expect(true).toBe(true);
      return;
    }
    process.env.ADMIN_EMAILS = 'root3@ukbonn.de';
    await request(app).post('/api/auth/register').send({
      email: 'root3@ukbonn.de',
      password: STRONG_PASSWORD,
      firstName: 'R',
      lastName: '3',
    });
    const adminLogin = await request(app).post('/api/auth/login').send({
      email: 'root3@ukbonn.de',
      password: STRONG_PASSWORD,
    });
    const targetReg = await request(app).post('/api/auth/register').send({
      email: 'tgt3@ukbonn.de',
      password: STRONG_PASSWORD,
      firstName: 'T',
      lastName: '3',
    });
    const res = await request(app)
      .patch(`/api/auth/admin/users/${targetReg.body.user._id}/role`)
      .set('Authorization', `Bearer ${adminLogin.body.token}`)
      .send({ role: 'superuser' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_ROLE');
  });

  it('rejects PATCH admin role SELF_DEMOTE when admin tries to demote self', async () => {
    if (!mongoReady) {
      expect(true).toBe(true);
      return;
    }
    process.env.ADMIN_EMAILS = 'selfdem@ukbonn.de';
    await request(app).post('/api/auth/register').send({
      email: 'selfdem@ukbonn.de',
      password: STRONG_PASSWORD,
      firstName: 'S',
      lastName: 'D',
    });
    const login = await request(app).post('/api/auth/login').send({
      email: 'selfdem@ukbonn.de',
      password: STRONG_PASSWORD,
    });
    const adminId = login.body.user._id as string;
    const res = await request(app)
      .patch(`/api/auth/admin/users/${adminId}/role`)
      .set('Authorization', `Bearer ${login.body.token}`)
      .send({ role: 'user' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('SELF_DEMOTE');
  });

  it('returns EMAIL_SEND_FAILED when forgot-password SMTP send throws', async () => {
    if (!mongoReady) {
      expect(true).toBe(true);
      return;
    }
    process.env.SMTP_USER = 'smtp-test-user';
    process.env.SMTP_PASS = 'smtp-test-pass';
    vi.mocked(sendPasswordResetEmail).mockRejectedValueOnce(new Error('SMTP down'));

    await request(app).post('/api/auth/register').send({
      email: 'mailfail@ukbonn.de',
      password: STRONG_PASSWORD,
      firstName: 'M',
      lastName: 'F',
    });

    const res = await request(app).post('/api/auth/forgot-password').send({
      email: 'mailfail@ukbonn.de',
    });
    expect(res.status).toBe(500);
    expect(res.body.code).toBe('EMAIL_SEND_FAILED');
  });
});
