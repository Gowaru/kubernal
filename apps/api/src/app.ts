import express from "express";
import cors from "cors";
import helmet from "helmet";
import { createRouter } from "./modules/infrastructure/http/router.js";
import { mountSwaggerUi } from "./shared/swagger-ui.js";
import { errorHandler } from "./shared/middleware/error-handler.js";
import { notFoundHandler } from "./shared/middleware/not-found.js";
import { trackRequest, getMetrics } from "./shared/metrics.js";

export function createApp() {
  const app = express();

  app.use(helmet());
  const corsOrigins = (process.env.CORS_ORIGIN ?? "http://localhost:5173,http://localhost:7007").split(",");
  app.use(cors({ origin: corsOrigins }));
  app.use(express.json({ limit: "1mb" }));

  app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      trackRequest(req.method, req.route?.path ?? req.path, res.statusCode, Date.now() - start);
    });
    next();
  });

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "kubernal-api", version: "0.1.0", timestamp: new Date().toISOString() });
  });

  app.get("/metrics", async (_req, res) => {
    res.set("Content-Type", "text/plain");
    res.send(await getMetrics());
  });

  const apiRouter = createRouter();
  mountSwaggerUi(apiRouter);
  app.use("/api/v1", apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
