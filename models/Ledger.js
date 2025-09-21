import mongoose from 'mongoose';

const LedgerSchema = new mongoose.Schema({
  provider: { type: String, index: true },
  eventId: { type: String, index: true },
  orgId: { type: String, index: true },
  ts: String
}, { timestamps: true, versionKey: false });

LedgerSchema.index({ provider: 1, eventId: 1 }, { unique: true });
export default mongoose.model('ingest_ledger', LedgerSchema);
