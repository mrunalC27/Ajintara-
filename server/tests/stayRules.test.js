import { describe, it, expect } from 'vitest';
import { stayProblems } from '../src/validators/common.js';
import { searchSchema } from '../src/validators/searchSchemas.js';
import {
  createPropertySchema,
  createRoomTypeSchema,
  dateOverrideSchema,
} from '../src/validators/propertySchemas.js';
import { todayIST, addDaysIST, datesInRange } from '../src/utils/ist.js';
import { normalizeCity } from '../src/utils/city.js';

const TODAY = '2026-11-22'; // fixed, so these tests never depend on the real date

describe('stay rules', () => {
  it('accepts a normal stay', () => {
    expect(stayProblems('2026-12-24', '2026-12-26', TODAY)).toEqual([]);
  });
  it('accepts check-in today', () => {
    expect(stayProblems(TODAY, '2026-11-23', TODAY)).toEqual([]);
  });
  it('rejects check-in in the past', () => {
    expect(stayProblems('2026-11-21', '2026-11-23', TODAY)[0]).toMatch(/past/);
  });
  it('rejects check-out on or before check-in', () => {
    expect(stayProblems('2026-12-24', '2026-12-24', TODAY).length).toBe(1);
    expect(stayProblems('2026-12-26', '2026-12-24', TODAY).length).toBe(1);
  });
  it('allows 30 nights, rejects 31', () => {
    expect(stayProblems('2026-12-01', '2026-12-31', TODAY)).toEqual([]);
    expect(stayProblems('2026-12-01', '2027-01-01', TODAY).length).toBe(1);
  });
  it('rejects stays beyond the 365 days we have rooms for', () => {
    // last day we have rooms for is 2027-11-21
    expect(stayProblems('2027-11-20', '2027-11-22', TODAY)).toEqual([]);
    expect(stayProblems('2027-11-21', '2027-11-23', TODAY).length).toBe(1);
  });
});

describe('date helpers', () => {
  it('datesInRange includes both ends', () => {
    expect(datesInRange('2026-12-24', '2026-12-26')).toEqual(['2026-12-24', '2026-12-25', '2026-12-26']);
  });
  it('one day range', () => {
    expect(datesInRange('2026-12-24', '2026-12-24')).toEqual(['2026-12-24']);
  });
  it('addDaysIST crosses the year', () => {
    expect(addDaysIST('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDaysIST('2027-01-01', -1)).toBe('2026-12-31');
  });
});

describe('city names', () => {
  it('treats Goa, goa and " GOA " the same', () => {
    expect(normalizeCity('Goa')).toBe('goa');
    expect(normalizeCity('  GOA ')).toBe('goa');
    expect(normalizeCity('New   Delhi')).toBe('new delhi');
  });
});

describe('search input', () => {
  const today = todayIST();
  const base = { city: 'Goa', checkIn: addDaysIST(today, 5), checkOut: addDaysIST(today, 7) };

  it('fills in defaults', () => {
    const r = searchSchema.parse(base);
    expect(r).toMatchObject({ guests: 1, page: 1, limit: 10, sort: 'price_asc' });
  });
  it('turns query strings into numbers', () => {
    const r = searchSchema.parse({ ...base, guests: '2', page: '3', minPrice: '100000' });
    expect(r.guests).toBe(2);
    expect(r.page).toBe(3);
    expect(r.minPrice).toBe(100000);
  });
  it('rejects min above max', () => {
    expect(searchSchema.safeParse({ ...base, minPrice: '500', maxPrice: '100' }).success).toBe(false);
  });
  it('rejects a limit above 50', () => {
    expect(searchSchema.safeParse({ ...base, limit: '500' }).success).toBe(false);
  });
  it('rejects a past check-in', () => {
    expect(searchSchema.safeParse({ ...base, checkIn: addDaysIST(today, -2) }).success).toBe(false);
  });
  it('rejects a bad date format', () => {
    expect(searchSchema.safeParse({ ...base, checkIn: '24/12/2026' }).success).toBe(false);
  });
});

describe('partner input', () => {
  const today = todayIST();

  it('property needs at least one image link', () => {
    const good = { name: 'Sea View', city: 'Goa', address: '12 Beach Road', images: ['https://x.com/a.jpg'] };
    expect(createPropertySchema.safeParse(good).success).toBe(true);
    expect(createPropertySchema.safeParse({ ...good, images: [] }).success).toBe(false);
    expect(createPropertySchema.safeParse({ ...good, images: ['not a link'] }).success).toBe(false);
  });

  it('room type price must be whole paise', () => {
    const good = { name: 'Deluxe', basePrice: 450000, totalRooms: 5, maxGuests: 2 };
    expect(createRoomTypeSchema.safeParse(good).success).toBe(true);
    expect(createRoomTypeSchema.safeParse({ ...good, basePrice: 4500.5 }).success).toBe(false);
    expect(createRoomTypeSchema.safeParse({ ...good, totalRooms: 0 }).success).toBe(false);
  });

  it('date override needs a price or rooms', () => {
    const range = { from: addDaysIST(today, 1), to: addDaysIST(today, 3) };
    expect(dateOverrideSchema.safeParse(range).success).toBe(false);
    expect(dateOverrideSchema.safeParse({ ...range, price: 500000 }).success).toBe(true);
    expect(dateOverrideSchema.safeParse({ ...range, totalRooms: 0 }).success).toBe(true); // closes dates
  });

  it('date override rejects backwards, past and too-far dates', () => {
    const p = { price: 500000 };
    expect(dateOverrideSchema.safeParse({ from: addDaysIST(today, 3), to: addDaysIST(today, 1), ...p }).success).toBe(false);
    expect(dateOverrideSchema.safeParse({ from: addDaysIST(today, -1), to: today, ...p }).success).toBe(false);
    expect(dateOverrideSchema.safeParse({ from: today, to: addDaysIST(today, 400), ...p }).success).toBe(false);
  });
});
