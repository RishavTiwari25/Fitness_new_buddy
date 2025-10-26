const express = require('express');
const cors = require('cors');
const path = require('path');
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

require('dotenv').config();
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

// Serve uploaded images statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve frontend build (single-server mode)
const distDir = path.resolve(__dirname, '..', 'frontend', 'dist');
app.use(express.static(distDir));
// SPA fallback for non-API routes
app.get(/^\/(?!api).*/, (req, res) => {
	res.sendFile(path.join(distDir, 'index.html'));
});

const PORT = process.env.PORT || 4000;
const HOST = process.env.HOST || '127.0.0.1';
app.listen(PORT, HOST, () => console.log(`Backend running on http://${HOST}:${PORT}`));

// nodemon: harmless change to trigger restart when needed
