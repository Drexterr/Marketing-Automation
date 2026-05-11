import crypto from 'crypto';

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, storedHash) {
  const [salt, key] = storedHash.split(':');
  const hashBuffer = crypto.scryptSync(password, salt, 64);
  const keyBuffer = Buffer.from(key, 'hex');
  // Use timingSafeEqual to prevent timing attacks
  const match = crypto.timingSafeEqual(hashBuffer, keyBuffer);
  return match;
}

// In-memory token store for Phase 1
export const activeTokens = new Map();

let cachedDashboardHash = null;

export function getDashboardHash() {
  if (!cachedDashboardHash) {
    const password = process.env.DASHBOARD_PASSWORD;
    if (!password) {
      throw new Error('DASHBOARD_PASSWORD not set');
    }
    cachedDashboardHash = hashPassword(password);
  }
  return cachedDashboardHash;
}

// Token TTL: 24 hours
const TOKEN_TTL = 24 * 60 * 60 * 1000;

// Cleanup expired tokens every hour
setInterval(() => {
  const now = Date.now();
  for (const [token, expiry] of activeTokens.entries()) {
    if (expiry < now) {
      activeTokens.delete(token);
    }
  }
}, 60 * 60 * 1000).unref();

export function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = (authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null) || req.cookies?.session_token;
  
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const expiry = activeTokens.get(token);
  
  if (!expiry || expiry < Date.now()) {
    activeTokens.delete(token);
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}
