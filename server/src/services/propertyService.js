// Hotel details page for guests, with prices for the chosen dates.
import { Property } from '../models/Property.js';
import { RoomType } from '../models/RoomType.js';
import { Inventory } from '../models/Inventory.js';
import { calculateStay } from './pricing.js';
import { nightsBetween } from '../utils/ist.js';
import { HttpError } from '../utils/httpError.js';

export async function getPropertyDetails(propertyId, { checkIn, checkOut, guests } = {}) {
  // Guests can only see approved hotels
  const property = await Property.findOne({ _id: propertyId, status: 'approved' })
    .select('-partner -cityKey -rejectionReason')
    .lean();
  if (!property) throw new HttpError(404, 'Property not found');

  const roomTypes = await RoomType.find({ property: propertyId }).lean();

  // No dates chosen: just show the rooms and their normal prices
  if (!checkIn || !checkOut) {
    return { property, roomTypes };
  }

  const nights = nightsBetween(checkIn, checkOut);
  const rows = await Inventory.find({
    roomType: { $in: roomTypes.map((r) => r._id) },
    date: { $in: nights },
  }).lean();

  const rowsByRoomType = new Map();
  for (const row of rows) {
    if (!rowsByRoomType.has(String(row.roomType))) rowsByRoomType.set(String(row.roomType), new Map());
    rowsByRoomType.get(String(row.roomType)).set(row.date, row);
  }

  const detailed = roomTypes.map((rt) => {
    const byDate = rowsByRoomType.get(String(rt._id)) || new Map();
    const nightRows = nights.map((d) => byDate.get(d));
    const hasEveryNight = nightRows.every(Boolean);

    // Rooms we can sell = the smallest number free on any night of the stay
    const availableRooms = hasEveryNight
      ? Math.max(Math.min(...nightRows.map((r) => r.totalRooms - r.booked)), 0)
      : 0;
    const fitsGuests = guests ? rt.maxGuests >= guests : true;

    return {
      ...rt,
      availableRooms,
      fitsGuests,
      bookable: availableRooms > 0 && fitsGuests,
      // Price for ONE room: every night + GST per night (all in paise)
      pricePerRoom: hasEveryNight
        ? calculateStay(nightRows.map((r) => ({ date: r.date, price: r.price })), 1)
        : null,
    };
  });

  return { property, checkIn, checkOut, nights: nights.length, roomTypes: detailed };
}
