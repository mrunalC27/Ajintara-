import mongoose from 'mongoose';

export const PROPERTY_STATUSES = ['pending', 'approved', 'rejected'];

const propertySchema = new mongoose.Schema(
  {
    partner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    cityKey: { type: String, required: true }, // clean lowercase city used for searching
    address: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    amenities: { type: [String], default: [] },
    images: { type: [String], validate: (v) => v.length >= 1 },
    status: { type: String, enum: PROPERTY_STATUSES, default: 'pending' },
    rejectionReason: { type: String, default: '' },
  },
  { timestamps: true }
);

// Makes "find approved hotels in a city" fast
propertySchema.index({ cityKey: 1, status: 1 });

export const Property = mongoose.model('Property', propertySchema);
