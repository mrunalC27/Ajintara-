import { z } from 'zod';
import { RULES } from '../config/rules.js';
import { dateString, addStayIssues } from './common.js';

const whole = (min, max) => z.coerce.number().int().min(min).max(max);

export const searchSchema = z
  .object({
    city: z.string().trim().min(2, 'City is required'),
    checkIn: dateString,
    checkOut: dateString,
    guests: whole(1, RULES.MAX_GUESTS).default(1),
    minPrice: whole(0, 100_000_000).optional(), // paise per night
    maxPrice: whole(0, 100_000_000).optional(), // paise per night
    sort: z.enum(['price_asc', 'price_desc']).default('price_asc'),
    page: whole(1, 10_000).default(1),
    limit: whole(1, RULES.PAGE_SIZE_MAX).default(RULES.PAGE_SIZE_DEFAULT),
  })
  .superRefine((v, ctx) => {
    addStayIssues(v.checkIn, v.checkOut, ctx);
    if (v.minPrice !== undefined && v.maxPrice !== undefined && v.minPrice > v.maxPrice) {
      ctx.addIssue({ code: 'custom', message: 'minPrice cannot be above maxPrice', path: ['minPrice'] });
    }
  });

// Property details: dates are optional, but if you send one you must send both
export const detailsQuerySchema = z
  .object({
    checkIn: dateString.optional(),
    checkOut: dateString.optional(),
    guests: whole(1, RULES.MAX_GUESTS).optional(),
  })
  .superRefine((v, ctx) => {
    if ((v.checkIn && !v.checkOut) || (!v.checkIn && v.checkOut)) {
      ctx.addIssue({ code: 'custom', message: 'Send both checkIn and checkOut', path: ['checkOut'] });
    } else if (v.checkIn && v.checkOut) {
      addStayIssues(v.checkIn, v.checkOut, ctx);
    }
  });
