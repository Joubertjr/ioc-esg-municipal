import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../shared/data/ieps_2021.json", () => ({
  default: {
    "4204202": {
      mortalidadeInfantil: 8.5,
      coberturaEsf: 92.3,
      coberturaVacinal: 85.1,
      internacoesCsap: 750.2,
      gastoSaudePerCapita: 1120.5,
      prenatalAdequado: 78.4,
    },
    "4200101": {
      mortalidadeInfantil: null,
      coberturaEsf: 65.0,
      coberturaVacinal: 70.0,
      internacoesCsap: 1200.0,
      gastoSaudePerCapita: 600.0,
      prenatalAdequado: 55.0,
    },
    "4200051": {
      mortalidadeInfantil: null,
      coberturaEsf: null,
      coberturaVacinal: null,
      internacoesCsap: null,
      gastoSaudePerCapita: null,
      prenatalAdequado: null,
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

import { IepsCollector } from "../../../backend/agents/ieps/ieps_collector.js";

describe("IepsCollector", () => {
  const collector = new IepsCollector();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna dados válidos para município com dados completos", async () => {
    const result = await collector.collect("4204202");

    expect(result).not.toBeNull();
    expect(result!.ibgeCode).toBe("4204202");
    expect(result!.siconfiCode).toBe("420420");
    expect(result!.dataAvailable).toBe(true);
    expect(result!.referenceYear).toBe(2021);
    expect(result!.indicators.mortalidadeInfantil).toBe(8.5);
    expect(result!.indicators.coberturaEsf).toBe(92.3);
    expect(result!.indicators.coberturaVacinal).toBe(85.1);
    expect(result!.indicators.internacoesCsap).toBe(750.2);
    expect(result!.indicators.gastoSaudePerCapita).toBe(1120.5);
    expect(result!.indicators.prenatalAdequado).toBe(78.4);
  });

  it("retorna null para ibgeCode ausente", async () => {
    const result = await collector.collect("9999999");
    expect(result).toBeNull();
  });

  it("retorna dados quando alguns indicadores são null", async () => {
    const result = await collector.collect("4200101");

    expect(result).not.toBeNull();
    expect(result!.indicators.mortalidadeInfantil).toBeNull();
    expect(result!.indicators.coberturaEsf).toBe(65.0);
    expect(result!.dataAvailable).toBe(true);
  });

  it("retorna null quando todos os indicadores são null", async () => {
    const result = await collector.collect("4200051");
    expect(result).toBeNull();
  });

  it("collectBatch retorna Map apenas com municípios encontrados", async () => {
    const result = await collector.collectBatch(["4204202", "4200101", "4200051", "9999999"]);

    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(2);
    expect(result.has("4204202")).toBe(true);
    expect(result.has("4200101")).toBe(true);
    expect(result.has("4200051")).toBe(false);
    expect(result.has("9999999")).toBe(false);
  });
});
