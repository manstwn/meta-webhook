const storage = require('../utils/storage');
const logger = require('../middleware/logger');

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
    const { from, body, type, status, notes, mediaPath } = req.body;
    
    if (!from || (type !== 'image' && !body)) {
      return res.status(400).json({ error: 'Missing required fields: from and body' });
    }
    
    const saved = storage.saveMessage({
      from,
      body: body || '',
      type: type || 'text',
      status: status || 'received',
      notes: notes || '',
      mediaPath: mediaPath || null
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

module.exports = {
  getMessages,
  getMessageById,
  createMessage,
  updateMessage,
  deleteMessage
};
