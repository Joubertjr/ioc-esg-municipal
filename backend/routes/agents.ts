import { Router, type Request, type Response, type Router as RouterType } from "express";
import { IbgeCollector, mapToOdsIndicators as mapIbgeOds } from "../agents/ibge/index.js";
import { SiconfiCollector, mapToOdsIndicators as mapSiconfiOds } from "../agents/siconfi/index.js";
import { logger } from "../utils/logger.js";

const router: RouterType = Router();
const ibgeCollector = new IbgeCollector();
const siconfiCollector = new SiconfiCollector();

// ─── Validação compartilhada ────────────────────────────────────────────────

function validateIbgeCode(ibgeCode: string | undefined): string | null {
  if (!ibgeCode || !/^\d{7}$/.test(ibgeCode)) return null;
  return ibgeCode;
}

function validateBatchBody(body: unknown): string[] | null {
  const { ibgeCodes } = body as { ibgeCodes?: string[] };
  if (!Array.isArray(ibgeCodes) || ibgeCodes.length === 0) return null;
  if (ibgeCodes.length > 50) return null;
  return ibgeCodes;
}

// ─── IBGE Routes ────────────────────────────────────────────────────────────

router.get("/ibge/:ibgeCode", async (req: Request, res: Response) => {
  const ibgeCode = validateIbgeCode(req.params["ibgeCode"]);
  if (!ibgeCode) {
    res.status(400).json({ error: "ibgeCode deve ter 7 dígitos numéricos" });
    return;
  }

  try {
    const data = await ibgeCollector.collect(ibgeCode);
    if (!data) {
      res.status(404).json({ error: `Dados IBGE não encontrados para ${ibgeCode}` });
      return;
    }
    res.json({
      municipality: ibgeCode,
      source: "ibge",
      referenceYear: data.referenceYear,
      indicators: data.indicators,
      ods: mapIbgeOds(data),
    });
  } catch (error) {
    logger.error("Error in IBGE agent route", {
      ibgeCode,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: "Erro interno ao coletar dados IBGE" });
  }
});

router.post("/ibge/batch", async (req: Request, res: Response) => {
  const ibgeCodes = validateBatchBody(req.body);
  if (!ibgeCodes) {
    res.status(400).json({ error: "ibgeCodes deve ser array não vazio (máx 50)" });
    return;
  }

  try {
    const results = await ibgeCollector.collectBatch(ibgeCodes);
    const response: Record<string, unknown> = {};
    for (const [code, data] of results) {
      response[code] = {
        referenceYear: data.referenceYear,
        indicators: data.indicators,
        ods: mapIbgeOds(data),
      };
    }
    res.json({ total: ibgeCodes.length, found: results.size, data: response });
  } catch (error) {
    logger.error("Error in IBGE batch route", {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: "Erro interno no batch IBGE" });
  }
});

// ─── SICONFI Routes ─────────────────────────────────────────────────────────

router.get("/siconfi/:ibgeCode", async (req: Request, res: Response) => {
  const ibgeCode = validateIbgeCode(req.params["ibgeCode"]);
  if (!ibgeCode) {
    res.status(400).json({ error: "ibgeCode deve ter 7 dígitos numéricos" });
    return;
  }

  try {
    const data = await siconfiCollector.collect(ibgeCode);
    if (!data) {
      res.status(404).json({ error: `Dados SICONFI não encontrados para ${ibgeCode}` });
      return;
    }
    res.json({
      municipality: ibgeCode,
      source: "siconfi",
      referenceYear: data.referenceYear,
      indicators: data.indicators,
      ods: mapSiconfiOds(data),
    });
  } catch (error) {
    logger.error("Error in SICONFI agent route", {
      ibgeCode,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: "Erro interno ao coletar dados SICONFI" });
  }
});

router.post("/siconfi/batch", async (req: Request, res: Response) => {
  const ibgeCodes = validateBatchBody(req.body);
  if (!ibgeCodes) {
    res.status(400).json({ error: "ibgeCodes deve ser array não vazio (máx 50)" });
    return;
  }

  try {
    const results = await siconfiCollector.collectBatch(ibgeCodes);
    const response: Record<string, unknown> = {};
    for (const [code, data] of results) {
      response[code] = {
        referenceYear: data.referenceYear,
        indicators: data.indicators,
        ods: mapSiconfiOds(data),
      };
    }
    res.json({ total: ibgeCodes.length, found: results.size, data: response });
  } catch (error) {
    logger.error("Error in SICONFI batch route", {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: "Erro interno no batch SICONFI" });
  }
});

export default router;
