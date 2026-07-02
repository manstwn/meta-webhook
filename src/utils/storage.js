const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const logger = require('../middleware/logger');

const DATA_DIR = path.join(__dirname, '../../data');
const DATA_FILE = path.join(DATA_DIR, 'messages.json');
const TEMP_FILE = path.join(DATA_DIR, 'messages.json.tmp');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

/**
 * Safely reads the messages JSON file.
 * @returns {Array} List of messages.
 */
function readMessages() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      return [];
    }
    const data = fs.readFileSync(DATA_FILE, 'utf-8');
    if (!data.trim()) {
      return [];
    }
    return JSON.parse(data);
  } catch (error) {
    logger.error('Failed to read messages database file:', error);
    return [];
  }
}

/**
 * Safely and atomically writes messages to the JSON file.
 * @param {Array} messages - The complete array of messages to write.
 */
function writeMessagesSafely(messages) {
  try {
    const dataString = JSON.stringify(messages, null, 2);
    // 1. Write to temporary file first
    fs.writeFileSync(TEMP_FILE, dataString, 'utf-8');
    // 2. Rename temporary file to target file (Atomic replacement)
    fs.renameSync(TEMP_FILE, DATA_FILE);
  } catch (error) {
    logger.error('Failed to save messages database file atomically:', error);
    // Cleanup temp file if it exists and write failed
    try {
      if (fs.existsSync(TEMP_FILE)) {
        fs.unlinkSync(TEMP_FILE);
      }
    } catch (cleanupError) {
      // Ignore cleanup error
    }
    throw error;
  }
}

/**
 * Save or append a new message.
 * @param {object} msgData - The message payload to add.
 * @returns {object} The saved message.
 */
function saveMessage(msgData) {
  const messages = readMessages();
  
  // Format message payload
  const newMessage = {
    id: msgData.id || `msg_${crypto.randomUUID()}`,
    from: msgData.from || 'unknown',
    body: msgData.body || '',
    type: msgData.type || 'text',
    timestamp: msgData.timestamp || Math.floor(Date.now() / 1000),
    status: msgData.status || 'received',
    replied: msgData.replied || false,
    mediaPath: msgData.mediaPath || null,
    rawData: msgData.rawData || null,
    createdAt: new Date().toISOString(),
    notes: msgData.notes || ''
  };

  // If a message with the same ID already exists, update it instead of duplicating
  const existingIdx = messages.findIndex(m => m.id === newMessage.id);
  if (existingIdx !== -1) {
    messages[existingIdx] = { ...messages[existingIdx], ...newMessage };
  } else {
    messages.push(newMessage);
  }

  writeMessagesSafely(messages);
  logger.info(`Message ${newMessage.id} saved safely to JSON store.`);
  return newMessage;
}

/**
 * Update message properties (e.g. notes or replied status).
 * @param {string} id - The ID of the message.
 * @param {object} updates - Key-value pair updates.
 * @returns {object|null} The updated message or null if not found.
 */
function updateMessage(id, updates) {
  const messages = readMessages();
  const index = messages.findIndex(m => m.id === id);
  
  if (index === -1) {
    logger.warn(`Failed to update message: Message with ID ${id} not found.`);
    return null;
  }

  messages[index] = {
    ...messages[index],
    ...updates,
    updatedAt: new Date().toISOString()
  };

  writeMessagesSafely(messages);
  logger.info(`Message ${id} updated in JSON store.`);
  return messages[index];
}

/**
 * Delete a message.
 * @param {string} id - The ID of the message to delete.
 * @returns {boolean} True if deleted, false if not found.
 */
function deleteMessage(id) {
  const messages = readMessages();
  const initialLength = messages.length;
  const filtered = messages.filter(m => m.id !== id);

  if (filtered.length === initialLength) {
    logger.warn(`Failed to delete message: Message with ID ${id} not found.`);
    return false;
  }

  writeMessagesSafely(filtered);
  logger.info(`Message ${id} deleted from JSON store.`);
  return true;
}

const DOMAINS_FILE = path.join(__dirname, '../../data/forwarding_domains.json');

// Ensure domains file exists
if (!fs.existsSync(DOMAINS_FILE)) {
  try {
    fs.writeFileSync(DOMAINS_FILE, '[]', 'utf8');
  } catch (err) {
    logger.error('Failed to initialize forwarding domains store:', err);
  }
}

function readDomains() {
  try {
    if (!fs.existsSync(DOMAINS_FILE)) return [];
    const data = fs.readFileSync(DOMAINS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    logger.error('Error reading forwarding domains store:', error);
    return [];
  }
}

function writeDomainsSafely(domains) {
  try {
    const tempFile = `${DOMAINS_FILE}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(domains, null, 2), 'utf-8');
    fs.renameSync(tempFile, DOMAINS_FILE);
  } catch (error) {
    logger.error('Error writing forwarding domains store:', error);
    throw error;
  }
}

function saveDomain(domain) {
  const domains = readDomains();
  const index = domains.findIndex(d => d.id === domain.id);
  
  if (index !== -1) {
    domains[index] = { ...domains[index], ...domain, updatedAt: new Date().toISOString() };
  } else {
    domain.id = domain.id || `dom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    domain.createdAt = new Date().toISOString();
    domain.enabled = domain.enabled !== undefined ? domain.enabled : true;
    domains.push(domain);
  }
  
  writeDomainsSafely(domains);
  return domain;
}

function deleteDomain(id) {
  const domains = readDomains();
  const filtered = domains.filter(d => d.id !== id);
  if (filtered.length === domains.length) return false;
  writeDomainsSafely(filtered);
  return true;
}

module.exports = {
  readMessages,
  writeMessagesSafely,
  saveMessage,
  updateMessage,
  deleteMessage,
  readDomains,
  saveDomain,
  deleteDomain
};
