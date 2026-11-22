import { z } from 'zod';
import { RULES } from '../config/rules.js';
import { todayIST } from '../utils/ist.js';
import { dateString, lastInventoryDate } from './common.js';

const propertyFields = {
  name: z.string().trim().min(2, 'Name must be at least 2 letters'),
  city: z.string().trim().min(2, 'City is required'),
  address: z.string().trim().min(5, 'Address is required'),
  description: z.string().trim().default(''),
  amenities: z.array(z.string().trim().min(1)).default([]),
  images: z.array(z.string().url('Each image must be a link')).min(1, 'Add at least one image'),
};

export const createPropertySchema = z.object(propertyFields);

// For editing: every field is optional, but at least one must be sent
export const updatePropertySchema = z
  .object({
    name: propertyFields.name.optional(),
    city: propertyFields.city.optional(),
    address: propertyFields.address.optional(),
    description: z.string().trim().optional(),
    amenities: z.array(z.string().trim().min(1)).optional(),
    images: propertyFields.images.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'Send at least one field to change');

// All prices are in paise (Rs 4,500 = 450000)
export const createRoomTypeSchema = z.object({
  name: z.string().trim().min(2, 'Room name must be at least 2 letters'),
  basePrice: z.number().int('Price must be a whole number of paise').min(1),
  totalRooms: z.number().int().min(1).max(1000),
  maxGuests: z.number().int().min(1).max(RULES.MAX_GUESTS),
});

// Change price and/or rooms for a range of dates (both ends included)
export const dateOverrideSchema = z
  .object({
    from: dateString,
    to: dateString,
    price: z.number().int('Price must be a whole number of paise').min(1).optional(),
    totalRooms: z.number().int().min(0).max(1000).optional(), // 0 = close these dates
  })
  .superRefine((v, ctx) => {
    if (v.price === undefined && v.totalRooms === undefined) {
      ctx.addIssue({ code: 'custom', message: 'Send price, totalRooms, or both', path: ['price'] });
    }
    if (v.to < v.from) {
      ctx.addIssue({ code: 'custom', message: '"to" must be the same as or after "from"', path: ['to'] });
    }
    if (v.from < todayIST()) {
      ctx.addIssue({ code: 'custom', message: 'You cannot change past dates', path: ['from'] });
    }
    if (v.to > lastInventoryDate()) {
      ctx.addIssue({
        code: 'custom',
        message: `Dates only go up to ${lastInventoryDate()}`,
        path: ['to'],
      });
    }
  });

export const calendarQuerySchema = z
  .object({ from: dateString, to: dateString })
  .refine((v) => v.to >= v.from, '"to" must be the same as or after "from"');

export const rejectSchema = z.object({
  reason: z.string().trim().min(3, 'Please give a reason (at least 3 letters)'),
});
