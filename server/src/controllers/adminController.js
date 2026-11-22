import { Property, PROPERTY_STATUSES } from '../models/Property.js';
import { HttpError } from '../utils/httpError.js';

// GET /api/admin/properties?status=pending  (default: pending)
export async function listProperties(req, res) {
  const status = req.query.status || 'pending';
  if (!PROPERTY_STATUSES.includes(status)) {
    throw new HttpError(400, `status must be one of: ${PROPERTY_STATUSES.join(', ')}`);
  }
  const properties = await Property.find({ status })
    .sort({ createdAt: 1 })
    .populate('partner', 'name email')
    .lean();
  res.json({ properties });
}

export async function approveProperty(req, res) {
  const property = await Property.findByIdAndUpdate(
    req.params.id,
    { status: 'approved', rejectionReason: '' },
    { returnDocument: 'after' }
  );
  if (!property) throw new HttpError(404, 'Property not found');
  res.json({ property });
}

export async function rejectProperty(req, res) {
  const property = await Property.findByIdAndUpdate(
    req.params.id,
    { status: 'rejected', rejectionReason: req.body.reason },
    { returnDocument: 'after' }
  );
  if (!property) throw new HttpError(404, 'Property not found');
  res.json({ property });
}
