const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const config = {
  PORT: parseInt(process.env.PORT || '2958', 10),
  VERIFY_TOKEN: process.env.VERIFY_TOKEN || 'my_secret_verify_token',
  WHATSAPP_TOKEN: process.env.WHATSAPP_TOKEN,
  PHONE_NUMBER_ID: process.env.PHONE_NUMBER_ID,
  APP_SECRET: process.env.APP_SECRET || '',
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  NODE_ENV: process.env.NODE_ENV || 'development',
  ADMIN_PIN: process.env.ADMIN_PIN || '123456'
};

// Check for missing or placeholder environment variables and log warnings
const requiredKeys = ['VERIFY_TOKEN', 'WHATSAPP_TOKEN', 'PHONE_NUMBER_ID', 'ADMIN_PIN'];
const missingKeys = requiredKeys.filter(key => {
  const val = config[key];
  return !val || val.includes('YOUR_') || val === '123456789012345' || (key === 'ADMIN_PIN' && val === '123456');
});

if (missingKeys.length > 0) {
  console.warn(`[WARNING] The following environment variables are not configured or are using default placeholders: ${missingKeys.join(', ')}`);
  console.warn('Some WhatsApp sending features may not function until these are properly configured in your .env file.');
}

module.exports = config;
