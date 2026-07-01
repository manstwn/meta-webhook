const config = require('../config/env');
const logger = require('./logger');

/**
 * Authentication middleware verifying that the request contains the correct
 * ADMIN_PIN in the Authorization header.
 */
function authenticatePIN(req, res, next) {
  const authHeader = req.headers['authorization'];
  
  if (!authHeader) {
    logger.warn(`Unauthorized request blocked: Missing authorization header from IP ${req.ip}`);
    return res.status(401).json({ error: 'Unauthorized: Missing PIN' });
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    logger.warn(`Unauthorized request blocked: Invalid authorization header format from IP ${req.ip}`);
    return res.status(401).json({ error: 'Unauthorized: Invalid header format' });
  }

  const pin = parts[1];
  if (pin !== config.ADMIN_PIN) {
    logger.warn(`Unauthorized request blocked: Invalid PIN attempt from IP ${req.ip}`);
    return res.status(401).json({ error: 'Unauthorized: Invalid PIN' });
  }

  // Auth successful
  next();
}

module.exports = authenticatePIN;
