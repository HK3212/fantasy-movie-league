import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import db from './db.js';

// Auth
import { loginHandler, logoutHandler, checkHandler, requireAdmin } from './middleware/auth.js';

// Route modules
import usersRouter from './routes/users.js';
import moviesRouter from './routes/movies.js';
import seasonsRouter from './routes/seasons.js';
import draftPeriodsRouter from './routes/draftPeriods.js';
import draftsRouter from './routes/drafts.js';
import adminRouter from './routes/admin.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Create and configure the Express app (without starting the server). */
export function createApp() {
  const app = express();

  // ── Middleware ──────────────────────────────────────────────────────────
  app.use(cors());
  app.use(express.json());

  // ── Auth endpoints ─────────────────────────────────────────────────────
  app.post('/api/auth/login', loginHandler);
  app.post('/api/auth/logout', logoutHandler);
  app.get('/api/auth/check', checkHandler);

  // ── Health check ────────────────────────────────────────────────────────
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // ── Public API routes ──────────────────────────────────────────────────
  app.use('/api', usersRouter);
  app.use('/api', moviesRouter);

  // ── Admin-only API routes ──────────────────────────────────────────────
  app.use('/api', requireAdmin, seasonsRouter);
  app.use('/api', requireAdmin, draftPeriodsRouter);
  app.use('/api', requireAdmin, draftsRouter);
  app.use('/api', requireAdmin, adminRouter);

  return app;
}

const app = createApp();
export default app;

// ── Start server ────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n🎬 Fantasy Movie League API running on http://localhost:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/api/health\n`);
});
