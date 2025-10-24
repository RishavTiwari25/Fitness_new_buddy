const express = require('express');
const cors = require('cors');
const authRouter = require('./routes/auth');
const gymsRouter = require('./routes/gyms');
const db = require('./db');

require('dotenv').config();
const app = express();
app.use(cors());
app.use(express.json());

app.use('/api', authRouter);
app.use('/api', gymsRouter);

app.get('/', (req, res) => res.send('Fitness Buddy backend running'));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
