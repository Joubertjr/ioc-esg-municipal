/**
 * Testes de integração SICONFI — chamam a API real do Tesouro Nacional.
 *
 * Requer: internet + Redis rodando.
 * Executar: SICONFI_INTEGRATION=1 npx vitest run tests/integration/agents/siconfi_integration.test.ts
 */

import { describe, it, expect, beforeAll } from "vitest";
import { SiconfiCollector } from "../../../backend/agents/siconfi/siconfi_collector.js";
import { mapToOdsIndicators } from "../../../backend/agents/siconfi/siconfi_ods_mapper.js";
import type { SiconfiMunicipalData } from "../../../shared/types/agents/siconfi.types.js";

const FLORIANOPOLIS = "4205407";

describe.skipIf(!process.env["SICONFI_INTEGRATION"])("SICONFI Integration (API real)", () => {
  let collector: SiconfiCollector;
  let florData: SiconfiMunicipalData | null;

  beforeAll(async () => {
    collector = new SiconfiCollector();
    // Buscar Florianópolis uma vez — reutilizar nos testes
    florData = await collector.collect(FLORIANOPOLIS);
  }, 60_000);

  it("retorna dados reais para Florianópolis (4205407)", () => {
    expect(florData).not.toBeNull();
    expect(florData!.ibgeCode).toBe(FLORIANOPOLIS);
    expect(florData!.siconfiCode).toBe("420540");
    expect(florData!.dataAvailable).toBe(true);
    expect(florData!.referenceYear).toBeGreaterThanOrEqual(2023);
  });

  it("indicadores financeiros são números positivos", () => {
    expect(florData).not.toBeNull();
    const ind = florData!.indicators;

    expect(ind.fpmAnual).toBeGreaterThan(0);
    expect(ind.receitaTotal).toBeGreaterThan(0);
    expect(ind.despesaTotal).toBeGreaterThan(0);
    expect(ind.despesaSaude).not.toBeNull();
    expect(ind.despesaEducacao).not.toBeNull();
    expect(ind.populacao).toBeGreaterThan(0);
  });

  it("retorna null para código IBGE inexistente", async () => {
    const result = await collector.collect("9999999");
    expect(result).toBeNull();
  }, 60_000);

  it("cache evita chamada duplicada (segunda < 100ms)", async () => {
    // Primeira chamada já feita no beforeAll (e cacheada)
    const start = performance.now();
    const cached = await collector.collect(FLORIANOPOLIS);
    const elapsed = performance.now() - start;

    expect(cached).not.toBeNull();
    expect(cached!.ibgeCode).toBe(FLORIANOPOLIS);
    expect(elapsed).toBeLessThan(100);
  }, 10_000);

  it("mapeia indicadores ODS corretamente com dados reais", () => {
    expect(florData).not.toBeNull();
    const indicators = mapToOdsIndicators(florData!);

    // Deve gerar pelo menos alguns dos ODS 3, 4, 11, 16, 17
    expect(indicators.length).toBeGreaterThan(0);

    for (const ind of indicators) {
      expect(ind.source).toBe("siconfi");
      expect(ind.score).toBeGreaterThanOrEqual(0);
      expect(ind.score).toBeLessThanOrEqual(100);
      expect([3, 4, 11, 16, 17]).toContain(ind.odsNumber);
    }
  });
});
