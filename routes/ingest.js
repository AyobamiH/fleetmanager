import { Router } from 'express';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';
import Ledger from '../models/ledger.js';
import Vehicle from '../models/vehicle.js';
import { auth } from '../middleware/auth.js';
import { emitPosition } from '../config/sockets.js';

const r = Router();
const ingestLimiter = rateLimit({ windowMs: 60 * 1000, max: 600 });

function verifySignature(req) {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) return true;
  const given = req.header('x-webhook-signature');
  if (!given) return false;
  const h = crypto.createHmac('sha256', secret).update(req.rawBody || '').digest('hex');
  try { return crypto.timingSafeEqual(Buffer.from(given), Buffer.from(h)); } catch { return false; }
}

r.post('/ingest/:provider', ingestLimiter, async (req, res) => {
  if (!verifySignature(req)) return res.status(401).json({ error: 'invalid signature' });
  const provider = req.params.provider;

  const payload = req.body;
  const events = Array.isArray(payload) ? payload : Array.isArray(payload?.events) ? payload.events : [payload];
  if (!events.length) return res.status(400).json({ error: 'no events' });

  const Positions = mongoose.connection.db.collection('positions');
  const docs = [];

  for (const e of events) {
    const orgId = e.orgId ?? e.metadata?.orgId;
    const vehicleId = e.vehicleId ?? e.metadata?.vehicleId;
    if (!orgId || !vehicleId) continue;

    const eventId = e.eventId ?? e.id ?? `${e.timestamp ?? Date.now()}-${vehicleId}`;
    try { await Ledger.create({ provider, eventId, orgId, ts: new Date().toISOString() }); }
    catch (err) { if (err?.code === 11000) continue; else throw err; }

    const ts = e.ts ?? e.timestamp ?? new Date().toISOString();
    const lat = Number(e.lat ?? e.latitude);
    const lon = Number(e.lon ?? e.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

    docs.push({
      ts,
      metadata: { orgId, vehicleId: String(vehicleId) },
      lat, lon,
      speedKph: e.speedKph ?? e.speed,
      heading: e.heading,
      accuracyM: e.accuracyM ?? e.accuracy,
      ignition: e.ignition,
      source: 'webhook'
    });
  }

  if (!docs.length) return res.status(400).json({ error: 'no valid events' });

  await Positions.insertMany(docs, { ordered: false });

  const last = docs[docs.length - 1];
  await Vehicle.updateOne({ orgId: last.metadata.orgId, _id: last.metadata.vehicleId }, { $set: { lastSeenTs: last.ts } });
  emitPosition(last);

  res.status(204).end();
});

// convenience: generate a test point (requires auth so you can use it from UI)
r.post('/test/send-position', auth, async (req, res) => {
  const { orgId, vehicleId } = req.body || {};
  if (!orgId || !vehicleId) return res.status(400).json({ error: 'orgId and vehicleId required' });
  const Positions = mongoose.connection.db.collection('positions');
  const doc = {
    ts: new Date().toISOString(),
    metadata: { orgId, vehicleId: String(vehicleId) },
    lat: 6.5244 + Math.random() * 0.01,
    lon: 3.3792 + Math.random() * 0.01,
    speedKph: Math.round(20 + Math.random() * 40),
    heading: Math.round(Math.random() * 359),
    source: 'webhook'
  };
  await Positions.insertOne(doc);
  await Vehicle.updateOne({ orgId, _id: String(vehicleId) }, { $set: { lastSeenTs: doc.ts } });
  emitPosition(doc);
  res.json({ ok: true, doc });
});

export default r;
