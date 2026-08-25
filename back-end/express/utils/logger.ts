import path from 'path';
import fs from 'fs';
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { config } from '../config/index';

/**
 * Application Logger (winston + winston-daily-rotate-file)
 *
 * Satisfies the "Log and Error Management" requirement: log and error
 * information is persisted to files and rotated at regular intervals
 * (daily, with size-based rollover and automatic retention).
 *
 * Files produced under `back-end/logs/`:
 *   application-YYYY-MM-DD.log  - every request and application event
 *   error-YYYY-MM-DD.log        - warnings and errors only (4xx, 5xx, RBAC
 *                                 denials, rate-limit trips)
 *   exceptions-YYYY-MM-DD.log   - uncaught exceptions
 *   rejections-YYYY-MM-DD.log   - unhandled promise rejections
 */

const logDir = path.isAbsolute(config.logging.dir)
  ? config.logging.dir
  : path.resolve(process.cwd(), config.logging.dir);

if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const rotationDefaults = {
  dirname: logDir,
  datePattern: config.logging.datePattern,
  zippedArchive: true,
  maxSize: config.logging.maxSize,
  maxFiles: config.logging.maxFiles,
};

/** Structured JSON for files - machine readable and easy to grep. */
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
);

/** Human readable, colourised output for the terminal during a demo. */
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf((info) => {
    const { timestamp, level, message, requestId, ...meta } = info;
    const tag = requestId ? ` [${String(requestId).slice(0, 8)}]` : '';
    const extra = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} ${level}${tag}: ${String(message)}${extra}`;
  }),
);

export const logger = winston.createLogger({
  level: config.logging.level,
  defaultMeta: { service: 'billbhai-api', env: config.nodeEnv },
  format: fileFormat,
  transports: [
    new DailyRotateFile({
      ...rotationDefaults,
      filename: 'application-%DATE%.log',
      level: 'info',
    }),
    // Captures 'warn' as well as 'error', so client errors (4xx), RBAC
    // denials and rate-limit trips all land in the problem log rather than
    // only server faults.
    new DailyRotateFile({
      ...rotationDefaults,
      filename: 'error-%DATE%.log',
      level: 'warn',
    }),
  ],
  exceptionHandlers: [
    new DailyRotateFile({ ...rotationDefaults, filename: 'exceptions-%DATE%.log' }),
  ],
  rejectionHandlers: [
    new DailyRotateFile({ ...rotationDefaults, filename: 'rejections-%DATE%.log' }),
  ],
  exitOnError: false,
});

if (!config.isProduction) {
  logger.add(new winston.transports.Console({ format: consoleFormat }));
}

/** Silence log output while jest runs so test output stays readable. */
if (config.isTest) {
  logger.transports.forEach((transport) => {
    transport.silent = true;
  });
}

/** Write-stream adapter so morgan can pipe its HTTP lines into winston. */
export const morganStream = {
  write: (message: string): void => {
    logger.info(message.trim(), { source: 'morgan' });
  },
};

export const logDirectory = logDir;
