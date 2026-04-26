import { Router } from 'express';
import db from '../db.js';

const router = Router();

// GET /api/draft-periods — List all draft periods (optionally filter by season_id)
router.get('/draft-periods', (req, res) => {
  const { season_id } = req.query;

  let query = `
    SELECT dp.*, s.name as season_name, s.year as season_year
    FROM draft_periods dp
    JOIN seasons s ON dp.season_id = s.id
  `;
  const params = [];

  if (season_id) {
    query += ' WHERE dp.season_id = ?';
    params.push(season_id);
  }

  query += ' ORDER BY dp.start_date';

  const periods = db.prepare(query).all(...params);
  res.json(periods);
});

// POST /api/draft-periods — Create a draft period
router.post('/draft-periods', (req, res) => {
  const { name, type, season_id, start_date, end_date, auction_budget } = req.body;
  if (!name || !season_id) {
    return res.status(400).json({ error: 'Name and season_id are required' });
  }

  const season = db.prepare('SELECT * FROM seasons WHERE id = ?').get(season_id);
  if (!season) return res.status(400).json({ error: 'Season not found' });

  const result = db.prepare(`
    INSERT INTO draft_periods (name, type, season_id, start_date, end_date, auction_budget)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    name,
    type || 'quarterly',
    season_id,
    start_date || null,
    end_date || null,
    auction_budget || 100.0
  );

  const period = db.prepare('SELECT * FROM draft_periods WHERE id = ?').get(result.lastInsertRowid);

  // Initialize budgets for all existing users
  const users = db.prepare('SELECT id FROM users').all();
  const initBudget = db.prepare(`
    INSERT OR IGNORE INTO user_draft_periods (user_id, draft_period_id, budget)
    VALUES (?, ?, ?)
  `);
  const initAll = db.transaction(() => {
    for (const u of users) {
      initBudget.run(u.id, period.id, auction_budget || 100.0);
    }
  });
  initAll();

  res.status(201).json(period);
});

// GET /api/draft-periods/:id — Get draft period with movies and user budgets
router.get('/draft-periods/:id', (req, res) => {
  const period = db.prepare(`
    SELECT dp.*, s.name as season_name
    FROM draft_periods dp
    JOIN seasons s ON dp.season_id = s.id
    WHERE dp.id = ?
  `).get(req.params.id);

  if (!period) return res.status(404).json({ error: 'Draft period not found' });

  const movies = db.prepare(`
    SELECT m.*, ms.domestic_box_office, ms.international_box_office,
           ms.domestic_opening_weekend, ms.letterboxd_avg_score,
           ms.letterboxd_members_rated, ms.rt_score, ms.imdb_rating,
           d.user_id, u.name as owner_name, u.abbreviation as owner_abbrev,
           d.bid_amount
    FROM drafts d
    JOIN movies m ON d.movie_id = m.id
    LEFT JOIN movie_stats ms ON m.id = ms.movie_id
    LEFT JOIN users u ON d.user_id = u.id
    WHERE d.draft_period_id = ?
    ORDER BY d.draft_order
  `).all(req.params.id);

  const budgets = db.prepare(`
    SELECT udp.*, u.name as user_name, u.abbreviation
    FROM user_draft_periods udp
    JOIN users u ON udp.user_id = u.id
    WHERE udp.draft_period_id = ?
  `).all(req.params.id);

  res.json({ ...period, movies, budgets });
});

// GET /api/draft-periods/:id/standings — Compute ROTO standings
router.get('/draft-periods/:id/standings', (req, res) => {
  const period = db.prepare('SELECT * FROM draft_periods WHERE id = ?').get(req.params.id);
  if (!period) return res.status(404).json({ error: 'Draft period not found' });

  // Get all movies in this draft period with stats and owners
  const movies = db.prepare(`
    SELECT m.id, m.title, d.user_id, u.name as owner_name, u.abbreviation as owner_abbrev,
           d.bid_amount,
           ms.domestic_box_office, ms.international_box_office,
           ms.domestic_opening_weekend, ms.letterboxd_avg_score,
           ms.letterboxd_members_rated, ms.rt_score, ms.imdb_rating
    FROM drafts d
    JOIN movies m ON d.movie_id = m.id
    LEFT JOIN movie_stats ms ON m.id = ms.movie_id
    LEFT JOIN users u ON d.user_id = u.id
    WHERE d.draft_period_id = ?
  `).all(req.params.id);

  if (movies.length === 0) {
    return res.json({ period_id: Number(req.params.id), standings: [], movies: [] });
  }

  // Stats categories to rank (higher value = higher rank = more points)
  const categories = [
    'domestic_box_office',
    'international_box_office',
    'domestic_opening_weekend',
    'letterboxd_avg_score',
    'letterboxd_members_rated',
    'rt_score',
    'imdb_rating',
  ];

  // Rank movies within each category
  const movieRanks = {};
  for (const movie of movies) {
    movieRanks[movie.id] = { movie, ranks: {}, totalRank: 0 };
  }

  for (const cat of categories) {
    // Sort movies by this category's value (ascending — rank 1 = lowest = worst)
    // Movies with null values get rank 0 (no points)
    const withValues = movies.filter(m => m[cat] != null);
    const withoutValues = movies.filter(m => m[cat] == null);

    withValues.sort((a, b) => a[cat] - b[cat]);

    // Assign ranks: 1 = lowest value (worst), N = highest value (best)
    for (let i = 0; i < withValues.length; i++) {
      movieRanks[withValues[i].id].ranks[cat] = i + 1;
      movieRanks[withValues[i].id].totalRank += i + 1;
    }
    for (const m of withoutValues) {
      movieRanks[m.id].ranks[cat] = 0;
    }
  }

  // Aggregate per user: sum of all their movies' ROTO totals
  const userStandings = {};
  for (const mr of Object.values(movieRanks)) {
    const userId = mr.movie.user_id;
    if (!userId) continue;

    if (!userStandings[userId]) {
      userStandings[userId] = {
        user_id: userId,
        user_name: mr.movie.owner_name,
        abbreviation: mr.movie.owner_abbrev,
        totalRoto: 0,
        movies: [],
      };
    }
    userStandings[userId].totalRoto += mr.totalRank;
    userStandings[userId].movies.push({
      movie_id: mr.movie.id,
      title: mr.movie.title,
      bid_amount: mr.movie.bid_amount,
      ranks: mr.ranks,
      totalRank: mr.totalRank,
    });
  }

  // Sort standings: highest ROTO wins
  const standings = Object.values(userStandings).sort((a, b) => b.totalRoto - a.totalRoto);

  res.json({
    period_id: Number(req.params.id),
    categories,
    standings,
    movie_count: movies.length,
  });
});

// PUT /api/draft-periods/:id — Update a draft period
router.put('/draft-periods/:id', (req, res) => {
  const period = db.prepare('SELECT * FROM draft_periods WHERE id = ?').get(req.params.id);
  if (!period) return res.status(404).json({ error: 'Draft period not found' });

  const { name, type, start_date, end_date, auction_budget, is_active } = req.body;
  db.prepare(`
    UPDATE draft_periods SET name = ?, type = ?, start_date = ?, end_date = ?,
    auction_budget = ?, is_active = ? WHERE id = ?
  `).run(
    name || period.name,
    type || period.type,
    start_date !== undefined ? start_date : period.start_date,
    end_date !== undefined ? end_date : period.end_date,
    auction_budget !== undefined ? auction_budget : period.auction_budget,
    is_active !== undefined ? is_active : period.is_active,
    req.params.id
  );

  const updated = db.prepare('SELECT * FROM draft_periods WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// DELETE /api/draft-periods/:id — Delete a draft period
router.delete('/draft-periods/:id', (req, res) => {
  const period = db.prepare('SELECT * FROM draft_periods WHERE id = ?').get(req.params.id);
  if (!period) return res.status(404).json({ error: 'Draft period not found' });

  db.prepare('DELETE FROM user_draft_periods WHERE draft_period_id = ?').run(req.params.id);
  db.prepare('DELETE FROM drafts WHERE draft_period_id = ?').run(req.params.id);
  db.prepare('DELETE FROM draft_periods WHERE id = ?').run(req.params.id);
  res.json({ message: 'Draft period deleted', id: Number(req.params.id) });
});

export default router;
