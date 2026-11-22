// Pricing rules. Pure functions: numbers in, numbers out. No database, no dates.
// All money is in paise (integers), so we never get decimal bugs.
import { GST_SLABS } from '../config/taxSlabs.js';

// Which GST percent applies to ONE night's price?
export function gstRateFor(nightPrice, slabs = GST_SLABS) {
  const slab = slabs.find((s) => nightPrice <= s.upTo);
  return slab.ratePercent;
}

// GST for ONE night, rounded to the nearest paisa
export function gstForNight(nightPrice, slabs = GST_SLABS) {
  const rate = gstRateFor(nightPrice, slabs);
  return Math.round((nightPrice * rate) / 100);
}

// nights = [{ date: "2026-12-24", price: 450000 }, ...]  (price in paise, for ONE room)
// rooms = how many rooms the guest wants
export function calculateStay(nights, rooms = 1, slabs = GST_SLABS) {
  if (!Array.isArray(nights) || nights.length === 0) {
    throw new Error('At least one night is required');
  }
  if (!Number.isInteger(rooms) || rooms < 1) {
    throw new Error('Rooms must be a whole number of at least 1');
  }

  const lines = nights.map(({ date, price }) => {
    if (!Number.isInteger(price) || price < 0) {
      throw new Error(`Invalid price for ${date}`);
    }
    // GST is worked out per night, using ONE room's price to pick the slab
    const ratePercent = gstRateFor(price, slabs);
    const roomPrice = price * rooms;
    const gst = gstForNight(price, slabs) * rooms;
    return { date, price, rooms, ratePercent, roomPrice, gst, total: roomPrice + gst };
  });

  const subtotal = lines.reduce((sum, l) => sum + l.roomPrice, 0);
  const gstTotal = lines.reduce((sum, l) => sum + l.gst, 0);

  return { lines, subtotal, gstTotal, grandTotal: subtotal + gstTotal };
}
