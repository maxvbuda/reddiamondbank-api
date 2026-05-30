const express = require('express');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// POST /api/send  { to, amount, note }
router.post('/send', authMiddleware, async (req, res) => {
  try {
    const fromUsername = req.auth.username;

    // Require email verification before sending payments.
    const senderCheck = await User.findOne({ username: fromUsername });
    if (!senderCheck?.isVerified) {
      return res.status(403).json({ error: 'Please verify your email before sending payments.' });
    }

    const { to, note } = req.body || {};
    const amount = Number(req.body && req.body.amount);

    if (!to || !Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Provide a recipient and a positive amount.' });
    }

    const toUsername = String(to).toLowerCase();
    if (toUsername === fromUsername) {
      return res.status(400).json({ error: 'You cannot send to yourself.' });
    }

    const recipient = await User.findOne({ username: toUsername });
    if (!recipient) {
      return res.status(404).json({ error: 'Recipient not found.' });
    }

    // Atomic debit: only succeeds if the sender still has enough balance.
    const sender = await User.findOneAndUpdate(
      { username: fromUsername, balance: { $gte: amount } },
      { $inc: { balance: -amount } },
      { new: true }
    );
    if (!sender) {
      return res.status(400).json({ error: 'Insufficient balance.' });
    }

    // Credit recipient. If this fails, refund the sender to stay consistent.
    try {
      await User.updateOne({ username: toUsername }, { $inc: { balance: amount } });
    } catch (creditErr) {
      await User.updateOne({ username: fromUsername }, { $inc: { balance: amount } });
      throw creditErr;
    }

    const txn = await Transaction.create({
      fromUser: fromUsername,
      toUser: toUsername,
      amount,
      note: note || '',
    });

    return res.json({ user: sender.toPublic(), transaction: txn.toPublic() });
  } catch (err) {
    console.error('send error:', err);
    return res.status(500).json({ error: 'Payment failed.' });
  }
});

// GET /api/transactions  -> most recent first
router.get('/transactions', authMiddleware, async (req, res) => {
  try {
    const me = req.auth.username;
    const txns = await Transaction.find({ $or: [{ fromUser: me }, { toUser: me }] })
      .sort({ createdAt: -1 })
      .limit(100);
    return res.json({ transactions: txns.map((t) => t.toPublic()) });
  } catch (err) {
    console.error('transactions error:', err);
    return res.status(500).json({ error: 'Could not load transactions.' });
  }
});

module.exports = router;
