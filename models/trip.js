import mongoose from 'mongoose';
import { randomUUID } from 'crypto';

const TripSchema = new mongoose.Schema({
  _id: { type: String, default: () => randomUUID() },
  orgId: { type: String, index: true, required: true },
  vehicleId: { type: String, index: true, required: true },
  startTs: { type: String, index: true },
  endTs: String,
  distanceKm: Number,
  idleMinutes: Number,
  polyline: String
}, { timestamps: true, versionKey: false });

TripSchema.index({ orgId: 1, vehicleId: 1, startTs: 1 });
TripSchema.index({ orgId: 1, startTs: 1 });
export default mongoose.model('trips', TripSchema);
