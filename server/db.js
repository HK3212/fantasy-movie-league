import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'fantasy_league.db');

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read/write performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Schema initialization ──────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS seasons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    year INTEGER NOT NULL,
    is_active INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS draft_periods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    season_id INTEGER NOT NULL REFERENCES seasons(id),
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'quarterly',
    start_date TEXT,
    end_date TEXT,
    auction_budget REAL DEFAULT 100.0,
    is_active INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    abbreviation TEXT,
    avatar_url TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS user_draft_periods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    draft_period_id INTEGER NOT NULL REFERENCES draft_periods(id),
    budget REAL NOT NULL,
    amount_spent REAL DEFAULT 0.0,
    carryover_in REAL DEFAULT 0.0,
    UNIQUE(user_id, draft_period_id)
  );

  CREATE TABLE IF NOT EXISTS movies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    imdb_id TEXT UNIQUE,
    letterboxd_slug TEXT,
    release_date TEXT,
    poster_url TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS movie_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    movie_id INTEGER NOT NULL REFERENCES movies(id),
    domestic_box_office REAL,
    international_box_office REAL,
    domestic_opening_weekend REAL,
    letterboxd_avg_score REAL,
    letterboxd_members_rated INTEGER,
    rt_score REAL,
    imdb_rating REAL,
    last_updated TEXT DEFAULT (datetime('now')),
    UNIQUE(movie_id)
  );

  CREATE TABLE IF NOT EXISTS drafts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    movie_id INTEGER NOT NULL REFERENCES movies(id),
    draft_period_id INTEGER NOT NULL REFERENCES draft_periods(id),
    bid_amount REAL DEFAULT 0.0,
    draft_order INTEGER,
    UNIQUE(movie_id, draft_period_id)
  );
`);

console.log('✓ Database initialized at', DB_PATH);

// ── Migrations ─────────────────────────────────────────────────────────
// Add tmdb_id column (safe to re-run — silently skips if column exists)
try {
  db.exec('ALTER TABLE movies ADD COLUMN tmdb_id INTEGER');
} catch (e) {
  // Column already exists — expected after first run
}

export default db;
