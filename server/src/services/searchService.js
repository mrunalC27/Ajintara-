// Guest search. The rule: show a hotel only if at least one room type is free on EVERY night.
import { Property } from '../models/Property.js';
import { RoomType } from '../models/RoomType.js';
import { Inventory } from '../models/Inventory.js';
import { nightsBetween } from '../utils/ist.js';
import { normalizeCity } from '../utils/city.js';

// Builds the database query. It is a plain function (no database needed) so we can test it.
export function buildSearchPipeline({ roomTypeIds, nights, minPrice, maxPrice, sort, page, limit }) {
  const pipeline = [
    // 1. Only rows for these room types, on the nights of the stay, with at least 1 room free
    {
      $match: {
        roomType: { $in: roomTypeIds },
        date: { $in: nights },
        $expr: { $gt: [{ $subtract: ['$totalRooms', '$booked'] }, 0] },
      },
    },
    // 2. One line per room type: how many nights were free, and what they add up to
    {
      $group: {
        _id: '$roomType',
        property: { $first: '$property' },
        nightsAvailable: { $sum: 1 },
        subtotal: { $sum: '$price' },
      },
    },
    // 3. Keep only room types free on EVERY night of the stay
    { $match: { nightsAvailable: nights.length } },
    // 4. Average price per night (paise)
    { $addFields: { avgNightly: { $round: [{ $divide: ['$subtotal', nights.length] }, 0] } } },
  ];

  // 5. Price filter (per night)
  const priceRange = {};
  if (minPrice !== undefined) priceRange.$gte = minPrice;
  if (maxPrice !== undefined) priceRange.$lte = maxPrice;
  if (Object.keys(priceRange).length > 0) pipeline.push({ $match: { avgNightly: priceRange } });

  pipeline.push(
    // 6. One line per hotel, using its cheapest room type
    { $sort: { avgNightly: 1 } },
    {
      $group: {
        _id: '$property',
        fromPrice: { $first: '$avgNightly' },
        roomTypesAvailable: { $sum: 1 },
      },
    },
    // 7. Sort hotels, then cut out just this page (and count all hotels)
    { $sort: { fromPrice: sort === 'price_desc' ? -1 : 1, _id: 1 } },
    {
      $facet: {
        results: [{ $skip: (page - 1) * limit }, { $limit: limit }],
        total: [{ $count: 'count' }],
      },
    }
  );
  return pipeline;
}

export async function searchProperties({ city, checkIn, checkOut, guests, minPrice, maxPrice, sort, page, limit }) {
  const empty = { items: [], page, limit, total: 0, totalPages: 0 };
  const nights = nightsBetween(checkIn, checkOut);

  // Approved hotels in this city
  const properties = await Property.find({ cityKey: normalizeCity(city), status: 'approved' })
    .select('_id')
    .lean();
  if (properties.length === 0) return empty;

  // Room types that fit the guests (guests per room)
  const roomTypes = await RoomType.find({
    property: { $in: properties.map((p) => p._id) },
    maxGuests: { $gte: guests },
  })
    .select('_id')
    .lean();
  if (roomTypes.length === 0) return empty;

  const pipeline = buildSearchPipeline({
    roomTypeIds: roomTypes.map((r) => r._id),
    nights,
    minPrice,
    maxPrice,
    sort,
    page,
    limit,
  });
  const [out] = await Inventory.aggregate(pipeline);
  const total = out.total[0]?.count ?? 0;

  // Fetch hotel details for just this page, keep the same order
  const ids = out.results.map((r) => r._id);
  const details = await Property.find({ _id: { $in: ids } })
    .select('name city address images amenities')
    .lean();
  const byId = new Map(details.map((d) => [String(d._id), d]));

  const items = out.results.map((r) => ({
    ...byId.get(String(r._id)),
    fromPrice: r.fromPrice, // average per night, paise, before GST
    roomTypesAvailable: r.roomTypesAvailable,
  }));

  return { items, page, limit, total, totalPages: Math.ceil(total / limit) };
}
