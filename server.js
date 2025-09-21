
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

