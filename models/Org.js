// models/Org.js (ESM)
// ------------------------------
import mongoose from 'mongoose';

const OrgSchema = new mongoose.Schema(
  {
    name:   { type: String, required: true, trim: true },
    status: { type: String, enum: ['active','disabled'], default: 'active' }
  },
  { timestamps: true }
);

// Optional: unique org name
OrgSchema.index({ name: 1 }, { unique: true });

const Org = mongoose.models.Org || mongoose.model('Org', OrgSchema);
export default Org;
