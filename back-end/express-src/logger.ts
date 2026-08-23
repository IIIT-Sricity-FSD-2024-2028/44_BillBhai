'use strict';

/**
 * logger.js — BillBhai Centralised Logger
 *
 * Uses Winston with two transports:
 *   1. Console  — colourised output for development
 *   2. Daily-rotating files:
 *        logs/app-YYYY-MM-DD.log   (info + warn, retained 14 days)
 *        logs/error-YYYY-MM-DD.log (error only,  retained 30 days)
 *
 * All other modules should import this logger instead of using console.*
 * so that logs are persisted to disk "at regular intervals" (daily rotation).
 */

const { createLogger, format, transports } = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');

// ── Shared format ──────────────────────────────────────────────────────────────
const timestampFmt = format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' });

const jsonFormat = format.combine(
  timestampFmt,
  format.errors({ stack: true }),
  format.json(),
);

const consoleFormat = format.combine(
  timestampFmt,
  format.colorize(),
  format.printf(({ timestamp, level, message, stack }) => {
    return stack
      ? `${timestamp} [${level}] ${message}\n${stack}`
      : `${timestamp} [${level}] ${message}`;
  }),
);

// ── Resolve logs directory (back-end/express-src/logs/) ───────────────────────
const logsDir = path.join(__dirname, 'logs');

// ── Daily-rotating transports ─────────────────────────────────────────────────
const appFileTransport = new DailyRotateFile({
  dirname: logsDir,
  filename: 'app-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '14d',          // keep 14 days of app logs
  level: 'info',
  format: jsonFormat,
});

const errorFileTransport = new DailyRotateFile({
  dirname: logsDir,
  filename: 'error-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '30d',          // keep 30 days of error logs
  level: 'error',
  format: jsonFormat,
});

// ── Logger instance ───────────────────────────────────────────────────────────
const logger = createLogger({
  level: 'info',
  transports: [
    appFileTransport,
    errorFileTransport,
    new transports.Console({
      format: consoleFormat,
    }),
  ],
  exitOnError: false,
});

// ── Emit lifecycle events to log ──────────────────────────────────────────────
appFileTransport.on('rotate', (oldFile, newFile) => {
  logger.info(`Log rotated: ${oldFile} → ${newFile}`);
});

errorFileTransport.on('rotate', (oldFile, newFile) => {
  logger.info(`Error log rotated: ${oldFile} → ${newFile}`);
});

module.exports = logger;
