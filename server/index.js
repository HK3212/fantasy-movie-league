import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import db from './db.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ──────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── Health check ────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Placeholder API routes (to be built out) ─────────────────────────
app.get('/api/users', (req, res) => {
  const users = db.prepare('SELECT * FROM users').all();
  res.json(users);
});

app.get('/api/movies', (req, res) => {
  const movies = db.prepare(`
    SELECT m.*, ms.domestic_box_office, ms.international_box_office,
           ms.domestic_opening_weekend, ms.letterboxd_avg_score,
           ms.letterboxd_members_rated, ms.rt_score, ms.imdb_rating,
           ms.last_updated as stats_updated
    FROM movies m
    LEFT JOIN movie_stats ms ON m.id = ms.movie_id
  `).all();
  res.json(movies);
});

app.get('/api/seasons', (req, res) => {
  const seasons = db.prepare('SELECT * FROM seasons').all();
  res.json(seasons);
});

app.get('/api/draft-periods', (req, res) => {
  const periods = db.prepare('SELECT * FROM draft_periods').all();
  res.json(periods);
});

// ── Start server ────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🎬 Fantasy Movie League API running on http://localhost:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/api/health\n`);
});
