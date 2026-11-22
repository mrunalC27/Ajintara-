import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

// Every route in this file is for partners only (admins can use them too)
router.use(requireAuth, requireRole('partner', 'admin'));

// Placeholder so we can prove the role check works. Real routes come in Phase 2.
router.get('/ping', (req, res) => {
  res.json({ message: `Hello partner ${req.user.name}` });
});

export default router;
