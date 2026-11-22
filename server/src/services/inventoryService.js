// Creates and changes the per-date room rows (the Inventory collection).
import { RULES } from '../config/rules.js';
import { Inventory } from '../models/Inventory.js';
import { HttpError } from '../utils/httpError.js';
import { todayIST, addDaysIST, datesInRange } from '../utils/ist.js';

// Makes one row per date for a new room type. Safe to run twice:
// a date that already has a row is left alone.
export async function generateInventory(roomType, fromDate = todayIST(), days = RULES.INVENTORY_DAYS) {
  const dates = datesInRange(fromDate, addDaysIST(fromDate, days - 1));
  const ops = dates.map((date) => ({
    updateOne: {
      filter: { roomType: roomType._id, date },
      update: {
        $setOnInsert: {
          roomType: roomType._id,
          property: roomType.property,
          date,
          price: roomType.basePrice,
          totalRooms: roomType.totalRooms,
          booked: 0,
        },
      },
      upsert: true,
    },
  }));
  await Inventory.bulkWrite(ops, { ordered: false });
  return dates.length;
}

// Change price and/or number of rooms for a range of dates.
// Rule: total rooms can never go below the rooms already booked on that date.
export async function applyDateOverride(roomType, { from, to, price, totalRooms }) {
  const dates = datesInRange(from, to);
  const filter = { roomType: roomType._id, date: { $in: dates } };

  const changes = {};
  if (price !== undefined) changes.price = price;
  if (totalRooms !== undefined) changes.totalRooms = totalRooms;

  if (totalRooms !== undefined) {
    // Friendly check first, so we can tell the partner exactly which dates clash
    const clashes = await Inventory.find({ ...filter, booked: { $gt: totalRooms } })
      .select('date booked')
      .lean();
    if (clashes.length > 0) {
      throw new HttpError(
        409,
        `Guests have already booked more than ${totalRooms} room(s) on some of these dates`,
        clashes.map((c) => ({ date: c.date, alreadyBooked: c.booked }))
      );
    }
    // Safety check inside the update itself, in case a booking lands in between
    filter.booked = { $lte: totalRooms };
  }

  const result = await Inventory.updateMany(filter, { $set: changes });
  if (result.matchedCount < dates.length) {
    throw new HttpError(
      409,
      `Only ${result.matchedCount} of ${dates.length} dates were updated. The rest changed while saving or have more bookings. Please check the calendar and try again`
    );
  }
  return { updatedDates: result.matchedCount };
}

// What a partner sees: each date with price, rooms, booked and still free
export async function getCalendar(roomTypeId, from, to) {
  const rows = await Inventory.find({ roomType: roomTypeId, date: { $in: datesInRange(from, to) } })
    .sort({ date: 1 })
    .lean();
  return rows.map((r) => ({
    date: r.date,
    price: r.price,
    totalRooms: r.totalRooms,
    booked: r.booked,
    available: Math.max(r.totalRooms - r.booked, 0),
  }));
}
