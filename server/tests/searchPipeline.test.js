// Tests the search query using sample data (no real database needed).
// Stay in these tests: 24 Dec to 26 Dec 2026 = 2 nights (24th and 25th).
import { describe, it, expect } from 'vitest';
import { Aggregator } from 'mingo';
import { buildSearchPipeline } from '../src/services/searchService.js';

const nights = ['2026-12-24', '2026-12-25'];

const row = (roomType, property, date, price, totalRooms = 2, booked = 0) => ({
  roomType, property, date, price, totalRooms, booked,
});

const rows = [
  // Hotel p1, room A1: free both nights at Rs 5,000
  row('A1', 'p1', '2026-12-24', 500000),
  row('A1', 'p1', '2026-12-25', 500000),
  // Hotel p1, room E: free both nights at Rs 4,000 (p1's cheapest)
  row('E', 'p1', '2026-12-24', 400000),
  row('E', 'p1', '2026-12-25', 400000),
  // Hotel p1, room A2: cheap, but FULLY BOOKED on the 25th -> must NOT count
  row('A2', 'p1', '2026-12-24', 300000),
  row('A2', 'p1', '2026-12-25', 300000, 2, 2),
  // Hotel p2: free both nights at Rs 2,000
  row('B', 'p2', '2026-12-24', 200000),
  row('B', 'p2', '2026-12-25', 200000),
  // Hotel p3: has NO row for the 25th -> must NOT count
  row('C', 'p3', '2026-12-24', 100000),
  // Hotel p4: Rs 9,000 and Rs 11,000 -> average Rs 10,000
  row('D', 'p4', '2026-12-24', 900000),
  row('D', 'p4', '2026-12-25', 1100000),
  // Hotel p5: only free on a different date -> must NOT count
  row('F', 'p5', '2026-12-31', 100000),
];

const roomTypeIds = ['A1', 'E', 'A2', 'B', 'C', 'D', 'F'];

function run(options = {}) {
  const pipeline = buildSearchPipeline({
    roomTypeIds, nights, sort: 'price_asc', page: 1, limit: 10, ...options,
  });
  const [out] = new Aggregator(pipeline).run(rows);
  return { ids: out.results.map((r) => r._id), results: out.results, total: out.total[0]?.count ?? 0 };
}

describe('search: only hotels free on EVERY night', () => {
  it('returns p2, p1, p4 and skips full / missing / other-date hotels', () => {
    const { ids, total } = run();
    expect(ids).toEqual(['p2', 'p1', 'p4']);
    expect(total).toBe(3);
  });

  it('a room that is full on one night is not counted for its hotel', () => {
    const p1 = run().results.find((r) => r._id === 'p1');
    expect(p1.roomTypesAvailable).toBe(2); // A1 and E, not A2
    expect(p1.fromPrice).toBe(400000); // cheapest working room, not the Rs 3,000 one
  });

  it('uses the average price per night', () => {
    const p4 = run().results.find((r) => r._id === 'p4');
    expect(p4.fromPrice).toBe(1000000);
  });
});

describe('search: sort, filter, pages', () => {
  it('sorts price high to low', () => {
    expect(run({ sort: 'price_desc' }).ids).toEqual(['p4', 'p1', 'p2']);
  });

  it('filters by price range (per night)', () => {
    const { ids, results } = run({ minPrice: 300000, maxPrice: 600000 });
    expect(ids).toEqual(['p1']);
    expect(results[0].roomTypesAvailable).toBe(2);
  });

  it('min price only', () => {
    expect(run({ minPrice: 600000 }).ids).toEqual(['p4']);
  });

  it('max price only', () => {
    expect(run({ maxPrice: 250000 }).ids).toEqual(['p2']);
  });

  it('gives an empty answer when nothing matches', () => {
    const { ids, total } = run({ maxPrice: 1000 });
    expect(ids).toEqual([]);
    expect(total).toBe(0);
  });

  it('pagination: page 1 has 2 hotels, page 2 has 1, total stays 3', () => {
    const first = run({ limit: 2, page: 1 });
    const second = run({ limit: 2, page: 2 });
    expect(first.ids).toEqual(['p2', 'p1']);
    expect(second.ids).toEqual(['p4']);
    expect(first.total).toBe(3);
    expect(second.total).toBe(3);
  });

  it('a one-night stay works too', () => {
    const [out] = new Aggregator(
      buildSearchPipeline({
        roomTypeIds, nights: ['2026-12-24'], sort: 'price_asc', page: 1, limit: 10,
      })
    ).run(rows);
    // p3 now counts (it has the 24th), and A2 counts too (free on the 24th)
    expect(out.results.map((r) => r._id)).toEqual(['p3', 'p2', 'p1', 'p4']);
  });
});
