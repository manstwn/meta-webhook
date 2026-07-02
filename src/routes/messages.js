const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const messageController = require('../controllers/messageController');
const authenticatePIN = require('../middleware/auth');
const cryptoHelper = require('../utils/cryptoHelper');

// Serve temporary expiring media files (No PIN auth required, validated via signed token and access key)
router.get('/temp-media/:token', (req, res) => {
  const { token } = req.params;
  
  // 1. Enforce Media Access Key check
  const reqKey = req.query.key;
  const storage = require('../utils/storage');
  const domains = storage.readDomains();
  const hasValidKey = domains.some(d => d.enabled && d.key && d.key === reqKey) ||
                       (reqKey && reqKey === process.env.WHATSAPP_TOKEN) ||
                       (reqKey && reqKey === process.env.ADMIN_PIN);

  if (!hasValidKey) {
    return res.status(403).send(`
      <div style="font-family: system-ui, -apple-system, sans-serif; text-align: center; padding: 4rem 2rem; background: #0f172a; color: #f8fafc; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center;">
        <h1 style="color: #ef4444; font-size: 2.5rem; margin-bottom: 1rem;">Access Denied</h1>
        <p style="color: #94a3b8; font-size: 1.1rem; max-width: 500px; line-height: 1.6;">A valid Media Access Key is required to access or download this media file.</p>
      </div>
    `);
  }

  const filePath = cryptoHelper.verifyTempToken(token);
  
  if (!filePath) {
    return res.status(410).send(`
      <div style="font-family: system-ui, -apple-system, sans-serif; text-align: center; padding: 4rem 2rem; background: #0f172a; color: #f8fafc; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center;">
        <h1 style="color: #ef4444; font-size: 2.5rem; margin-bottom: 1rem;">Link Expired</h1>
        <p style="color: #94a3b8; font-size: 1.1rem; max-width: 500px; line-height: 1.6;">This temporary media link has expired or is invalid. Temporary media links are valid for exactly 10 minutes from receipt.</p>
      </div>
    `);
  }
  
  const absolutePath = path.resolve(filePath);
  if (!fs.existsSync(absolutePath)) {
    return res.status(404).send(`
      <div style="font-family: system-ui, -apple-system, sans-serif; text-align: center; padding: 4rem 2rem; background: #0f172a; color: #f8fafc; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center;">
        <h1 style="color: #f59e0b; font-size: 2.5rem; margin-bottom: 1rem;">File Not Found</h1>
        <p style="color: #94a3b8; font-size: 1.1rem; max-width: 500px; line-height: 1.6;">The requested media file was not found or has been removed from the server.</p>
      </div>
    `);
  }
  
  res.sendFile(absolutePath);
});

// Apply PIN authentication middleware to protect all CRUD endpoints
router.use(authenticatePIN);

// Retrieve all messages
router.get('/', messageController.getMessages);

// Retrieve a single message
router.get('/:id', messageController.getMessageById);

// Manually insert/create a message
router.post('/', messageController.createMessage);

// Update a message's details
router.put('/:id', messageController.updateMessage);

// Delete a message
router.delete('/:id', messageController.deleteMessage);

// Delete all messages (Clear database)
router.delete('/', messageController.clearAllMessages);

module.exports = router;
