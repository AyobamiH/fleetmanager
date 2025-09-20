# fleetmanager
FleetManager is a production-ready Fleet Management MVP. The API runs on Render (Express/Node) with MongoDB Atlas time-series for telemetry, Socket.IO for realtime updates, and strict multi-tenant scoping by orgId. It ships core modules—Vehicles, Jobs/Dispatch, Trips, Maintenance, Reports—plus a signed, idempotent webhook for GPS ingest. The repo includes the Unified Fleet Management MVP Knowledge Base (MongoDB-Only) to keep architecture, APIs, and ops aligned.

Highlights

MongoDB time-series positions with TTL 90 days

JWT auth + org-scoped RBAC (no cross-tenant reads/writes)

Socket.IO realtime (Redis adapter optional for scale)

REST endpoints: Vehicles, Jobs, Trips, Positions, Health/Ready

Signed ingest webhook + idempotency ledger

Mapbox-ready frontend (Lovable) via VITE_API_BASE_URL

Render-friendly: /health, /ready, graceful shutdown, CORS/Helmet/Compression

Included KB: architecture, indexes, retention, runbooks, and acceptance tests

Stack

Express • TypeScript/Node (or ESM JS) • MongoDB Atlas • Socket.IO • Redis (optional) • Mapbox (client) • Lovable (frontend)

Quick start
# env (server-only): MONGODB_URI, MONGODB_DBNAME, MONGODB_APPNAME, JWT_SECRET, ALLOWED_ORIGINS[, WEBHOOK_SECRET, REDIS_URL]
npm ci
npm start   # starts server on process.env.PORT (4000 locally)

# Health
curl http://localhost:4000/health
curl http://localhost:4000/health/data

Repo topics

fleet-management mongodb time-series express socket.io render multitenant mapbox mvp mern
