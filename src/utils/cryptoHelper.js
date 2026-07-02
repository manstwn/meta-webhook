const crypto = require('crypto');
const logger = require('./logger');

const SECRET_KEY = process.env.WHATSAPP_TOKEN || 'whatsapp_webhook_super_secret_fallback_key';

/**
 * Generate a cryptographically signed token containing file path and expiration timestamp (10 minutes)
 * @param {string} filePath - Path to the local media file
 * @returns {string} Signed token
 */
function generateTempToken(filePath) {
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes from now
  const payload = JSON.stringify({ filePath, expiresAt });
  const encodedPayload = Buffer.from(payload).toString('base64url');
  const signature = crypto.createHmac('sha256', SECRET_KEY).update(encodedPayload).digest('base64url');
  return `${encodedPayload}.${signature}`;
}

/**
 * Verify HMAC signature and check expiration of a token
 * @param {string} token - Token to verify
 * @returns {string|null} Resolved file path if valid, null otherwise
 */
function verifyTempToken(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [encodedPayload, signature] = parts;
    
    // Verify signature
    const expectedSignature = crypto.createHmac('sha256', SECRET_KEY).update(encodedPayload).digest('base64url');
    if (signature !== expectedSignature) {
      logger.warn('Temp media token verification failed: Signature mismatch');
      return null;
    }
    
    // Parse and decode payload
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
    
    // Check expiration
    if (Date.now() > payload.expiresAt) {
      logger.warn('Temp media token verification failed: Token expired');
      return null;
    }
    
    return payload.filePath;
  } catch (e) {
    logger.error('Error verifying temp media token:', e);
    return null;
  }
}

module.exports = {
  generateTempToken,
  verifyTempToken
};
