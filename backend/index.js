/**
 * Last forced restart: 1
 * =============================================
 * FITNESS BUDDY - BACKEND SERVER (index.js)
 * =============================================
 * Main entry point for the Express.js server
 * Configures all routes, middleware, and initializes
 * database connections (SQLite or MongoDB)
 */

// Import required dependencies
const express = require('express'); // Web framework
const cors = require('cors'); // Cross-Origin Resource Sharing middleware
const path = require('path'); // File path utilities
const fs = require('fs'); // File system operations

// Import all route modules (API endpoints)
const authRouter = require('./routes/auth'); // Authentication endpoints (signup, login, profile)
const gymsRouter = require('./routes/gyms'); // Gym management endpoints
const dietRouter = require('./routes/diet'); // Diet/nutrition tracking endpoints
const exercisesRouter = require('./routes/exercises'); // Exercise alternatives endpoints
const advancedBookingRouter = require('./routes/advancedBooking'); // Advanced booking system
const socialRouter = require('./routes/social'); // Social features (follows, posts, likes)
const engagementRouter = require('./routes/engagement'); // Engagement & rewards system
const managementRouter = require('./routes/management'); // Management endpoints (memberships, payments)
const notificationsRouter = require('./routes/notifications'); // Notification system
const coachRouter = require('./routes/coach'); // AI personal trainer (RAG chat, streaming)
const aiRouter = require('./routes/ai'); // AI features: semantic search, NL booking, weekly insights
const stripePayments = require('./routes/payments_stripe'); // Stripe membership payments
const db = require('./db'); // SQLite database connection
const mongo = require('./lib/mongo'); // MongoDB connection utilities

// Load environment variables from .env file
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Initialize Express application
const app = express();

// ===== MIDDLEWARE CONFIGURATION =====
// Enable CORS for cross-origin requests from frontend
app.use(cors());
// Stripe webhook needs the raw request body for signature verification —
// it MUST be registered before the JSON body parser below.
app.post('/api/payments/stripe/webhook', express.raw({ type: 'application/json' }), stripePayments.webhookHandler);
// Parse incoming JSON request bodies
app.use(express.json());

// ===== API ROUTE REGISTRATION =====
// All routes are prefixed with /api
app.use('/api', authRouter); // POST /api/signup, POST /api/login, GET /api/profile
app.use('/api', gymsRouter); // Gym-related endpoints
app.use('/api', dietRouter); // Diet tracking endpoints
app.use('/api', exercisesRouter); // Exercise endpoints
app.use('/api', advancedBookingRouter); // Equipment booking system
app.use('/api', socialRouter); // Social networking features
app.use('/api', engagementRouter); // Engagement points and rewards
app.use('/api', managementRouter); // Management and billing
app.use('/api', notificationsRouter); // Notifications system
app.use('/api', coachRouter); // AI personal trainer chat (streaming)
app.use('/api', aiRouter); // AI: semantic search, NL booking, weekly insights
app.use('/api', stripePayments.router); // Stripe checkout session

// ===== HEALTH CHECK ENDPOINT =====
// Endpoint to verify that the backend server is running
app.get('/health', (req, res) => res.send('Fitness Buddy backend running'));


// ===== DATABASE STATUS ENDPOINT =====
// Returns health status of both SQLite and MongoDB databases
// Useful for monitoring and debugging connectivity issues
app.get('/api/db-status', async (req, res) => {
	try {
		// Check MongoDB connection status
		const m = await mongo.health(); 
		// Return status of both databases (SQLite always available, MongoDB conditional)
		res.json({ sqlite: true, mongo: m });
	} catch (e) {
		// If MongoDB check fails, still report SQLite is available
		res.json({ 
			sqlite: true, 
			mongo: { 
				enabled: !!process.env.MONGODB_URI, 
				connected: false, 
				error: e.message 
			} 
		});
	}
});

// ===== FILE UPLOAD CONFIGURATION =====
// Serves uploaded images (user avatars, food logs, posts, etc.)
// PRIMARY_UPLOADS_DIR: Main directory for storing uploads
// - On production (Render): uses /tmp/uploads for ephemeral storage
// - On local: uses backend/uploads directory
// LEGACY_UPLOADS_DIRS: Fallback directories for backward compatibility
const PRIMARY_UPLOADS_DIR = process.env.UPLOADS_DIR || path.resolve(__dirname, 'uploads');
const LEGACY_UPLOADS_DIRS = [path.resolve('/tmp/uploads'), path.resolve(__dirname, 'uploads')]
	.filter((p, i, arr) => p !== PRIMARY_UPLOADS_DIR && arr.indexOf(p) === i); // Remove duplicates

// Create directories if they don't exist (for storing uploaded files)
try { fs.mkdirSync(PRIMARY_UPLOADS_DIR, { recursive: true }); } catch (_) {}
for (const legacyDir of LEGACY_UPLOADS_DIRS) {
	try { fs.mkdirSync(legacyDir, { recursive: true }); } catch (_) {}
}

// Serve uploaded files as static content (images can be accessed via /uploads/filename)
app.use('/uploads', express.static(PRIMARY_UPLOADS_DIR));
// Also serve from legacy directories for backward compatibility
for (const legacyDir of LEGACY_UPLOADS_DIRS) {
	app.use('/uploads', express.static(legacyDir));
}

// ===== FRONTEND BUILD SERVING (Single-Server Mode) =====
// When running as a single server, serves the built React frontend
// This allows both backend API and frontend UI to run from one server
const distDir = path.resolve(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(distDir)) {
	// Serve all static files (CSS, JS, images) from the dist directory
	app.use(express.static(distDir));
	// SPA (Single Page Application) fallback route
	// For all non-API routes, serve index.html (React handles routing on client-side)
	app.get(/^\/(?!api).*/, (req, res) => {
		res.sendFile(path.join(distDir, 'index.html'));
	});
}

// ===== SERVER STARTUP CONFIGURATION =====
// PORT: Server listening port (default 4000 if not specified in .env)
const PORT = process.env.PORT || 4000;
// HOST: Server binding address
// '0.0.0.0' allows external connections (needed for Render, Vercel, etc.)
const HOST = process.env.HOST || '0.0.0.0';

// ===== DATABASE CONNECTION INITIALIZATION =====
// Attempts to connect to MongoDB if configured
// Non-blocking - SQLite always works as fallback
(async () => {
	if (process.env.MONGODB_URI) {
		try {
			// Try to establish MongoDB connection
			await mongo.connect();
			console.log('[mongo] Connected'); // Log success
		} catch (e) {
			// Log warning if MongoDB connection fails, but continue with SQLite
			console.warn('[mongo] Connection failed:', e.message);
		}
	}
})();

// ===== START SERVER =====
// Start listening on configured host and port
app.listen(PORT, HOST, () => console.log(`Backend running on http://${HOST}:${PORT}`));

// Start the weekly AI-insights cron (no-op if DISABLE_CRON=1)
try { require('./lib/weeklyInsightsCron').start(); } catch (e) { console.warn('[cron] not started:', e.message); }

// Comment for development: nodemon watches this file for changes and restarts the server
