import winston from "winston";
import fs from "fs";
import path from "path";

const logsDir = path.join(process.cwd(), "logs");
fs.mkdirSync(logsDir, { recursive: true });

export const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.printf(
      ({ timestamp, level, message }) =>
        `${timestamp} [${level.toUpperCase()}] ${message}`
    )
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ level, message }) => `${level}: ${message}`)
      ),
    }),
    new winston.transports.File({
      filename: path.join(logsDir, "automation.log"),
    }),
  ],
});
