import express from "express";
import cors from "cors";
import helmet from "helmet";
import { createRouter } from "./modules/infrastructure/http/router.js";
import { mountSwaggerUi } from "./shared/swagger-ui.js";
import { errorHandler } from "./shared/middleware/error-handler.js";
import { notFoundHandler } from "./shared/middleware/not-found.js";
import { logger } from "./shared/logger.js";

const app = express();
const PORT = parseInt(process.env.PORT ?? "4000", 10);

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN ?? "http://localhost:7007" }));
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "kubernal-api", version: "0.1.0", timestamp: new Date().toISOString() });
});

const apiRouter = createRouter();
mountSwaggerUi(apiRouter);
app.use("/api/v1", apiRouter);

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`Server running on http://localhost:${PORT}`);
  logger.info(`Health check: http://localhost:${PORT}/health`);
});

export default app;
