const config = require('../config/env');
const logger = require('./logger');

/**
 * Authentication middleware verifying that the request contains the valid API_KEY.
 * Accepts API key via 'x-api-key' header or 'Authorization: Bearer <API_KEY>' header.
 * Also permits ADMIN_PIN as a valid fallback.
 */
function authenticateApiKey(req, res, next) {
  const apiKey = config.API_KEY;
  const adminPin = config.ADMIN_PIN;

  if (!apiKey && !adminPin) {
    logger.error('Neither API_KEY nor ADMIN_PIN is configured in server environment.');
    return res.status(500).json({ error: 'Server misconfiguration: Authentication key missing.' });
  }

  const headerKey = req.headers['x-api-key'];
  const authHeader = req.headers['authorization'];
  let bearerKey = null;

  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    bearerKey = authHeader.substring(7).trim();
  }

  const providedKey = headerKey || bearerKey;

  if (!providedKey) {
    logger.warn(`Unauthorized API access: Missing API key from IP ${req.ip}`);
    return res.status(401).json({ error: 'Unauthorized: Missing API key. Provide header x-api-key or Authorization: Bearer <key>' });
  }

  const isValid = (apiKey && providedKey === apiKey) || (adminPin && providedKey === adminPin);

  if (!isValid) {
    logger.warn(`Unauthorized API access: Invalid API key attempt from IP ${req.ip}`);
    return res.status(401).json({ error: 'Unauthorized: Invalid API key' });
  }

  next();
}

module.exports = authenticateApiKey;
