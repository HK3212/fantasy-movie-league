import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app, getAdminToken, cleanDb } from './setup.js';

describe('Seasons API', () => {
  let token;

  beforeAll(async () => {
    token = await getAdminToken();
  });

  beforeEach(() => cleanDb());

  /** Helper to create a season. */
  async function createSeason(name = 'Season 1', year = 2026) {
    return request(app)
      .post('/api/seasons')
      .set('Authorization', `Bearer ${token}`)
      .send({ name, year });
  }

  // ── GET /api/seasons ────────────────────────────────────────────────
  describe('GET /api/seasons', () => {
    it('returns an empty array when no seasons exist', async () => {
      const res = await request(app)
        .get('/api/seasons')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('returns seasons with period_count', async () => {
      await createSeason('Season 1', 2026);

      const res = await request(app)
        .get('/api/seasons')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0]).toHaveProperty('period_count', 0);
    });
  });

  // ── POST /api/seasons ───────────────────────────────────────────────
  describe('POST /api/seasons', () => {
    it('creates a season', async () => {
      const res = await createSeason('Season 1', 2026);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.name).toBe('Season 1');
      expect(res.body.year).toBe(2026);
    });

    it('returns 400 when name is missing', async () => {
      const res = await request(app)
        .post('/api/seasons')
        .set('Authorization', `Bearer ${token}`)
        .send({ year: 2026 });

      expect(res.status).toBe(400);
    });

    it('returns 400 when year is missing', async () => {
      const res = await request(app)
        .post('/api/seasons')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Season 1' });

      expect(res.status).toBe(400);
    });
  });

  // ── GET /api/seasons/:id ────────────────────────────────────────────
  describe('GET /api/seasons/:id', () => {
    it('returns a season with its draft_periods', async () => {
      const created = await createSeason();

      const res = await request(app)
        .get(`/api/seasons/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Season 1');
      expect(res.body).toHaveProperty('draft_periods');
      expect(res.body.draft_periods).toEqual([]);
    });

    it('returns 404 for a non-existent season', async () => {
      const res = await request(app)
        .get('/api/seasons/9999')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });

  // ── PUT /api/seasons/:id ────────────────────────────────────────────
  describe('PUT /api/seasons/:id', () => {
    it('updates a season', async () => {
      const created = await createSeason();

      const res = await request(app)
        .put(`/api/seasons/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Updated Season', year: 2027 });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Updated Season');
      expect(res.body.year).toBe(2027);
    });

    it('partially updates — keeps existing values for omitted fields', async () => {
      const created = await createSeason('Original', 2026);

      const res = await request(app)
        .put(`/api/seasons/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Renamed' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Renamed');
      expect(res.body.year).toBe(2026);
    });

    it('returns 404 for a non-existent season', async () => {
      const res = await request(app)
        .put('/api/seasons/9999')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Nope' });

      expect(res.status).toBe(404);
    });
  });

  // ── PUT /api/seasons/:id/activate ───────────────────────────────────
  describe('PUT /api/seasons/:id/activate', () => {
    it('activates a season and deactivates others', async () => {
      const s1 = await createSeason('S1', 2025);
      const s2 = await createSeason('S2', 2026);

      // Activate S1
      await request(app)
        .put(`/api/seasons/${s1.body.id}/activate`)
        .set('Authorization', `Bearer ${token}`);

      // Activate S2 — should deactivate S1
      const res = await request(app)
        .put(`/api/seasons/${s2.body.id}/activate`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.is_active).toBe(1);

      // Confirm S1 is no longer active
      const s1Check = await request(app)
        .get(`/api/seasons/${s1.body.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(s1Check.body.is_active).toBe(0);
    });

    it('returns 404 for a non-existent season', async () => {
      const res = await request(app)
        .put('/api/seasons/9999/activate')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });

  // ── DELETE /api/seasons/:id ─────────────────────────────────────────
  describe('DELETE /api/seasons/:id', () => {
    it('deletes a season', async () => {
      const created = await createSeason();

      const res = await request(app)
        .delete(`/api/seasons/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message');

      const check = await request(app)
        .get(`/api/seasons/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(check.status).toBe(404);
    });

    it('returns 404 for a non-existent season', async () => {
      const res = await request(app)
        .delete('/api/seasons/9999')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });
});
