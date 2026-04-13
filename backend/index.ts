import express, { type Express } from "express";
import compression from "compression";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";
import swaggerUi from "swagger-ui-express";
import agentsRouter from "./routes/agents.js";
import municipalitiesRouter from "./routes/municipalities.js";
import odsRouter from "./routes/ods.js";
import authRouter from "./routes/auth.js";
import simulatorRouter from "./routes/simulator.js";
import reportsRouter from "./routes/reports.js";
import benchmarksRouter from "./routes/benchmarks.js";
import recommendationsRouter from "./routes/recommendations.js";
import graphRouter from "./routes/graph.js";
import ingestionRouter from "./routes/ingestion.js";
import {
  startIngestionScheduler,
  stopIngestionScheduler,
} from "./services/ingestion/ingestion_scheduler.js";
import { generalLimiter } from "./middleware/rate-limit.js";
import { authenticateToken } from "./middleware/auth.js";
import { globalErrorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { requestIdMiddleware } from "./middleware/request-id.js";
import { requestLoggerMiddleware } from "./middleware/request-logger.js";
import { logger } from "./utils/logger.js";
import { env } from "./utils/env-validator.js";
import { registry, webVitals, frontendApiDuration, normalizeRoute } from "./utils/metrics.js";
import { getRedisClient } from "./utils/cache.js";
import { prisma } from "./lib/prisma.js";
import { swaggerSpec } from "./docs/swagger.js";

const app: Express = express();
const PORT = env.PORT;

// ─── Middlewares globais ──────────────────────────────────────────────────────

// Request ID deve ser o primeiro para garantir rastreabilidade em todos os logs
app.use(requestIdMiddleware);
app.use(requestLoggerMiddleware);

// Compressão gzip — reduz payload ~70-80% em respostas JSON grandes (ex: 17 ODS)
app.use(compression());

const isDev = env.NODE_ENV === "development";

// Em desenvolvimento o Vite HMR requer 'unsafe-inline' e 'unsafe-eval' em scripts
// e WebSocket para hot reload. Em produção a CSP é estrita.
const scriptSrc: string[] = isDev ? ["'self'", "'unsafe-inline'", "'unsafe-eval'"] : ["'self'"];

const connectSrc: string[] = isDev
  ? ["'self'", "ws://localhost:*", "http://localhost:*"]
  : ["'self'"];

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc,
        styleSrc: ["'self'", "'unsafe-inline'"], // Tailwind injeta estilos inline em dev e prod
        imgSrc: ["'self'", "data:", "https:"],
        fontSrc: ["'self'"],
        connectSrc,
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
    hsts: {
      maxAge: 31_536_000, // 1 ano em segundos
      includeSubDomains: true,
      preload: true,
    },
    noSniff: true, // X-Content-Type-Options: nosniff
    frameguard: { action: "deny" }, // X-Frame-Options: DENY
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    permittedCrossDomainPolicies: false,
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: { policy: "same-origin" },
    crossOriginResourcePolicy: { policy: "same-origin" },
  }),
);

// Permissions-Policy não é suportado nativamente pelo helmet — adiciona manualmente
app.use((_req, res, next) => {
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});

app.use(
  cors({
    origin: env.ALLOWED_ORIGINS.split(",").map((o) => o.trim()),
    credentials: true,
  }),
);
app.use(generalLimiter);
app.use(cookieParser());
app.use(express.json({ limit: "10kb" }));

// ─── Rotas ────────────────────────────────────────────────────────────────────

app.get("/health", async (_req, res) => {
  const checks = await Promise.allSettled([
    prisma.$queryRaw`SELECT 1`,
    getRedisClient().then((c) => c.ping()),
  ]);

  const db = checks[0].status === "fulfilled" ? "ok" : "degraded";
  const redis = checks[1].status === "fulfilled" ? "ok" : "degraded";
  const overall = db === "ok" && redis === "ok" ? "ok" : "degraded";
  const mem = process.memoryUsage();

  res.status(overall === "ok" ? 200 : 503).json({
    status: overall,
    service: "ioc-esg-municipal",
    checks: { db, redis },
    memory: {
      heapUsedMb: Math.round(mem.heapUsed / 1_048_576),
      rssMb: Math.round(mem.rss / 1_048_576),
    },
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.get("/metrics", async (_req, res) => {
  res.set("Content-Type", registry.contentType);
  res.end(await registry.metrics());
});

// Documentação interativa (sem auth)
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Telemetria frontend — público, sem auth (beacon API não envia cookies)
app.post("/api/telemetry", (req, res) => {
  const body = req.body as {
    events?: Array<{ type: string; name: string; value: number; page?: string }>;
  };
  if (Array.isArray(body?.events)) {
    for (const evt of body.events) {
      if (evt.type === "web-vital" && evt.name && typeof evt.value === "number") {
        webVitals.set({ metric: evt.name, page: evt.page ?? "unknown" }, evt.value);
      } else if (evt.type === "api-timing" && evt.name && typeof evt.value === "number") {
        // name format: "200 /api/ods/4205407" → extract status and path
        const match = evt.name.match(/^(\d{3})\s+(.+)$/);
        if (match) {
          frontendApiDuration.observe(
            { path: normalizeRoute(match[2]), status_code: match[1] },
            evt.value,
          );
        }
      }
    }
    logger.debug("[telemetry] frontend batch", { count: body.events.length });
  }
  res.status(204).end();
});

// Rotas públicas
app.use("/api/auth", authRouter);

// Rotas protegidas — requerem JWT válido
app.use("/api/agents", authenticateToken, agentsRouter);
app.use("/api/municipalities", authenticateToken, municipalitiesRouter);
app.use("/api/ods", authenticateToken, odsRouter);
app.use("/api/simulator", authenticateToken, simulatorRouter);
app.use("/api/reports", authenticateToken, reportsRouter);
app.use("/api/benchmarks", authenticateToken, benchmarksRouter);
app.use("/api/recommendations", authenticateToken, recommendationsRouter);
app.use("/api/graph", authenticateToken, graphRouter);
app.use("/api/ingestion", authenticateToken, ingestionRouter);

// ─── Frontend estático (SPA) ──────────────────────────────────────────────────
// Serve frontend/dist quando compilado (Docker ou pnpm build + pnpm start).
// Em dev local com `pnpm dev`, o Vite roda na porta 5173 e faz proxy para /api.
// Deve vir DEPOIS de todas as rotas de API para não interceptá-las.

{
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  // dist/backend/index.js → subir dois níveis → raiz do projeto → frontend/dist
  const frontendDist = path.resolve(__dirname, "../../frontend/dist");

  app.use(
    express.static(frontendDist, {
      // Arquivos com hash no nome (ex: assets/index-abc123.js) ficam em cache 1 ano
      setHeaders(res, filePath) {
        if (/\.(js|css|woff2?|ttf|eot|svg|png|jpg|webp)$/.test(filePath)) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        }
      },
    }),
  );

  // SPA fallback: qualquer rota não-API serve o index.html
  // para que o React Router trate o roteamento no cliente.
  app.get("*", (req, res, next) => {
    // Não interceptar rotas de API nem health check
    if (req.path.startsWith("/api") || req.path === "/health" || req.path === "/metrics") {
      return next();
    }
    res.sendFile(path.join(frontendDist, "index.html"), (err) => {
      if (err) next(); // Se index.html não existir (dev local), segue para 404 handler
    });
  });
}

// ─── Error handlers (ordem importa: 404 antes do error handler global) ────────

app.use(notFoundHandler);
app.use(globalErrorHandler);

// ─── Start ────────────────────────────────────────────────────────────────────

const server = app.listen(PORT, () => {
  logger.info(`IOC ESG Municipal API running on port ${PORT}`);

  // Inicializar scheduler de ingestão (após servidor ouvindo)
  startIngestionScheduler().catch((err) => {
    logger.error("[startup] failed to start ingestion scheduler", {
      error: err instanceof Error ? err.message : String(err),
    });
  });
});

// ─── Graceful shutdown ────────────────────────────────────────────────────────

function gracefulShutdown(signal: string): void {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  stopIngestionScheduler();

  server.close(() => {
    logger.info("HTTP server closed");
    prisma
      .$disconnect()
      .then(() => {
        logger.info("Database disconnected");
        process.exit(0);
      })
      .catch(() => {
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
