import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockCalculateOds } = vi.hoisted(() => ({
  mockCalculateOds: vi.fn(),
}));

vi.mock("../../../backend/services/ods/ods_score_service.js", () => ({
  calculateMunicipalOds: mockCalculateOds,
}));

// withCache mock — executa fn diretamente sem Redis para testes unitários
vi.mock("../../../backend/utils/cache.js", () => ({
  withCache: (_key: string, _ttl: number, fn: () => unknown) => fn(),
}));

vi.mock("../../../backend/utils/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("../../../shared/data/ideb_2023.json", () => ({ default: {} }));
vi.mock("../../../shared/data/snis_2022.json", () => ({ default: {} }));
vi.mock("../../../shared/data/tse_2024.json", () => ({ default: {} }));
vi.mock("../../../shared/data/aneel_gd_2023.json", () => ({ default: {} }));
vi.mock("../../../shared/data/snis_rs_2022.json", () => ({ default: {} }));
vi.mock("../../../shared/data/ana_2022.json", () => ({ default: {} }));
vi.mock("../../../shared/data/convenios_2023.json", () => ({ default: {} }));

const { generateBenchmark, compareAgainstBenchmark } =
  await import("../../../backend/services/benchmarks/benchmark_service.js");

function makeMockReport(
  ibgeCode: string,
  name: string,
  globalScore: number,
  ods3Score: number,
  ods4Score: number,
) {
  return {
    ibgeCode,
    municipalityName: name,
    referenceYear: 2024,
    globalScore,
    globalStatus: globalScore >= 70 ? "verde" : globalScore >= 40 ? "amarelo" : "vermelho",
    odsCount: { total: 17, withData: 2, verde: 1, amarelo: 1, vermelho: 0 },
    ods: Array.from({ length: 17 }, (_, i) => {
      const num = i + 1;
      let score: number | null = null;
      let status: string | null = null;
      const indicators: Array<{
        indicatorName: string;
        value: number | null;
        odsNumber: number;
        score: number | null;
        source: string;
      }> = [];
      if (num === 3) {
        score = ods3Score;
        status = score >= 70 ? "verde" : "amarelo";
        indicators.push({
          indicatorName: "despesa_saude",
          value: 1,
          odsNumber: 3,
          score,
          source: "siconfi",
        });
      }
      if (num === 4) {
        score = ods4Score;
        status = score >= 70 ? "verde" : "amarelo";
        indicators.push({
          indicatorName: "despesa_educacao",
          value: 1,
          odsNumber: 4,
          score,
          source: "siconfi",
        });
      }
      return {
        odsNumber: num,
        name: `ODS ${num}`,
        shortName: `ODS${num}`,
        color: "#000",
        weight: 1.0,
        score,
        status,
        indicators,
        sources: score !== null ? ["test"] : [],
      };
    }),
  };
}

const REPORT_A = makeMockReport("4204202", "Chapecó", 70, 80, 60);
const REPORT_B = makeMockReport("4205407", "Florianópolis", 85, 90, 80);
const REPORT_C = makeMockReport("4209102", "Joinville", 50, 60, 40);

describe("BenchmarkService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("generateBenchmark", () => {
    it("retorna ranking ordenado por globalScore decrescente", async () => {
      mockCalculateOds
        .mockResolvedValueOnce(REPORT_A)
        .mockResolvedValueOnce(REPORT_B)
        .mockResolvedValueOnce(REPORT_C);

      const result = await generateBenchmark(["4204202", "4205407", "4209102"]);

      expect(result.ranking).toHaveLength(3);
      expect(result.ranking[0].ibgeCode).toBe("4205407");
      expect(result.ranking[1].ibgeCode).toBe("4204202");
      expect(result.ranking[2].ibgeCode).toBe("4209102");
      expect(result.ranking[0].position).toBe(1);
    });

    it("calcula médias ODS corretamente", async () => {
      mockCalculateOds.mockResolvedValueOnce(REPORT_A).mockResolvedValueOnce(REPORT_B);

      const result = await generateBenchmark(["4204202", "4205407"]);

      const ods3Avg = result.averages.find((a: { odsNumber: number }) => a.odsNumber === 3)!;
      expect(ods3Avg.average).toBe(85);
      expect(ods3Avg.min).toBe(80);
      expect(ods3Avg.max).toBe(90);
      expect(ods3Avg.count).toBe(2);

      const ods1Avg = result.averages.find((a: { odsNumber: number }) => a.odsNumber === 1)!;
      expect(ods1Avg.average).toBeNull();
      expect(ods1Avg.count).toBe(0);
    });

    it("lida com falhas de coletores graciosamente", async () => {
      mockCalculateOds.mockResolvedValueOnce(REPORT_A).mockRejectedValueOnce(new Error("timeout"));

      const result = await generateBenchmark(["4204202", "0000000"]);

      expect(result.municipalityCount).toBe(1);
      expect(result.municipalities).toHaveLength(1);
      expect(result.municipalities[0].ibgeCode).toBe("4204202");
    });

    it("calcula globalAverage corretamente", async () => {
      mockCalculateOds.mockResolvedValueOnce(REPORT_A).mockResolvedValueOnce(REPORT_B);

      const result = await generateBenchmark(["4204202", "4205407"]);
      expect(result.globalAverage).toBe(77.5);
    });

    it("retorna globalAverage null quando nenhum report tem dados", async () => {
      mockCalculateOds.mockResolvedValue(null);

      const result = await generateBenchmark(["0000000", "0000001"]);
      expect(result.globalAverage).toBeNull();
      expect(result.municipalityCount).toBe(0);
    });
  });

  describe("compareAgainstBenchmark", () => {
    it("retorna comparison com delta e aboveAverage", async () => {
      mockCalculateOds
        // fullBenchmark call (alvo + peers)
        .mockResolvedValueOnce(REPORT_A)
        .mockResolvedValueOnce(REPORT_B)
        .mockResolvedValueOnce(REPORT_C)
        // peers-only benchmark call
        .mockResolvedValueOnce(REPORT_B)
        .mockResolvedValueOnce(REPORT_C);

      const result = await compareAgainstBenchmark("4204202", ["4205407", "4209102"]);

      expect(result.municipality).not.toBeNull();
      expect(result.municipality!.ibgeCode).toBe("4204202");
      expect(result.comparison).toHaveLength(17);

      const ods3Comp = result.comparison.find((c: { odsNumber: number }) => c.odsNumber === 3)!;
      expect(ods3Comp.municipalityScore).toBe(80);
      expect(ods3Comp.benchmarkAverage).not.toBeNull();
      expect(ods3Comp.delta).not.toBeNull();
      expect(typeof ods3Comp.aboveAverage).toBe("boolean");
    });

    it("exclui município alvo do benchmark para evitar self-reference bias", async () => {
      mockCalculateOds
        .mockResolvedValueOnce(REPORT_A) // fullBenchmark: alvo
        .mockResolvedValueOnce(REPORT_B) // fullBenchmark: peer
        .mockResolvedValueOnce(REPORT_B); // benchmark peers-only

      const result = await compareAgainstBenchmark("4204202", ["4205407"]);

      // Benchmark deve conter apenas os peers, não o município alvo
      const codes = result.benchmark.municipalities.map((m: { ibgeCode: string }) => m.ibgeCode);
      expect(codes).not.toContain("4204202");
      expect(codes).toContain("4205407");
    });
  });
});
