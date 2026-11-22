import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { searchSchema, detailsQuerySchema } from '../validators/searchSchemas.js';
import { search, details } from '../controllers/publicController.js';

const router = Router();

// Anyone can search, no login needed. "search" must come before ":id".
router.get('/search', validate(searchSchema, 'query'), asyncHandler(search));
router.get('/:id', validate(detailsQuerySchema, 'query'), asyncHandler(details));

export default router;
