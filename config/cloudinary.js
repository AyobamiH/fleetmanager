// config/cloudinary.js
import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';

const {
  CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET,
  CLOUDINARY_FOLDER = 'fleet',
  MAX_UPLOAD_MB = '15'
} = process.env;

cloudinary.config({
  cloud_name: CLOUDINARY_CLOUD_NAME,
  api_key:    CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET
});

// Multer storage that sends files straight to Cloudinary
const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => ({
    folder: CLOUDINARY_FOLDER,
    resource_type: 'auto',              // allow pdf/images/video
    // file filter is handled by multer below; leave format auto
  })
});

// Basic size/type limits
const upload = multer({
  storage,
  limits: { fileSize: Number(MAX_UPLOAD_MB) * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    // Accept common doc/image types (Cloudinary can handle much more)
    const ok = /pdf|png|jpg|jpeg|webp|heic|gif/.test(file.mimetype);
    if (!ok) return cb(new Error('Unsupported file type'), false);
    cb(null, true);
  }
});

export { cloudinary, upload };
