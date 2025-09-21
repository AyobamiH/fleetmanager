// models/User.js (ESM)
// ------------------------------
import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema(
  {
    orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Org', required: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    name:  { type: String, required: true, trim: true },
    passwordHash: { type: String }, // required for password login
    role: { type: String, enum: ['owner','admin','dispatcher','driver','viewer'], default: 'owner' },
    status: { type: String, enum: ['active','disabled'], default: 'active' }
  },
  { timestamps: true }
);

// Unique email per org
UserSchema.index({ orgId: 1, email: 1 }, { unique: true });

const User = mongoose.models.User || mongoose.model('User', UserSchema);
export default User;
