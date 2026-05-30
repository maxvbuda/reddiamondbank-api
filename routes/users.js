const express = require('express');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// GET /api/users/search?q=partial_username
// Returns up to 10 verified users whose username starts with the query.
// Never returns the requesting user or sensitive fields.
router.get('/users/search', authMiddleware, async (req, res) => {
  try {
    const q = String(req.query.q || '').trim().toLowerCase();
    if (q.length < 1) return res.json({ users: [] });

    const users = await User.find({
      username: { $regex: `^${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, $options: 'i' },
      username: { $ne: req.auth.username },
      isVerified: true,
    })
      .select('username accountNumber')
      .limit(10)
      .lean();

    return res.json({ users });
  } catch (err) {
    console.error('user search error:', err);
    return res.status(500).json({ error: 'Search failed.' });
  }
});

module.exports = router;
