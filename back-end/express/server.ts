import { Server } from 'http';
import { app } from './app';
import { config } from './config/index';
import { logger, logDirectory } from './utils/logger';

/**
 * Server Startup and Lifecycle Entry Point
 *
 * Responsibilities:
 * - Boot the HTTP server on the configured port.
 * - Print the startup banner.
 * - Handle SIGINT and SIGTERM so the process shuts down cleanly and the file
 *   log transports get a chance to flush.
 *
 * No routes and no middleware are defined here; that all lives in app.ts.
 */
export function startServer(): Server {
  const server = app.listen(config.port, () => {
    const base = `http://localhost:${config.port}`;
    [
      '----------------------------------------------------',
      `BillBhai Express Backend : ${base}`,
      `API root                 : ${base}${config.apiPrefix}`,
      `Swagger docs             : ${base}${config.apiPrefix}/docs`,
      `Health check             : ${base}/health`,
      `Uploaded files           : ${base}/uploads`,
      `Log files                : ${logDirectory}`,
      `Environment              : ${config.nodeEnv}`,
      `Allowed CORS origins     : ${config.cors.origins.join(', ')}`,
      '----------------------------------------------------',
    ].forEach((line) => logger.info(line));
  });

  const shutdown = (signal: string): void => {
    logger.info(`Received ${signal}. Shutting down gracefully.`);

    server.close(() => {
      logger.info('HTTP server closed.');
      process.exit(0);
    });

    setTimeout(() => {
      logger.error('Could not close connections in time. Forcing shutdown.');
      process.exit(1);
    }, 5000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  return server;
}

if (!config.isTest) {
  startServer();
}
