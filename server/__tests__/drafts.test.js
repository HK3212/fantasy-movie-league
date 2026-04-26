import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app, getAdminToken, cleanDb } from './setup.js';

describe('Drafts API', () => {
  let token;
  beforeAll(async () => { token = await getAdminToken(); });
  beforeEach(() => cleanDb());

  /** Set up a user, season, period, and movie — returns their IDs. */
  async function seedDraftDeps() {
    const user = (await request(app).post('/api/users').send({ name: 'Hamza' })).body;
    const season = (await request(app).post('/api/seasons').set('Authorization', `Bearer ${token}`).send({ name: 'S1', year: 2026 })).body;
    const period = (await request(app).post('/api/draft-periods').set('Authorization', `Bearer ${token}`).send({ name: 'Q1', season_id: season.id })).body;
    const movie = (await request(app).post('/api/movies').send({ title: 'Dune 3' })).body;
    return { user, season, period, movie };
  }

  describe('GET /api/drafts', () => {
    it('returns empty array', async () => {
      const res = await request(app).get('/api/drafts').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  describe('POST /api/drafts', () => {
    it('creates a draft pick', async () => {
      const { user, period, movie } = await seedDraftDeps();
      const res = await request(app).post('/api/drafts').set('Authorization', `Bearer ${token}`).send({
        user_id: user.id, movie_id: movie.id, draft_period_id: period.id, bid_amount: 15,
      });
      expect(res.status).toBe(201);
      expect(res.body.title).toBe('Dune 3');
      expect(res.body.owner_name).toBe('Hamza');
    });

    it('returns 400 with missing fields', async () => {
      const res = await request(app).post('/api/drafts').set('Authorization', `Bearer ${token}`).send({});
      expect(res.status).toBe(400);
    });

    it('returns 400 for non-existent user', async () => {
      const { period, movie } = await seedDraftDeps();
      const res = await request(app).post('/api/drafts').set('Authorization', `Bearer ${token}`).send({
        user_id: 9999, movie_id: movie.id, draft_period_id: period.id,
      });
      expect(res.status).toBe(400);
    });

    it('returns 409 for duplicate movie in same period', async () => {
      const { user, period, movie } = await seedDraftDeps();
      await request(app).post('/api/drafts').set('Authorization', `Bearer ${token}`).send({
        user_id: user.id, movie_id: movie.id, draft_period_id: period.id,
      });
      const res = await request(app).post('/api/drafts').set('Authorization', `Bearer ${token}`).send({
        user_id: user.id, movie_id: movie.id, draft_period_id: period.id,
      });
      expect(res.status).toBe(409);
    });
  });

  describe('PUT /api/drafts/:id', () => {
    it('updates bid amount', async () => {
      const { user, period, movie } = await seedDraftDeps();
      const created = (await request(app).post('/api/drafts').set('Authorization', `Bearer ${token}`).send({
        user_id: user.id, movie_id: movie.id, draft_period_id: period.id, bid_amount: 10,
      })).body;

      const res = await request(app).put(`/api/drafts/${created.id}`).set('Authorization', `Bearer ${token}`).send({ bid_amount: 25 });
      expect(res.status).toBe(200);
      expect(res.body.bid_amount).toBe(25);
    });

    it('returns 404 for non-existent', async () => {
      const res = await request(app).put('/api/drafts/9999').set('Authorization', `Bearer ${token}`).send({ bid_amount: 5 });
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/drafts/:id', () => {
    it('deletes a draft pick', async () => {
      const { user, period, movie } = await seedDraftDeps();
      const created = (await request(app).post('/api/drafts').set('Authorization', `Bearer ${token}`).send({
        user_id: user.id, movie_id: movie.id, draft_period_id: period.id,
      })).body;

      const res = await request(app).delete(`/api/drafts/${created.id}`).set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message');
    });

    it('returns 404 for non-existent', async () => {
      const res = await request(app).delete('/api/drafts/9999').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });
  });
});
