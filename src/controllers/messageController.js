const storage = require('../utils/storage');
const logger = require('../middleware/logger');
const whatsappService = require('../services/whatsapp');

/**
 * GET /api/messages
 * Retrieve all stored webhook messages (sorted by newest first)
 */
function getMessages(req, res) {
  try {
    const messages = storage.readMessages();
    // Sort by timestamp or createdAt descending
    messages.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return res.status(200).json(messages);
  } catch (error) {
    logger.error('Error retrieving messages:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /api/messages/:id
 * Retrieve a specific message by its ID
 */
function getMessageById(req, res) {
  try {
    const { id } = req.params;
    const messages = storage.readMessages();
    const message = messages.find(m => m.id === id);
    
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }
    
    return res.status(200).json(message);
  } catch (error) {
    logger.error('Error retrieving message details:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * POST /api/messages
 * Manually create/insert a message record
 */
function createMessage(req, res) {
  try {
    const { from, body, type, status, notes, mediaPath, rawData } = req.body;
    
    if (!from || (type !== 'image' && !body)) {
      return res.status(400).json({ error: 'Missing required fields: from and body' });
    }
    
    const saved = storage.saveMessage({
      from,
      body: body || '',
      type: type || 'text',
      status: status || 'received',
      notes: notes || '',
      mediaPath: mediaPath || null,
      rawData: rawData || null
    });
    
    return res.status(201).json(saved);
  } catch (error) {
    logger.error('Error manually creating message:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * PUT /api/messages/:id
 * Update properties of a stored message
 */
function updateMessage(req, res) {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // Perform update
    const updated = storage.updateMessage(id, updates);
    if (!updated) {
      return res.status(404).json({ error: 'Message not found' });
    }
    
    return res.status(200).json(updated);
  } catch (error) {
    logger.error('Error updating message:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * DELETE /api/messages/:id
 * Remove a message record
 */
function deleteMessage(req, res) {
  try {
    const { id } = req.params;
    const deleted = storage.deleteMessage(id);
    
    if (!deleted) {
      return res.status(404).json({ error: 'Message not found' });
    }
    
    return res.status(200).json({ success: true, message: `Message ${id} deleted successfully.` });
  } catch (error) {
    logger.error('Error deleting message:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * DELETE /api/messages
 * Remove all message records (Clear Database)
 */
function clearAllMessages(req, res) {
  try {
    storage.writeMessagesSafely([]);
    logger.info('All message logs cleared from database.');
    return res.status(200).json({ success: true, message: 'All messages deleted successfully.' });
  } catch (error) {
    logger.error('Error clearing messages database:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * POST /api/messages/send
 * Outbound message sending endpoint for text and media (images, videos, documents, audio, attachments)
 */
async function sendMessage(req, res) {
  try {
    const { to, text, body, message, link, url, mediaUrl, fileUrl, mediaId, id, caption, filename } = req.body;
    let type = (req.body.type || '').toLowerCase().trim();

    if (!to) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: "to" (recipient WhatsApp phone number with country code, e.g. "6281234567890")'
      });
    }

    const targetMedia = link || url || mediaUrl || fileUrl;
    const targetMediaId = mediaId || (type !== 'text' && id ? id : null);
    const contentText = text || body || message || '';

    // Auto-detect type if not provided or generic
    if (!type || ['media', 'file', 'attachment'].includes(type)) {
      if (targetMedia || targetMediaId) {
        type = whatsappService.detectMediaType(targetMedia);
      } else {
        type = 'text';
      }
    } else if (['doc', 'docs', 'pdf'].includes(type)) {
      type = 'document';
    }

    let metaResponse;

    if (type === 'text') {
      if (!contentText) {
        return res.status(400).json({
          success: false,
          error: 'Missing text content. Provide "text" or "body" field for text messages.'
        });
      }
      metaResponse = await whatsappService.sendTextMessage(to, contentText);
    } else if (['image', 'video', 'audio', 'document'].includes(type)) {
      if (!targetMedia && !targetMediaId) {
        return res.status(400).json({
          success: false,
          error: `Missing media attachment for type "${type}". Provide "link" (direct public URL) or "mediaId".`
        });
      }

      metaResponse = await whatsappService.sendMediaMessage(to, type, {
        link: targetMedia,
        id: targetMediaId,
        caption: caption || contentText,
        filename: filename
      });
    } else {
      return res.status(400).json({
        success: false,
        error: `Unsupported message type: "${type}". Supported types: text, image, video, audio, document.`
      });
    }

    const metaMsgId = metaResponse?.messages?.[0]?.id;

    // Save outbound record to message storage
    const saved = storage.saveMessage({
      id: metaMsgId || `out_${Date.now()}`,
      from: 'me',
      body: contentText || caption || (targetMedia ? `[${type}: ${targetMedia}]` : `[${type}]`),
      type: type,
      status: 'sent',
      mediaPath: targetMedia || null,
      notes: `Sent to ${to}`
    });

    return res.status(200).json({
      success: true,
      messageId: metaMsgId,
      type: type,
      recipient: to,
      record: saved
    });
  } catch (error) {
    const errorDetails = error.details || (error.response ? error.response.data : error.message);
    logger.error('Error sending message via WhatsApp Cloud API:', errorDetails);

    const errorMessage = error.message || 'Failed to send WhatsApp message';
    const statusCode = error.status || (error.response ? error.response.status : 500);

    return res.status(statusCode >= 400 && statusCode < 600 ? statusCode : 500).json({
      success: false,
      error: errorMessage,
      details: errorDetails
    });
  }
}

module.exports = {
  getMessages,
  getMessageById,
  createMessage,
  updateMessage,
  deleteMessage,
  clearAllMessages,
  sendMessage
};
