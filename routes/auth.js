const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

function signToken(username) {
  return jwt.sign({ username }, process.env.JWT_SECRET, { expiresIn: '30d' });
}

// Generate a unique-ish account number like RDB000000042.
async function nextAccountNumber() {
  const count = await User.estimatedDocumentCount();
  return `RDB${String(count + 1).padStart(9, '0')}`;
}

// POST /api/register
router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }
    if (String(username).length < 3 || String(password).length < 6) {
      return res.status(400).json({ error: 'Username must be 3+ chars and password 6+ chars.' });
    }

    const exists = await User.findOne({ username: username.toLowerCase() });
    if (exists) {
      return res.status(409).json({ error: 'Username already taken.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      username,
      passwordHash,
      accountNumber: await nextAccountNumber(),
      balance: 1000,
    });

    return res.status(201).json({ token: signToken(user.username), user: user.toPublic() });
  } catch (err) {
    // Handle duplicate-key race conditions gracefully.
    if (err && err.code === 11000) {
      return res.status(409).json({ error: 'Username already taken.' });
    }
    console.error('register error:', err);
    return res.status(500).json({ error: 'Registration failed.' });
  }
});

// POST /api/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const user = await User.findOne({ username: username.toLowerCase() });
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    return res.json({ token: signToken(user.username), user: user.toPublic() });
  } catch (err) {
    console.error('login error:', err);
    return res.status(500).json({ error: 'Login failed.' });
  }
});

// GET /api/me
router.get('/me', authMiddleware, async (req, res) => {
  const user = await User.findOne({ username: req.auth.username });
  if (!user) return res.status(404).json({ error: 'User not found.' });
  return res.json({ user: user.toPublic() });
});

module.exports = router;
