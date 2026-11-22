import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { User } from '../models/User.js';

// Step 1: is the person logged in? Checks the token, then loads the user fresh from the database.
// We check the database every time so a blocked user is stopped right away.
export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Please log in first' });

    let payload;
    try {
      payload = jwt.verify(token, config.jwtSecret);
    } catch {
      return res.status(401).json({ error: 'Login expired or invalid. Please log in again' });
    }

    const user = await User.findById(payload.id);
    if (!user) return res.status(401).json({ error: 'User no longer exists' });
    if (user.isBlocked) return res.status(403).json({ error: 'Your account is blocked' });

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

// Step 2: does this person have the right role? Use after requireAuth.
// Example: router.get('/mine', requireAuth, requireRole('partner'), handler)
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'You are not allowed to do this' });
    }
    next();
  };
}
