import { createApp } from './app.js';
import { logger } from './shared/logger.js';
import { startDeploymentWorker, stopDeploymentWorker } from './modules/deployment/deployment.worker.js';

const PORT = parseInt(process.env.PORT ?? '4000', 10);

const app = createApp();

const server = app.listen(PORT, () => {
  logger.info(`Server running on http://localhost:${PORT}`);
  logger.info(`Health check: http://localhost:${PORT}/health`);
  startDeploymentWorker();
});

const shutdown = (signal: string): void => {
  logger.info({ signal }, 'Shutting down...');
  stopDeploymentWorker();
  server.close(() => process.exit(0));
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default app;
