const app = require('./app');
const config = require('./config/env');
const logger = require('./middleware/logger');

// Start the Express server on 0.0.0.0 to make it accessible to external services (like Cloudflare Tunnel)
const server = app.listen(config.PORT, '0.0.0.0', () => {
  logger.info(`WhatsApp Webhook Server started successfully.`);
  logger.info(`Listening on: 0.0.0.0:${config.PORT}`);
  logger.info(`Running in ${config.NODE_ENV} mode.`);
});

// Handle graceful shutdowns
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received. Initiating graceful shutdown.');
  server.close(() => {
    logger.info('HTTP server closed.');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT signal received. Initiating graceful shutdown.');
  server.close(() => {
    logger.info('HTTP server closed.');
    process.exit(0);
  });
});

// Handle uncaught exceptions and unhandled promise rejections to log them without crashing
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception details:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
