// routes/cloudinary.js
import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { v2 as cloudinary } from 'cloudinary';

const r = Router();

// Returns a short-lived signed payload for the Upload Widget / SDK
r.post('/cloudinary/sign', auth, (req, res) => {
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = process.env.CLOUDINARY_FOLDER || 'fleet';
  const paramsToSign = { timestamp, folder, source: 'uw', resource_type: 'auto' };
  const signature = cloudinary.utils.api_sign_request(paramsToSign, process.env.CLOUDINARY_API_SECRET);
  res.json({
    timestamp,
    signature,
    folder,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY
  });
});

export default r;
