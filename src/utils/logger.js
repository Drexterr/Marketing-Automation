import winston from 'winston';
import 'winston-daily-rotate-file';
import path from 'path';
import fs from 'fs';
import { ActivityRepository } from '../../shared/repositories/ActivityRepository.js';

const logDir = path.resolve(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Custom transport for SQLite logging
class SqliteTransport extends winston.Transport {
  constructor(opts) {
    super(opts);
    this.activityRepo = new ActivityRepository();
  }

  log(info, callback) {
    setImmediate(() => {
      this.emit('logged', info);
    });

    try {
      // Avoid logging internal DB logs to DB to prevent recursion if any
      const { level, message, module, ...meta } = info;
      
      const details = {
        message,
        ...meta
      };
      
      this.activityRepo.log(
        level,
        module || 'system',
        details
      );
    } catch (err) {
      // Silently fail DB logging to avoid crashing the main process
      console.error('Failed to log to SQLite:', err.message);
    }

    callback();
  }
}

const commonRotationOptions = {
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '14d'
};

export const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.DailyRotateFile({
      filename: path.join(logDir, 'automation-%DATE%.log'),
      ...commonRotationOptions
    }),
    new winston.transports.DailyRotateFile({
      filename: path.join(logDir, 'errors-%DATE%.log'),
      level: 'error',
      ...commonRotationOptions
    }),
    new winston.transports.DailyRotateFile({
      filename: path.join(logDir, 'ai-%DATE%.log'),
      name: 'ai-log',
      level: 'info',
      ...commonRotationOptions
    }),
    new winston.transports.DailyRotateFile({
      filename: path.join(logDir, 'security-%DATE%.log'),
      name: 'security-log',
      level: 'info',
      ...commonRotationOptions
    }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new SqliteTransport()
  ]
});

// Helper methods for specialized logging
logger.security = (message, meta = {}) => {
  logger.info(message, { ...meta, module: 'security' });
};

logger.ai = (message, meta = {}) => {
  logger.info(message, { ...meta, module: 'ai' });
};

export default logger;
