import mongoose from 'mongoose';

// One kind of room in a hotel, for example "Deluxe Double".
// Prices are in paise (Rs 1 = 100 paise).
const roomTypeSchema = new mongoose.Schema(
  {
    property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true, index: true },
    name: { type: String, required: true, trim: true },
    basePrice: { type: Number, required: true, min: 1 }, // normal price per night, in paise
    totalRooms: { type: Number, required: true, min: 1 }, // how many rooms of this type exist
    maxGuests: { type: Number, required: true, min: 1 }, // guests allowed in one room
  },
  { timestamps: true }
);

export const RoomType = mongoose.model('RoomType', roomTypeSchema);
