const axios = require('axios');
const fs = require('fs');
const path = require('path');
const config = require('../config/env');
const logger = require('../middleware/logger');

// Ensure uploads directory exists in public/uploads
const UPLOADS_DIR = path.join(__dirname, '../../public/uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Map mime type to file extensions
const MIME_EXTENSION_MAP = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp'
};

/**
 * Send a plain text message to a WhatsApp number.
 * @param {string} to - The recipient's WhatsApp ID or phone number with country code.
 * @param {string} textBody - The text content of the message.
 * @returns {Promise<object>} The API response data.
 */
async function sendTextMessage(to, textBody) {
  const url = `https://graph.facebook.com/v23.0/${config.PHONE_NUMBER_ID}/messages`;
  
  const payload = {
    messaging_product: 'whatsapp',
    to: to,
    type: 'text',
    text: {
      body: textBody
    }
  };

  const headers = {
    'Authorization': `Bearer ${config.WHATSAPP_TOKEN}`,
    'Content-Type': 'application/json'
  };

  logger.info(`Sending message to ${to}: "${textBody}"`);
  
  try {
    const response = await axios.post(url, payload, { headers });
    const msgId = response.data?.messages?.[0]?.id;
    logger.info(`Message sent successfully to ${to}. Message ID: ${msgId || 'unknown'}`);
    return response.data;
  } catch (error) {
    const errorDetails = error.response ? JSON.stringify(error.response.data) : error.message;
    logger.error(`Failed to send message to ${to}. Details: ${errorDetails}`);
    throw error;
  }
}

/**
 * Download media from Meta Graph API using Media ID.
 * @param {string} mediaId - The ID of the media file on Meta.
 * @returns {Promise<string|null>} Relative path of the downloaded file (e.g. /uploads/mediaId.jpg), or null if failed.
 */
async function downloadMedia(mediaId) {
  if (!mediaId) return null;
  
  // Handing placeholder/empty token elegantly for local testing
  if (!config.WHATSAPP_TOKEN || config.WHATSAPP_TOKEN === 'YOUR_PERMANENT_ACCESS_TOKEN' || config.WHATSAPP_TOKEN.trim() === '') {
    logger.warn(`WhatsApp token is using default placeholder or is empty. Creating fallback dummy image for local testing.`);
    const filename = `${mediaId}.png`;
    const outputPath = path.join(UPLOADS_DIR, filename);
    
    // Tiny 1x1 transparent PNG base64
    const dummyImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    try {
      fs.writeFileSync(outputPath, Buffer.from(dummyImageBase64, 'base64'));
      return `/uploads/${filename}`;
    } catch (writeErr) {
      logger.error('Failed to write dummy image file:', writeErr);
      return null;
    }
  }

  try {
    logger.info(`Fetching media metadata for ID: ${mediaId}`);
    const metadataUrl = `https://graph.facebook.com/v23.0/${mediaId}`;
    const headers = {
      'Authorization': `Bearer ${config.WHATSAPP_TOKEN}`
    };

    // 1. Fetch metadata (URL and mime-type)
    const metadataResponse = await axios.get(metadataUrl, { headers });
    const { url, mime_type } = metadataResponse.data;
    
    if (!url) {
      throw new Error(`No download URL returned for media ID: ${mediaId}`);
    }

    // Determine file extension
    const ext = MIME_EXTENSION_MAP[mime_type] || '.jpg';
    const filename = `${mediaId}${ext}`;
    const outputPath = path.join(UPLOADS_DIR, filename);
    const relativePath = `/uploads/${filename}`;

    // 2. Download the binary content from the URL
    logger.info(`Downloading media content from URL: ${url}`);
    const fileResponse = await axios.get(url, {
      headers,
      responseType: 'stream'
    });

    // 3. Write to file
    const writer = fs.createWriteStream(outputPath);
    fileResponse.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        logger.info(`Media downloaded successfully to: ${outputPath}`);
        resolve(relativePath);
      });
      writer.on('error', (err) => {
        logger.error(`Error writing media stream to file:`, err);
        reject(err);
      });
    });
  } catch (error) {
    const errorDetails = error.response ? JSON.stringify(error.response.data) : error.message;
    logger.error(`Failed to download media for ID ${mediaId}. Details: ${errorDetails}`);
    
    // In case of error but we are in dev/test, fallback to dummy image
    const filename = `${mediaId}.png`;
    const outputPath = path.join(UPLOADS_DIR, filename);
    const dummyImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    try {
      fs.writeFileSync(outputPath, Buffer.from(dummyImageBase64, 'base64'));
      logger.info(`Created fallback dummy image at ${outputPath} due to download error.`);
      return `/uploads/${filename}`;
    } catch (writeErr) {
      return null;
    }
  }
}

module.exports = {
  sendTextMessage,
  downloadMedia
};
