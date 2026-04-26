import { Router } from 'express';
import db from '../db.js';

const router = Router();

// POST /api/admin/import — Import spreadsheet data
// (Placeholder — full xlsx parsing will be added in Phase 2)
router.post('/admin/import', (req, res) => {
  res.status(501).json({ error: 'Spreadsheet import not yet implemented. Coming in Phase 2.' });
});

// POST /api/admin/refresh-all — Trigger stats refresh for all movies
// (Placeholder — services will be wired in Phase 2)
router.post('/admin/refresh-all', (req, res) => {
  res.status(501).json({ error: 'Stats refresh not yet implemented. Coming in Phase 2.' });
});

// POST /api/admin/refresh/:movieId — Trigger stats refresh for one movie
router.post('/admin/refresh/:movieId', (req, res) => {
  const movie = db.prepare('SELECT * FROM movies WHERE id = ?').get(req.params.movieId);
  if (!movie) return res.status(404).json({ error: 'Movie not found' });

  res.status(501).json({ error: 'Stats refresh not yet implemented. Coming in Phase 2.' });
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
