# 🎬 Fantasy Movie League

Track your fantasy movie league — drafted movies, box office performance, ratings, auction budgets, and ROTO standings.

## Prerequisites

- **Node.js** v18 or later
- **npm** v9 or later

## API Keys

You'll need two free API keys:

| Key | Where to get it | Free tier |
|-----|-----------------|-----------|
| **OMDb** (IMDB ratings + RT scores) | [omdbapi.com/apikey.aspx](https://www.omdbapi.com/apikey.aspx) | 1,000 req/day |
| **TMDB** (movie posters) | [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api) | Unlimited (non-commercial) |

## Setup

1. **Clone and install dependencies:**

   ```bash
   git clone <repo-url>
   cd fantasy-movie-league
   npm install
   ```

2. **Configure environment variables:**

   ```bash
   cp .env.example .env
   ```

   Open `.env` and add your API keys:

   ```env
   OMDB_API_KEY=your_omdb_key_here
   TMDB_API_KEY=your_tmdb_key_here
   PORT=3001
   ```

## Running

Start both the Express backend and Vite frontend dev server:

```bash
npm run dev
```

This runs two processes concurrently:

| Process | URL | Description |
|---------|-----|-------------|
| **Frontend** | [http://localhost:5173](http://localhost:5173) | Vite dev server (hot reload) |
| **Backend API** | [http://localhost:3001](http://localhost:3001) | Express API server |

> The Vite dev server proxies `/api/*` requests to the backend automatically — just open **localhost:5173** in your browser.

### Individual commands

```bash
npm run dev:client   # Vite frontend only
npm run dev:server   # Express backend only (with --watch for auto-restart)
npm run build        # Production build (frontend)
npm run preview      # Preview production build
```

## Project Structure

```
fantasy-movie-league/
├── index.html              # App shell (nav, mount point)
├── package.json
├── vite.config.js          # Vite config + API proxy
├── .env                    # API keys (not committed)
├── .env.example            # Template for .env
├── server/
│   ├── index.js            # Express entry point
│   ├── db.js               # SQLite schema + connection
│   ├── routes/             # API route modules
│   └── services/           # Data fetching (OMDb, scrapers)
└── src/
    ├── main.js             # SPA router + page renderers
    └── style.css           # Design system (dark theme)
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Runtime** | Node.js |
| **Backend** | Express.js |
| **Database** | SQLite via `better-sqlite3` |
| **Frontend** | Vite (vanilla JS) |
| **Scraping** | Cheerio + Axios |
| **Styling** | Vanilla CSS |
| **Testing** | Vitest + Supertest |

## Testing

API tests live in `server/__tests__/` and cover every route module:

| Test file | What it covers |
|-----------|----------------|
| `health.test.js` | Health-check endpoint |
| `auth.test.js` | Login, logout, token check, requireAdmin middleware |
| `users.test.js` | User CRUD + seed |
| `seasons.test.js` | Season CRUD + activate |
| `movies.test.js` | Movie CRUD + stats update + duplicate handling |
| `draftPeriods.test.js` | Draft period CRUD + standings + budget init |
| `drafts.test.js` | Draft pick CRUD + duplicate & validation |
| `admin.test.js` | Carryover calculation, db-stats, placeholder endpoints |

### Running tests

```bash
# Run all tests once
npm test

# Run tests in watch mode (re-runs on file changes)
npm run test:watch

# Run a specific test file
npx vitest run server/__tests__/seasons.test.js

# Run tests with verbose output
npx vitest run --reporter=verbose
```

> Tests run against the real SQLite database file but clean all tables between each test via `beforeEach`. They do not start the HTTP server — Supertest makes in-process requests to the Express app.

## Database

SQLite database is created automatically at `fantasy_league.db` on first run. No external database setup needed.

## League Scoring (ROTO)

Movies are ranked within their draft period across 7 categories. Each user's ROTO score = sum of their movies' ranks. Highest total wins.

| Category | Direction |
|----------|-----------|
| Domestic Box Office | Higher $ = better |
| International Box Office | Higher $ = better |
| Opening Weekend | Higher $ = better |
| Letterboxd Avg Score | Higher = better |
| Letterboxd # Members | Higher = better |
| RT Score | Higher % = better |
| IMDB Rating | Higher = better |

## License

Private — for personal league use.
