const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');
const verifySignature = require('../utils/verifySignature');

// Route for Meta webhook validation (GET /webhook)
router.get('/', webhookController.verifyWebhook);

// Route for receiving incoming WhatsApp events (POST /webhook)
// Includes signature verification middleware
router.post('/', verifySignature, webhookController.handleWebhook);

module.exports = router;
