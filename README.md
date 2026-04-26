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
|-------|-----------|
| **Runtime** | Node.js |
| **Backend** | Express.js |
| **Database** | SQLite via `better-sqlite3` |
| **Frontend** | Vite (vanilla JS) |
| **Scraping** | Cheerio + Axios |
| **Styling** | Vanilla CSS |

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
