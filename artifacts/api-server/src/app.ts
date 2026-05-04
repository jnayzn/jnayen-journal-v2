import cors from "cors";
import type { ErrorRequestHandler } from "express";
import express from "express";
import pinoHttp from "pino-http";
import { logger } from "./lib/logger";
import { buildRouter } from "./routes/index";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(
    cors({
      origin: true,
      credentials: false,
      allowedHeaders: ["Authorization", "Content-Type"],
    }),
  );
  app.use(express.json({ limit: "5mb" }));
  app.use(pinoHttp({ logger }));

  app.use("/api", buildRouter());

  app.use((req, res) => {
    res.status(404).json({ error: "Not found", path: req.path });
  });

  const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
    logger.error({ err }, "request failed");
    res.status(500).json({ error: "Internal server error" });
  };
  app.use(errorHandler);
  return app;
}
