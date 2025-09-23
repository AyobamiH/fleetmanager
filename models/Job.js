// import mongoose from 'mongoose';
// import { randomUUID } from 'crypto';

// const JobSchema = new mongoose.Schema({
//   _id: { type: String, default: () => randomUUID() },
//   orgId: { type: String, index: true, required: true },
//   title: String,
//   pickup: mongoose.Schema.Types.Mixed,
//   dropoff: mongoose.Schema.Types.Mixed,
//   assignedVehicleId: { type: String, index: true },
//   assignedDriverId: String,
//   status: { type: String, enum: ['new','assigned','enroute','arrived','completed','failed'], default: 'new', index: true },
//   eta: String,
//   notes: String
// }, { timestamps: true, versionKey: false });

// JobSchema.index({ orgId: 1, createdAt: -1 });
// export default mongoose.model('jobs', JobSchema);


// models/Job.js  (backwards-compatible)
import mongoose from 'mongoose';
import { randomUUID } from 'crypto';

const AddressSchema = new mongoose.Schema({
  address: { type: String },
  lat: { type: Number },
  lon: { type: Number },
  contactName: { type: String },
  contactPhone: { type: String },
  notes: { type: String },
}, { _id: false });

const JobSchema = new mongoose.Schema({
  // KEEP string UUID id for full compatibility with existing data & UI
  _id: { type: String, default: () => randomUUID() },

  orgId: { type: String, index: true, required: true },

  // existing fields
  title: { type: String, required: true },
  pickup: { type: mongoose.Schema.Types.Mixed },    // keep Mixed to avoid migration
  dropoff:{ type: mongoose.Schema.Types.Mixed },

  assignedVehicleId: { type: String, index: true },
  assignedDriverId:  { type: String },

  // KEEP existing statuses and also allow new ones (flexible)
  status: {
    type: String,
    index: true,
    enum: ['new','assigned','enroute','arrived','completed','failed','cancelled'],
    default: 'new'
  },

  // KEEP eta as String to avoid breaking existing docs; allow Date mirror if you add later
  eta: { type: String },             // e.g. ISO string
  notes: { type: String },

  // NEW optional fields (safe additions)
  description: { type: String },
  priority: { type: String, enum: ['low','normal','high','urgent'], default: 'normal', index: true },
  scheduledAt: { type: Date },
  completedAt: { type: Date },

  // OPTIONAL: normalized pickup/dropoff if you start sending structured objects
  pickupNormalized: { type: AddressSchema },
  dropoffNormalized:{ type: AddressSchema },
}, { timestamps: true, versionKey: false });

// Helpful indexes
JobSchema.index({ orgId: 1, createdAt: -1 });
JobSchema.index({ orgId: 1, status: 1, priority: 1 });

export default mongoose.model('jobs', JobSchema);
