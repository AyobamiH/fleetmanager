import mongoose from 'mongoose';
import { randomUUID } from 'crypto';

const JobSchema = new mongoose.Schema({
  _id: { type: String, default: () => randomUUID() },
  orgId: { type: String, index: true, required: true },
  title: String,
  pickup: mongoose.Schema.Types.Mixed,
  dropoff: mongoose.Schema.Types.Mixed,
  assignedVehicleId: { type: String, index: true },
  assignedDriverId: String,
  status: { type: String, enum: ['new','assigned','enroute','arrived','completed','failed'], default: 'new', index: true },
  eta: String,
  notes: String
}, { timestamps: true, versionKey: false });

JobSchema.index({ orgId: 1, createdAt: -1 });
export default mongoose.model('jobs', JobSchema);
