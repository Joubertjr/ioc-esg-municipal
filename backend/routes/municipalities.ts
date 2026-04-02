/**
 * backend/routes/municipalities.ts
 *
 * Rotas REST para consulta de municípios de SC.
 *
 * GET /api/municipalities        — lista todos, ordenados por nome
 * GET /api/municipalities/:ibgeCode — detalhe de um município
 */

import { Router, type Request, type Response, type Router as RouterType } from "express";
import { PrismaClient } from "@prisma/client";
import { z, ZodError } from "zod";
import { logger } from "../utils/logger.js";

const router: RouterType = Router();
const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Schemas de validação
// ---------------------------------------------------------------------------

const IbgeCodeSchema = z
  .string()
  .regex(/^\d{7}$/, "ibgeCode deve ter exatamente 7 dígitos numéricos");

// ---------------------------------------------------------------------------
// GET /api/municipalities
// ---------------------------------------------------------------------------

/**
 * Retorna todos os municípios ordenados por nome.
 * Campos: ibgeCode, name, state, population.
 */
router.get("/", async (_req: Request, res: Response) => {
  logger.info("GET /api/municipalities");

  try {
    const municipalities = await prisma.municipality.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
      select: {
        ibgeCode: true,
        name: true,
        state: true,
        population: true,
      },
    });

    logger.info("GET /api/municipalities — ok", { count: municipalities.length });

    res.json({ data: municipalities, total: municipalities.length });
  } catch (err) {
    logger.error("GET /api/municipalities — erro ao consultar banco", {
      error: err instanceof Error ? err.message : String(err),
    });
    res.status(500).json({ error: "Erro interno ao listar municípios" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/municipalities/:ibgeCode
// ---------------------------------------------------------------------------

/**
 * Retorna um município pelo código IBGE de 7 dígitos.
 */
router.get("/:ibgeCode", async (req: Request, res: Response) => {
  const rawCode = req.params["ibgeCode"];

  const parsed = IbgeCodeSchema.safeParse(rawCode);
  if (!parsed.success) {
    const message = parsed.error.errors[0]?.message ?? "ibgeCode inválido";
    res.status(400).json({ error: message });
    return;
  }

  const ibgeCode = parsed.data;

  logger.info("GET /api/municipalities/:ibgeCode", { ibgeCode });

  try {
    const municipality = await prisma.municipality.findFirst({
      where: { ibgeCode, deletedAt: null },
      select: {
        ibgeCode: true,
        siconfiCode: true,
        name: true,
        state: true,
        population: true,
        fpmAnnual: true,
      },
    });

    if (!municipality) {
      res.status(404).json({ error: `Município ${ibgeCode} não encontrado` });
      return;
    }

    logger.info("GET /api/municipalities/:ibgeCode — ok", { ibgeCode, name: municipality.name });

    res.json({ data: municipality });
  } catch (err) {
    if (err instanceof ZodError) {
      res.status(400).json({ error: "Parâmetro inválido", details: err.flatten().fieldErrors });
      return;
    }

    logger.error("GET /api/municipalities/:ibgeCode — erro ao consultar banco", {
      ibgeCode,
      error: err instanceof Error ? err.message : String(err),
    });
    res.status(500).json({ error: "Erro interno ao buscar município" });
  }
});

export default router;
