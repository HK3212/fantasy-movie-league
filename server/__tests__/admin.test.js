import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app, getAdminToken, cleanDb } from './setup.js';

describe('Admin API', () => {
  let token;
  beforeAll(async () => { token = await getAdminToken(); });
  beforeEach(() => cleanDb());

  describe('POST /api/admin/import', () => {
    it('returns 501 (not yet implemented)', async () => {
      const res = await request(app).post('/api/admin/import').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(501);
    });
  });

  describe('POST /api/admin/refresh-all', () => {
    it('returns 501 (not yet implemented)', async () => {
      const res = await request(app).post('/api/admin/refresh-all').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(501);
    });
  });

  describe('POST /api/admin/refresh/:movieId', () => {
    it('returns 404 for non-existent movie', async () => {
      const res = await request(app).post('/api/admin/refresh/9999').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });

    it('returns 501 for existing movie', async () => {
      const movie = (await request(app).post('/api/movies').send({ title: 'Test' })).body;
      const res = await request(app).post(`/api/admin/refresh/${movie.id}`).set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(501);
    });
  });

  describe('POST /api/admin/calculate-carryover', () => {
    it('calculates carryover between periods', async () => {
      // Setup: user, season, two periods
      const user = (await request(app).post('/api/users').send({ name: 'Alice' })).body;
      const season = (await request(app).post('/api/seasons').set('Authorization', `Bearer ${token}`).send({ name: 'S1', year: 2026 })).body;
      const p1 = (await request(app).post('/api/draft-periods').set('Authorization', `Bearer ${token}`).send({ name: 'Q1', season_id: season.id, auction_budget: 100 })).body;
      const p2 = (await request(app).post('/api/draft-periods').set('Authorization', `Bearer ${token}`).send({ name: 'Q2', season_id: season.id, auction_budget: 100 })).body;

      const res = await request(app).post('/api/admin/calculate-carryover').set('Authorization', `Bearer ${token}`).send({ from_period_id: p1.id, to_period_id: p2.id });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('results');
      expect(res.body.results).toHaveLength(1);
      // 100 budget, 0 spent → 50 carryover (50% of unspent)
      expect(res.body.results[0].carryover).toBe(50);
    });

    it('returns 400 without required fields', async () => {
      const res = await request(app).post('/api/admin/calculate-carryover').set('Authorization', `Bearer ${token}`).send({});
      expect(res.status).toBe(400);
    });

    it('returns 404 for non-existent periods', async () => {
      const res = await request(app).post('/api/admin/calculate-carryover').set('Authorization', `Bearer ${token}`).send({ from_period_id: 9999, to_period_id: 9998 });
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/admin/db-stats', () => {
    it('returns counts for all tables', async () => {
      const res = await request(app).get('/api/admin/db-stats').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('users');
      expect(res.body).toHaveProperty('movies');
      expect(res.body).toHaveProperty('seasons');
      expect(res.body).toHaveProperty('draft_periods');
      expect(res.body).toHaveProperty('drafts');
      expect(res.body).toHaveProperty('movies_with_stats');
    });
  });
});
