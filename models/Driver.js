import mongoose from 'mongoose';

const driverSchema = new mongoose.Schema({
  orgId: { type: String, index: true, required: true },
  name: { type: String, required: true },
  email: { type: String },
  phone: { type: String },
  licenceNumber: { type: String },
  status: { type: String, enum: ['active', 'inactive', 'suspended'], default: 'active', index: true },
  emergencyContact: {
    name: String,
    phone: String,
    relationship: String
  }
}, { timestamps: true });

driverSchema.index({ orgId: 1, name: 1 });

export default mongoose.model('Driver', driverSchema);
