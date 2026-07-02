const config = require('../config/env');
const logger = require('../middleware/logger');
const whatsappService = require('../services/whatsapp');
const storage = require('../utils/storage');

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
 * Handle incoming Meta webhook events (POST request)
 */
function handleWebhook(req, res) {
  // Respond immediately with 200 OK to acknowledge receipt as per Meta guidelines
  res.status(200).json({ status: 'success' });

  // Process the webhook payload asynchronously
  processPayloadAsync(req.body).catch(err => {
    logger.error('Error processing webhook payload asynchronously:', err);
  });
}

/**
 * Helper to process the payload asynchronously
 */
async function processPayloadAsync(body) {
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
          }

          logger.info(`Incoming Message - ID: ${msgId}, From: ${from}, Type: ${type}, Body: "${bodyText}", Timestamp: ${timestamp}`);

          // 1. Save incoming message metadata safely in JSON store first
          try {
            storage.saveMessage({
              id: msgId,
              from: from,
              body: bodyText,
              type: type,
              timestamp: parseInt(timestamp, 10) || Math.floor(Date.now() / 1000),
              status: 'received',
              replied: false,
              rawData: body
            });
          } catch (saveErr) {
            logger.error(`Failed to save message ${msgId} to JSON storage:`, saveErr);
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
