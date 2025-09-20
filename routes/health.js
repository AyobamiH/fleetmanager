import { Router } from 'express';
import mongoose from 'mongoose';

const r = Router();

r.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), uptime: process.uptime(), env: process.env.NODE_ENV || 'production' });
});

r.get('/health/data', async (_req, res) => {
  try {
    const db = mongoose.connection.db;
    const infos = await db.listCollections().toArray();
    const pos = infos.find(c => c.name === 'positions');
    res.json({
      ok: true,
      tsTTL: pos?.options?.expireAfterSeconds ?? null,
      collections: infos.map(c => c.name).filter(n => !n.startsWith('system.'))
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

r.get('/ready', async (_req, res) => {
  try { await mongoose.connection.db.command({ ping: 1 }); res.json({ ready: true }); }
  catch (e) { res.status(503).json({ ready: false, error: String(e) }); }
});

export default r;
