import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DBNAME = process.env.MONGODB_DBNAME || 'fleet_prod';
const MONGODB_APPNAME = process.env.MONGODB_APPNAME || 'fleet-api';

export async function connectDB() {
  if (!MONGODB_URI) throw new Error('MONGODB_URI is required');
  await mongoose.connect(MONGODB_URI, { dbName: MONGODB_DBNAME, appName: MONGODB_APPNAME });
  console.log('[db] connected');
}

export async function ensureTimeSeries() {
  const db = mongoose.connection.db;
  const exists = await db.listCollections({ name: 'positions' }).toArray();
  if (!exists.length) {
    await db.createCollection('positions', {
      timeseries: { timeField: 'ts', metaField: 'metadata', granularity: 'seconds' },
      expireAfterSeconds: 90 * 24 * 60 * 60 // 90 days
    });
    console.log('[db] created time-series `positions` (TTL 90d)');
  } else {
    const info = (await db.listCollections({ name: 'positions' }).toArray())[0];
    console.log('[db] positions exists; TTL:', info?.options?.expireAfterSeconds ?? '(unknown)');
  }
  // helpful index:
  await db.collection('positions')
    .createIndex({ 'metadata.orgId': 1, 'metadata.vehicleId': 1, ts: -1 });
}

export function positions() {
  return mongoose.connection.db.collection('positions'); // native handle
}
