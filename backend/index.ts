import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";
import agentsRouter from "./routes/agents.js";
import municipalitiesRouter from "./routes/municipalities.js";
import odsRouter from "./routes/ods.js";
import authRouter from "./routes/auth.js";
import simulatorRouter from "./routes/simulator.js";
import reportsRouter from "./routes/reports.js";
import benchmarksRouter from "./routes/benchmarks.js";
import { generalLimiter } from "./middleware/rate-limit.js";
import { authenticateToken } from "./middleware/auth.js";
import { globalErrorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { logger } from "./utils/logger.js";
import { env } from "./utils/env-validator.js";
import { prisma } from "./lib/prisma.js";
import { swaggerSpec } from "./docs/swagger.js";

const app: Express = express();
const PORT = env.PORT;

// ─── Middlewares globais ──────────────────────────────────────────────────────

app.use(helmet());
app.use(
  cors({
    origin: env.ALLOWED_ORIGINS.split(",").map((o) => o.trim()),
    credentials: true,
  }),
);
app.use(generalLimiter);
app.use(express.json({ limit: "10kb" }));

// ─── Rotas ────────────────────────────────────────────────────────────────────

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "ioc-esg-municipal",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Documentação interativa (sem auth)
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Rotas públicas
app.use("/api/auth", authRouter);

// Rotas protegidas — requerem JWT válido
app.use("/api/agents", authenticateToken, agentsRouter);
app.use("/api/municipalities", authenticateToken, municipalitiesRouter);
app.use("/api/ods", authenticateToken, odsRouter);
app.use("/api/simulator", authenticateToken, simulatorRouter);
app.use("/api/reports", authenticateToken, reportsRouter);
app.use("/api/benchmarks", authenticateToken, benchmarksRouter);

// ─── Error handlers (ordem importa: 404 antes do error handler global) ────────

app.use(notFoundHandler);
app.use(globalErrorHandler);

// ─── Start ────────────────────────────────────────────────────────────────────

const server = app.listen(PORT, () => {
  logger.info(`IOC ESG Municipal API running on port ${PORT}`);
});

// ─── Graceful shutdown ────────────────────────────────────────────────────────

function gracefulShutdown(signal: string): void {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  server.close(() => {
    logger.info("HTTP server closed");
    prisma.$disconnect().then(() => {
      logger.info("Database disconnected");
      process.exit(0);
    }).catch(() => {
      process.exit(1);
    });
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    logger.error("Graceful shutdown timed out, forcing exit");
    process.exit(1);
  }, 10000);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// ─── Process handlers — erros não capturados ─────────────────────────────────

process.on("uncaughtException", (err: Error) => {
  logger.error("[process] uncaughtException — iniciando graceful shutdown", {
    message: err.message,
    stack: err.stack,
  });
  gracefulShutdown("uncaughtException");
});

process.on("unhandledRejection", (reason: unknown) => {
  const message = reason instanceof Error ? reason.message : String(reason);
  const stack = reason instanceof Error ? reason.stack : undefined;
  logger.warn("[process] unhandledRejection — promise rejeitada sem handler", {
    message,
    ...(stack ? { stack } : {}),
  });
});

export default app;
