import { createApp } from './app.js';
import { logger } from './shared/logger.js';

const PORT = parseInt(process.env.PORT ?? '4000', 10);

const app = createApp();

app.listen(PORT, () => {
  logger.info(`Server running on http://localhost:${PORT}`);
  logger.info(`Health check: http://localhost:${PORT}/health`);
});

export default app;
