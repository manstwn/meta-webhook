const storage = require('../utils/storage');
const logger = require('../middleware/logger');

/**
 * GET /api/forward-urls
 * Retrieve list of all target domains
 */
function getDomains(req, res) {
  try {
    const domains = storage.readDomains();
    return res.status(200).json(domains);
  } catch (error) {
    logger.error('Error fetching domains list:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * POST/PUT /api/forward-urls
 * Save or update forwarding target domain
 */
function saveDomain(req, res) {
  try {
    const { id, url, enabled, notes } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL field is required' });
    }
    
    const domainRecord = storage.saveDomain({ id, url, enabled, notes });
    logger.info(`Forwarding domain target saved successfully: ${domainRecord.url}`);
    return res.status(200).json(domainRecord);
  } catch (error) {
    logger.error('Error saving forwarding domain target:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * DELETE /api/forward-urls/:id
 * Delete target domain
 */
function deleteDomain(req, res) {
  try {
    const { id } = req.params;
    const deleted = storage.deleteDomain(id);
    
    if (!deleted) {
      return res.status(404).json({ error: 'Domain target not found' });
    }
    
    logger.info(`Forwarding domain target deleted: ${id}`);
    return res.status(200).json({ success: true, message: `Domain ${id} deleted successfully.` });
  } catch (error) {
    logger.error('Error deleting forwarding domain target:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  getDomains,
  saveDomain,
  deleteDomain
};
