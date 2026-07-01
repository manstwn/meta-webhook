const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const authenticatePIN = require('../middleware/auth');

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

module.exports = router;
