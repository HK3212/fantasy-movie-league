import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app, getAdminToken, cleanDb } from './setup.js';

describe('Users API', () => {
  let token;

  beforeAll(async () => {
    token = await getAdminToken();
  });

  beforeEach(() => cleanDb());

  // ── GET /api/users ──────────────────────────────────────────────────
  describe('GET /api/users', () => {
    it('returns an empty array when no users exist', async () => {
      const res = await request(app).get('/api/users');

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('returns all users ordered by name', async () => {
      await request(app).post('/api/users').send({ name: 'Zara' });
      await request(app).post('/api/users').send({ name: 'Alice' });

      const res = await request(app).get('/api/users');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].name).toBe('Alice');
      expect(res.body[1].name).toBe('Zara');
    });
  });

  // ── POST /api/users ─────────────────────────────────────────────────
  describe('POST /api/users', () => {
    it('creates a user with just a name', async () => {
      const res = await request(app)
        .post('/api/users')
        .send({ name: 'Hamza' });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.name).toBe('Hamza');
    });

    it('creates a user with all fields', async () => {
      const res = await request(app)
        .post('/api/users')
        .send({ name: 'Hamza', abbreviation: 'H', avatar_url: 'https://example.com/avatar.png' });

      expect(res.status).toBe(201);
      expect(res.body.abbreviation).toBe('H');
      expect(res.body.avatar_url).toBe('https://example.com/avatar.png');
    });

    it('returns 400 when name is missing', async () => {
      const res = await request(app)
        .post('/api/users')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });
  });

  // ── GET /api/users/:id ──────────────────────────────────────────────
  describe('GET /api/users/:id', () => {
    it('returns user with drafts and budgets', async () => {
      const created = await request(app)
        .post('/api/users')
        .send({ name: 'Hamza' });

      const res = await request(app).get(`/api/users/${created.body.id}`);

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Hamza');
      expect(res.body).toHaveProperty('drafts');
      expect(res.body).toHaveProperty('budgets');
    });

    it('returns 404 for a non-existent user', async () => {
      const res = await request(app).get('/api/users/9999');

      expect(res.status).toBe(404);
    });
  });

  // ── PUT /api/users/:id ──────────────────────────────────────────────
  describe('PUT /api/users/:id', () => {
    it('updates user fields', async () => {
      const created = await request(app)
        .post('/api/users')
        .send({ name: 'Hamza' });

      const res = await request(app)
        .put(`/api/users/${created.body.id}`)
        .send({ name: 'Hamza K', abbreviation: 'HK' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Hamza K');
      expect(res.body.abbreviation).toBe('HK');
    });

    it('returns 404 for a non-existent user', async () => {
      const res = await request(app)
        .put('/api/users/9999')
        .send({ name: 'Ghost' });

      expect(res.status).toBe(404);
    });
  });

  // ── DELETE /api/users/:id ───────────────────────────────────────────
  describe('DELETE /api/users/:id', () => {
    it('deletes a user', async () => {
      const created = await request(app)
        .post('/api/users')
        .send({ name: 'Hamza' });

      const res = await request(app).delete(`/api/users/${created.body.id}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message');

      // Confirm deleted
      const check = await request(app).get(`/api/users/${created.body.id}`);
      expect(check.status).toBe(404);
    });

    it('returns 404 for a non-existent user', async () => {
      const res = await request(app).delete('/api/users/9999');
      expect(res.status).toBe(404);
    });
  });

  // ── POST /api/users/seed ────────────────────────────────────────────
  describe('POST /api/users/seed', () => {
    it('seeds the 9 league members', async () => {
      const res = await request(app).post('/api/users/seed');

      expect(res.status).toBe(200);
      expect(res.body.users.length).toBeGreaterThanOrEqual(9);
      expect(res.body.users.map(u => u.name)).toContain('Hamza');
      expect(res.body.users.map(u => u.name)).toContain('Thomas');
    });
  });
});
