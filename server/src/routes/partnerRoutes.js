import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  createPropertySchema,
  updatePropertySchema,
  createRoomTypeSchema,
  dateOverrideSchema,
  calendarQuerySchema,
} from '../validators/propertySchemas.js';
import {
  createProperty,
  listMyProperties,
  getMyProperty,
  updateProperty,
  createRoomType,
  setDateOverride,
  viewCalendar,
} from '../controllers/partnerController.js';

const router = Router();

// Every route in this file is for hotel partners only
router.use(requireAuth, requireRole('partner'));

router.get('/ping', (req, res) => {
  res.json({ message: `Hello partner ${req.user.name}` });
});

router.post('/properties', validate(createPropertySchema), asyncHandler(createProperty));
router.get('/properties', asyncHandler(listMyProperties));
router.get('/properties/:id', asyncHandler(getMyProperty));
router.put('/properties/:id', validate(updatePropertySchema), asyncHandler(updateProperty));

router.post('/properties/:id/room-types', validate(createRoomTypeSchema), asyncHandler(createRoomType));
router.put('/room-types/:id/dates', validate(dateOverrideSchema), asyncHandler(setDateOverride));
router.get('/room-types/:id/calendar', validate(calendarQuerySchema, 'query'), asyncHandler(viewCalendar));

export default router;
