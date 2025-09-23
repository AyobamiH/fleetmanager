

// server.js (ESM)
// ------------------------------
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import bodyParser from 'body-parser';
import { createServer } from 'http';
import { Server as IOServer } from 'socket.io';

// DB & sockets
import { connectDB, ensureTimeSeries } from './config/db.js';
import { initSockets } from './config/sockets.js';

// Routes
import healthRoutes from './routes/health.js';
import authRoutes from './routes/auth.js';
import vehiclesRoutes from './routes/vehicles.js';
import tripsRoutes from './routes/trips.js';
import positionsRoutes from './routes/positions.js';
import jobsRoutes from './routes/jobs.js';
import ingestRoutes from './routes/ingest.js';
import driversRoutes from './routes/drivers.js';
import dashboardRoutes from './routes/dashboard.js';


import documentsRoutes from './routes/documents.js';

const PORT = parseInt(process.env.PORT || '3001', 10);
const HOST = '0.0.0.0';
const NODE_ENV = process.env.NODE_ENV || 'production';

// Build allow list from env (comma-separated, supports wildcard like *.lovable.dev)
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGIN || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

// Convert wildcard origins to regex for cors
const ORIGIN_PATTERNS = ALLOWED_ORIGINS.map(p =>
  new RegExp(
    '^' +
      p
        .replace(/\./g, '\\.') // escape dots
        .replace(/\*/g, '.*') + // wildcard
      '$'
  )
);

const app = express();
app.set('trust proxy', 1);

// Capture raw body for webhook verification before JSON parse
app.use(bodyParser.json({
  limit: '2mb',
  verify: (req, _res, buf) => { req.rawBody = buf.toString(); }
}));

// CORS with wildcard pattern support
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // non-browser tools (curl/Postman)
    if (!ORIGIN_PATTERNS.length) return cb(null, true);
    const ok = ORIGIN_PATTERNS.some(re => re.test(origin));
    return cb(ok ? null : new Error('CORS: origin not allowed'), ok);
  },
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
  credentials: true,
  maxAge: 86400
}));
app.options('*', cors()); // fast preflight

// Security & perf
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(compression());



// Logs
app.use(morgan(NODE_ENV === 'production' ? 'combined' : 'dev', {
  skip: (_req, res) => res.statusCode < 400 && NODE_ENV === 'production'
}));

// Sockets
const httpServer = createServer(app);
const io = new IOServer(httpServer, {
  cors: { origin: (origin, cb) => cb(null, true), credentials: true }
});
initSockets(io);

// Root/health (public)
app.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    name: 'fleet-api',
    env: NODE_ENV,
    uptime: process.uptime(),
    time: new Date().toISOString(),
  });
});
app.use(healthRoutes);

// Auth (public mount; route-level protection is inside)
app.use('/api/auth', authRoutes);

// Everything below is mounted under /api and should require auth in each router
app.use('/api', vehiclesRoutes);
app.use('/api', tripsRoutes);
app.use('/api', positionsRoutes);
app.use('/api', jobsRoutes);
app.use('/api', ingestRoutes);
app.use('/api', documentsRoutes);
app.use('/api', driversRoutes);
app.use('/api', dashboardRoutes);

// Boot
await connectDB();
await ensureTimeSeries(); // positions TTL (e.g., 90d)

httpServer.listen(PORT, HOST, () => {
  console.log(`[fleet-api] listening on http://${HOST}:${PORT} (${NODE_ENV})`);
});

process.on('SIGINT', () => { io.close(); process.exit(0); });
process.on('SIGTERM', () => { io.close(); process.exit(0); });
