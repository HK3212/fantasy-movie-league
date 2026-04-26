import { Router } from 'express';
import db from '../db.js';

const router = Router();

// GET /api/drafts — List all draft picks (filter by draft_period_id, user_id)
router.get('/drafts', (req, res) => {
  const { draft_period_id, user_id } = req.query;

  let query = `
    SELECT d.*, m.title, m.poster_url, u.name as owner_name,
           u.abbreviation as owner_abbrev, dp.name as draft_period_name
    FROM drafts d
    JOIN movies m ON d.movie_id = m.id
    JOIN users u ON d.user_id = u.id
    JOIN draft_periods dp ON d.draft_period_id = dp.id
  `;

  const conditions = [];
  const params = [];

  if (draft_period_id) {
    conditions.push('d.draft_period_id = ?');
    params.push(draft_period_id);
  }
  if (user_id) {
    conditions.push('d.user_id = ?');
    params.push(user_id);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY d.draft_order';

  const drafts = db.prepare(query).all(...params);
  res.json(drafts);
});

// POST /api/drafts — Record a draft pick
router.post('/drafts', (req, res) => {
  const { user_id, movie_id, draft_period_id, bid_amount, draft_order } = req.body;

  if (!user_id || !movie_id || !draft_period_id) {
    return res.status(400).json({ error: 'user_id, movie_id, and draft_period_id are required' });
  }

  // Validate references exist
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(user_id);
  if (!user) return res.status(400).json({ error: 'User not found' });

  const movie = db.prepare('SELECT * FROM movies WHERE id = ?').get(movie_id);
  if (!movie) return res.status(400).json({ error: 'Movie not found' });

  const period = db.prepare('SELECT * FROM draft_periods WHERE id = ?').get(draft_period_id);
  if (!period) return res.status(400).json({ error: 'Draft period not found' });

  try {
    const result = db.prepare(`
      INSERT INTO drafts (user_id, movie_id, draft_period_id, bid_amount, draft_order)
      VALUES (?, ?, ?, ?, ?)
    `).run(user_id, movie_id, draft_period_id, bid_amount || 0, draft_order || null);

    // Update user's amount_spent for this draft period
    if (bid_amount && bid_amount > 0) {
      db.prepare(`
        UPDATE user_draft_periods
        SET amount_spent = amount_spent + ?
        WHERE user_id = ? AND draft_period_id = ?
      `).run(bid_amount, user_id, draft_period_id);
    }

    const draft = db.prepare(`
      SELECT d.*, m.title, u.name as owner_name
      FROM drafts d
      JOIN movies m ON d.movie_id = m.id
      JOIN users u ON d.user_id = u.id
      WHERE d.id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json(draft);
  } catch (err) {
    if (err.message.includes('UNIQUE constraint')) {
      return res.status(409).json({ error: 'Movie already drafted in this period' });
    }
    throw err;
  }
});

// PUT /api/drafts/:id — Update a draft pick
router.put('/drafts/:id', (req, res) => {
  const draft = db.prepare('SELECT * FROM drafts WHERE id = ?').get(req.params.id);
  if (!draft) return res.status(404).json({ error: 'Draft pick not found' });

  const { user_id, bid_amount, draft_order } = req.body;

  // If bid amount changed, adjust user budgets
  if (bid_amount !== undefined && bid_amount !== draft.bid_amount) {
    const diff = bid_amount - draft.bid_amount;
    db.prepare(`
      UPDATE user_draft_periods
      SET amount_spent = amount_spent + ?
      WHERE user_id = ? AND draft_period_id = ?
    `).run(diff, draft.user_id, draft.draft_period_id);
  }

  db.prepare(`
    UPDATE drafts SET user_id = ?, bid_amount = ?, draft_order = ? WHERE id = ?
  `).run(
    user_id || draft.user_id,
    bid_amount !== undefined ? bid_amount : draft.bid_amount,
    draft_order !== undefined ? draft_order : draft.draft_order,
    req.params.id
  );

  const updated = db.prepare(`
    SELECT d.*, m.title, u.name as owner_name
    FROM drafts d
    JOIN movies m ON d.movie_id = m.id
    JOIN users u ON d.user_id = u.id
    WHERE d.id = ?
  `).get(req.params.id);

  res.json(updated);
});

// DELETE /api/drafts/:id — Remove a draft pick
router.delete('/drafts/:id', (req, res) => {
  const draft = db.prepare('SELECT * FROM drafts WHERE id = ?').get(req.params.id);
  if (!draft) return res.status(404).json({ error: 'Draft pick not found' });

  // Refund the bid amount
  if (draft.bid_amount > 0) {
    db.prepare(`
      UPDATE user_draft_periods
      SET amount_spent = amount_spent - ?
      WHERE user_id = ? AND draft_period_id = ?
    `).run(draft.bid_amount, draft.user_id, draft.draft_period_id);
  }

  db.prepare('DELETE FROM drafts WHERE id = ?').run(req.params.id);
  res.json({ message: 'Draft pick removed', id: Number(req.params.id) });
});

export default router;
