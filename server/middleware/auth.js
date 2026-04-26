import crypto from 'crypto';

const TOKEN_SECRET = crypto.randomBytes(32).toString('hex');

// Active admin tokens (in-memory — cleared on server restart)
const activeTokens = new Set();

/**
 * POST /api/auth/login — Validate admin password, return a bearer token.
 */
export function loginHandler(req, res) {
  const { password } = req.body;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    return res.status(500).json({ error: 'ADMIN_PASSWORD not configured on server' });
  }

  if (!password || password !== adminPassword) {
    return res.status(401).json({ error: 'Invalid password' });
  }

  // Generate a session token
  const token = crypto.randomBytes(48).toString('hex');
  activeTokens.add(token);

  res.json({ token, message: 'Authenticated as admin' });
}

/**
 * POST /api/auth/logout — Invalidate the current token.
 */
export function logoutHandler(req, res) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    activeTokens.delete(token);
  }
  res.json({ message: 'Logged out' });
}

/**
 * GET /api/auth/check — Check if current token is valid.
 */
export function checkHandler(req, res) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    if (activeTokens.has(token)) {
      return res.json({ authenticated: true });
    }
  }
  res.json({ authenticated: false });
}

/**
 * Middleware: requireAdmin
 * Blocks the request with 401 if no valid admin token is present.
 */
export function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Admin authentication required' });
  }

  const token = authHeader.slice(7);
  if (!activeTokens.has(token)) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  next();
}
