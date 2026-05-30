const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');
const { generateCode, sendVerificationEmail } = require('../services/emailService');

const router = express.Router();

function signToken(username) {
  return jwt.sign({ username }, process.env.JWT_SECRET, { expiresIn: '30d' });
}

async function nextAccountNumber() {
  const count = await User.estimatedDocumentCount();
  return `RDB${String(count + 1).padStart(9, '0')}`;
}

// POST /api/register
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body || {};
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required.' });
    }
    if (String(username).length < 3 || String(password).length < 6) {
      return res.status(400).json({ error: 'Username must be 3+ chars and password 6+ chars.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email address.' });
    }

    const existingUser = await User.findOne({ username: username.toLowerCase() });
    if (existingUser) return res.status(409).json({ error: 'Username already taken.' });

    const existingEmail = await User.findOne({ email: email.toLowerCase() });
    if (existingEmail) return res.status(409).json({ error: 'Email already registered.' });

    const code = generateCode();
    const expiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    const user = await User.create({
      username,
      email,
      passwordHash: await bcrypt.hash(password, 10),
      accountNumber: await nextAccountNumber(),
      balance: 1000,
      isVerified: false,
      verificationCode: code,
      verificationExpiry: expiry,
    });

    await sendVerificationEmail(email, username, code);

    return res.status(201).json({
      token: signToken(user.username),
      user: user.toPublic(),
      message: 'Account created. Check your email for a verification code.',
    });
  } catch (err) {
    if (err && err.code === 11000) {
      return res.status(409).json({ error: 'Username or email already taken.' });
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
    if (!user) return res.status(401).json({ error: 'Invalid username or password.' });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid username or password.' });

    return res.json({ token: signToken(user.username), user: user.toPublic() });
  } catch (err) {
    console.error('login error:', err);
    return res.status(500).json({ error: 'Login failed.' });
  }
});

// POST /api/verify-email  { code }
router.post('/verify-email', authMiddleware, async (req, res) => {
  try {
    const { code } = req.body || {};
    if (!code) return res.status(400).json({ error: 'Verification code is required.' });

    const user = await User.findOne({ username: req.auth.username });
    if (!user) return res.status(404).json({ error: 'User not found.' });
    if (user.isVerified) return res.json({ user: user.toPublic(), message: 'Already verified.' });

    if (!user.verificationCode || user.verificationCode !== String(code)) {
      return res.status(400).json({ error: 'Invalid verification code.' });
    }
    if (user.verificationExpiry && user.verificationExpiry < new Date()) {
      return res.status(400).json({ error: 'Verification code has expired. Request a new one.' });
    }

    user.isVerified = true;
    user.verificationCode = null;
    user.verificationExpiry = null;
    await user.save();

    return res.json({ user: user.toPublic(), message: 'Email verified!' });
  } catch (err) {
    console.error('verify-email error:', err);
    return res.status(500).json({ error: 'Verification failed.' });
  }
});

// POST /api/resend-verification
router.post('/resend-verification', authMiddleware, async (req, res) => {
  try {
    const user = await User.findOne({ username: req.auth.username });
    if (!user) return res.status(404).json({ error: 'User not found.' });
    if (user.isVerified) return res.json({ message: 'Already verified.' });

    const code = generateCode();
    user.verificationCode = code;
    user.verificationExpiry = new Date(Date.now() + 15 * 60 * 1000);
    await user.save();

    await sendVerificationEmail(user.email, user.username, code);
    return res.json({ message: 'Verification code resent.' });
  } catch (err) {
    console.error('resend-verification error:', err);
    return res.status(500).json({ error: 'Failed to resend verification.' });
  }
});

// GET /api/me
router.get('/me', authMiddleware, async (req, res) => {
  const user = await User.findOne({ username: req.auth.username });
  if (!user) return res.status(404).json({ error: 'User not found.' });
  return res.json({ user: user.toPublic() });
});

module.exports = router;
