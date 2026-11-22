import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { config } from '../config/index.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { signup, login, me, signupSchema, loginSchema } from '../controllers/authController.js';

// Stops people from trying thousands of passwords
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config.loginRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Try again in 15 minutes' },
});

const router = Router();

router.post('/signup', validate(signupSchema), signup);
router.post('/login', loginLimiter, validate(loginSchema), login);
router.get('/me', requireAuth, me);

export default router;
