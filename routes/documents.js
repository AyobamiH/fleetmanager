// routes/documents.js
import { Router } from 'express';
import { auth, requireOrg } from '../middleware/auth.js';
import Document from '../models/Document.js';
import { cloudinary, upload } from '../config/cloudinary.js';

const r = Router();

/**
 * POST /api/orgs/:orgId/documents
 * multipart/form-data with:
 * - file (required)
 * - type (optional: MOT|Insurance|Tax|Proof|Photo|Other)
 * - ownerType (vehicle|driver|job)  required
 * - ownerId   (string)              required
 * - expiry    (ISO string)          optional
 * - notes     (string)              optional
 */
r.post('/orgs/:orgId/documents', auth, requireOrg, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'file required' });
    const { type, ownerType, ownerId, expiry, notes } = req.body || {};
    if (!ownerType || !ownerId) return res.status(400).json({ error: 'ownerType and ownerId required' });

    const doc = await Document.create({
      orgId: req.params.orgId,
      type,
      ownerType,
      ownerId,
      expiry,
      notes,
      provider: 'cloudinary',
      publicId: req.file.filename,                 // from CloudinaryStorage
      secureUrl: req.file.path,                    // https URL
      bytes: req.file.size,
      format: req.file.format
    });
    res.status(201).json(doc);
  } catch (e) {
    console.error('upload error:', e);
    res.status(500).json({ error: 'upload failed' });
  }
});

/**
 * GET /api/orgs/:orgId/documents?ownerType=&ownerId=&type=
 */
r.get('/orgs/:orgId/documents', auth, requireOrg, async (req, res) => {
  const { ownerType, ownerId, type } = req.query;
  const q = { orgId: req.params.orgId };
  if (ownerType) q.ownerType = String(ownerType);
  if (ownerId)   q.ownerId   = String(ownerId);
  if (type)      q.type      = String(type);
  const rows = await Document.find(q).sort({ createdAt: -1 }).limit(1000).lean();
  res.json(rows);
});

/**
 * DELETE /api/orgs/:orgId/documents/:id
 * - deletes Cloudinary asset AND metadata record
 */
r.delete('/orgs/:orgId/documents/:id', auth, requireOrg, async (req, res) => {
  const doc = await Document.findOne({ _id: req.params.id, orgId: req.params.orgId });
  if (!doc) return res.status(404).json({ error: 'not found' });

  try {
    // destroy on cloud (resource_type:auto ensures video/pdf delete works)
    await cloudinary.uploader.destroy(doc.publicId, { resource_type: 'auto' });
  } catch (e) {
    // if not found in cloud, we still remove DB row
    console.warn('cloudinary destroy warning:', e?.message || e);
  }

  await Document.deleteOne({ _id: doc._id });
  res.json({ ok: true });
});

export default r;
