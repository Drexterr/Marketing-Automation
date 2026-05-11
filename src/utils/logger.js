import winston from 'winston';
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

export const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: path.join(logDir, 'automation.log') }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new SqliteTransport()
  ]
});

export default logger;
