import mongoose from 'mongoose';
import { randomUUID } from 'crypto';

const VehicleSchema = new mongoose.Schema({
  _id: { type: String, default: () => randomUUID() },
  orgId: { type: String, index: true, required: true },
  name: String,
  plate: String,
  status: { type: String, enum: ['active', 'maintenance', 'retired'], default: 'active', index: true },
  deviceId: String,
  odometerKm: Number,
  lastSeenTs: String
}, { timestamps: true, versionKey: false });

VehicleSchema.index({ orgId: 1, plate: 1 }, { unique: true });
export default mongoose.model('vehicles', VehicleSchema);
