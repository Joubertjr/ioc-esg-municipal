import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockCalculateOds } = vi.hoisted(() => ({
  mockCalculateOds: vi.fn(),
}));

vi.mock("../../../backend/services/ods/ods_score_service.js", () => ({
  calculateMunicipalOds: mockCalculateOds,
}));

vi.mock("../../../backend/utils/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// The simulator imports ods_score_service which imports all collectors.
// By mocking ods_score_service above, those transitive imports are prevented.
// But we still need to mock the JSON files that any collector barrel might import.
vi.mock("../../../shared/data/ideb_2023.json", () => ({ default: {} }));
vi.mock("../../../shared/data/snis_2022.json", () => ({ default: {} }));
vi.mock("../../../shared/data/tse_2024.json", () => ({ default: {} }));
vi.mock("../../../shared/data/aneel_gd_2023.json", () => ({ default: {} }));
vi.mock("../../../shared/data/snis_rs_2022.json", () => ({ default: {} }));
vi.mock("../../../shared/data/ana_2022.json", () => ({ default: {} }));
vi.mock("../../../shared/data/convenios_2023.json", () => ({ default: {} }));

// Import after mocks
const { runSimulation } = await import("../../../backend/services/simulator/simulator_service.js");
type SimulationInput = import("../../../backend/services/simulator/simulator_service.js").SimulationInput;

// Mock ODS report — 3 ODS with data
const MOCK_ODS_REPORT = {
  ibgeCode: "4204202",
  municipalityName: null,
  referenceYear: 2024,
  globalScore: 55,
  globalStatus: "amarelo" as const,
  odsCount: { total: 17, withData: 3, verde: 1, amarelo: 1, vermelho: 1 },
  ods: Array.from({ length: 17 }, (_, i) => {
    const num = i + 1;
    let score: number | null = null;
    let status: string | null = null;
    const indicators: Array<{ indicatorName: string; value: number | null; odsNumber: number; score: number | null; source: string }> = [];
    if (num === 3) { score = 80; status = "verde"; indicators.push({ indicatorName: "despesa_saude", value: 400000000, odsNumber: 3, score: 80, source: "siconfi" }); }
    if (num === 4) { score = 50; status = "amarelo"; indicators.push({ indicatorName: "despesa_educacao", value: 450000000, odsNumber: 4, score: 50, source: "siconfi" }); }
    if (num === 6) { score = 30; status = "vermelho"; indicators.push({ indicatorName: "atendimento_agua", value: 75, odsNumber: 6, score: 30, source: "snis" }); }
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

describe("SimulatorService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCalculateOds.mockResolvedValue(MOCK_ODS_REPORT);
  });

  it("retorna projeção com deltas positivos para investimento em saúde", async () => {
    const input: SimulationInput = {
      ibgeCode: "4204202",
      scenarioName: "Investir em saúde",
      allocations: [
        { area: "health", amount: 10_000_000, targetOds: [] },
      ],
    };

    const result = await runSimulation(input);

    expect(result.ibgeCode).toBe("4204202");
    expect(result.scenarioName).toBe("Investir em saúde");
    expect(result.totalInvestment).toBe(10_000_000);
    expect(result.odsProjections).toHaveLength(17);

    const ods3 = result.odsProjections.find((o) => o.odsNumber === 3)!;
    expect(ods3.currentScore).toBe(80);
    expect(ods3.projectedScore).toBeGreaterThanOrEqual(80);
    expect(ods3.delta).toBeGreaterThanOrEqual(0);
  });

  it("retorna resultado degenerado quando não há dados ODS", async () => {
    mockCalculateOds.mockResolvedValue(null);

    const input: SimulationInput = {
      ibgeCode: "0000000",
      scenarioName: "Sem dados",
      allocations: [{ area: "education", amount: 1_000_000, targetOds: [] }],
    };

    const result = await runSimulation(input);
    expect(result.currentGlobalScore).toBeNull();
    expect(result.projectedGlobalScore).toBeNull();
    expect(result.deltaGlobalScore).toBe(0);
    expect(result.odsProjections.every((o) => o.currentScore === null)).toBe(true);
  });

  it("projectedScore nunca ultrapassa 100", async () => {
    const input: SimulationInput = {
      ibgeCode: "4204202",
      scenarioName: "Mega investimento",
      allocations: [{ area: "health", amount: 500_000_000, targetOds: [] }],
    };

    const result = await runSimulation(input);
    const ods3 = result.odsProjections.find((o) => o.odsNumber === 3)!;
    expect(ods3.projectedScore).toBeLessThanOrEqual(100);
  });

  it("suporta múltiplas áreas de investimento", async () => {
    const input: SimulationInput = {
      ibgeCode: "4204202",
      scenarioName: "Investimento diversificado",
      allocations: [
        { area: "health", amount: 5_000_000, targetOds: [] },
        { area: "education", amount: 5_000_000, targetOds: [] },
        { area: "sanitation", amount: 5_000_000, targetOds: [] },
      ],
    };

    const result = await runSimulation(input);
    expect(result.totalInvestment).toBe(15_000_000);

    const ods3 = result.odsProjections.find((o) => o.odsNumber === 3)!;
    expect(ods3.delta).toBeGreaterThanOrEqual(0);

    const ods4 = result.odsProjections.find((o) => o.odsNumber === 4)!;
    expect(ods4.delta).toBeGreaterThanOrEqual(0);

    const ods6 = result.odsProjections.find((o) => o.odsNumber === 6)!;
    expect(ods6.delta).toBeGreaterThanOrEqual(0);
  });

  it("delta é 0 para ODS sem investimento nem dados", async () => {
    const input: SimulationInput = {
      ibgeCode: "4204202",
      scenarioName: "Só saúde",
      allocations: [{ area: "health", amount: 1_000_000, targetOds: [] }],
    };

    const result = await runSimulation(input);

    const ods7 = result.odsProjections.find((o) => o.odsNumber === 7)!;
    expect(ods7.currentScore).toBeNull();
    expect(ods7.delta).toBe(0);
  });

  it("projected global score é maior ou igual ao current", async () => {
    const input: SimulationInput = {
      ibgeCode: "4204202",
      scenarioName: "Global check",
      allocations: [
        { area: "health", amount: 5_000_000, targetOds: [] },
        { area: "education", amount: 5_000_000, targetOds: [] },
      ],
    };

    const result = await runSimulation(input);
    expect(result.projectedGlobalScore).toBeGreaterThanOrEqual(result.currentGlobalScore!);
    expect(result.deltaGlobalScore).toBeGreaterThanOrEqual(0);
  });

  it("scenarioName é preservado no resultado", async () => {
    const input: SimulationInput = {
      ibgeCode: "4204202",
      scenarioName: "Cenário A - Educação Prioritária",
      allocations: [{ area: "education", amount: 2_000_000, targetOds: [] }],
    };

    const result = await runSimulation(input);
    expect(result.scenarioName).toBe("Cenário A - Educação Prioritária");
  });

  it("totalInvestment é soma de todas as allocations", async () => {
    const input: SimulationInput = {
      ibgeCode: "4204202",
      scenarioName: "Multi",
      allocations: [
        { area: "health", amount: 3_000_000, targetOds: [] },
        { area: "education", amount: 2_000_000, targetOds: [] },
        { area: "governance", amount: 1_000_000, targetOds: [] },
      ],
    };

    const result = await runSimulation(input);
    expect(result.totalInvestment).toBe(6_000_000);
  });

  it("targetOds override distribui investimento como primary", async () => {
    const input: SimulationInput = {
      ibgeCode: "4204202",
      scenarioName: "Override ODS",
      allocations: [
        { area: "health", amount: 5_000_000, targetOds: [3, 6] },
      ],
    };

    const result = await runSimulation(input);

    const ods3 = result.odsProjections.find((o) => o.odsNumber === 3)!;
    const ods6 = result.odsProjections.find((o) => o.odsNumber === 6)!;
    expect(ods3.primaryInvestment).toBe(5_000_000);
    expect(ods6.primaryInvestment).toBe(5_000_000);
  });

  it("todas as 8 áreas de investimento são aceitas", async () => {
    const areas = ["education", "health", "sanitation", "environment", "security", "energy", "urbanization", "governance"] as const;

    for (const area of areas) {
      mockCalculateOds.mockResolvedValue(MOCK_ODS_REPORT);
      const input: SimulationInput = {
        ibgeCode: "4204202",
        scenarioName: `Teste ${area}`,
        allocations: [{ area, amount: 1_000_000, targetOds: [] }],
      };
      const result = await runSimulation(input);
      expect(result.totalInvestment).toBe(1_000_000);
    }
  });
});
