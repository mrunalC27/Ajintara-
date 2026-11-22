import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { rejectSchema } from '../validators/propertySchemas.js';
import { listProperties, approveProperty, rejectProperty } from '../controllers/adminController.js';

const router = Router();

// Every route in this file is for admins only
router.use(requireAuth, requireRole('admin'));

router.get('/properties', asyncHandler(listProperties));
router.patch('/properties/:id/approve', asyncHandler(approveProperty));
router.patch('/properties/:id/reject', validate(rejectSchema), asyncHandler(rejectProperty));

export default router;
