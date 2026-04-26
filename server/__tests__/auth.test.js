import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app, getAdminToken, cleanDb } from './setup.js';

describe('Auth endpoints', () => {
  beforeEach(() => cleanDb());

  describe('POST /api/auth/login', () => {
    it('returns a token with a valid password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ password: 'test-password' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body.token).toBeTruthy();
      expect(res.body).toHaveProperty('message', 'Authenticated as admin');
    });

    it('rejects an invalid password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ password: 'wrong' });

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error');
    });

    it('rejects a missing password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({});

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/auth/check', () => {
    it('returns authenticated: true for a valid token', async () => {
      const token = await getAdminToken();

      const res = await request(app)
        .get('/api/auth/check')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ authenticated: true });
    });

    it('returns authenticated: false with no token', async () => {
      const res = await request(app).get('/api/auth/check');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ authenticated: false });
    });

    it('returns authenticated: false with an invalid token', async () => {
      const res = await request(app)
        .get('/api/auth/check')
        .set('Authorization', 'Bearer invalid-token');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ authenticated: false });
    });
  });

  describe('POST /api/auth/logout', () => {
    it('invalidates the token', async () => {
      const token = await getAdminToken();

      // Logout
      const logoutRes = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`);
      expect(logoutRes.status).toBe(200);

      // Token should no longer be valid
      const checkRes = await request(app)
        .get('/api/auth/check')
        .set('Authorization', `Bearer ${token}`);
      expect(checkRes.body).toEqual({ authenticated: false });
    });
  });

  describe('requireAdmin middleware', () => {
    it('blocks access without a token', async () => {
      const res = await request(app).get('/api/seasons');

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error');
    });

    it('blocks access with an invalid token', async () => {
      const res = await request(app)
        .get('/api/seasons')
        .set('Authorization', 'Bearer bad-token');

      expect(res.status).toBe(401);
    });

    it('allows access with a valid admin token', async () => {
      const token = await getAdminToken();

      const res = await request(app)
        .get('/api/seasons')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
    });
  });
});
