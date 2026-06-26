/**
 * =============================================
 * FILE UPLOAD UTILITIES (uploads.js)
 * =============================================
 * Handles file uploads to either Cloudinary (cloud)
 * or local disk storage (fallback)
 * Supports images for avatars, posts, food logs, etc.
 */

// Import dependencies
const path = require('path');
const multer = require('multer'); // Middleware for handling file uploads
const fs = require('fs'); // File system operations

// ===== CLOUDINARY CONFIGURATION =====
let cloudinary = null;
let useCloudinary = false;

// Try to initialize Cloudinary if configured
try {
  if (process.env.CLOUDINARY_URL) {
    // If CLOUDINARY_URL env var is set, use Cloudinary for uploads
    cloudinary = require('cloudinary').v2;
    // Cloudinary automatically reads CLOUDINARY_URL from environment
    cloudinary.config({ secure: true }); // Use HTTPS for secure uploads
    useCloudinary = true;
  }
} catch (_) {
  // Cloudinary not installed or configuration failed - will use disk storage
}

// ===== DISK STORAGE CONFIGURATION =====
// Ensure uploads directory exists for local file storage
const uploadsDir = process.env.UPLOADS_DIR || path.join(__dirname, '..', 'uploads');
try { 
  fs.mkdirSync(uploadsDir, { recursive: true }); 
} catch (_) {}

// ===== MULTER STORAGE SETUP =====
// Configure where and how files are stored
const storage = useCloudinary
  ? multer.memoryStorage() // Store in memory first, will upload to Cloudinary
  : multer.diskStorage({
      // Store files on local disk
      destination: (_req, _file, cb) => cb(null, uploadsDir),
      // Generate unique filename to avoid collisions
      filename: (_req, file, cb) => {
        // Use timestamp and random string for unique filenames
        const ext = path.extname(file.originalname || '') || '.bin'; // Get file extension
        const name = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2) + ext.toLowerCase();
        cb(null, name);
      }
    });

// Create multer upload middleware instance
const upload = multer({ storage });

// ===== SAVE FILE FUNCTION =====
// Saves uploaded file to either Cloudinary or local disk
// Returns the URL where the file can be accessed
async function saveFile(file, folder = 'fitness-buddy') {
  if (!file) return null; // No file provided
  
  if (useCloudinary && cloudinary && file.buffer) {
    // Upload to Cloudinary using the file buffer (in-memory data)
    // Use streamifier to convert buffer to stream
    const streamifier = require('streamifier');
    return new Promise((resolve, reject) => {
      // Create upload stream to Cloudinary
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder }, // Organize uploads in folder
        (err, result) => {
          if (err) return reject(err);
          // Return the secure URL of uploaded file
          resolve(result.secure_url);
        }
      );
      // Pipe the file buffer through the upload stream
      streamifier.createReadStream(file.buffer).pipe(uploadStream);
    });
  } else {
    // Disk storage fallback - file already saved by multer
    // Return the relative path that can be accessed via /uploads endpoint
    return '/uploads/' + path.basename(file.path);
  }
}

// ===== EXPORTS =====
// Export upload middleware, saveFile function, and uploads directory path
module.exports = { upload, saveFile, uploadsDir };
