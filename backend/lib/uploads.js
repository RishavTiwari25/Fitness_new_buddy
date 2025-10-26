const path = require('path');
const multer = require('multer');
const fs = require('fs');
let cloudinary = null;
let useCloudinary = false;
try {
  if (process.env.CLOUDINARY_URL) {
    cloudinary = require('cloudinary').v2;
    // cloudinary will read CLOUDINARY_URL automatically
    cloudinary.config({ secure: true });
    useCloudinary = true;
  }
} catch (_) {}

// Ensure uploads dir exists for disk fallback
const uploadsDir = process.env.UPLOADS_DIR || path.join(__dirname, '..', 'uploads');
try { fs.mkdirSync(uploadsDir, { recursive: true }); } catch (_) {}

const storage = useCloudinary
  ? multer.memoryStorage()
  : multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, uploadsDir),
      filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname || '') || '.bin';
        const name = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2) + ext.toLowerCase();
        cb(null, name);
      }
    });

const upload = multer({ storage });

async function saveFile(file, folder = 'fitness-buddy') {
  if (!file) return null;
  if (useCloudinary && cloudinary && file.buffer) {
    // Upload to Cloudinary via stream
    const streamifier = require('streamifier');
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream({ folder }, (err, result) => {
        if (err) return reject(err);
        resolve(result.secure_url);
      });
      streamifier.createReadStream(file.buffer).pipe(uploadStream);
    });
  } else {
    // Disk fallback, already saved by multer
    return '/uploads/' + path.basename(file.path);
  }
}

module.exports = { upload, saveFile, uploadsDir };
