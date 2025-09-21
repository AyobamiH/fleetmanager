// // server.js (ESM) — Fleet API aligned to your KB/MVP
// import 'dotenv/config';
// import express from 'express';
// import cors from 'cors';
// import helmet from 'helmet';
// import compression from 'compression';
// import morgan from 'morgan';
// import bodyParser from 'body-parser';
// import rateLimit from 'express-rate-limit';
// import jwt from 'jsonwebtoken';
// import crypto, { randomUUID } from 'crypto';
// import mongoose from 'mongoose';
// import { createServer } from 'http';
// import { Server as IOServer } from 'socket.io';

// // ---------- ENV ----------
// const PORT = parseInt(process.env.PORT || '4000', 10);
// const HOST = '0.0.0.0';
// const NODE_ENV = process.env.NODE_ENV || 'production';
// const MONGODB_URI = process.env.MONGODB_URI; // <-- you said you already have this
// const MONGODB_DBNAME = process.env.MONGODB_DBNAME || 'fleet_prod';
// const MONGODB_APPNAME = process.env.MONGODB_APPNAME || 'fleet-api';
// const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
// const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET; // optional but recommended
// const REDIS_URL = process.env.REDIS_URL || '';
// const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
//   .split(',')
//   .map(s => s.trim())
//   .filter(Boolean);

// // ---------- APP ----------
// const app = express();
// app.set('trust proxy', 1);

// // capture raw JSON for HMAC BEFORE any parser touches it
// app.use(bodyParser.json({
//   limit: '2mb',
//   verify: (req, _res, buf) => { req.rawBody = buf.toString(); }
// }));

// app.use(cors({ origin: ALLOWED_ORIGINS.length ? ALLOWED_ORIGINS : true, credentials: true }));
// app.use(helmet({ crossOriginResourcePolicy: false }));
// app.use(compression());
// app.use(morgan(NODE_ENV === 'production' ? 'combined' : 'dev', {
//   skip: (_req, res) => res.statusCode < 400 && NODE_ENV === 'production'
// }));

// // ---------- SOCKETS ----------
// const httpServer = createServer(app);
// const io = new IOServer(httpServer, {
//   cors: { origin: ALLOWED_ORIGINS.length ? ALLOWED_ORIGINS : true, credentials: true }
// });

// let redisAdapterReady = false;
// if (REDIS_URL) {
//   (async () => {
//     try {
//       const { createAdapter } = await import('@socket.io/redis-adapter');
//       const { default: IORedis } = await import('ioredis');
//       const pub = new IORedis(REDIS_URL);
//       const sub = new IORedis(REDIS_URL);
//       io.adapter(createAdapter(pub, sub));
//       redisAdapterReady = true;
//       console.log('[sockets] Redis adapter enabled');
//     } catch (e) {
//       console.warn('[sockets] Redis adapter not enabled:', e.message || e);
//     }
//   })();
// }

// io.of('/org')
//   .use((socket, next) => {
//     const orgId = socket.handshake.auth?.orgId;
//     if (!orgId) return next(new Error('orgId required'));
//     socket.data.orgId = orgId;
//     next();
//   })
//   .on('connection', socket => {
//     const { orgId } = socket.data;
//     socket.join(`org:${orgId}`);
//     socket.emit('hello', { ok: true, orgId, redisAdapterReady, now: new Date().toISOString() });
//   });

// const emitPosition = (pos) => {
//   io.of('/org').to(`org:${pos.metadata.orgId}`).emit('position', pos);
// };

// // ---------- MONGOOSE & MODELS ----------
// await mongoose.connect(MONGODB_URI, {
//   dbName: MONGODB_DBNAME,
//   appName: MONGODB_APPNAME
// });
// console.log('[db] connected');

// // Ensure time-series `positions` with TTL 90 days
// const db = mongoose.connection.db;
// const existing = await db.listCollections({ name: 'positions' }).toArray();
// if (!existing.length) {
//   await db.createCollection('positions', {
//     timeseries: { timeField: 'ts', metaField: 'metadata', granularity: 'seconds' },
//     expireAfterSeconds: 90 * 24 * 60 * 60
//   });
//   console.log('[db] created time-series `positions` (TTL 90d)');
// } else {
//   const info = (await db.listCollections({ name: 'positions' }).toArray())[0];
//   console.log('[db] positions exists; TTL:', info?.options?.expireAfterSeconds ?? '(unknown)');
// }
// const Positions = db.collection('positions'); // native collection handle

// const baseOpts = { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }, versionKey: false };

// const VehicleSchema = new mongoose.Schema({
//   _id: { type: String, default: () => randomUUID() },
//   orgId: { type: String, index: true, required: true },
//   name: String,
//   plate: String,
//   status: { type: String, enum: ['active', 'maintenance', 'retired'], default: 'active', index: true },
//   deviceId: String,
//   odometerKm: Number,
//   lastSeenTs: String
// }, baseOpts);
// VehicleSchema.index({ orgId: 1, plate: 1 }, { unique: true });
// const Vehicle = mongoose.model('vehicles', VehicleSchema);

// const TripSchema = new mongoose.Schema({
//   _id: { type: String, default: () => randomUUID() },
//   orgId: { type: String, index: true, required: true },
//   vehicleId: { type: String, index: true, required: true },
//   startTs: { type: String, index: true },
//   endTs: String,
//   distanceKm: Number,
//   idleMinutes: Number,
//   polyline: String
// }, baseOpts);
// TripSchema.index({ orgId: 1, vehicleId: 1, startTs: 1 });
// TripSchema.index({ orgId: 1, startTs: 1 });
// const Trip = mongoose.model('trips', TripSchema);

// const JobSchema = new mongoose.Schema({
//   _id: { type: String, default: () => randomUUID() },
//   orgId: { type: String, index: true, required: true },
//   title: String,
//   pickup: mongoose.Schema.Types.Mixed,
//   dropoff: mongoose.Schema.Types.Mixed,
//   assignedVehicleId: { type: String, index: true },
//   assignedDriverId: String,
//   status: { type: String, enum: ['new', 'assigned', 'enroute', 'arrived', 'completed', 'failed'], default: 'new', index: true },
//   eta: String,
//   notes: String
// }, baseOpts);
// JobSchema.index({ orgId: 1, createdAt: -1 });
// const Job = mongoose.model('jobs', JobSchema);

// const LedgerSchema = new mongoose.Schema({
//   provider: { type: String, index: true },
//   eventId: { type: String, index: true },
//   orgId: { type: String, index: true },
//   ts: String
// }, { ...baseOpts });
// LedgerSchema.index({ provider: 1, eventId: 1 }, { unique: true });
// const Ledger = mongoose.model('ingest_ledger', LedgerSchema);

// // Helpful index for positions (native)
// await Positions.createIndex({ 'metadata.orgId': 1, 'metadata.vehicleId': 1, ts: -1 });

// // ---------- HEALTH ----------
// app.get('/health', (_req, res) => {
//   res.json({ status: 'ok', timestamp: new Date().toISOString(), uptime: process.uptime(), env: NODE_ENV });
// });

// app.get('/health/data', async (_req, res) => {
//   try {
//     const infos = await db.listCollections().toArray();
//     const pos = infos.find(c => c.name === 'positions');
//     res.json({
//       ok: true,
//       tsTTL: pos?.options?.expireAfterSeconds ?? null,
//       collections: infos.map(c => c.name).filter(n => !n.startsWith('system.'))
//     });
//   } catch (e) {
//     res.status(500).json({ ok: false, error: String(e) });
//   }
// });

// app.get('/ready', async (_req, res) => {
//   try {
//     await db.command({ ping: 1 });
//     res.json({ ready: true });
//   } catch (e) {
//     res.status(503).json({ ready: false, error: String(e) });
//   }
// });

// // ---------- AUTH / RBAC ----------
// const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
// app.post('/api/auth/login', loginLimiter, (req, res) => {
//   const { orgId, email, role } = req.body || {};
//   if (!orgId || !email) return res.status(400).json({ error: 'orgId and email required' });
//   const token = jwt.sign({ orgId, role: role || 'owner', sub: email }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '12h' });
//   res.json({ ok: true, token, orgId, role: role || 'owner' });
// });

// const auth = (req, res, next) => {
//   try {
//     const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
//     const payload = jwt.verify(token, JWT_SECRET);
//     req.user = payload;
//     next();
//   } catch {
//     res.status(401).json({ error: 'unauthorized' });
//   }
// };

// const requireOrg = (req, res, next) => {
//   if (!req.user) return res.status(401).json({ error: 'unauthorized' });
//   if (req.params.orgId !== req.user.orgId) return res.status(403).json({ error: 'cross-tenant blocked' });
//   next();
// };

// app.get('/api/auth/whoami', auth, (req, res) => res.json({ ok: true, user: req.user }));

// // ---------- VEHICLES ----------
// app.get('/api/orgs/:orgId/vehicles', auth, requireOrg, async (req, res) => {
//   const rows = await Vehicle.find({ orgId: req.params.orgId }).sort({ name: 1 }).limit(1000).lean();
//   res.json(rows);
// });
// app.post('/api/orgs/:orgId/vehicles', auth, requireOrg, async (req, res) => {
//   const { name, plate } = req.body || {};
//   if (!name || !plate) return res.status(400).json({ error: 'name and plate required' });
//   const doc = await Vehicle.create({ orgId: req.params.orgId, name, plate, status: 'active' });
//   res.status(201).json(doc);
// });
// app.patch('/api/orgs/:orgId/vehicles/:id', auth, requireOrg, async (req, res) => {
//   const r = await Vehicle.updateOne({ orgId: req.params.orgId, _id: req.params.id }, { $set: { ...req.body } });
//   res.json({ ok: true, matched: r.matchedCount, modified: r.modifiedCount });
// });

// // ---------- TRIPS ----------
// app.get('/api/orgs/:orgId/trips', auth, requireOrg, async (req, res) => {
//   const { vehicleId, from, to, limit = '1000' } = req.query;
//   const q = { orgId: req.params.orgId };
//   if (vehicleId) q.vehicleId = String(vehicleId);
//   if (from || to) q.startTs = {};
//   if (from) q.startTs.$gte = String(from);
//   if (to) q.startTs.$lte = String(to);
//   const rows = await Trip.find(q).sort({ startTs: -1 }).limit(Math.min(parseInt(limit, 10) || 1000, 5000)).lean();
//   res.json(rows);
// });

// // ---------- POSITIONS (history query) ----------
// app.get('/api/orgs/:orgId/positions', auth, requireOrg, async (req, res) => {
//   const { vehicleId, from, to, limit = '500' } = req.query;
//   const q = { 'metadata.orgId': req.params.orgId };
//   if (vehicleId) q['metadata.vehicleId'] = String(vehicleId);
//   if (from || to) q.ts = {};
//   if (from) q.ts.$gte = String(from);
//   if (to) q.ts.$lte = String(to);
//   const rows = await Positions.find(q, { projection: { _id: 0 } })
//     .sort({ ts: -1 })
//     .limit(Math.min(parseInt(limit, 10) || 500, 5000))
//     .toArray();
//   res.json(rows);
// });

// // ---------- JOBS ----------
// app.post('/api/orgs/:orgId/jobs', auth, requireOrg, async (req, res) => {
//   const now = new Date().toISOString();
//   const job = await Job.create({
//     orgId: req.params.orgId,
//     title: req.body?.title || 'Untitled Job',
//     pickup: req.body?.pickup,
//     dropoff: req.body?.dropoff,
//     assignedVehicleId: req.body?.assignedVehicleId,
//     assignedDriverId: req.body?.assignedDriverId,
//     status: 'new',
//     eta: req.body?.eta,
//     notes: req.body?.notes,
//     createdAt: now,
//     updatedAt: now
//   });
//   res.status(201).json(job);
// });
// app.patch('/api/orgs/:orgId/jobs/:id/status', auth, requireOrg, async (req, res) => {
//   const { status } = req.body || {};
//   if (!status) return res.status(400).json({ error: 'status required' });
//   const r = await Job.updateOne({ orgId: req.params.orgId, _id: req.params.id }, { $set: { status, updatedAt: new Date().toISOString() } });
//   res.json({ ok: true, matched: r.matchedCount, modified: r.modifiedCount });
// });

// // ---------- INGEST WEBHOOK (signed + idempotent) ----------
// const ingestLimiter = rateLimit({ windowMs: 60 * 1000, max: 600 });
// const verifySignature = (req) => {
//   if (!WEBHOOK_SECRET) return true; // allow dev
//   const given = req.header('x-webhook-signature');
//   if (!given) return false;
//   const h = crypto.createHmac('sha256', WEBHOOK_SECRET).update(req.rawBody || '').digest('hex');
//   try { return crypto.timingSafeEqual(Buffer.from(given), Buffer.from(h)); } catch { return false; }
// };

// app.post('/api/ingest/:provider', ingestLimiter, async (req, res) => {
//   if (!verifySignature(req)) return res.status(401).json({ error: 'invalid signature' });

//   const provider = req.params.provider;
//   const payload = req.body;
//   const events = Array.isArray(payload) ? payload : Array.isArray(payload?.events) ? payload.events : [payload];
//   if (!events.length) return res.status(400).json({ error: 'no events' });

//   const docs = [];
//   for (const e of events) {
//     const orgId = e.orgId ?? e.metadata?.orgId;
//     const vehicleId = e.vehicleId ?? e.metadata?.vehicleId;
//     if (!orgId || !vehicleId) continue;

//     const eventId = e.eventId ?? e.id ?? `${e.timestamp ?? Date.now()}-${vehicleId}`;
//     try { await Ledger.create({ provider, eventId, orgId, ts: new Date().toISOString() }); }
//     catch (err) { if (err?.code === 11000) continue; else throw err; }

//     const ts = e.ts ?? e.timestamp ?? new Date().toISOString();
//     const lat = Number(e.lat ?? e.latitude);
//     const lon = Number(e.lon ?? e.longitude);
//     if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

//     docs.push({
//       ts,
//       metadata: { orgId, vehicleId: String(vehicleId) },
//       lat, lon,
//       speedKph: e.speedKph ?? e.speed,
//       heading: e.heading,
//       accuracyM: e.accuracyM ?? e.accuracy,
//       ignition: e.ignition,
//       source: 'webhook'
//     });
//   }

//   if (!docs.length) return res.status(400).json({ error: 'no valid events' });

//   await Positions.insertMany(docs, { ordered: false });
//   const last = docs[docs.length - 1];
//   await Vehicle.updateOne({ orgId: last.metadata.orgId, _id: last.metadata.vehicleId }, { $set: { lastSeenTs: last.ts } });
//   emitPosition(last);

//   res.status(204).end();
// });

// // Convenience test: generate one point for a vehicle
// app.post('/api/test/send-position', auth, async (req, res) => {
//   const { orgId, vehicleId } = req.body || {};
//   if (!orgId || !vehicleId) return res.status(400).json({ error: 'orgId and vehicleId required' });
//   const doc = {
//     ts: new Date().toISOString(),
//     metadata: { orgId, vehicleId: String(vehicleId) },
//     lat: 6.5244 + Math.random() * 0.01,
//     lon: 3.3792 + Math.random() * 0.01,
//     speedKph: Math.round(20 + Math.random() * 40),
//     heading: Math.round(Math.random() * 359),
//     source: 'webhook'
//   };
//   await Positions.insertOne(doc);
//   await Vehicle.updateOne({ orgId, _id: String(vehicleId) }, { $set: { lastSeenTs: doc.ts } });
//   emitPosition(doc);
//   res.json({ ok: true, doc });
// });

// // ---------- START / STOP ----------
// httpServer.listen(PORT, HOST, () => {
//   console.log(`[fleet-api] listening on http://${HOST}:${PORT} (${NODE_ENV})`);
// });

// const shutdown = async (sig) => {
//   console.log(`\nReceived ${sig}, shutting down...`);
//   try {
//     await mongoose.disconnect();
//     io.close();
//     httpServer.close(() => process.exit(0));
//   } catch {
//     process.exit(0);
//   }
// };
// process.on('SIGINT', () => shutdown('SIGINT'));
// process.on('SIGTERM', () => shutdown('SIGTERM'));



import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import bodyParser from 'body-parser';
import { createServer } from 'http';
import { Server as IOServer } from 'socket.io';

import { connectDB, ensureTimeSeries } from './config/db.js';
import { initSockets } from './config/sockets.js';

import healthRoutes from './routes/health.js';
import authRoutes from './routes/auth.js';
import vehiclesRoutes from './routes/vehicles.js';
import tripsRoutes from './routes/trips.js';
import positionsRoutes from './routes/positions.js';
import jobsRoutes from './routes/jobs.js';
import ingestRoutes from './routes/ingest.js';
import documentsRoutes from './routes/documents.js';
// import cloudinaryRoutes from './routes/cloudinary.js'; // optional


const PORT = parseInt(process.env.PORT || '3001', 10);
const HOST = '0.0.0.0';
const NODE_ENV = process.env.NODE_ENV || 'production';
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',').map(s => s.trim()).filter(Boolean);

const app = express();
app.set('trust proxy', 1);

// capture raw body for HMAC verification BEFORE any JSON parse
app.use(bodyParser.json({
  limit: '2mb',
  verify: (req, _res, buf) => { req.rawBody = buf.toString(); }
}));
app.use(
  cors({
    origin:  ALLOWED_ORIGINS, // Your frontend domain
    methods: ["POST", "GET", "DELETE", "PUT"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);


app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(compression());
app.use(morgan(NODE_ENV === 'production' ? 'combined' : 'dev', {
  skip: (_req, res) => res.statusCode < 400 && NODE_ENV === 'production'
}));

// sockets
const httpServer = createServer(app);
const io = new IOServer(httpServer, {
  cors: { origin: ALLOWED_ORIGINS.length ? ALLOWED_ORIGINS : true, credentials: true }
});
initSockets(io);

// routes
// root + health
app.get("/", (_req, res) => {
  res.json({
    status: "ok",
    name: "fleet-api",
    env: NODE_ENV,
    uptime: process.uptime(),
    time: new Date().toISOString(),
  });
});

// if your health router doesn't already expose /api/health, keep this:
// app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use(healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api', vehiclesRoutes);
app.use('/api', tripsRoutes);
app.use('/api', positionsRoutes);

app.use('/api', jobsRoutes);
app.use('/api', ingestRoutes);
app.use('/api', documentsRoutes);
// app.use('/api', cloudinaryRoutes); // optional

// boot
await connectDB();
await ensureTimeSeries(); // positions collection with TTL 90d

httpServer.listen(PORT, HOST, () => {
  console.log(`[fleet-api] listening on http://${HOST}:${PORT} (${NODE_ENV})`);
});

process.on('SIGINT', () => { io.close(); process.exit(0); });
process.on('SIGTERM', () => { io.close(); process.exit(0); });

