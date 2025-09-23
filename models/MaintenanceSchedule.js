// models/MaintenanceSchedule.js
import mongoose from 'mongoose';

const MaintenanceScheduleSchema = new mongoose.Schema({
  orgId:         { type: String, index: true, required: true },
  vehicleId:     { type: String, index: true, required: true },
  title:         { type: String, required: true },     // e.g. Oil change
  priority:      { type: String, enum: ['low','medium','high'], default: 'medium' },
  // Either by time or by odometer (support both)
  everyDays:     { type: Number },                     // e.g. 90
  everyKm:       { type: Number },                     // e.g. 5000
  nextDueDate:   { type: String },                     // ISO date string
  nextDueOdomKm: { type: Number },
  notes:         { type: String },
}, { timestamps: true, versionKey: false });

MaintenanceScheduleSchema.index({ orgId: 1, vehicleId: 1 });

export default mongoose.model('maintenance_schedules', MaintenanceScheduleSchema);
