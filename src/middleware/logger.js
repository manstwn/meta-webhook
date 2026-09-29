const winston = require('winston');
const path = require('path');
const fs = require('fs');
const config = require('../config/env');

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ level, message, timestamp, stack }) => {
    return `${timestamp} [${level.toUpperCase()}]: ${stack || message}`;
  })
);

const transports = [
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      logFormat
    )
  })
];

// Only write to file when LOG is not set to false
if (config.LOG !== false) {
  const logsDir = path.join(__dirname, '../../logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  transports.push(
    new winston.transports.File({
      filename: path.join(logsDir, 'server.log'),
      level: config.LOG_LEVEL
    })
  );
}

const logger = winston.createLogger({
  level: config.LOG_LEVEL,
  format: logFormat,
  transports: transports
});

module.exports = logger;
