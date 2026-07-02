const express = require('express');
const router = express.Router();
const domainController = require('../controllers/domainController');
const authenticatePIN = require('../middleware/auth');

// Apply PIN authentication middleware to protect forwarding domains CRUD endpoints
router.use(authenticatePIN);

// Get all forwarding target domains
router.get('/', domainController.getDomains);

// Create or update a forwarding target domain
router.post('/', domainController.saveDomain);

// Delete a forwarding target domain
router.delete('/:id', domainController.deleteDomain);

module.exports = router;
