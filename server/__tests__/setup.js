/**
 * Test setup — provides helpers to get an admin auth token and
 * clean the database between tests.
 */
import { createApp } from '../index.js';
import request from 'supertest';
import db from '../db.js';

// Set ADMIN_PASSWORD for tests so login works
process.env.ADMIN_PASSWORD = 'test-password';

/** Shared Express app instance for all tests in a suite. */
export const app = createApp();

/**
 * Authenticate as admin and return the bearer token.
 * Most endpoints sit behind `requireAdmin`, so virtually every
 * test suite will call this in a beforeAll/beforeEach hook.
 */
export async function getAdminToken() {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ password: 'test-password' });
  return res.body.token;
}

/**
 * Delete all rows from every table.
 * Call in beforeEach to start each test with a clean slate.
 */
export function cleanDb() {
  db.exec(`
    DELETE FROM drafts;
    DELETE FROM user_draft_periods;
    DELETE FROM movie_stats;
    DELETE FROM movies;
    DELETE FROM draft_periods;
    DELETE FROM seasons;
    DELETE FROM users;
  `);
}

export { db };
