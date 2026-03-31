import { Router, type Request, type Response, type Router as RouterType } from "express";
import { IbgeCollector, mapToOdsIndicators } from "../agents/ibge/index.js";
import { logger } from "../utils/logger.js";

const router: RouterType = Router();
const ibgeCollector = new IbgeCollector();

/**
 * GET /api/agents/ibge/:ibgeCode
 * Retorna indicadores IBGE + mapeamento ODS para um município.
 */
router.get("/ibge/:ibgeCode", async (req: Request, res: Response) => {
  const { ibgeCode } = req.params;

  if (!ibgeCode || !/^\d{7}$/.test(ibgeCode)) {
    res.status(400).json({ error: "ibgeCode deve ter 7 dígitos numéricos" });
    return;
  }

  try {
    const data = await ibgeCollector.collect(ibgeCode);

    if (!data) {
      res.status(404).json({ error: `Dados não encontrados para ${ibgeCode}` });
      return;
    }

    const odsIndicators = mapToOdsIndicators(data);

    res.json({
      municipality: ibgeCode,
      referenceYear: data.referenceYear,
      indicators: data.indicators,
      ods: odsIndicators,
    });
  } catch (error) {
    logger.error("Error in IBGE agent route", {
      ibgeCode,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: "Erro interno ao coletar dados IBGE" });
  }
});

/**
 * POST /api/agents/ibge/batch
 * Body: { ibgeCodes: string[] }
 * Retorna dados para múltiplos municípios.
 */
router.post("/ibge/batch", async (req: Request, res: Response) => {
  const { ibgeCodes } = req.body as { ibgeCodes?: string[] };

  if (!Array.isArray(ibgeCodes) || ibgeCodes.length === 0) {
    res.status(400).json({ error: "ibgeCodes deve ser array não vazio" });
    return;
  }

  if (ibgeCodes.length > 50) {
    res.status(400).json({ error: "Máximo 50 municípios por batch" });
    return;
  }

  try {
    const results = await ibgeCollector.collectBatch(ibgeCodes);
    const response: Record<string, unknown> = {};

    for (const [code, data] of results) {
      response[code] = {
        referenceYear: data.referenceYear,
        indicators: data.indicators,
        ods: mapToOdsIndicators(data),
      };
    }

    res.json({
      total: ibgeCodes.length,
      found: results.size,
      data: response,
    });
  } catch (error) {
    logger.error("Error in IBGE batch route", {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: "Erro interno no batch IBGE" });
  }
});

export default router;
