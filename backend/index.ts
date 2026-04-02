import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import agentsRouter from "./routes/agents.js";
import municipalitiesRouter from "./routes/municipalities.js";
import odsRouter from "./routes/ods.js";
import authRouter from "./routes/auth.js";
import simulatorRouter from "./routes/simulator.js";
import { generalLimiter } from "./middleware/rate-limit.js";
import { authenticateToken } from "./middleware/auth.js";
import { globalErrorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { logger } from "./utils/logger.js";

dotenv.config();

const app: Express = express();
const PORT = Number(process.env["PORT"] ?? 3000);

// ─── Middlewares globais ──────────────────────────────────────────────────────

app.use(helmet());
app.use(
  cors({
    origin: process.env["ALLOWED_ORIGINS"]?.split(",") ?? ["http://localhost:5173"],
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

// Rotas públicas
app.use("/api/auth", authRouter);

// Rotas protegidas — requerem JWT válido
app.use("/api/agents", authenticateToken, agentsRouter);
app.use("/api/municipalities", authenticateToken, municipalitiesRouter);
app.use("/api/ods", authenticateToken, odsRouter);
app.use("/api/simulator", authenticateToken, simulatorRouter);

// ─── Error handlers (ordem importa: 404 antes do error handler global) ────────

app.use(notFoundHandler);
app.use(globalErrorHandler);

// ─── Process handlers — erros não capturados ─────────────────────────────────

process.on("uncaughtException", (err: Error) => {
  logger.error("[process] uncaughtException — iniciando graceful shutdown", {
    message: err.message,
    stack: err.stack,
  });
  // Graceful shutdown: encerra o processo após flush dos logs (exit code 1)
  process.exit(1);
});

process.on("unhandledRejection", (reason: unknown) => {
  const message = reason instanceof Error ? reason.message : String(reason);
  const stack = reason instanceof Error ? reason.stack : undefined;
  logger.warn("[process] unhandledRejection — promise rejeitada sem handler", {
    message,
    ...(stack ? { stack } : {}),
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  logger.info(`IOC ESG Municipal API running on port ${PORT}`);
});

export default app;
