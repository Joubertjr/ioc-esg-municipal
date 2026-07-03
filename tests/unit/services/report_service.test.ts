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

vi.mock("../../../backend/services/ingestion/ods_score_reader.js", () => ({
  readOdsReportFromDatabase: vi.fn().mockResolvedValue(null),
}));

vi.mock("../../../backend/lib/prisma.js", () => ({
  prisma: {
    municipality: { findUnique: vi.fn().mockResolvedValue(null) },
  },
}));

vi.mock("../../../shared/data/ideb_2023.json", () => ({ default: {} }));
vi.mock("../../../shared/data/snis_2022.json", () => ({ default: {} }));
vi.mock("../../../shared/data/tse_2024.json", () => ({ default: {} }));
vi.mock("../../../shared/data/aneel_gd_2023.json", () => ({ default: {} }));
vi.mock("../../../shared/data/snis_rs_2022.json", () => ({ default: {} }));
vi.mock("../../../shared/data/ana_2022.json", () => ({ default: {} }));
vi.mock("../../../shared/data/convenios_2023.json", () => ({ default: {} }));

const { generateEsgReport } = await import("../../../backend/services/reports/report_service.js");

const MOCK_ODS_REPORT = {
  ibgeCode: "4204202",
  municipalityName: "Chapecó",
  referenceYear: 2024,
  globalScore: 55,
  globalStatus: "amarelo" as const,
  odsCount: { total: 17, withData: 3, verde: 1, amarelo: 1, vermelho: 1 },
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
      score = 80;
      status = "verde";
      indicators.push({
        indicatorName: "despesa_saude",
        value: 400000000,
        odsNumber: 3,
        score: 80,
        source: "siconfi",
      });
    }
    if (num === 4) {
      score = 50;
      status = "amarelo";
      indicators.push({
        indicatorName: "despesa_educacao",
        value: 450000000,
        odsNumber: 4,
        score: 50,
        source: "siconfi",
      });
    }
    if (num === 6) {
      score = 30;
      status = "vermelho";
      indicators.push({
        indicatorName: "atendimento_agua",
        value: 75,
        odsNumber: 6,
        score: 30,
        source: "snis",
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

describe("ReportService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCalculateOds.mockResolvedValue(MOCK_ODS_REPORT);
  });

  it("retorna null quando calculateMunicipalOds retorna null", async () => {
    mockCalculateOds.mockResolvedValue(null);
    const result = await generateEsgReport("0000000");
    expect(result).toBeNull();
  });

  it("retorna EsgReport com todos os campos populados", async () => {
    const result = await generateEsgReport("4204202");
    expect(result).not.toBeNull();
    expect(result!.ibgeCode).toBe("4204202");
    expect(result!.municipalityName).toBe("Chapecó");
    expect(result!.referenceYear).toBe(2024);
    expect(result!.globalScore).toBe(55);
    expect(result!.globalStatus).toBe("amarelo");
    expect(result!.odsDetails).toHaveLength(17);
    expect(result!.generatedAt).toBeTruthy();
    expect(result!.executiveSummary).toBeTruthy();
  });

  it("calcula coverage percentage corretamente", async () => {
    const result = await generateEsgReport("4204202");
    expect(result!.coverage.total).toBe(17);
    expect(result!.coverage.withData).toBe(3);
    expect(result!.coverage.percentage).toBe(Math.round((3 / 17) * 100));
  });

  it("identifica strengths como ODS com score >= 70", async () => {
    const result = await generateEsgReport("4204202");
    expect(result!.strengths).toHaveLength(1);
    expect(result!.strengths[0]).toContain("ODS 3");
    expect(result!.strengths[0]).toContain("80");
  });

  it("identifica weaknesses como ODS com score < 40", async () => {
    const result = await generateEsgReport("4204202");
    expect(result!.weaknesses).toHaveLength(1);
    expect(result!.weaknesses[0]).toContain("ODS 6");
    expect(result!.weaknesses[0]).toContain("30");
  });

  it("gera recomendações para ODS com score < 70", async () => {
    const result = await generateEsgReport("4204202");
    expect(result!.recommendations.length).toBe(2);
    const odsNumbers = result!.recommendations.map((r) => r.odsNumber);
    expect(odsNumbers).toContain(4);
    expect(odsNumbers).toContain(6);
  });

  it("ordena recomendações por prioridade alta primeiro, depois score", async () => {
    const result = await generateEsgReport("4204202");
    expect(result!.recommendations[0].odsNumber).toBe(6);
    expect(result!.recommendations[0].priority).toBe("alta");
    expect(result!.recommendations[1].odsNumber).toBe(4);
    expect(result!.recommendations[1].priority).toBe("media");
  });

  it("executiveSummary menciona score global e status", async () => {
    const result = await generateEsgReport("4204202");
    expect(result!.executiveSummary).toContain("55");
    expect(result!.executiveSummary).toContain("moderado");
  });

  it("executiveSummary retorna dados insuficientes quando globalScore é null", async () => {
    const nullScoreReport = {
      ...MOCK_ODS_REPORT,
      globalScore: null,
      globalStatus: null,
    };
    mockCalculateOds.mockResolvedValue(nullScoreReport);
    const result = await generateEsgReport("4204202");
    expect(result!.executiveSummary).toContain("insuficientes");
  });

  it("statusBreakdown reflete contagem do report", async () => {
    const result = await generateEsgReport("4204202");
    expect(result!.statusBreakdown.verde).toBe(1);
    expect(result!.statusBreakdown.amarelo).toBe(1);
    expect(result!.statusBreakdown.vermelho).toBe(1);
  });
});
