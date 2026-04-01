import { Router, type Request, type Response, type Router as RouterType } from "express";
import { IbgeCollector, mapToOdsIndicators as mapIbgeOds } from "../agents/ibge/index.js";
import { SiconfiCollector, mapToOdsIndicators as mapSiconfiOds } from "../agents/siconfi/index.js";
import { DatasusCollector, mapToOdsIndicators as mapDatasusOds } from "../agents/datasus/index.js";
import { InepCollector, mapToOdsIndicators as mapInepOds } from "../agents/inep/index.js";
import { SnisCollector, mapToOdsIndicators as mapSnisOds } from "../agents/snis/index.js";
import { logger } from "../utils/logger.js";
import { batchLimiter } from "../middleware/rate-limit.js";

const router: RouterType = Router();
const ibgeCollector = new IbgeCollector();
const siconfiCollector = new SiconfiCollector();
const datasusCollector = new DatasusCollector();
const inepCollector = new InepCollector();
const snisCollector = new SnisCollector();

// ─── Validação compartilhada ────────────────────────────────────────────────

function validateIbgeCode(ibgeCode: string | undefined): string | null {
  if (!ibgeCode || !/^\d{7}$/.test(ibgeCode)) return null;
  return ibgeCode;
}

function validateBatchBody(body: unknown): string[] | null {
  const { ibgeCodes } = body as { ibgeCodes?: unknown[] };
  if (!Array.isArray(ibgeCodes) || ibgeCodes.length === 0) return null;
  if (ibgeCodes.length > 50) return null;
  const valid = ibgeCodes.filter(
    (code): code is string => typeof code === "string" && /^\d{7}$/.test(code),
  );
  if (valid.length === 0) return null;
  return valid;
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

router.post("/ibge/batch", batchLimiter, async (req: Request, res: Response) => {
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

router.post("/siconfi/batch", batchLimiter, async (req: Request, res: Response) => {
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

// ─── DATASUS Routes ────────────────────────────────────────────────────────

router.get("/datasus/:ibgeCode", async (req: Request, res: Response) => {
  const ibgeCode = validateIbgeCode(req.params["ibgeCode"]);
  if (!ibgeCode) {
    res.status(400).json({ error: "ibgeCode deve ter 7 dígitos numéricos" });
    return;
  }

  try {
    const data = await datasusCollector.collect(ibgeCode);
    if (!data) {
      res.status(404).json({ error: `Dados DATASUS não encontrados para ${ibgeCode}` });
      return;
    }
    res.json({
      municipality: ibgeCode,
      source: "datasus",
      referenceYear: data.referenceYear,
      indicators: data.indicators,
      ods: mapDatasusOds(data),
    });
  } catch (error) {
    logger.error("Error in DATASUS agent route", {
      ibgeCode,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: "Erro interno ao coletar dados DATASUS" });
  }
});

// ─── INEP Routes ─────────────────────────────────────────────────────────────

router.get("/inep/:ibgeCode", async (req: Request, res: Response) => {
  const ibgeCode = validateIbgeCode(req.params["ibgeCode"]);
  if (!ibgeCode) {
    res.status(400).json({ error: "ibgeCode deve ter 7 dígitos numéricos" });
    return;
  }

  try {
    const data = await inepCollector.collect(ibgeCode);
    if (!data) {
      res.status(404).json({ error: `Dados INEP não encontrados para ${ibgeCode}` });
      return;
    }
    res.json({
      municipality: ibgeCode,
      source: "inep",
      referenceYear: data.referenceYear,
      indicators: data.indicators,
      ods: mapInepOds(data),
    });
  } catch (error) {
    logger.error("Error in INEP agent route", {
      ibgeCode,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: "Erro interno ao coletar dados INEP" });
  }
});

// ─── SNIS Routes ─────────────────────────────────────────────────────────────

router.get("/snis/:ibgeCode", async (req: Request, res: Response) => {
  const ibgeCode = validateIbgeCode(req.params["ibgeCode"]);
  if (!ibgeCode) {
    res.status(400).json({ error: "ibgeCode deve ter 7 dígitos numéricos" });
    return;
  }

  try {
    const data = await snisCollector.collect(ibgeCode);
    if (!data) {
      res.status(404).json({ error: `Dados SNIS não encontrados para ${ibgeCode}` });
      return;
    }
    res.json({
      municipality: ibgeCode,
      source: "snis",
      referenceYear: data.referenceYear,
      indicators: data.indicators,
      ods: mapSnisOds(data),
    });
  } catch (error) {
    logger.error("Error in SNIS agent route", {
      ibgeCode,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: "Erro interno ao coletar dados SNIS" });
  }
});

export default router;
