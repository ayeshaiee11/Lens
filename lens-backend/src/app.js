require('dotenv').config();
const express = require('express');
const cors = require('cors');

const { ensureSchema } = require('./db'); // ensures tables exist before routes are wired up

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const investigationRoutes = require('./routes/investigations');
const sourceRoutes = require('./routes/sources');
const notificationRoutes = require('./routes/notifications');
const mapRoutes = require('./routes/maps');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', async (req, res) => {
  try {
    await ensureSchema();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

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

module.exports = app;
