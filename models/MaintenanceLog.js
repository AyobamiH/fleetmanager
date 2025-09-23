// models/MaintenanceLog.js
import mongoose from 'mongoose';

const MaintenanceLogSchema = new mongoose.Schema({
  orgId:       { type: String, index: true, required: true },
  vehicleId:   { type: String, index: true, required: true },
  scheduleId:  { type: String, index: true, required: true },
  performedAt: { type: String, required: true }, // ISO date
  odometerKm:  { type: Number },
  cost:        { type: Number },
  notes:       { type: String },
}, { timestamps: true, versionKey: false });

MaintenanceLogSchema.index({ orgId: 1, vehicleId: 1, scheduleId: 1 });

export default mongoose.model('maintenance_logs', MaintenanceLogSchema);
