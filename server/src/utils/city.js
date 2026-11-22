// "  Goa " and "goa" and "GOA" are the same city. We search on this clean version.
export function normalizeCity(city) {
  return String(city).trim().replace(/\s+/g, ' ').toLowerCase();
}
