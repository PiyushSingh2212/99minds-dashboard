const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production-please';

module.exports = function authJwt(req, res, next) {
  // 1. x-api-key — backward compat for Chrome extension + n8n
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;
  if (apiKey && process.env.API_KEY && apiKey === process.env.API_KEY) {
    return next();
  }

  // 2. JWT Bearer token (Authorization header)
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    try {
      req.user = jwt.verify(auth.slice(7), JWT_SECRET);
      return next();
    } catch {
      return res.status(401).json({ error: 'Token expired or invalid. Please sign in again.' });
    }
  }

  // 3. JWT via query string (for CSV download links opened in a new tab)
  if (req.query.token) {
    try {
      req.user = jwt.verify(req.query.token, JWT_SECRET);
      return next();
    } catch {
      return res.status(401).json({ error: 'Token expired or invalid.' });
    }
  }

  res.status(401).json({ error: 'Authentication required.' });
};
