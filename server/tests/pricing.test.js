import { describe, it, expect } from 'vitest';
import { gstRateFor, gstForNight, calculateStay } from '../src/services/pricing.js';

// Prices are in paise: Rs 1 = 100 paise
describe('GST rate per night', () => {
  it('uses 5% at exactly Rs 7,500', () => {
    expect(gstRateFor(750000)).toBe(5);
  });
  it('uses 5% below Rs 7,500', () => {
    expect(gstRateFor(450000)).toBe(5);
  });
  it('uses 18% just above Rs 7,500', () => {
    expect(gstRateFor(750001)).toBe(18);
  });
  it('uses 18% for expensive rooms', () => {
    expect(gstRateFor(1200000)).toBe(18);
  });
});

describe('GST amount per night', () => {
  it('works out 5% of Rs 4,500 = Rs 225', () => {
    expect(gstForNight(450000)).toBe(22500);
  });
  it('works out 18% of Rs 9,000 = Rs 1,620', () => {
    expect(gstForNight(900000)).toBe(162000);
  });
});

describe('Stay total', () => {
  it('adds each night separately', () => {
    const result = calculateStay([
      { date: '2026-12-24', price: 450000 },
      { date: '2026-12-25', price: 450000 },
    ]);
    expect(result.subtotal).toBe(900000);
    expect(result.gstTotal).toBe(45000);
    expect(result.grandTotal).toBe(945000);
  });

  it('uses a different GST slab for each night', () => {
    // Night 1: Rs 7,000 (5%)  -> GST Rs 350
    // Night 2: Rs 8,000 (18%) -> GST Rs 1,440
    const result = calculateStay([
      { date: '2026-12-24', price: 700000 },
      { date: '2026-12-25', price: 800000 },
    ]);
    expect(result.lines[0].ratePercent).toBe(5);
    expect(result.lines[1].ratePercent).toBe(18);
    expect(result.subtotal).toBe(1500000);
    expect(result.gstTotal).toBe(35000 + 144000);
    expect(result.grandTotal).toBe(1500000 + 179000);
  });

  it('multiplies by number of rooms', () => {
    const result = calculateStay([{ date: '2026-12-24', price: 450000 }], 2);
    expect(result.subtotal).toBe(900000);
    expect(result.gstTotal).toBe(45000);
    expect(result.grandTotal).toBe(945000);
  });

  it('picks the GST slab using ONE room price, not the room total', () => {
    // 2 rooms at Rs 5,000 = Rs 10,000 total, but each room is still 5%
    const result = calculateStay([{ date: '2026-12-24', price: 500000 }], 2);
    expect(result.lines[0].ratePercent).toBe(5);
  });

  it('rejects empty stays', () => {
    expect(() => calculateStay([])).toThrow();
  });

  it('rejects bad room counts', () => {
    expect(() => calculateStay([{ date: '2026-12-24', price: 100 }], 0)).toThrow();
  });

  it('rejects decimal prices', () => {
    expect(() => calculateStay([{ date: '2026-12-24', price: 100.5 }])).toThrow();
  });

  it('follows custom tax slabs (so rules live in config)', () => {
    const slabs = [{ upTo: Infinity, ratePercent: 10 }];
    expect(gstRateFor(999999, slabs)).toBe(10);
  });
});
