/**
 * Factory para criação do app Express de integração.
 *
 * Monta exatamente o mesmo stack de middleware e rotas que backend/index.ts,
 * mas sem app.listen() e sem os handlers process.on('uncaughtException' | 'unhandledRejection').
 * Isso permite importar o app nos testes sem efeitos colaterais de processo.
 *
 * Uso: chame createTestApp() dentro de beforeAll() após configurar os vi.mock()
 * necessários para o cenário de teste.
 */

import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";

export async function createTestApp(): Promise<Express> {
  const app: Express = express();

  // ── Middlewares globais (mesma ordem de backend/index.ts) ──────────────────
  app.use(helmet());
  app.use(
    cors({
      origin: ["http://localhost:5173"],
      credentials: true,
    }),
  );

  // Importa o limiter já mockado (vi.mock de express-rate-limit aplica-se aqui)
  const { generalLimiter } = await import("../../../backend/middleware/rate-limit.js");
  app.use(generalLimiter);
  app.use(express.json({ limit: "10kb" }));

  // ── Health endpoint ─────────────────────────────────────────────────────────
  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      service: "ioc-esg-municipal",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  // ── Rotas (importação dinâmica — respeita os vi.mock do teste) ────────────
  const [
    { default: authRouter },
    { default: agentsRouter },
    { default: municipalitiesRouter },
    { default: odsRouter },
    { default: simulatorRouter },
    { default: reportsRouter },
    { default: benchmarksRouter },
    { authenticateToken },
    { globalErrorHandler, notFoundHandler },
  ] = await Promise.all([
    import("../../../backend/routes/auth.js"),
    import("../../../backend/routes/agents.js"),
    import("../../../backend/routes/municipalities.js"),
    import("../../../backend/routes/ods.js"),
    import("../../../backend/routes/simulator.js"),
    import("../../../backend/routes/reports.js"),
    import("../../../backend/routes/benchmarks.js"),
    import("../../../backend/middleware/auth.js"),
    import("../../../backend/middleware/error-handler.js"),
  ]);

  // Rotas públicas
  app.use("/api/auth", authRouter);

  // Rotas protegidas
  app.use("/api/agents", authenticateToken, agentsRouter);
  app.use("/api/municipalities", authenticateToken, municipalitiesRouter);
  app.use("/api/ods", authenticateToken, odsRouter);
  app.use("/api/simulator", authenticateToken, simulatorRouter);
  app.use("/api/reports", authenticateToken, reportsRouter);
  app.use("/api/benchmarks", authenticateToken, benchmarksRouter);

  // Error handlers
  app.use(notFoundHandler);
  app.use(globalErrorHandler);

  return app;
}
