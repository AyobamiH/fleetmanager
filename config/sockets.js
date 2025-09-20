import { createAdapter } from '@socket.io/redis-adapter';
import IORedis from 'ioredis';

let ioRef = null;

export function initSockets(io) {
  ioRef = io;

  // Optional Redis adapter for scaling
  if (process.env.REDIS_URL) {
    try {
      const pub = new IORedis(process.env.REDIS_URL);
      const sub = new IORedis(process.env.REDIS_URL);
      io.adapter(createAdapter(pub, sub));
      console.log('[sockets] Redis adapter enabled');
    } catch (e) {
      console.warn('[sockets] Redis not enabled:', e.message || e);
    }
  }

  io.of('/org')
    .use((socket, next) => {
      const orgId = socket.handshake.auth?.orgId;
      if (!orgId) return next(new Error('orgId required'));
      socket.data.orgId = orgId;
      next();
    })
    .on('connection', (socket) => {
      const orgId = socket.data.orgId;
      socket.join(`org:${orgId}`);
      socket.emit('hello', { ok: true, orgId, now: new Date().toISOString() });
    });
}

export function emitPosition(pos) {
  if (!ioRef) return;
  ioRef.of('/org').to(`org:${pos.metadata.orgId}`).emit('position', pos);
}
