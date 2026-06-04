// Simple API key auth — used by Chrome extension and n8n
module.exports = function auth(req, res, next) {
  const key = req.headers['x-api-key'] || req.query.apiKey;
  if (!process.env.API_KEY || key === process.env.API_KEY) {
    return next();
  }
  res.status(401).json({ error: 'Unauthorized' });
};
