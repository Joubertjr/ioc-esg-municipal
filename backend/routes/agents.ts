import { Router, type Request, type Response, type Router as RouterType } from "express";
import { IbgeCollector, mapToOdsIndicators as mapIbgeOds } from "../agents/ibge/index.js";
import { SiconfiCollector, mapToOdsIndicators as mapSiconfiOds } from "../agents/siconfi/index.js";
import { DatasusCollector, mapToOdsIndicators as mapDatasusOds } from "../agents/datasus/index.js";
import { InepCollector, mapToOdsIndicators as mapInepOds } from "../agents/inep/index.js";
import { SnisCollector, mapToOdsIndicators as mapSnisOds } from "../agents/snis/index.js";
import { InpeCollector, mapToOdsIndicators as mapInpeOds } from "../agents/inpe/index.js";
import { PncpCollector, mapToOdsIndicators as mapPncpOds } from "../agents/pncp/index.js";
import { TseCollector, mapToOdsIndicators as mapTseOds } from "../agents/tse/index.js";
import { AneelCollector, mapToOdsIndicators as mapAneelOds } from "../agents/aneel/index.js";
import { SnisRsCollector, mapToOdsIndicators as mapSnisRsOds } from "../agents/snis_rs/index.js";
import { AnaCollector, mapToOdsIndicators as mapAnaOds } from "../agents/ana/index.js";
import {
  ConveniosCollector,
  mapToOdsIndicators as mapConveniosOds,
} from "../agents/convenios/index.js";
import { AnatelCollector, mapToOdsIndicators as mapAnatelOds } from "../agents/anatel/index.js";
import { SisvanCollector, mapToOdsIndicators as mapSisvanOds } from "../agents/sisvan/index.js";
import { logger } from "../utils/logger.js";

import { requireRole } from "../middleware/auth.js";

const router: RouterType = Router();
const ibgeCollector = new IbgeCollector();
const siconfiCollector = new SiconfiCollector();
const datasusCollector = new DatasusCollector();
const inepCollector = new InepCollector();
const snisCollector = new SnisCollector();
const inpeCollector = new InpeCollector();
const pncpCollector = new PncpCollector();
const tseCollector = new TseCollector();
const aneelCollector = new AneelCollector();
const snisRsCollector = new SnisRsCollector();
const anaCollector = new AnaCollector();
const conveniosCollector = new ConveniosCollector();
const anatelCollector = new AnatelCollector();
const sisvanCollector = new SisvanCollector();

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

router.post(
  "/ibge/batch",
  requireRole("admin", "prefeito", "secretario"),

  async (req: Request, res: Response) => {
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
  },
);

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

router.post(
  "/siconfi/batch",
  requireRole("admin", "prefeito", "secretario"),

  async (req: Request, res: Response) => {
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
  },
);

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

// ─── INPE Routes ─────────────────────────────────────────────────────────────

router.get("/inpe/:ibgeCode", async (req: Request, res: Response) => {
  const ibgeCode = validateIbgeCode(req.params["ibgeCode"]);
  if (!ibgeCode) {
    res.status(400).json({ error: "ibgeCode deve ter 7 dígitos numéricos" });
    return;
  }

  try {
    const data = await inpeCollector.collect(ibgeCode);
    if (!data) {
      res.status(404).json({ error: `Dados INPE não encontrados para ${ibgeCode}` });
      return;
    }
    res.json({
      municipality: ibgeCode,
      source: "inpe",
      referenceYear: data.referenceYear,
      indicators: data.indicators,
      ods: mapInpeOds(data),
    });
  } catch (error) {
    logger.error("Error in INPE (TerraBrasilis) agent route", {
      ibgeCode,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: "Erro interno ao coletar dados INPE" });
  }
});

// ─── PNCP Routes ──────────────────────────────────────────────────────────────

router.get("/pncp/:ibgeCode", async (req: Request, res: Response) => {
  const ibgeCode = validateIbgeCode(req.params["ibgeCode"]);
  if (!ibgeCode) {
    res.status(400).json({ error: "ibgeCode deve ter 7 dígitos numéricos" });
    return;
  }

  try {
    const data = await pncpCollector.collect(ibgeCode);
    if (!data) {
      res.status(404).json({ error: `Dados PNCP não encontrados para ${ibgeCode}` });
      return;
    }
    res.json({
      municipality: ibgeCode,
      source: "pncp",
      referenceYear: data.referenceYear,
      indicators: data.indicators,
      ods: mapPncpOds(data),
    });
  } catch (error) {
    logger.error("Error in PNCP agent route", {
      ibgeCode,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: "Erro interno ao coletar dados PNCP" });
  }
});

// ─── TSE Routes ───────────────────────────────────────────────────────────────

router.get("/tse/:ibgeCode", async (req: Request, res: Response) => {
  const ibgeCode = validateIbgeCode(req.params["ibgeCode"]);
  if (!ibgeCode) {
    res.status(400).json({ error: "ibgeCode deve ter 7 dígitos numéricos" });
    return;
  }

  try {
    const data = await tseCollector.collect(ibgeCode);
    if (!data) {
      res.status(404).json({ error: `Dados TSE não encontrados para ${ibgeCode}` });
      return;
    }
    res.json({
      municipality: ibgeCode,
      source: "tse",
      referenceYear: data.referenceYear,
      indicators: data.indicators,
      ods: mapTseOds(data),
    });
  } catch (error) {
    logger.error("Error in TSE agent route", {
      ibgeCode,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: "Erro interno ao coletar dados TSE" });
  }
});

// ─── ANEEL Routes ─────────────────────────────────────────────────────────────

router.get("/aneel/:ibgeCode", async (req: Request, res: Response) => {
  const ibgeCode = validateIbgeCode(req.params["ibgeCode"]);
  if (!ibgeCode) {
    res.status(400).json({ error: "ibgeCode deve ter 7 dígitos numéricos" });
    return;
  }

  try {
    const data = await aneelCollector.collect(ibgeCode);
    if (!data) {
      res.status(404).json({ error: `Dados ANEEL não encontrados para ${ibgeCode}` });
      return;
    }
    res.json({
      municipality: ibgeCode,
      source: "aneel",
      referenceYear: data.referenceYear,
      indicators: data.indicators,
      ods: mapAneelOds(data),
    });
  } catch (error) {
    logger.error("Error in ANEEL agent route", {
      ibgeCode,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: "Erro interno ao coletar dados ANEEL" });
  }
});

// ─── SNIS-RS Routes ───────────────────────────────────────────────────────────

router.get("/snis-rs/:ibgeCode", async (req: Request, res: Response) => {
  const ibgeCode = validateIbgeCode(req.params["ibgeCode"]);
  if (!ibgeCode) {
    res.status(400).json({ error: "ibgeCode deve ter 7 dígitos numéricos" });
    return;
  }

  try {
    const data = await snisRsCollector.collect(ibgeCode);
    if (!data) {
      res.status(404).json({ error: `Dados SNIS-RS não encontrados para ${ibgeCode}` });
      return;
    }
    res.json({
      municipality: ibgeCode,
      source: "snis-rs",
      referenceYear: data.referenceYear,
      indicators: data.indicators,
      ods: mapSnisRsOds(data),
    });
  } catch (error) {
    logger.error("Error in SNIS-RS agent route", {
      ibgeCode,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: "Erro interno ao coletar dados SNIS-RS" });
  }
});

// ─── ANA Routes ───────────────────────────────────────────────────────────────

router.get("/ana/:ibgeCode", async (req: Request, res: Response) => {
  const ibgeCode = validateIbgeCode(req.params["ibgeCode"]);
  if (!ibgeCode) {
    res.status(400).json({ error: "ibgeCode deve ter 7 dígitos numéricos" });
    return;
  }

  try {
    const data = await anaCollector.collect(ibgeCode);
    if (!data) {
      res.status(404).json({ error: `Dados ANA não encontrados para ${ibgeCode}` });
      return;
    }
    res.json({
      municipality: ibgeCode,
      source: "ana",
      referenceYear: data.referenceYear,
      indicators: data.indicators,
      ods: mapAnaOds(data),
    });
  } catch (error) {
    logger.error("Error in ANA agent route", {
      ibgeCode,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: "Erro interno ao coletar dados ANA" });
  }
});

// ─── CONVENIOS Routes ─────────────────────────────────────────────────────────

router.get("/convenios/:ibgeCode", async (req: Request, res: Response) => {
  const ibgeCode = validateIbgeCode(req.params["ibgeCode"]);
  if (!ibgeCode) {
    res.status(400).json({ error: "ibgeCode deve ter 7 dígitos numéricos" });
    return;
  }

  try {
    const data = await conveniosCollector.collect(ibgeCode);
    if (!data) {
      res.status(404).json({ error: `Dados CONVENIOS não encontrados para ${ibgeCode}` });
      return;
    }
    res.json({
      municipality: ibgeCode,
      source: "convenios",
      referenceYear: data.referenceYear,
      indicators: data.indicators,
      ods: mapConveniosOds(data),
    });
  } catch (error) {
    logger.error("Error in CONVENIOS agent route", {
      ibgeCode,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: "Erro interno ao coletar dados CONVENIOS" });
  }
});

// ─── ANATEL Routes ────────────────────────────────────────────────────────────

router.get("/anatel/:ibgeCode", async (req: Request, res: Response) => {
  const ibgeCode = validateIbgeCode(req.params["ibgeCode"]);
  if (!ibgeCode) {
    res.status(400).json({ error: "ibgeCode deve ter 7 dígitos numéricos" });
    return;
  }

  try {
    const data = await anatelCollector.collect(ibgeCode);
    if (!data) {
      res.status(404).json({ error: `Dados ANATEL não encontrados para ${ibgeCode}` });
      return;
    }
    res.json({
      municipality: ibgeCode,
      source: "anatel",
      referenceYear: data.referenceYear,
      indicators: data.indicators,
      ods: mapAnatelOds(data),
    });
  } catch (error) {
    logger.error("Error in ANATEL agent route", {
      ibgeCode,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: "Erro interno ao coletar dados ANATEL" });
  }
});

// ─── SISVAN Routes ────────────────────────────────────────────────────────────

router.get("/sisvan/:ibgeCode", async (req: Request, res: Response) => {
  const ibgeCode = validateIbgeCode(req.params["ibgeCode"]);
  if (!ibgeCode) {
    res.status(400).json({ error: "ibgeCode deve ter 7 dígitos numéricos" });
    return;
  }

  try {
    const data = await sisvanCollector.collect(ibgeCode);
    if (!data) {
      res.status(404).json({ error: `Dados SISVAN não encontrados para ${ibgeCode}` });
      return;
    }
    res.json({
      municipality: ibgeCode,
      source: "sisvan",
      referenceYear: data.referenceYear,
      indicators: data.indicators,
      ods: mapSisvanOds(data),
    });
  } catch (error) {
    logger.error("Error in SISVAN agent route", {
      ibgeCode,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: "Erro interno ao coletar dados SISVAN" });
  }
});

export default router;
