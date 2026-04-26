import { Router } from 'express';
import db from '../db.js';
import { searchMovies as tmdbSearch, getMovieDetails as tmdbDetails } from '../services/tmdb.js';
import { getMovieByImdbId, buildStats } from '../services/omdb.js';

const router = Router();

// GET /api/movies/search?query=... — Search TMDB for movies (typeahead)
router.get('/movies/search', async (req, res) => {
  const { query } = req.query;
  if (!query || query.trim().length < 2) {
    return res.json([]);
  }

  try {
    const results = await tmdbSearch(query.trim());
    res.json(results);
  } catch (err) {
    console.error('TMDB search error:', err.message);
    res.status(502).json({ error: 'Failed to search movies. Check TMDB API key.' });
  }
});

// GET /api/movies — List all movies with joined stats
router.get('/movies', (req, res) => {
  const { draft_period_id, user_id } = req.query;

  let query = `
    SELECT m.*, ms.domestic_box_office, ms.international_box_office,
           ms.domestic_opening_weekend, ms.letterboxd_avg_score,
           ms.letterboxd_members_rated, ms.rt_score, ms.imdb_rating,
           ms.last_updated as stats_updated,
           d.user_id as owner_id, u.name as owner_name, u.abbreviation as owner_abbrev,
           d.bid_amount, d.draft_period_id, dp.name as draft_period_name
    FROM movies m
    LEFT JOIN movie_stats ms ON m.id = ms.movie_id
    LEFT JOIN drafts d ON m.id = d.movie_id
    LEFT JOIN users u ON d.user_id = u.id
    LEFT JOIN draft_periods dp ON d.draft_period_id = dp.id
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

  query += ' ORDER BY m.title';

  const movies = db.prepare(query).all(...params);
  res.json(movies);
});

// POST /api/movies — Add a new movie
// If `tmdb_id` is provided, auto-fetches metadata from TMDB + stats from OMDb.
router.post('/movies', async (req, res) => {
  const { title, tmdb_id, imdb_id, letterboxd_slug, release_date, poster_url } = req.body;

  // If tmdb_id is provided, auto-fetch everything
  if (tmdb_id) {
    try {
      // 1. Get full details from TMDB (includes imdb_id, poster, release date, revenue)
      const tmdbData = await tmdbDetails(tmdb_id);

      // Check for duplicate IMDB ID
      if (tmdbData.imdb_id) {
        const existing = db.prepare('SELECT id FROM movies WHERE imdb_id = ?').get(tmdbData.imdb_id);
        if (existing) {
          return res.status(409).json({ error: 'Movie already exists', existing_id: existing.id });
        }
      }

      // Check for duplicate TMDB ID
      const existingTmdb = db.prepare('SELECT id FROM movies WHERE tmdb_id = ?').get(tmdb_id);
      if (existingTmdb) {
        return res.status(409).json({ error: 'Movie already exists', existing_id: existingTmdb.id });
      }

      // 2. Insert movie
      const result = db.prepare(
        'INSERT INTO movies (title, tmdb_id, imdb_id, release_date, poster_url) VALUES (?, ?, ?, ?, ?)'
      ).run(
        tmdbData.title,
        tmdb_id,
        tmdbData.imdb_id,
        tmdbData.release_date,
        tmdbData.poster_url
      );

      const movie = db.prepare('SELECT * FROM movies WHERE id = ?').get(result.lastInsertRowid);

      // 3. Fetch stats from OMDb (if we have an IMDB ID)
      let stats = {};
      if (tmdbData.imdb_id) {
        try {
          const omdbData = await getMovieByImdbId(tmdbData.imdb_id);
          stats = buildStats(omdbData, tmdbData);
        } catch (omdbErr) {
          console.warn('OMDb fetch failed (movie still saved):', omdbErr.message);
        }
      }

      // 4. Insert stats
      db.prepare(`
        INSERT INTO movie_stats (movie_id, domestic_box_office, international_box_office,
          domestic_opening_weekend, letterboxd_avg_score, letterboxd_members_rated,
          rt_score, imdb_rating, last_updated)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).run(
        movie.id,
        stats.domestic_box_office ?? null,
        stats.international_box_office ?? null,
        stats.domestic_opening_weekend ?? null,
        stats.letterboxd_avg_score ?? null,
        stats.letterboxd_members_rated ?? null,
        stats.rt_score ?? null,
        stats.imdb_rating ?? null
      );

      // Return movie with stats
      const full = db.prepare(`
        SELECT m.*, ms.domestic_box_office, ms.international_box_office,
               ms.domestic_opening_weekend, ms.letterboxd_avg_score,
               ms.letterboxd_members_rated, ms.rt_score, ms.imdb_rating,
               ms.last_updated as stats_updated
        FROM movies m
        LEFT JOIN movie_stats ms ON m.id = ms.movie_id
        WHERE m.id = ?
      `).get(movie.id);

      return res.status(201).json(full);
    } catch (err) {
      console.error('Auto-fetch error:', err.message);
      return res.status(502).json({ error: 'Failed to fetch movie data from external APIs', detail: err.message });
    }
  }

  // Manual creation (no tmdb_id) — original behavior
  if (!title) return res.status(400).json({ error: 'Title is required' });

  const stmt = db.prepare(
    'INSERT INTO movies (title, imdb_id, letterboxd_slug, release_date, poster_url) VALUES (?, ?, ?, ?, ?)'
  );

  try {
    const result = stmt.run(title, imdb_id || null, letterboxd_slug || null, release_date || null, poster_url || null);
    const movie = db.prepare('SELECT * FROM movies WHERE id = ?').get(result.lastInsertRowid);

    // Create empty stats row
    db.prepare('INSERT INTO movie_stats (movie_id) VALUES (?)').run(movie.id);

    res.status(201).json(movie);
  } catch (err) {
    if (err.message.includes('UNIQUE constraint')) {
      return res.status(409).json({ error: 'Movie with this IMDB ID already exists' });
    }
    throw err;
  }
});

// GET /api/movies/:id — Get movie with full stats
router.get('/movies/:id', (req, res) => {
  const movie = db.prepare(`
    SELECT m.*, ms.domestic_box_office, ms.international_box_office,
           ms.domestic_opening_weekend, ms.letterboxd_avg_score,
           ms.letterboxd_members_rated, ms.rt_score, ms.imdb_rating,
           ms.last_updated as stats_updated
    FROM movies m
    LEFT JOIN movie_stats ms ON m.id = ms.movie_id
    WHERE m.id = ?
  `).get(req.params.id);

  if (!movie) return res.status(404).json({ error: 'Movie not found' });

  // Get draft info (who owns it, in which period)
  const draft = db.prepare(`
    SELECT d.*, u.name as owner_name, u.abbreviation as owner_abbrev,
           dp.name as draft_period_name
    FROM drafts d
    JOIN users u ON d.user_id = u.id
    JOIN draft_periods dp ON d.draft_period_id = dp.id
    WHERE d.movie_id = ?
  `).get(req.params.id);

  res.json({ ...movie, draft: draft || null });
});

// PUT /api/movies/:id — Update movie metadata
router.put('/movies/:id', (req, res) => {
  const movie = db.prepare('SELECT * FROM movies WHERE id = ?').get(req.params.id);
  if (!movie) return res.status(404).json({ error: 'Movie not found' });

  const { title, imdb_id, letterboxd_slug, release_date, poster_url } = req.body;
  db.prepare(
    'UPDATE movies SET title = ?, imdb_id = ?, letterboxd_slug = ?, release_date = ?, poster_url = ? WHERE id = ?'
  ).run(
    title || movie.title,
    imdb_id !== undefined ? imdb_id : movie.imdb_id,
    letterboxd_slug !== undefined ? letterboxd_slug : movie.letterboxd_slug,
    release_date !== undefined ? release_date : movie.release_date,
    poster_url !== undefined ? poster_url : movie.poster_url,
    req.params.id
  );

  const updated = db.prepare('SELECT * FROM movies WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// PUT /api/movies/:id/stats — Update movie stats directly
router.put('/movies/:id/stats', (req, res) => {
  const movie = db.prepare('SELECT * FROM movies WHERE id = ?').get(req.params.id);
  if (!movie) return res.status(404).json({ error: 'Movie not found' });

  const {
    domestic_box_office, international_box_office, domestic_opening_weekend,
    letterboxd_avg_score, letterboxd_members_rated, rt_score, imdb_rating
  } = req.body;

  db.prepare(`
    INSERT INTO movie_stats (movie_id, domestic_box_office, international_box_office,
      domestic_opening_weekend, letterboxd_avg_score, letterboxd_members_rated,
      rt_score, imdb_rating, last_updated)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(movie_id) DO UPDATE SET
      domestic_box_office = COALESCE(?, domestic_box_office),
      international_box_office = COALESCE(?, international_box_office),
      domestic_opening_weekend = COALESCE(?, domestic_opening_weekend),
      letterboxd_avg_score = COALESCE(?, letterboxd_avg_score),
      letterboxd_members_rated = COALESCE(?, letterboxd_members_rated),
      rt_score = COALESCE(?, rt_score),
      imdb_rating = COALESCE(?, imdb_rating),
      last_updated = datetime('now')
  `).run(
    req.params.id,
    domestic_box_office, international_box_office, domestic_opening_weekend,
    letterboxd_avg_score, letterboxd_members_rated, rt_score, imdb_rating,
    domestic_box_office, international_box_office, domestic_opening_weekend,
    letterboxd_avg_score, letterboxd_members_rated, rt_score, imdb_rating
  );

  const updated = db.prepare(`
    SELECT m.*, ms.*
    FROM movies m
    LEFT JOIN movie_stats ms ON m.id = ms.movie_id
    WHERE m.id = ?
  `).get(req.params.id);

  res.json(updated);
});

// DELETE /api/movies/:id — Delete a movie
router.delete('/movies/:id', (req, res) => {
  const movie = db.prepare('SELECT * FROM movies WHERE id = ?').get(req.params.id);
  if (!movie) return res.status(404).json({ error: 'Movie not found' });

  db.prepare('DELETE FROM movie_stats WHERE movie_id = ?').run(req.params.id);
  db.prepare('DELETE FROM drafts WHERE movie_id = ?').run(req.params.id);
  db.prepare('DELETE FROM movies WHERE id = ?').run(req.params.id);
  res.json({ message: 'Movie deleted', id: Number(req.params.id) });
});

export default router;
