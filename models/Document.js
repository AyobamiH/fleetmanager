import mongoose from 'mongoose';

const DocSchema = new mongoose.Schema({
  orgId:      { type: String, index: true, required: true },
  type:       { type: String, index: true },
  ownerType:  { type: String, enum: ['vehicle','driver','job'], index: true, required: true },
  ownerId:    { type: String, index: true, required: true },

  provider:   { type: String, default: 'cloudinary' },
  publicId:   { type: String, index: true, required: true },
  secureUrl:  { type: String },
  bytes:      { type: Number },
  format:     { type: String },

  expiry:     { type: String },
  notes:      { type: String }
}, { timestamps: true, versionKey: false });

DocSchema.index({ orgId: 1, ownerType: 1, ownerId: 1 });
DocSchema.index({ orgId: 1, type: 1 });
DocSchema.index({ orgId: 1, expiry: 1 });

export default mongoose.model('Document', DocSchema);
