import { Router } from 'express';
import db from '../db.js';

const router = Router();

// GET /api/users — List all users
router.get('/users', (req, res) => {
  const users = db.prepare('SELECT * FROM users ORDER BY name').all();
  res.json(users);
});

// POST /api/users — Create a user
router.post('/users', (req, res) => {
  const { name, abbreviation, avatar_url } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  const stmt = db.prepare(
    'INSERT INTO users (name, abbreviation, avatar_url) VALUES (?, ?, ?)'
  );
  const result = stmt.run(name, abbreviation || null, avatar_url || null);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(user);
});

// GET /api/users/:id — Get user with their drafts and budgets
router.get('/users/:id', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  // Get their draft picks with movie info
  const drafts = db.prepare(`
    SELECT d.*, m.title, m.poster_url, dp.name as draft_period_name
    FROM drafts d
    JOIN movies m ON d.movie_id = m.id
    JOIN draft_periods dp ON d.draft_period_id = dp.id
    WHERE d.user_id = ?
    ORDER BY dp.name, d.draft_order
  `).all(req.params.id);

  // Get their budget info per draft period
  const budgets = db.prepare(`
    SELECT udp.*, dp.name as draft_period_name
    FROM user_draft_periods udp
    JOIN draft_periods dp ON udp.draft_period_id = dp.id
    WHERE udp.user_id = ?
  `).all(req.params.id);

  res.json({ ...user, drafts, budgets });
});

// PUT /api/users/:id — Update a user
router.put('/users/:id', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const { name, abbreviation, avatar_url } = req.body;
  db.prepare(
    'UPDATE users SET name = ?, abbreviation = ?, avatar_url = ? WHERE id = ?'
  ).run(
    name || user.name,
    abbreviation !== undefined ? abbreviation : user.abbreviation,
    avatar_url !== undefined ? avatar_url : user.avatar_url,
    req.params.id
  );

  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// DELETE /api/users/:id — Delete a user
router.delete('/users/:id', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ message: 'User deleted', id: Number(req.params.id) });
});

// POST /api/users/seed — Seed all 9 league members
router.post('/users/seed', (req, res) => {
  const members = [
    { name: 'Thomas', abbreviation: 'T' },
    { name: 'Hamza', abbreviation: 'H' },
    { name: 'Oliver', abbreviation: 'O' },
    { name: 'Dani', abbreviation: 'D' },
    { name: 'Sean', abbreviation: 'Sean' },
    { name: 'Griffin', abbreviation: 'G' },
    { name: 'Mickey', abbreviation: 'M' },
    { name: 'Seb', abbreviation: 'Seb' },
    { name: 'Gideon', abbreviation: 'Gid' },
  ];

  const insert = db.prepare(
    'INSERT OR IGNORE INTO users (name, abbreviation) VALUES (?, ?)'
  );
  const insertMany = db.transaction((list) => {
    for (const m of list) insert.run(m.name, m.abbreviation);
  });
  insertMany(members);

  const users = db.prepare('SELECT * FROM users ORDER BY name').all();
  res.json({ message: `Seeded ${users.length} members`, users });
});

export default router;
