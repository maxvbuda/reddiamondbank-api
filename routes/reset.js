const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const router = express.Router();

// POST /api/reset-password
// Body: { username, resetSecret, newPassword }
// resetSecret must match the RESET_SECRET env var set in Render dashboard.
router.post('/reset-password', async (req, res) => {
  try {
    const { username, resetSecret, newPassword } = req.body || {};

    if (!username || !resetSecret || !newPassword) {
      return res.status(400).json({ error: 'username, resetSecret, and newPassword are required.' });
    }

    const expected = process.env.RESET_SECRET;
    if (!expected || resetSecret !== expected) {
      return res.status(403).json({ error: 'Invalid reset secret.' });
    }

    if (String(newPassword).length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters.' });
    }

    const user = await User.findOne({ username: username.toLowerCase() });
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();

    return res.json({ message: `Password reset successfully for ${user.username}.` });
  } catch (err) {
    console.error('reset-password error:', err);
    return res.status(500).json({ error: 'Password reset failed.' });
  }
});

module.exports = router;
