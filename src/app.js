const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const config = require('./config/env');
const logger = require('./middleware/logger');
const webhookRoutes = require('./routes/webhook');
const messageRoutes = require('./routes/messages');

const app = express();

// Apply security headers
app.use(helmet());

// Enable Cross-Origin Resource Sharing
app.use(cors());

// Configure Rate Limiter (100 requests per minute as specified in PRD)
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true, // Return rate limit info in headers
  legacyHeaders: false, // Disable X-RateLimit-* headers
  message: { error: 'Too many requests, please try again later.' }
});
app.use(limiter);

// Integrate morgan HTTP logger with Winston
app.use(morgan('combined', {
  stream: {
    write: (message) => logger.info(message.trim())
  }
}));

// Parse incoming JSON body with raw body extraction (required for signature verification)
// and limit size to 5MB (as specified in PRD)
app.use(express.json({
  limit: '5mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

// Middleware to catch and reject invalid JSON body parsing errors
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    logger.error(`Bad Request - Invalid JSON payload received: ${err.message}`);
    return res.status(400).json({ error: 'Invalid JSON payload' });
  }
  next(err);
});

// Serve static assets from public folder (e.g. JavaScript, CSS, HTML dashboard)
app.use(express.static(path.join(__dirname, '../public')));

// Serve admin dashboard explicitly on GET /admin
app.get('/admin', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.sendFile(path.join(__dirname, '../public/admin.html'));
});

// Health check endpoint (GET /)
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'WhatsApp Cloud API',
    port: config.PORT
  });
});

// Register Webhook routes
app.use('/webhook', webhookRoutes);

// Register Messages API routes
app.use('/api/messages', messageRoutes);

// Catch-all route handler for 404 Not Found
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// Global Error Handler Middleware
// Catches all exceptions, logs the stack trace, returns 500, and prevents server crash
app.use((err, req, res, next) => {
  logger.error('Unhandled exception caught by global handler:', err);
  
  // Return clean message without exposing stack traces (as specified in PRD)
  res.status(500).json({
    error: 'Internal server error'
  });
});

module.exports = app;
