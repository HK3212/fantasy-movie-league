import { Router } from 'express';
import db from '../db.js';

const router = Router();

// GET /api/seasons — List all seasons
router.get('/seasons', (req, res) => {
  const seasons = db.prepare(`
    SELECT s.*,
      (SELECT COUNT(*) FROM draft_periods WHERE season_id = s.id) as period_count
    FROM seasons s
    ORDER BY s.year DESC, s.id DESC
  `).all();
  res.json(seasons);
});

// POST /api/seasons — Create a season
router.post('/seasons', (req, res) => {
  const { name, year } = req.body;
  if (!name || !year) return res.status(400).json({ error: 'Name and year are required' });

  const result = db.prepare(
    'INSERT INTO seasons (name, year) VALUES (?, ?)'
  ).run(name, year);

  const season = db.prepare('SELECT * FROM seasons WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(season);
});

// GET /api/seasons/:id — Get season with its draft periods
router.get('/seasons/:id', (req, res) => {
  const season = db.prepare('SELECT * FROM seasons WHERE id = ?').get(req.params.id);
  if (!season) return res.status(404).json({ error: 'Season not found' });

  const periods = db.prepare(
    'SELECT * FROM draft_periods WHERE season_id = ? ORDER BY start_date'
  ).all(req.params.id);

  res.json({ ...season, draft_periods: periods });
});

// PUT /api/seasons/:id — Update a season
router.put('/seasons/:id', (req, res) => {
  const season = db.prepare('SELECT * FROM seasons WHERE id = ?').get(req.params.id);
  if (!season) return res.status(404).json({ error: 'Season not found' });

  const { name, year } = req.body;
  db.prepare('UPDATE seasons SET name = ?, year = ? WHERE id = ?').run(
    name || season.name,
    year || season.year,
    req.params.id
  );

  const updated = db.prepare('SELECT * FROM seasons WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// PUT /api/seasons/:id/activate — Set as active season (deactivate others)
router.put('/seasons/:id/activate', (req, res) => {
  const season = db.prepare('SELECT * FROM seasons WHERE id = ?').get(req.params.id);
  if (!season) return res.status(404).json({ error: 'Season not found' });

  db.prepare('UPDATE seasons SET is_active = 0').run();
  db.prepare('UPDATE seasons SET is_active = 1 WHERE id = ?').run(req.params.id);

  const updated = db.prepare('SELECT * FROM seasons WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// DELETE /api/seasons/:id — Delete a season
router.delete('/seasons/:id', (req, res) => {
  const season = db.prepare('SELECT * FROM seasons WHERE id = ?').get(req.params.id);
  if (!season) return res.status(404).json({ error: 'Season not found' });

  db.prepare('DELETE FROM seasons WHERE id = ?').run(req.params.id);
  res.json({ message: 'Season deleted', id: Number(req.params.id) });
});

export default router;
