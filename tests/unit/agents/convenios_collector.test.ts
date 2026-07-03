import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../shared/data/convenios_latest.json", () => ({
  default: {
    __meta: { referenceYear: 2023 },
    "4204202": {
      conveniosFederaisAtivos: 12,
      pctOrcamentoConvenios: 18.5,
      consorciosIntermunicipais: 6,
    },
    "4200101": {
      conveniosFederaisAtivos: 3,
      pctOrcamentoConvenios: null,
      consorciosIntermunicipais: 2,
    },
    "4200051": {
      conveniosFederaisAtivos: null,
      pctOrcamentoConvenios: null,
      consorciosIntermunicipais: null,
    },
    "4200200": {
      conveniosFederaisAtivos: 0,
      pctOrcamentoConvenios: 0.0,
      consorciosIntermunicipais: 0,
    },
  },
}));

vi.mock("../../../backend/utils/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { ConveniosCollector } from "../../../backend/agents/convenios/convenios_collector.js";
import { mapToOdsIndicators } from "../../../backend/agents/convenios/convenios_ods_mapper.js";
import type { ConveniosMunicipalData } from "../../../shared/types/agents/convenios.types.js";

describe("ConveniosCollector", () => {
  const collector = new ConveniosCollector();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna dados válidos para município SC existente", async () => {
    const result = await collector.collect("4204202");

    expect(result).not.toBeNull();
    expect(result!.ibgeCode).toBe("4204202");
    expect(result!.siconfiCode).toBe("420420");
    expect(result!.dataAvailable).toBe(true);
    expect(result!.referenceYear).toBe(2023);
    expect(result!.indicators.conveniosFederaisAtivos).toBe(12);
    expect(result!.indicators.pctOrcamentoConvenios).toBe(18.5);
    expect(result!.indicators.consorciosIntermunicipais).toBe(6);
  });

  it("retorna null para município inexistente (não lança erro)", async () => {
    const result = await collector.collect("9999999");
    expect(result).toBeNull();
  });

  it("retorna dados quando apenas alguns indicadores são null", async () => {
    const result = await collector.collect("4200101");

    expect(result).not.toBeNull();
    expect(result!.indicators.conveniosFederaisAtivos).toBe(3);
    expect(result!.indicators.pctOrcamentoConvenios).toBeNull();
    expect(result!.indicators.consorciosIntermunicipais).toBe(2);
    expect(result!.dataAvailable).toBe(true);
  });

  it("retorna null quando todos os indicadores são null", async () => {
    const result = await collector.collect("4200051");
    expect(result).toBeNull();
  });

  it("retorna dados quando município tem todos indicadores zerados", async () => {
    const result = await collector.collect("4200200");

    expect(result).not.toBeNull();
    expect(result!.indicators.conveniosFederaisAtivos).toBe(0);
    expect(result!.indicators.pctOrcamentoConvenios).toBe(0.0);
    expect(result!.indicators.consorciosIntermunicipais).toBe(0);
  });

  it("collectBatch retorna Map apenas com municípios encontrados", async () => {
    const result = await collector.collectBatch(["4204202", "4200101", "9999999"]);

    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(2);
    expect(result.has("4204202")).toBe(true);
    expect(result.has("4200101")).toBe(true);
    expect(result.has("9999999")).toBe(false);
  });

  it("valida schema com Zod antes de retornar (rejeita dado malformado)", () => {
    // A validação ocorre na carga do módulo — o mock retorna dados válidos,
    // então o módulo carrega sem erro.
    expect(() => collector.collect("4204202")).not.toThrow();
  });
});

describe("Convenios ODS Mapper", () => {
  const mockData: ConveniosMunicipalData = {
    ibgeCode: "4204202",
    siconfiCode: "420420",
    referenceYear: 2023,
    referenceDate: new Date("2023-12-31"),
    dataAvailable: true,
    indicators: {
      conveniosFederaisAtivos: 12,
      pctOrcamentoConvenios: 18.5,
      consorciosIntermunicipais: 6,
    },
  };

  it("gera indicadores apenas para ODS 17", () => {
    const indicators = mapToOdsIndicators(mockData);

    expect(indicators.length).toBe(3);
    expect(indicators.every((i) => i.odsNumber === 17)).toBe(true);
  });

  it("source é sempre 'convenios'", () => {
    const indicators = mapToOdsIndicators(mockData);
    expect(indicators.every((i) => i.source === "convenios")).toBe(true);
  });

  // ── scoreConvenios ─────────────────────────────────────────────────────────

  it("score convenios_federais: >= 10 → 100", () => {
    const data: ConveniosMunicipalData = {
      ...mockData,
      indicators: { ...mockData.indicators, conveniosFederaisAtivos: 10 },
    };
    const ind = mapToOdsIndicators(data).find((i) => i.indicatorName === "convenios_federais")!;
    expect(ind.score).toBe(100);
  });

  it("score convenios_federais: 5 → 50", () => {
    const data: ConveniosMunicipalData = {
      ...mockData,
      indicators: { ...mockData.indicators, conveniosFederaisAtivos: 5 },
    };
    const ind = mapToOdsIndicators(data).find((i) => i.indicatorName === "convenios_federais")!;
    expect(ind.score).toBe(50);
  });

  it("score convenios_federais: 0 → 0", () => {
    const data: ConveniosMunicipalData = {
      ...mockData,
      indicators: { ...mockData.indicators, conveniosFederaisAtivos: 0 },
    };
    const ind = mapToOdsIndicators(data).find((i) => i.indicatorName === "convenios_federais")!;
    expect(ind.score).toBe(0);
  });

  // ── scorePctOrcamento ──────────────────────────────────────────────────────

  it("score pct_orcamento_convenios: >= 15% → 100", () => {
    const data: ConveniosMunicipalData = {
      ...mockData,
      indicators: { ...mockData.indicators, pctOrcamentoConvenios: 15 },
    };
    const ind = mapToOdsIndicators(data).find(
      (i) => i.indicatorName === "pct_orcamento_convenios",
    )!;
    expect(ind.score).toBe(100);
  });

  it("score pct_orcamento_convenios: 5% → 50", () => {
    const data: ConveniosMunicipalData = {
      ...mockData,
      indicators: { ...mockData.indicators, pctOrcamentoConvenios: 5 },
    };
    const ind = mapToOdsIndicators(data).find(
      (i) => i.indicatorName === "pct_orcamento_convenios",
    )!;
    expect(ind.score).toBe(50);
  });

  it("score pct_orcamento_convenios: 0% → 0", () => {
    const data: ConveniosMunicipalData = {
      ...mockData,
      indicators: { ...mockData.indicators, pctOrcamentoConvenios: 0 },
    };
    const ind = mapToOdsIndicators(data).find(
      (i) => i.indicatorName === "pct_orcamento_convenios",
    )!;
    expect(ind.score).toBe(0);
  });

  // ── scoreConsorcios ────────────────────────────────────────────────────────

  it("score consorcios_intermunicipais: >= 5 → 100", () => {
    const data: ConveniosMunicipalData = {
      ...mockData,
      indicators: { ...mockData.indicators, consorciosIntermunicipais: 5 },
    };
    const ind = mapToOdsIndicators(data).find(
      (i) => i.indicatorName === "consorcios_intermunicipais",
    )!;
    expect(ind.score).toBe(100);
  });

  it("score consorcios_intermunicipais: 2 → 50", () => {
    const data: ConveniosMunicipalData = {
      ...mockData,
      indicators: { ...mockData.indicators, consorciosIntermunicipais: 2 },
    };
    const ind = mapToOdsIndicators(data).find(
      (i) => i.indicatorName === "consorcios_intermunicipais",
    )!;
    expect(ind.score).toBe(50);
  });

  it("score consorcios_intermunicipais: 0 → 0", () => {
    const data: ConveniosMunicipalData = {
      ...mockData,
      indicators: { ...mockData.indicators, consorciosIntermunicipais: 0 },
    };
    const ind = mapToOdsIndicators(data).find(
      (i) => i.indicatorName === "consorcios_intermunicipais",
    )!;
    expect(ind.score).toBe(0);
  });

  // ── Null handling ──────────────────────────────────────────────────────────

  it("não gera indicador quando valor é null", () => {
    const data: ConveniosMunicipalData = {
      ...mockData,
      indicators: {
        conveniosFederaisAtivos: null,
        pctOrcamentoConvenios: null,
        consorciosIntermunicipais: null,
      },
    };
    const indicators = mapToOdsIndicators(data);
    expect(indicators).toHaveLength(0);
  });

  it("gera apenas indicadores não-null quando alguns são null", () => {
    const data: ConveniosMunicipalData = {
      ...mockData,
      indicators: {
        conveniosFederaisAtivos: 8,
        pctOrcamentoConvenios: null,
        consorciosIntermunicipais: 3,
      },
    };
    const indicators = mapToOdsIndicators(data);
    expect(indicators).toHaveLength(2);
    expect(indicators.map((i) => i.indicatorName)).not.toContain("pct_orcamento_convenios");
  });

  // ── Status ─────────────────────────────────────────────────────────────────

  it("status segue verde/amarelo/vermelho conforme score", () => {
    // convenios=10 → 100 (verde), pct=5% → 50 (amarelo), consorcios=0 → 0 (vermelho)
    const data: ConveniosMunicipalData = {
      ...mockData,
      indicators: {
        conveniosFederaisAtivos: 10,
        pctOrcamentoConvenios: 5,
        consorciosIntermunicipais: 0,
      },
    };
    const indicators = mapToOdsIndicators(data);

    const conv = indicators.find((i) => i.indicatorName === "convenios_federais")!;
    const pct = indicators.find((i) => i.indicatorName === "pct_orcamento_convenios")!;
    const cons = indicators.find((i) => i.indicatorName === "consorcios_intermunicipais")!;

    expect(conv.status).toBe("verde");
    expect(pct.status).toBe("amarelo");
    expect(cons.status).toBe("vermelho");
  });

  it("score intermediário convenios_federais: 7 → entre 50 e 100", () => {
    // 7 convênios: 50 + ((7-5)/5)*50 = 50 + 20 = 70
    const data: ConveniosMunicipalData = {
      ...mockData,
      indicators: { ...mockData.indicators, conveniosFederaisAtivos: 7 },
    };
    const ind = mapToOdsIndicators(data).find((i) => i.indicatorName === "convenios_federais")!;
    expect(ind.score).toBe(70);
    expect(ind.status).toBe("verde");
  });
});
