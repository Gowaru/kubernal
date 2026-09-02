import 'dotenv/config';
import { createApp } from './app.js';
import { createWsExecServer } from './shared/ws-exec-server.js';
import { createWsLogServer } from './shared/ws-log-server.js';
import { disconnectDatabase } from './shared/database.js';
import { logger } from './shared/logger.js';
import { Pool } from 'pg';
import {
  startDeploymentWorker,
  stopDeploymentWorker,
} from './modules/deployment/deployment.worker.js';

const PORT = parseInt(process.env.PORT ?? '4000', 10);

const app = createApp();

const server = app.listen(PORT, () => {
  logger.info(`Server running on http://localhost:${PORT}`);
  logger.info(`Health check: http://localhost:${PORT}/health`);
  startDeploymentWorker();
});

const wsExecServer = createWsExecServer(server);
const wsLogServer = createWsLogServer(server);

const shutdown = async (signal: string): Promise<void> => {
  logger.info({ signal }, 'Shutting down...');

  stopDeploymentWorker();
  (globalThis as { __pipelineWorker?: { stop: () => void } }).__pipelineWorker?.stop();
  wsExecServer.close();
  wsLogServer.close();

  const forceExit = setTimeout(() => {
    logger.error('Forced exit after shutdown timeout');
    process.exit(1);
  }, 5000);

  server.close(async () => {
    clearTimeout(forceExit);
    try {
      await disconnectDatabase();
      const pgPool = (globalThis as { __sessionPgPool?: Pool }).__sessionPgPool;
      if (pgPool) await pgPool.end();
    } catch (err) {
      logger.error({ err }, 'Error during database disconnect');
    }
    process.exit(0);
  });
};

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});
process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

export default app;
