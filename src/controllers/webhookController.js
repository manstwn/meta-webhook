const config = require('../config/env');
const logger = require('../middleware/logger');
const whatsappService = require('../services/whatsapp');
const storage = require('../utils/storage');
const axios = require('axios');
const cryptoHelper = require('../utils/cryptoHelper');

/**
 * Handle Meta webhook verification (GET request)
 */
function verifyWebhook(req, res) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  logger.info(`Received webhook verification attempt. Mode: ${mode}, Token: ${token}`);

  if (mode && token) {
    if (mode === 'subscribe' && token === config.VERIFY_TOKEN) {
      logger.info('Webhook verification successful. Returning challenge.');
      // Respond with the challenge token
      return res.status(200).send(challenge);
    } else {
      logger.warn('Webhook verification failed. Token mismatch or invalid mode.');
      return res.sendStatus(403);
    }
  }

  logger.warn('Webhook verification failed. Missing hub.mode or hub.verify_token.');
  return res.sendStatus(400);
}

/**
 * Forward parsed webhook message to external domains (multicast)
 */
async function forwardWebhook(msgRecord) {
  const payload = {
    id: msgRecord.id,
    from: msgRecord.from,
    type: msgRecord.type,
    body: msgRecord.body,
    timestamp: msgRecord.timestamp,
    tempMediaUrl: msgRecord.tempMediaUrl || null,
    rawData: msgRecord.rawData
  };

  const targets = [];

  // Add static URL from environment if configured
  if (process.env.FORWARD_URL) {
    targets.push({ url: process.env.FORWARD_URL, notes: 'Static environment target' });
  }

  // Add dynamic target URLs from database (only enabled ones)
  try {
    const dbDomains = storage.readDomains();
    if (dbDomains && Array.isArray(dbDomains)) {
      dbDomains.forEach(d => {
        if (d.enabled && d.url) {
          targets.push(d);
        }
      });
    }
  } catch (dbErr) {
    logger.error('Error reading forwarding domains list for relay:', dbErr);
  }

  if (targets.length === 0) return;

  // Relay payload to all target endpoints
  for (const target of targets) {
    try {
      logger.info(`Forwarding message ${msgRecord.id} to target: ${target.url} (${target.notes || 'No notes'})`);
      await axios.post(target.url, payload, { timeout: 5000 });
      logger.info(`Successfully forwarded message ${msgRecord.id} to ${target.url}`);
    } catch (err) {
      logger.error(`Failed to forward message ${msgRecord.id} to ${target.url}:`, err.message);
    }
  }
}

/**
 * Handle incoming Meta webhook events (POST request)
 */
function handleWebhook(req, res) {
  // Respond immediately with 200 OK to acknowledge receipt as per Meta guidelines
  res.status(200).json({ status: 'success' });

  // Process the webhook payload asynchronously
  processPayloadAsync(req.body, req).catch(err => {
    logger.error('Error processing webhook payload asynchronously:', err);
  });
}

/**
 * Helper to process the payload asynchronously
 */
async function processPayloadAsync(body, req) {
  logger.info(`Processing webhook event: ${JSON.stringify(body)}`);

  const entries = body.entry;
  if (!entries || !Array.isArray(entries)) {
    return;
  }

  for (const entry of entries) {
    const changes = entry.changes;
    if (!changes || !Array.isArray(changes)) {
      continue;
    }

    for (const change of changes) {
      const value = change.value;
      if (!value) {
        continue;
      }

      // Check if there are messages
      const messages = value.messages;
      if (messages && Array.isArray(messages)) {
        for (const msg of messages) {
          const from = msg.from; // Sender phone number
          const msgId = msg.id;
          const timestamp = msg.timestamp;
          const type = msg.type;

          let bodyText = '';
          if (type === 'text' && msg.text && msg.text.body) {
            bodyText = msg.text.body;
          } else if (type === 'image' && msg.image) {
            bodyText = msg.image.caption || '';
          } else if (type === 'video' && msg.video) {
            bodyText = msg.video.caption || '';
          } else if (type === 'audio' && msg.audio) {
            bodyText = msg.audio.voice ? '[Voice Note]' : '[Audio]';
          }

          logger.info(`Incoming Message - ID: ${msgId}, From: ${from}, Type: ${type}, Body: "${bodyText}", Timestamp: ${timestamp}`);

          // Construct temporary signed expiring media URL if applicable
          let tempMediaUrl = null;
          if (type === 'image' && msg.image && msg.image.id) {
            const mime = msg.image.mime_type ? msg.image.mime_type.split(';')[0].trim().toLowerCase() : '';
            const ext = whatsappService.MIME_EXTENSION_MAP[mime] || '.jpg';
            const filePath = `public/uploads/${msg.image.id}${ext}`;
            const token = cryptoHelper.generateTempToken(filePath);
            tempMediaUrl = `${req.protocol}://${req.get('host')}/api/messages/temp-media/${token}`;
          } else if (type === 'video' && msg.video && msg.video.id) {
            const mime = msg.video.mime_type ? msg.video.mime_type.split(';')[0].trim().toLowerCase() : '';
            const ext = whatsappService.MIME_EXTENSION_MAP[mime] || '.mp4';
            const filePath = `public/uploads/${msg.video.id}${ext}`;
            const token = cryptoHelper.generateTempToken(filePath);
            tempMediaUrl = `${req.protocol}://${req.get('host')}/api/messages/temp-media/${token}`;
          } else if (type === 'audio' && msg.audio && msg.audio.id) {
            const mime = msg.audio.mime_type ? msg.audio.mime_type.split(';')[0].trim().toLowerCase() : '';
            const ext = whatsappService.MIME_EXTENSION_MAP[mime] || '.ogg';
            const filePath = `public/uploads/${msg.audio.id}${ext}`;
            const token = cryptoHelper.generateTempToken(filePath);
            tempMediaUrl = `${req.protocol}://${req.get('host')}/api/messages/temp-media/${token}`;
          }

          // 1. Save incoming message metadata safely in JSON store first
          const messageRecord = {
            id: msgId,
            from: from,
            body: bodyText,
            type: type,
            timestamp: parseInt(timestamp, 10) || Math.floor(Date.now() / 1000),
            status: 'received',
            replied: false,
            tempMediaUrl: tempMediaUrl,
            rawData: body
          };

          try {
            storage.saveMessage(messageRecord);
          } catch (saveErr) {
            logger.error(`Failed to save message ${msgId} to JSON storage:`, saveErr);
          }

          // Forward webhook payload to external domain asynchronously in background
          forwardWebhook(messageRecord);

          // 1.5. Asynchronously download media (image, video, audio) in the background if applicable
          if (type === 'image' && msg.image && msg.image.id) {
            whatsappService.downloadMedia(msg.image.id, msg.image.url, msg.image.mime_type)
              .then(localPath => {
                if (localPath) {
                  storage.updateMessage(msgId, { mediaPath: localPath });
                }
              })
              .catch(downloadErr => {
                logger.error(`Failed to download image asynchronously for message ${msgId}:`, downloadErr);
              });
          } else if (type === 'video' && msg.video && msg.video.id) {
            whatsappService.downloadMedia(msg.video.id, msg.video.url, msg.video.mime_type)
              .then(localPath => {
                if (localPath) {
                  storage.updateMessage(msgId, { mediaPath: localPath });
                }
              })
              .catch(downloadErr => {
                logger.error(`Failed to download video asynchronously for message ${msgId}:`, downloadErr);
              });
          } else if (type === 'audio' && msg.audio && msg.audio.id) {
            whatsappService.downloadMedia(msg.audio.id, msg.audio.url, msg.audio.mime_type)
              .then(localPath => {
                if (localPath) {
                  storage.updateMessage(msgId, { mediaPath: localPath });
                }
              })
              .catch(downloadErr => {
                logger.error(`Failed to download audio asynchronously for message ${msgId}:`, downloadErr);
              });
          }

          // 2. Trigger Auto Reply Logic asynchronously in the background
          if (type === 'text' && bodyText.trim().toLowerCase() === 'hi') {
            whatsappService.sendTextMessage(from, 'Halo')
              .then(() => {
                // On success, update storage status
                try {
                  storage.updateMessage(msgId, { status: 'replied', replied: true });
                } catch (updateErr) {
                  logger.error(`Failed to update message ${msgId} status to replied:`, updateErr);
                }
              })
              .catch(replyErr => {
                logger.error(`Error sending automatic reply to ${from}:`, replyErr);
              });
          }
        }
      } else {
        // Handle all other webhook event fields (system updates, template statuses, account changes)
        const fieldName = change.field || 'unknown_field';
        const eventId = value.id || value.entity_id || `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const timestamp = body.entry?.[0]?.time || Math.floor(Date.now() / 1000);
        
        let fromIdentifier = fieldName;
        if (value.entity_type && value.entity_id) {
          fromIdentifier = `${fieldName} (${value.entity_type}:${value.entity_id})`;
        } else if (value.display_phone_number) {
          fromIdentifier = `${fieldName} (${value.display_phone_number})`;
        }

        // Generate summary description
        let eventBody = '';
        if (fieldName === 'account_alerts') {
          eventBody = value.alert_description || value.alert_type || 'Account alert received';
        } else if (fieldName === 'message_template_status_update') {
          eventBody = `Template "${value.message_template_name}" status changed to: ${value.event || 'updated'}`;
        } else if (fieldName === 'phone_number_name_update') {
          eventBody = `Display name update for ${value.display_phone_number}: ${value.decision || 'updated'}`;
        } else if (fieldName === 'phone_number_quality_update') {
          eventBody = `Quality changed for ${value.display_phone_number}: ${value.new_quality_update || 'updated'}`;
        } else if (fieldName === 'account_update') {
          eventBody = `Account ban state: ${value.ban_info?.ban_state || 'updated'}`;
        } else {
          // Generic fallback summary from flat keys
          eventBody = Object.entries(value)
            .filter(([_, v]) => typeof v !== 'object')
            .map(([k, v]) => `${k}: ${v}`)
            .join(', ');
          if (!eventBody) {
            eventBody = `System event update for ${fieldName}`;
          }
        }

        logger.info(`System Webhook Event - Field: ${fieldName}, ID: ${eventId}, Summary: "${eventBody}", Timestamp: ${timestamp}`);

        try {
          storage.saveMessage({
            id: eventId,
            from: fromIdentifier,
            body: eventBody,
            type: 'system_event',
            timestamp: parseInt(timestamp, 10) || Math.floor(Date.now() / 1000),
            status: 'received',
            replied: false,
            rawData: body
          });
        } catch (saveErr) {
          logger.error(`Failed to save system event ${eventId} to JSON storage:`, saveErr);
        }
      }
    }
  }
}

module.exports = {
  verifyWebhook,
  handleWebhook
};
