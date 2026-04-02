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

const BASE_ALLOCATION = {
  education: 12,
  health: 13,
  sanitation: 12,
  environment: 13,
  security: 12,
  energy: 13,
  urbanization: 12,
  governance: 13,
} as const;

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
      totalAmount: 10_000_000,
      allocation: { ...BASE_ALLOCATION, health: 100, education: 0, sanitation: 0, environment: 0, security: 0, energy: 0, urbanization: 0, governance: 0 },
    };

    const result = await runSimulation(input);

    expect(result.ibgeCode).toBe("4204202");
    expect(result.totalAmount).toBe(10_000_000);
    expect(result.ods).toHaveLength(17);

    const ods3 = result.ods.find((o) => o.odsNumber === 3)!;
    expect(ods3.currentScore).toBe(80);
    expect(ods3.projectedScore).toBeGreaterThanOrEqual(80);
    expect(ods3.delta).toBeGreaterThanOrEqual(0);
  });

  it("retorna resultado degenerado quando não há dados ODS", async () => {
    mockCalculateOds.mockResolvedValue(null);

    const input: SimulationInput = {
      ibgeCode: "0000000",
      totalAmount: 1_000_000,
      allocation: BASE_ALLOCATION,
    };

    const result = await runSimulation(input);
    expect(result.currentGlobalScore).toBeNull();
    expect(result.projectedGlobalScore).toBeNull();
    expect(result.globalDelta).toBeNull();
    expect(result.ods.every((o) => o.currentScore === null)).toBe(true);
  });

  it("projectedScore nunca ultrapassa 100", async () => {
    const input: SimulationInput = {
      ibgeCode: "4204202",
      totalAmount: 500_000_000,
      allocation: { ...BASE_ALLOCATION, health: 100, education: 0, sanitation: 0, environment: 0, security: 0, energy: 0, urbanization: 0, governance: 0 },
    };

    const result = await runSimulation(input);
    const ods3 = result.ods.find((o) => o.odsNumber === 3)!;
    expect(ods3.projectedScore).toBeLessThanOrEqual(100);
  });

  it("suporta múltiplas áreas de investimento", async () => {
    const input: SimulationInput = {
      ibgeCode: "4204202",
      totalAmount: 15_000_000,
      allocation: { ...BASE_ALLOCATION, health: 34, education: 33, sanitation: 33, environment: 0, security: 0, energy: 0, urbanization: 0, governance: 0 },
    };

    const result = await runSimulation(input);
    expect(result.totalAmount).toBe(15_000_000);

    const ods3 = result.ods.find((o) => o.odsNumber === 3)!;
    expect(ods3.delta).toBeGreaterThanOrEqual(0);

    const ods4 = result.ods.find((o) => o.odsNumber === 4)!;
    expect(ods4.delta).toBeGreaterThanOrEqual(0);

    const ods6 = result.ods.find((o) => o.odsNumber === 6)!;
    expect(ods6.delta).toBeGreaterThanOrEqual(0);
  });

  it("delta é null para ODS sem dados", async () => {
    const input: SimulationInput = {
      ibgeCode: "4204202",
      totalAmount: 1_000_000,
      allocation: { ...BASE_ALLOCATION, health: 100, education: 0, sanitation: 0, environment: 0, security: 0, energy: 0, urbanization: 0, governance: 0 },
    };

    const result = await runSimulation(input);

    const ods7 = result.ods.find((o) => o.odsNumber === 7)!;
    expect(ods7.currentScore).toBeNull();
    expect(ods7.delta).toBeNull();
  });

  it("projected global score é maior ou igual ao current", async () => {
    const input: SimulationInput = {
      ibgeCode: "4204202",
      totalAmount: 10_000_000,
      allocation: { ...BASE_ALLOCATION, health: 50, education: 50, sanitation: 0, environment: 0, security: 0, energy: 0, urbanization: 0, governance: 0 },
    };

    const result = await runSimulation(input);
    expect(result.projectedGlobalScore).toBeGreaterThanOrEqual(result.currentGlobalScore!);
    expect(result.globalDelta).toBeGreaterThanOrEqual(0);
  });

  it("allocation é preservada no resultado", async () => {
    const alloc = { ...BASE_ALLOCATION, education: 100, health: 0, sanitation: 0, environment: 0, security: 0, energy: 0, urbanization: 0, governance: 0 };
    const input: SimulationInput = {
      ibgeCode: "4204202",
      totalAmount: 2_000_000,
      allocation: alloc,
    };

    const result = await runSimulation(input);
    expect(result.allocation).toEqual(alloc);
    expect(result.totalAmount).toBe(2_000_000);
  });

  it("totalAmount é preservado no resultado", async () => {
    const input: SimulationInput = {
      ibgeCode: "4204202",
      totalAmount: 6_000_000,
      allocation: BASE_ALLOCATION,
    };

    const result = await runSimulation(input);
    expect(result.totalAmount).toBe(6_000_000);
  });

  it("ods result inclui shortName e color", async () => {
    const input: SimulationInput = {
      ibgeCode: "4204202",
      totalAmount: 1_000_000,
      allocation: BASE_ALLOCATION,
    };

    const result = await runSimulation(input);
    const ods1 = result.ods.find((o) => o.odsNumber === 1)!;
    expect(typeof ods1.shortName).toBe("string");
    expect(ods1.shortName.length).toBeGreaterThan(0);
    expect(typeof ods1.color).toBe("string");
    expect(ods1.color).toMatch(/^#/);
  });

  it("todas as 8 áreas de investimento são aceitas", async () => {
    const areas = ["education", "health", "sanitation", "environment", "security", "energy", "urbanization", "governance"] as const;

    for (const area of areas) {
      mockCalculateOds.mockResolvedValue(MOCK_ODS_REPORT);
      const singleAreaAlloc = {
        education: 0, health: 0, sanitation: 0, environment: 0,
        security: 0, energy: 0, urbanization: 0, governance: 0,
        [area]: 100,
      };
      const input: SimulationInput = {
        ibgeCode: "4204202",
        totalAmount: 1_000_000,
        allocation: singleAreaAlloc,
      };
      const result = await runSimulation(input);
      expect(result.totalAmount).toBe(1_000_000);
    }
  });
});
