import { Router } from 'express';
import db from '../db.js';
import { getMovieDetails as tmdbDetails } from '../services/tmdb.js';
import { getMovieByImdbId, buildStats } from '../services/omdb.js';

const router = Router();

// POST /api/admin/import — Import spreadsheet data
// (Placeholder — full xlsx parsing will be added in Phase 2)
router.post('/admin/import', (req, res) => {
  res.status(501).json({ error: 'Spreadsheet import not yet implemented. Coming in Phase 2.' });
});

// POST /api/admin/refresh-all — Refresh stats for all movies with an IMDB ID
router.post('/admin/refresh-all', async (req, res) => {
  const movies = db.prepare('SELECT * FROM movies WHERE imdb_id IS NOT NULL').all();

  if (movies.length === 0) {
    return res.json({ message: 'No movies with IMDB IDs to refresh', refreshed: 0 });
  }

  const results = [];
  const errors = [];

  for (const movie of movies) {
    try {
      // Fetch from OMDb
      const omdbData = await getMovieByImdbId(movie.imdb_id);

      // Optionally get TMDB data for international revenue calculation
      let tmdbData = null;
      if (movie.tmdb_id) {
        try {
          tmdbData = await tmdbDetails(movie.tmdb_id);
        } catch (e) {
          // TMDB fetch is optional — continue without it
        }
      }

      const stats = buildStats(omdbData, tmdbData);

      db.prepare(`
        INSERT INTO movie_stats (movie_id, domestic_box_office, international_box_office,
          domestic_opening_weekend, rt_score, imdb_rating, last_updated)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(movie_id) DO UPDATE SET
          domestic_box_office = COALESCE(?, domestic_box_office),
          international_box_office = COALESCE(?, international_box_office),
          domestic_opening_weekend = COALESCE(?, domestic_opening_weekend),
          rt_score = COALESCE(?, rt_score),
          imdb_rating = COALESCE(?, imdb_rating),
          last_updated = datetime('now')
      `).run(
        movie.id,
        stats.domestic_box_office, stats.international_box_office, stats.domestic_opening_weekend,
        stats.rt_score, stats.imdb_rating,
        stats.domestic_box_office, stats.international_box_office, stats.domestic_opening_weekend,
        stats.rt_score, stats.imdb_rating
      );

      results.push({ id: movie.id, title: movie.title, stats });
    } catch (err) {
      errors.push({ id: movie.id, title: movie.title, error: err.message });
    }
  }

  res.json({
    message: `Refreshed ${results.length} of ${movies.length} movies`,
    refreshed: results.length,
    failed: errors.length,
    results,
    errors,
  });
});

// POST /api/admin/refresh/:movieId — Refresh stats for one movie
router.post('/admin/refresh/:movieId', async (req, res) => {
  const movie = db.prepare('SELECT * FROM movies WHERE id = ?').get(req.params.movieId);
  if (!movie) return res.status(404).json({ error: 'Movie not found' });

  if (!movie.imdb_id) {
    return res.status(400).json({ error: 'Movie has no IMDB ID — cannot fetch stats' });
  }

  try {
    const omdbData = await getMovieByImdbId(movie.imdb_id);

    let tmdbData = null;
    if (movie.tmdb_id) {
      try {
        tmdbData = await tmdbDetails(movie.tmdb_id);
      } catch (e) {
        // continue without TMDB data
      }
    }

    const stats = buildStats(omdbData, tmdbData);

    db.prepare(`
      INSERT INTO movie_stats (movie_id, domestic_box_office, international_box_office,
        domestic_opening_weekend, rt_score, imdb_rating, last_updated)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(movie_id) DO UPDATE SET
        domestic_box_office = COALESCE(?, domestic_box_office),
        international_box_office = COALESCE(?, international_box_office),
        domestic_opening_weekend = COALESCE(?, domestic_opening_weekend),
        rt_score = COALESCE(?, rt_score),
        imdb_rating = COALESCE(?, imdb_rating),
        last_updated = datetime('now')
    `).run(
      movie.id,
      stats.domestic_box_office, stats.international_box_office, stats.domestic_opening_weekend,
      stats.rt_score, stats.imdb_rating,
      stats.domestic_box_office, stats.international_box_office, stats.domestic_opening_weekend,
      stats.rt_score, stats.imdb_rating
    );

    const updated = db.prepare(`
      SELECT m.*, ms.*
      FROM movies m
      LEFT JOIN movie_stats ms ON m.id = ms.movie_id
      WHERE m.id = ?
    `).get(movie.id);

    res.json({ message: 'Stats refreshed', movie: updated });
  } catch (err) {
    res.status(502).json({ error: 'Failed to fetch stats', detail: err.message });
  }
});

// POST /api/admin/calculate-carryover — Calculate carryover from one period to the next
router.post('/admin/calculate-carryover', (req, res) => {
  const { from_period_id, to_period_id } = req.body;

  if (!from_period_id || !to_period_id) {
    return res.status(400).json({ error: 'from_period_id and to_period_id are required' });
  }

  const fromPeriod = db.prepare('SELECT * FROM draft_periods WHERE id = ?').get(from_period_id);
  const toPeriod = db.prepare('SELECT * FROM draft_periods WHERE id = ?').get(to_period_id);
  if (!fromPeriod || !toPeriod) {
    return res.status(404).json({ error: 'One or both draft periods not found' });
  }

  // Get all user budgets from the source period
  const sourceBudgets = db.prepare(`
    SELECT * FROM user_draft_periods WHERE draft_period_id = ?
  `).all(from_period_id);

  const results = [];
  const updateCarryover = db.prepare(`
    UPDATE user_draft_periods
    SET carryover_in = ?, budget = budget + ?
    WHERE user_id = ? AND draft_period_id = ?
  `);

  const calculateAll = db.transaction(() => {
    for (const src of sourceBudgets) {
      const unspent = src.budget - src.amount_spent;
      const carryover = Math.max(0, unspent) / 2; // 50% of unspent carries over

      updateCarryover.run(carryover, carryover, src.user_id, to_period_id);
      results.push({
        user_id: src.user_id,
        unspent: unspent,
        carryover: carryover,
      });
    }
  });

  calculateAll();

  res.json({
    message: `Carryover calculated for ${results.length} users`,
    from_period: fromPeriod.name,
    to_period: toPeriod.name,
    results,
  });
});

// GET /api/admin/db-stats — Quick overview of database contents
router.get('/admin/db-stats', (req, res) => {
  const stats = {
    users: db.prepare('SELECT COUNT(*) as count FROM users').get().count,
    movies: db.prepare('SELECT COUNT(*) as count FROM movies').get().count,
    seasons: db.prepare('SELECT COUNT(*) as count FROM seasons').get().count,
    draft_periods: db.prepare('SELECT COUNT(*) as count FROM draft_periods').get().count,
    drafts: db.prepare('SELECT COUNT(*) as count FROM drafts').get().count,
    movies_with_stats: db.prepare(
      'SELECT COUNT(*) as count FROM movie_stats WHERE domestic_box_office IS NOT NULL OR imdb_rating IS NOT NULL'
    ).get().count,
  };
  res.json(stats);
});

export default router;
