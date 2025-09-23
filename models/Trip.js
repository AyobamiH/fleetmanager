// models/Trip.js
import mongoose from 'mongoose';
import { randomUUID } from 'crypto';

const TripSchema = new mongoose.Schema({
  _id:            { type: String, default: () => randomUUID() },
  orgId:          { type: String, index: true, required: true },
  vehicleId:      { type: String, index: true, required: true },

  // Core timing
  startTs:        { type: String, index: true, required: true }, // ISO
  endTs:          { type: String },                               // ISO
  durationMin:    { type: Number },                               // computed

  // Distance & speed
  distanceKm:     { type: Number, default: 0 },
  avgSpeedKph:    { type: Number },
  maxSpeedKph:    { type: Number },

  // Idling & stops
  idleMinutes:    { type: Number, default: 0 },
  stopCount:      { type: Number, default: 0 },

  // Fuel & emissions (optional; fill if you calculate)
  fuelUsedL:      { type: Number },
  co2Kg:          { type: Number },

  // Endpoints
  startLat:       { type: Number }, startLon: { type: Number },
  endLat:         { type: Number }, endLon:   { type: Number },
  startAddress:   { type: String },
  endAddress:     { type: String },

  // Path (compact)
  polyline:       { type: String },

  // Safety/behaviour event counters (optional)
  harshAccel:     { type: Number, default: 0 },
  harshBrake:     { type: Number, default: 0 },
  overSpeedEvents:{ type: Number, default: 0 },
}, { timestamps: true, versionKey: false });

TripSchema.index({ orgId: 1, vehicleId: 1, startTs: -1 });
TripSchema.index({ orgId: 1, startTs: -1 });

export default mongoose.model('trips', TripSchema);
