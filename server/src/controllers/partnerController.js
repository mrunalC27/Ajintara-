import { Property } from '../models/Property.js';
import { RoomType } from '../models/RoomType.js';
import { Inventory } from '../models/Inventory.js';
import { generateInventory, applyDateOverride, getCalendar } from '../services/inventoryService.js';
import { normalizeCity } from '../utils/city.js';
import { HttpError } from '../utils/httpError.js';

// A partner can only touch their own hotels. Someone else's hotel looks like "not found".
async function loadOwnProperty(propertyId, partnerId) {
  const property = await Property.findOne({ _id: propertyId, partner: partnerId });
  if (!property) throw new HttpError(404, 'Property not found');
  return property;
}

async function loadOwnRoomType(roomTypeId, partnerId) {
  const roomType = await RoomType.findById(roomTypeId);
  if (!roomType) throw new HttpError(404, 'Room type not found');
  await loadOwnProperty(roomType.property, partnerId);
  return roomType;
}

export async function createProperty(req, res) {
  const data = req.body;
  const property = await Property.create({
    ...data,
    cityKey: normalizeCity(data.city),
    partner: req.user._id,
    status: 'pending', // hidden from guests until an admin approves
  });
  res.status(201).json({ property });
}

export async function listMyProperties(req, res) {
  const properties = await Property.find({ partner: req.user._id }).sort({ createdAt: -1 }).lean();
  res.json({ properties });
}

export async function getMyProperty(req, res) {
  const property = await loadOwnProperty(req.params.id, req.user._id);
  const roomTypes = await RoomType.find({ property: property._id }).lean();
  res.json({ property, roomTypes });
}

export async function updateProperty(req, res) {
  const property = await loadOwnProperty(req.params.id, req.user._id);
  const changes = req.body;

  Object.assign(property, changes);
  if (changes.city) property.cityKey = normalizeCity(changes.city);
  // A rejected hotel goes back to the admin when the partner fixes it
  if (property.status === 'rejected') {
    property.status = 'pending';
    property.rejectionReason = '';
  }
  await property.save();
  res.json({ property });
}

export async function createRoomType(req, res) {
  const property = await loadOwnProperty(req.params.id, req.user._id);
  const roomType = await RoomType.create({ ...req.body, property: property._id });

  try {
    await generateInventory(roomType);
  } catch (err) {
    // Don't leave a room type with no dates behind
    await Inventory.deleteMany({ roomType: roomType._id });
    await RoomType.deleteOne({ _id: roomType._id });
    throw err;
  }
  res.status(201).json({ roomType });
}

export async function setDateOverride(req, res) {
  const roomType = await loadOwnRoomType(req.params.id, req.user._id);
  const result = await applyDateOverride(roomType, req.body);
  res.json({ message: 'Dates updated', ...result });
}

export async function viewCalendar(req, res) {
  const roomType = await loadOwnRoomType(req.params.id, req.user._id);
  const { from, to } = req.validatedQuery;
  const calendar = await getCalendar(roomType._id, from, to);
  res.json({ roomType: { id: roomType._id, name: roomType.name }, calendar });
}
