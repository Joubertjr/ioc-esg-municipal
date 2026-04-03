/**
 * backend/routes/municipalities.ts
 *
 * Rotas REST para consulta de municípios de SC.
 *
 * GET /api/municipalities        — lista todos, ordenados por nome
 * GET /api/municipalities/:ibgeCode — detalhe de um município
 */

import { Router, type Request, type Response, type Router as RouterType } from "express";
import { z, ZodError } from "zod";
import { prisma } from "../lib/prisma.js";
import { logger } from "../utils/logger.js";

const router: RouterType = Router();

// ---------------------------------------------------------------------------
// Schemas de validação
// ---------------------------------------------------------------------------

const IbgeCodeSchema = z
  .string()
  .regex(/^\d{7}$/, "ibgeCode deve ter exatamente 7 dígitos numéricos");

// ---------------------------------------------------------------------------
// GET /api/municipalities
// ---------------------------------------------------------------------------

const PageSchema = z.coerce.number().int().min(1).default(1);
const PageSizeSchema = z.coerce.number().int().min(1).max(100).default(50);

/**
 * Retorna municípios paginados, ordenados por nome.
 * Query params: page (default 1), pageSize (default 50, max 100).
 */
router.get("/", async (req: Request, res: Response) => {
  const page = PageSchema.safeParse(req.query["page"]).data ?? 1;
  const pageSize = PageSizeSchema.safeParse(req.query["pageSize"]).data ?? 50;

  logger.info("GET /api/municipalities", { page, pageSize });

  try {
    const [municipalities, total] = await prisma.$transaction([
      prisma.municipality.findMany({
        where: { deletedAt: null },
        orderBy: { name: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          ibgeCode: true,
          name: true,
          state: true,
          population: true,
        },
      }),
      prisma.municipality.count({ where: { deletedAt: null } }),
    ]);

    logger.info("GET /api/municipalities — ok", { count: municipalities.length, total });

    res.json({ data: municipalities, total, page, pageSize });
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
    const municipality = await prisma.municipality.findUnique({
      where: { ibgeCode },
      select: {
        ibgeCode: true,
        siconfiCode: true,
        name: true,
        state: true,
        population: true,
        fpmAnnual: true,
        deletedAt: true, // usado apenas para filtro, removido da resposta
      },
    });

    if (!municipality || municipality.deletedAt) {
      res.status(404).json({ error: `Município ${ibgeCode} não encontrado` });
      return;
    }

    // Remove campo interno antes de enviar ao cliente
    const { deletedAt: _, ...publicData } = municipality;

    logger.info("GET /api/municipalities/:ibgeCode — ok", { ibgeCode, name: municipality.name });

    res.json({ data: publicData });
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
