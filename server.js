require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const authRoutes = require('./routes/auth');
const paymentRoutes = require('./routes/payments');
const resetRoutes = require('./routes/reset');
const usersRoutes = require('./routes/users');

const app = express();
app.use(cors());
app.use(express.json());

// Health check (Render pings this; also handy to confirm a deploy is live).
app.get('/', (_req, res) => {
  res.json({ service: 'Red Diamond Bank API', status: 'ok' });
});
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' });
});

app.use('/api', authRoutes);
app.use('/api', paymentRoutes);
app.use('/api', resetRoutes);
app.use('/api', usersRoutes);

// 404 fallback for unknown API routes.
app.use((req, res) => {
  res.status(404).json({ error: `Not found: ${req.method} ${req.path}` });
});

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;
const JWT_SECRET = process.env.JWT_SECRET;

if (!MONGODB_URI) {
  console.error('FATAL: MONGODB_URI is not set. Add it in the Render dashboard.');
  process.exit(1);
}
if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET is not set. Add it in the Render dashboard.');
  process.exit(1);
}

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB.');
    app.listen(PORT, () => console.log(`Red Diamond Bank API listening on port ${PORT}`));
  })
  .catch((err) => {
    console.error('Failed to connect to MongoDB:', err.message);
    process.exit(1);
  });
