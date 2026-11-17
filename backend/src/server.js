import { app } from './app.js';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { prisma } from './lib/prisma.js';

const server = app.listen(env.PORT, () => {
  logger.info(`Nexora API server started on port ${env.PORT} in ${env.NODE_ENV} mode`);
});

const gracefulShutdown = async (signal) => {
  logger.info(`Received ${signal}, shutting down gracefully...`);
  server.close(async () => {
    logger.info('HTTP server closed');
    try {
      await prisma.$disconnect();
      logger.info('Prisma disconnected');
      process.exit(0);
    } catch (err) {
      logger.error({ err }, 'Error during Prisma disconnect');
      process.exit(1);
    }
  });

  // Force close after 10s if graceful shutdown hangs
  setTimeout(() => {
    logger.error('Forceful shutdown after timeout');
    process.exit(1);
  }, 10000).unref();
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.fatal({ err: reason }, 'Unhandled Rejection detected');
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught Exception detected');
  process.exit(1);
});
