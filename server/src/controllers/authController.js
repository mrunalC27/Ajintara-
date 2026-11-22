import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { config } from '../config/index.js';
import { User } from '../models/User.js';

export const signupSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 letters'),
  email: z.string().trim().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  // Only guest or partner can sign up by themselves. Admins are created by us.
  role: z.enum(['guest', 'partner']).default('guest'),
});

export const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

function makeToken(user) {
  return jwt.sign({ id: user._id, role: user.role }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
}

function publicUser(user) {
  return { id: user._id, name: user.name, email: user.email, role: user.role };
}

export async function signup(req, res, next) {
  try {
    const { name, email, password, role } = req.body;

    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) return res.status(409).json({ error: 'This email is already registered' });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, passwordHash, role });

    res.status(201).json({ token: makeToken(user), user: publicUser(user) });
  } catch (err) {
    next(err);
  }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email: email.toLowerCase() });
    // Same message for "no such user" and "wrong password" so nobody can guess emails
    const ok = user && (await bcrypt.compare(password, user.passwordHash));
    if (!ok) return res.status(401).json({ error: 'Wrong email or password' });

    if (user.isBlocked) return res.status(403).json({ error: 'Your account is blocked' });

    res.json({ token: makeToken(user), user: publicUser(user) });
  } catch (err) {
    next(err);
  }
}

export function me(req, res) {
  res.json({ user: publicUser(req.user) });
}
