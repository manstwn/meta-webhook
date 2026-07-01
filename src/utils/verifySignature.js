const crypto = require('crypto');
const config = require('../config/env');
const logger = require('../middleware/logger');

function verifySignature(req, res, next) {
  // If APP_SECRET is not configured, skip verification with a debug log
  if (!config.APP_SECRET) {
    return next();
  }

  const signature = req.headers['x-hub-signature-256'];
  if (!signature) {
    logger.warn('Signature verification failed: Missing x-hub-signature-256 header');
    return res.status(401).json({ error: 'Signature missing' });
  }

  try {
    const parts = signature.split('=');
    if (parts.length !== 2 || parts[0] !== 'sha256') {
      logger.warn(`Signature verification failed: Invalid header format: ${signature}`);
      return res.status(401).json({ error: 'Invalid signature format' });
    }

    const signatureHash = parts[1];
    
    // Ensure rawBody exists
    if (!req.rawBody) {
      logger.error('Signature verification failed: Raw request body not available');
      return res.status(500).json({ error: 'Internal server error' });
    }

    const expectedHash = crypto
      .createHmac('sha256', config.APP_SECRET)
      .update(req.rawBody)
      .digest('hex');

    // Secure timing-safe comparison to prevent timing attacks
    const isMatched = crypto.timingSafeEqual(
      Buffer.from(signatureHash, 'utf-8'),
      Buffer.from(expectedHash, 'utf-8')
    );

    if (!isMatched) {
      logger.warn('Signature verification failed: Hash mismatch');
      return res.status(401).json({ error: 'Signature mismatch' });
    }

    next();
  } catch (error) {
    logger.error('Error during signature verification:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = verifySignature;
