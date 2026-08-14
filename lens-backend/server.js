require('dotenv').config();
const express = require('express');
const cors = require('cors');

require('./src/db'); // ensures tables exist before routes are wired up

const authRoutes = require('./src/routes/auth');
const userRoutes = require('./src/routes/users');
const investigationRoutes = require('./src/routes/investigations');
const sourceRoutes = require('./src/routes/sources');
const notificationRoutes = require('./src/routes/notifications');
const mapRoutes = require('./src/routes/maps');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/me', userRoutes);
app.use('/api/investigations', investigationRoutes);
app.use('/api/sources', sourceRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/maps', mapRoutes);

app.use((req, res) => res.status(404).json({ error: 'Not found.' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error.' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`LENS backend listening on http://localhost:${PORT}`);
});
