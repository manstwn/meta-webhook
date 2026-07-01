const axios = require('axios');
const config = require('../config/env');
const logger = require('../middleware/logger');

/**
 * Send a plain text message to a WhatsApp number.
 * @param {string} to - The recipient's WhatsApp ID or phone number with country code.
 * @param {string} textBody - The text content of the message.
 * @returns {Promise<object>} The API response data.
 */
async function sendTextMessage(to, textBody) {
  const url = `https://graph.facebook.com/v23.0/${config.PHONE_NUMBER_ID}/messages`;
  
  const payload = {
    messaging_product: 'whatsapp',
    to: to,
    type: 'text',
    text: {
      body: textBody
    }
  };

  const headers = {
    'Authorization': `Bearer ${config.WHATSAPP_TOKEN}`,
    'Content-Type': 'application/json'
  };

  logger.info(`Sending message to ${to}: "${textBody}"`);
  
  try {
    const response = await axios.post(url, payload, { headers });
    const msgId = response.data?.messages?.[0]?.id;
    logger.info(`Message sent successfully to ${to}. Message ID: ${msgId || 'unknown'}`);
    return response.data;
  } catch (error) {
    const errorDetails = error.response ? JSON.stringify(error.response.data) : error.message;
    logger.error(`Failed to send message to ${to}. Details: ${errorDetails}`);
    throw error;
  }
}

module.exports = {
  sendTextMessage
};
