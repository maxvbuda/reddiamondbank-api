const jwt = require('jsonwebtoken');

// Verifies the Bearer token and attaches { username } to req.auth.
module.exports = function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Missing authorization token.' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.auth = { username: payload.username };
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
};
