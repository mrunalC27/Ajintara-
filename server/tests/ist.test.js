import { describe, it, expect } from 'vitest';
import {
  checkInMoment,
  checkOutMoment,
  nightsBetween,
  formatIST,
  isValidDateString,
} from '../src/utils/ist.js';

describe('IST moments', () => {
  it('check-in 2 PM IST is 08:30 UTC', () => {
    expect(checkInMoment('2026-12-24').toISOString()).toBe('2026-12-24T08:30:00.000Z');
  });
  it('check-out 12 PM IST is 06:30 UTC', () => {
    expect(checkOutMoment('2026-12-26').toISOString()).toBe('2026-12-26T06:30:00.000Z');
  });
  it('shows a UTC moment back in IST', () => {
    expect(formatIST(new Date('2026-12-24T08:30:00.000Z'), 'YYYY-MM-DD HH:mm')).toBe(
      '2026-12-24 14:00'
    );
  });
  it('late night UTC is already the next day in IST', () => {
    expect(formatIST(new Date('2026-12-24T20:00:00.000Z'), 'YYYY-MM-DD')).toBe('2026-12-25');
  });
});

describe('nights', () => {
  it('2 nights for 24 to 26 Dec', () => {
    expect(nightsBetween('2026-12-24', '2026-12-26')).toEqual(['2026-12-24', '2026-12-25']);
  });
  it('crosses month and year end', () => {
    expect(nightsBetween('2026-12-31', '2027-01-02')).toEqual(['2026-12-31', '2027-01-01']);
  });
  it('same day gives zero nights', () => {
    expect(nightsBetween('2026-12-24', '2026-12-24')).toEqual([]);
  });
});

describe('date string check', () => {
  it('accepts a good date', () => expect(isValidDateString('2026-12-24')).toBe(true));
  it('rejects bad formats', () => {
    expect(isValidDateString('24-12-2026')).toBe(false);
    expect(isValidDateString('tomorrow')).toBe(false);
    expect(isValidDateString(undefined)).toBe(false);
  });
});
