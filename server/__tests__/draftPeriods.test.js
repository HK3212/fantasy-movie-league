import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app, getAdminToken, cleanDb } from './setup.js';

describe('Draft Periods API', () => {
  let token;
  beforeAll(async () => { token = await getAdminToken(); });
  beforeEach(() => cleanDb());

  async function createSeason(name = 'S1', year = 2026) {
    const res = await request(app).post('/api/seasons').set('Authorization', `Bearer ${token}`).send({ name, year });
    return res.body;
  }

  async function createPeriod(seasonId, name = 'Q1', extra = {}) {
    return request(app).post('/api/draft-periods').set('Authorization', `Bearer ${token}`).send({ name, season_id: seasonId, ...extra });
  }

  describe('GET /api/draft-periods', () => {
    it('returns empty array', async () => {
      const res = await request(app).get('/api/draft-periods').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('filters by season_id', async () => {
      const s1 = await createSeason('S1', 2025);
      const s2 = await createSeason('S2', 2026);
      await createPeriod(s1.id, 'Q1');
      await createPeriod(s2.id, 'Q2');

      const res = await request(app).get(`/api/draft-periods?season_id=${s1.id}`).set('Authorization', `Bearer ${token}`);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].season_id).toBe(s1.id);
    });
  });

  describe('POST /api/draft-periods', () => {
    it('creates a draft period', async () => {
      const season = await createSeason();
      const res = await createPeriod(season.id, 'Q1 2026');
      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Q1 2026');
      expect(res.body.season_id).toBe(season.id);
    });

    it('initializes budgets for existing users', async () => {
      await request(app).post('/api/users').send({ name: 'Alice' });
      const season = await createSeason();
      const res = await createPeriod(season.id, 'Q1', { auction_budget: 200 });

      const detail = await request(app).get(`/api/draft-periods/${res.body.id}`).set('Authorization', `Bearer ${token}`);
      expect(detail.body.budgets).toHaveLength(1);
      expect(detail.body.budgets[0].budget).toBe(200);
    });

    it('returns 400 without name', async () => {
      const season = await createSeason();
      const res = await request(app).post('/api/draft-periods').set('Authorization', `Bearer ${token}`).send({ season_id: season.id });
      expect(res.status).toBe(400);
    });

    it('returns 400 for non-existent season', async () => {
      const res = await request(app).post('/api/draft-periods').set('Authorization', `Bearer ${token}`).send({ name: 'Q1', season_id: 9999 });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/draft-periods/:id', () => {
    it('returns period with movies and budgets', async () => {
      const season = await createSeason();
      const created = await createPeriod(season.id);
      const res = await request(app).get(`/api/draft-periods/${created.body.id}`).set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('movies');
      expect(res.body).toHaveProperty('budgets');
    });

    it('returns 404 for non-existent', async () => {
      const res = await request(app).get('/api/draft-periods/9999').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/draft-periods/:id/standings', () => {
    it('returns empty standings when no drafts exist', async () => {
      const season = await createSeason();
      const period = await createPeriod(season.id);
      const res = await request(app).get(`/api/draft-periods/${period.body.id}/standings`).set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.standings).toEqual([]);
    });

    it('returns 404 for non-existent period', async () => {
      const res = await request(app).get('/api/draft-periods/9999/standings').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/draft-periods/:id', () => {
    it('updates a draft period', async () => {
      const season = await createSeason();
      const created = await createPeriod(season.id, 'Old');
      const res = await request(app).put(`/api/draft-periods/${created.body.id}`).set('Authorization', `Bearer ${token}`).send({ name: 'New' });
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('New');
    });

    it('returns 404 for non-existent', async () => {
      const res = await request(app).put('/api/draft-periods/9999').set('Authorization', `Bearer ${token}`).send({ name: 'X' });
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/draft-periods/:id', () => {
    it('deletes a draft period', async () => {
      const season = await createSeason();
      const created = await createPeriod(season.id);
      const res = await request(app).delete(`/api/draft-periods/${created.body.id}`).set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      const check = await request(app).get(`/api/draft-periods/${created.body.id}`).set('Authorization', `Bearer ${token}`);
      expect(check.status).toBe(404);
    });

    it('returns 404 for non-existent', async () => {
      const res = await request(app).delete('/api/draft-periods/9999').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });
  });
});
