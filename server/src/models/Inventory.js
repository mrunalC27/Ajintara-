import mongoose from 'mongoose';

// ONE ROW = ONE ROOM TYPE ON ONE DATE.
// This is where price and availability live, per date.
//   available rooms = totalRooms - booked
const inventorySchema = new mongoose.Schema({
  roomType: { type: mongoose.Schema.Types.ObjectId, ref: 'RoomType', required: true },
  property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true },
  date: { type: String, required: true }, // "YYYY-MM-DD", a calendar day in India
  price: { type: Number, required: true, min: 0 }, // price for this night, in paise
  totalRooms: { type: Number, required: true, min: 0 },
  booked: { type: Number, required: true, default: 0, min: 0 },
});

// A room type can only have one row per date. The database itself enforces this.
inventorySchema.index({ roomType: 1, date: 1 }, { unique: true });

export const Inventory = mongoose.model('Inventory', inventorySchema);
