import { Server } from 'http';
import { app } from './app';
import { config } from './config/index';

/**
 * Server Startup & Lifecycle Entry Point
 *
 * Responsibilities:
 * - Boots the HTTP server on the configured port.
 * - Manages process signals (SIGINT, SIGTERM) for graceful shutdown.
 * - Logs application startup banner.
 */
function startServer(): Server {
  const server = app.listen(config.port, () => {
    console.log('----------------------------------------------------');
    console.log(
      `BillBhai Express Backend running on: http://localhost:${config.port}`,
    );
    console.log(`Environment: ${config.nodeEnv}`);
    console.log(
      `API Prefix: http://localhost:${config.port}${config.apiPrefix}`,
    );
    console.log(
      `Example endpoint: http://localhost:${config.port}${config.apiPrefix}/example`,
    );
    console.log('----------------------------------------------------');
  });

  const handleShutdown = (signal: string) => {
    console.log(
      `\nReceived ${signal}. Gracefully shutting down Express server...`,
    );
    server.close(() => {
      console.log('HTTP server closed successfully.');
      process.exit(0);
    });

    // Force shutdown if server doesn't close within 5s
    setTimeout(() => {
      console.error('Forcing server shutdown after timeout.');
      process.exit(1);
    }, 5000);
  };

  process.on('SIGINT', () => handleShutdown('SIGINT'));
  process.on('SIGTERM', () => handleShutdown('SIGTERM'));

  return server;
}

if (process.env.NODE_ENV !== 'test') {
  startServer();
}

export { startServer };
