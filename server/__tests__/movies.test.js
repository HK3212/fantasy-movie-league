import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app, getAdminToken, cleanDb } from './setup.js';

describe('Movies API', () => {
  let token;
  beforeAll(async () => { token = await getAdminToken(); });
  beforeEach(() => cleanDb());

  async function createMovie(title = 'Dune 3', extra = {}) {
    return request(app).post('/api/movies').send({ title, ...extra });
  }

  describe('GET /api/movies', () => {
    it('returns empty array', async () => {
      const res = await request(app).get('/api/movies');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('returns movies ordered by title', async () => {
      await createMovie('Zorro');
      await createMovie('Avatar 4');
      const res = await request(app).get('/api/movies');
      expect(res.body).toHaveLength(2);
      expect(res.body[0].title).toBe('Avatar 4');
    });
  });

  describe('POST /api/movies', () => {
    it('creates a movie', async () => {
      const res = await createMovie('Dune 3');
      expect(res.status).toBe(201);
      expect(res.body.title).toBe('Dune 3');
    });

    it('returns 400 without title', async () => {
      const res = await request(app).post('/api/movies').send({});
      expect(res.status).toBe(400);
    });

    it('returns 409 for duplicate imdb_id', async () => {
      await createMovie('A', { imdb_id: 'tt001' });
      const res = await createMovie('B', { imdb_id: 'tt001' });
      expect(res.status).toBe(409);
    });
  });

  describe('GET /api/movies/:id', () => {
    it('returns movie with draft info', async () => {
      const c = await createMovie('Dune 3');
      const res = await request(app).get(`/api/movies/${c.body.id}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('draft');
    });

    it('returns 404 for non-existent', async () => {
      const res = await request(app).get('/api/movies/9999');
      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/movies/:id', () => {
    it('updates movie metadata', async () => {
      const c = await createMovie('Old');
      const res = await request(app).put(`/api/movies/${c.body.id}`).send({ title: 'New' });
      expect(res.status).toBe(200);
      expect(res.body.title).toBe('New');
    });

    it('returns 404 for non-existent', async () => {
      const res = await request(app).put('/api/movies/9999').send({ title: 'X' });
      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/movies/:id/stats', () => {
    it('updates stats', async () => {
      const c = await createMovie('Hit');
      const res = await request(app).put(`/api/movies/${c.body.id}/stats`).send({ imdb_rating: 8.5, rt_score: 92 });
      expect(res.status).toBe(200);
      expect(res.body.imdb_rating).toBe(8.5);
    });

    it('returns 404 for non-existent', async () => {
      const res = await request(app).put('/api/movies/9999/stats').send({ imdb_rating: 9 });
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/movies/:id', () => {
    it('deletes a movie', async () => {
      const c = await createMovie('Doomed');
      const res = await request(app).delete(`/api/movies/${c.body.id}`);
      expect(res.status).toBe(200);
      const check = await request(app).get(`/api/movies/${c.body.id}`);
      expect(check.status).toBe(404);
    });

    it('returns 404 for non-existent', async () => {
      const res = await request(app).delete('/api/movies/9999');
      expect(res.status).toBe(404);
    });
  });
});
