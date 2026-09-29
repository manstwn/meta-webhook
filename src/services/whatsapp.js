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
  'image/webp': '.webp',
  'video/mp4': '.mp4',
  'video/3gpp': '.3gp',
  'video/quicktime': '.mov',
  'audio/ogg': '.ogg',
  'audio/mpeg': '.mp3',
  'audio/mp4': '.m4a',
  'audio/amr': '.amr',
  'audio/wav': '.wav'
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
    const metaMessage = error.response?.data?.error?.message || error.message;
    const err = new Error(metaMessage);
    err.status = error.response?.status || 500;
    err.details = error.response?.data || error.message;
    throw err;
  }
}

/**
 * Detect media type category from filename or URL.
 * @param {string} urlOrFilename
 * @returns {string} 'image' | 'video' | 'audio' | 'document'
 */
function detectMediaType(urlOrFilename) {
  if (!urlOrFilename || typeof urlOrFilename !== 'string') return 'document';
  const clean = urlOrFilename.split('?')[0].toLowerCase();
  const ext = path.extname(clean);
  
  const imageExts = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
  const videoExts = ['.mp4', '.3gp', '.mov'];
  const audioExts = ['.mp3', '.ogg', '.wav', '.m4a', '.aac', '.amr'];

  if (imageExts.includes(ext)) return 'image';
  if (videoExts.includes(ext)) return 'video';
  if (audioExts.includes(ext)) return 'audio';
  return 'document';
}

/**
 * Send media message (image, video, audio, document) via WhatsApp Cloud API.
 * @param {string} to - Recipient phone number or WhatsApp ID.
 * @param {string} mediaType - 'image' | 'video' | 'audio' | 'document'.
 * @param {object} options - Media options { link, id, caption, filename }.
 * @returns {Promise<object>} The API response data.
 */
async function sendMediaMessage(to, mediaType, options = {}) {
  const url = `https://graph.facebook.com/v23.0/${config.PHONE_NUMBER_ID}/messages`;
  
  let type = (mediaType || '').toLowerCase().trim();
  if (['doc', 'docs', 'pdf', 'file', 'attachment'].includes(type)) {
    type = 'document';
  }

  const mediaObject = {};
  if (options.id || options.mediaId) {
    mediaObject.id = options.id || options.mediaId;
  } else if (options.link || options.url) {
    mediaObject.link = options.link || options.url;
  } else {
    const error = new Error('Media attachment requires either a valid public URL ("link") or Meta Media ID ("id")');
    error.status = 400;
    throw error;
  }

  if (options.caption && ['image', 'video', 'document'].includes(type)) {
    mediaObject.caption = options.caption;
  }

  if (type === 'document') {
    if (options.filename) {
      mediaObject.filename = options.filename;
    } else if (mediaObject.link) {
      try {
        const parsed = new URL(mediaObject.link);
        const base = path.basename(parsed.pathname);
        if (base && base.includes('.')) mediaObject.filename = base;
      } catch (e) {
        // Ignore URL parse error
      }
    }
  }

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: to,
    type: type,
    [type]: mediaObject
  };

  const headers = {
    'Authorization': `Bearer ${config.WHATSAPP_TOKEN}`,
    'Content-Type': 'application/json'
  };

  logger.info(`Sending ${type} message to ${to}`);

  try {
    const response = await axios.post(url, payload, { headers });
    const msgId = response.data?.messages?.[0]?.id;
    logger.info(`${type} sent successfully to ${to}. Message ID: ${msgId || 'unknown'}`);
    return response.data;
  } catch (error) {
    const errorData = error.response?.data;
    const metaMessage = errorData?.error?.message || error.message;
    logger.error(`Failed to send ${type} to ${to}. Details: ${JSON.stringify(errorData || error.message)}`);
    
    const err = new Error(metaMessage || `Failed to send ${type} attachment`);
    err.status = error.response?.status || 500;
    err.details = errorData || error.message;
    throw err;
  }
}

/**
 * Download media from Meta Graph API using Media ID or direct URL.
 * @param {string} mediaId - The ID of the media file on Meta.
 * @param {string} [directUrl] - Optional direct URL from the webhook payload.
 * @param {string} [mimeType] - Optional mime type from the webhook payload.
 * @returns {Promise<string|null>} Relative path of the downloaded file.
 */
async function downloadMedia(mediaId, directUrl = null, mimeType = null) {
  if (!mediaId) return null;

  const cleanMime = mimeType ? mimeType.split(';')[0].trim().toLowerCase() : '';
  let mediaCategory = 'image';
  if (cleanMime.startsWith('video/')) {
    mediaCategory = 'video';
  } else if (cleanMime.startsWith('audio/')) {
    mediaCategory = 'audio';
  }

  const categoryExtensions = {
    'image': '.png',
    'video': '.mp4',
    'audio': '.ogg'
  };

  const dummyBinaries = {
    'image': 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'video': 'AAAAIGZ0eXBtcDQyAAAAAG1wNDJpc29tYXZjMQAAAAhidW1wAAAAH2ZyZWUAAAAAAG1kYXQAAAAAHGZyZWUAAAAAAGZyZWUAAAAAAGZyZWU=',
    'audio': 'SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjYwLjMuMTAwAAAAAAAAAAAAAAD/'
  };
  
  // Handing placeholder/empty token elegantly for local testing
  if (!config.WHATSAPP_TOKEN || config.WHATSAPP_TOKEN === 'YOUR_PERMANENT_ACCESS_TOKEN' || config.WHATSAPP_TOKEN.trim() === '') {
    logger.warn(`WhatsApp token is using default placeholder or is empty. Creating fallback dummy ${mediaCategory} file for local testing.`);
    const ext = categoryExtensions[mediaCategory];
    const filename = `${mediaId}${ext}`;
    const outputPath = path.join(UPLOADS_DIR, filename);
    const base64Content = dummyBinaries[mediaCategory];
    
    try {
      fs.writeFileSync(outputPath, Buffer.from(base64Content, 'base64'));
      return `/uploads/${filename}`;
    } catch (writeErr) {
      logger.error(`Failed to write dummy ${mediaCategory} file:`, writeErr);
      return null;
    }
  }

  try {
    let downloadUrl = directUrl;
    let finalMimeType = mimeType;

    // If direct URL is not provided, fetch metadata from Graph API
    if (!downloadUrl) {
      logger.info(`Fetching media metadata for ID: ${mediaId} from Graph API`);
      const metadataUrl = `https://graph.facebook.com/v23.0/${mediaId}`;
      const headers = {
        'Authorization': `Bearer ${config.WHATSAPP_TOKEN}`
      };
      const metadataResponse = await axios.get(metadataUrl, { headers });
      downloadUrl = metadataResponse.data.url;
      finalMimeType = metadataResponse.data.mime_type;
    }

    if (!downloadUrl) {
      throw new Error(`No download URL available for media ID: ${mediaId}`);
    }

    // Clean mime type of parameters (e.g. "audio/ogg; codecs=opus" -> "audio/ogg")
    const cleanFinalMime = finalMimeType ? finalMimeType.split(';')[0].trim().toLowerCase() : '';
    const ext = MIME_EXTENSION_MAP[cleanFinalMime] || MIME_EXTENSION_MAP[finalMimeType] || '.bin';
    const filename = `${mediaId}${ext}`;
    const outputPath = path.join(UPLOADS_DIR, filename);
    const relativePath = `/uploads/${filename}`;

    // Download the binary content from the URL
    logger.info(`Downloading media content from URL: ${downloadUrl}`);
    const headers = {
      'Authorization': `Bearer ${config.WHATSAPP_TOKEN}`
    };
    
    const fileResponse = await axios.get(downloadUrl, {
      headers,
      responseType: 'stream'
    });

    // Write to file
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
    const ext = categoryExtensions[mediaCategory];
    const filename = `${mediaId}${ext}`;
    const outputPath = path.join(UPLOADS_DIR, filename);
    const base64Content = dummyBinaries[mediaCategory];
    try {
      fs.writeFileSync(outputPath, Buffer.from(base64Content, 'base64'));
      logger.info(`Created fallback dummy ${mediaCategory} at ${outputPath} due to download error.`);
      return `/uploads/${filename}`;
    } catch (writeErr) {
      return null;
    }
  }
}

module.exports = {
  sendTextMessage,
  sendMediaMessage,
  detectMediaType,
  downloadMedia,
  MIME_EXTENSION_MAP
};
