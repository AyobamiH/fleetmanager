import { Router } from 'express';
import Trip from '../models/Trip.js';
import { auth, requireOrg } from '../middleware/auth.js';

import { Parser as Json2CsvParser } from 'json2csv';


const r = Router();

// existing list endpoints...

r.get('/orgs/:orgId/trips/export/csv', auth, requireOrg, async (req, res) => {
  const { from, to } = req.query;
  const q = { orgId: req.params.orgId };
  if (from || to) {
    q.startedAt = {};
    if (from) q.startedAt.$gte = new Date(from);
    if (to) q.startedAt.$lte = new Date(to);
  }
  const rows = await Trip.find(q).sort({ startedAt: -1 }).lean();
  const fields = ['vehicleId','vehicleName','distanceKm','durationMin','startedAt','endedAt'];
  const parser = new Json2CsvParser({ fields });
  const csv = parser.parse(rows);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="trips.csv"');
  res.send(csv);
});



r.get('/orgs/:orgId/trips', auth, requireOrg, async (req, res) => {
  const { vehicleId, from, to, limit = '1000' } = req.query;
  const q = { orgId: req.params.orgId };
  if (vehicleId) q.vehicleId = String(vehicleId);
  if (from || to) q.startTs = {};
  if (from) q.startTs.$gte = String(from);
  if (to) q.startTs.$lte = String(to);
  const rows = await Trip.find(q).sort({ startTs: -1 }).limit(Math.min(parseInt(limit, 10) || 1000, 5000)).lean();
  res.json(rows);
});

export default r;
