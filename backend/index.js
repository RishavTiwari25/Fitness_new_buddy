const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const authRouter = require('./routes/auth');
const gymsRouter = require('./routes/gyms');
const dietRouter = require('./routes/diet');
const exercisesRouter = require('./routes/exercises');
const advancedBookingRouter = require('./routes/advancedBooking');
const socialRouter = require('./routes/social');
const engagementRouter = require('./routes/engagement');
const managementRouter = require('./routes/management');
const notificationsRouter = require('./routes/notifications');
const db = require('./db');
const mongo = require('./lib/mongo');

require('dotenv').config({ path: path.join(__dirname, '.env') });
const app = express();
app.use(cors());
app.use(express.json());

app.use('/api', authRouter);
app.use('/api', gymsRouter);
app.use('/api', dietRouter);
app.use('/api', exercisesRouter);
app.use('/api', advancedBookingRouter);
app.use('/api', socialRouter);
app.use('/api', engagementRouter);
app.use('/api', managementRouter);
app.use('/api', notificationsRouter);

app.get('/health', (req, res) => res.send('Fitness Buddy backend running'));

// Simple DB status endpoint: reports Mongo status if configured
app.get('/api/db-status', async (req, res) => {
	try {
		const m = await mongo.health();
		res.json({ sqlite: true, mongo: m });
	} catch (e) {
		res.json({ sqlite: true, mongo: { enabled: !!process.env.MONGODB_URI, connected: false, error: e.message } });
	}
});

// Serve uploaded images statically.
// Primary dir defaults to backend/uploads for local consistency.
// If UPLOADS_DIR is set (e.g., /tmp/uploads on Render), that becomes primary.
const PRIMARY_UPLOADS_DIR = process.env.UPLOADS_DIR || path.resolve(__dirname, 'uploads');
const LEGACY_UPLOADS_DIRS = [path.resolve('/tmp/uploads'), path.resolve(__dirname, 'uploads')]
	.filter((p, i, arr) => p !== PRIMARY_UPLOADS_DIR && arr.indexOf(p) === i);
try { fs.mkdirSync(PRIMARY_UPLOADS_DIR, { recursive: true }); } catch (_) {}
for (const legacyDir of LEGACY_UPLOADS_DIRS) {
	try { fs.mkdirSync(legacyDir, { recursive: true }); } catch (_) {}
}
app.use('/uploads', express.static(PRIMARY_UPLOADS_DIR));
for (const legacyDir of LEGACY_UPLOADS_DIRS) {
	app.use('/uploads', express.static(legacyDir));
}

// Serve frontend build (single-server mode) only if dist exists
const distDir = path.resolve(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(distDir)) {
	app.use(express.static(distDir));
	// SPA fallback for non-API routes
	app.get(/^\/(?!api).*/, (req, res) => {
		res.sendFile(path.join(distDir, 'index.html'));
	});
}

const PORT = process.env.PORT || 4000;
// Bind to 0.0.0.0 by default so platforms like Render can accept external traffic
const HOST = process.env.HOST || '0.0.0.0';

// If MongoDB is configured, attempt to connect on startup (non-blocking for SQLite fallback)
(async () => {
	if (process.env.MONGODB_URI) {
		try {
			await mongo.connect();
			console.log('[mongo] Connected');
		} catch (e) {
			console.warn('[mongo] Connection failed:', e.message);
		}
	}
})();

app.listen(PORT, HOST, () => console.log(`Backend running on http://${HOST}:${PORT}`));

// nodemon: harmless change to trigger restart when needed
