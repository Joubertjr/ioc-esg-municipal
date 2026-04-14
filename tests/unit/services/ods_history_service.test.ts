import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Hoisted mocks ---

const {
  mockCalculateMunicipalOds,
  mockMunicipalityFindUnique,
  mockOdsScoreUpsert,
  mockTransaction,
  mockOdsScoreFindMany,
} = vi.hoisted(() => ({
  mockCalculateMunicipalOds: vi.fn(),
  mockMunicipalityFindUnique: vi.fn(),
  mockOdsScoreUpsert: vi.fn(),
  mockTransaction: vi.fn(),
  mockOdsScoreFindMany: vi.fn(),
}));

vi.mock("../../../backend/services/ods/ods_score_service.js", () => ({
  calculateMunicipalOds: mockCalculateMunicipalOds,
}));

vi.mock("../../../backend/lib/prisma.js", () => ({
  prisma: {
    municipality: { findUnique: mockMunicipalityFindUnique },
    odsScore: {
      upsert: mockOdsScoreUpsert,
      findMany: mockOdsScoreFindMany,
    },
    $transaction: mockTransaction,
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

import {
  calculateAndPersistScores,
  getScoreHistory,
  assessComparability,
} from "../../../backend/services/ods/ods_history_service.js";

// --- Fixtures ---

const MUNICIPALITY = { id: "muni-uuid-1", ibgeCode: "4204202", name: "Chapecó" };

function makeOds(odsNumber: number, score: number) {
  return {
    odsNumber,
    score,
    status: score >= 70 ? "verde" : score >= 40 ? "amarelo" : "vermelho",
    indicators: [{ indicatorName: "dummy", value: 1, odsNumber, score, source: "ibge" }],
    sources: ["ibge"],
  };
}

const MOCK_REPORT = {
  ibgeCode: "4204202",
  municipalityName: "Chapecó",
  referenceYear: 2024,
  globalScore: 65,
  globalStatus: "amarelo",
  odsCount: { total: 17, withData: 2, verde: 1, amarelo: 1, vermelho: 0 },
  ods: [
    makeOds(1, 75),
    makeOds(4, 55),
    ...Array.from({ length: 15 }, (_, i) => ({
      odsNumber: i + 2 === 4 ? 99 : i + 2,
      score: null,
      status: null,
      indicators: [],
      sources: [],
    })),
  ].slice(0, 17),
};

const MOCK_DB_SCORE = {
  id: "score-uuid-1",
  municipalityId: MUNICIPALITY.id,
  odsNumber: 1,
  score: 75,
  status: "verde",
  indicatorCount: 1,
  referenceYear: 2024,
  sources: ["ibge"],
  calculatedAt: new Date("2024-01-01"),
};

// --- Tests ---

describe("calculateAndPersistScores", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTransaction.mockResolvedValue([]);
    mockOdsScoreUpsert.mockResolvedValue(MOCK_DB_SCORE);
  });

  it("retorna null quando calculateMunicipalOds retorna null", async () => {
    mockCalculateMunicipalOds.mockResolvedValue(null);

    const result = await calculateAndPersistScores("0000000");

    expect(result).toBeNull();
    expect(mockMunicipalityFindUnique).not.toHaveBeenCalled();
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("retorna report sem persistir quando município não está no banco", async () => {
    mockCalculateMunicipalOds.mockResolvedValue(MOCK_REPORT);
    mockMunicipalityFindUnique.mockResolvedValue(null);

    const result = await calculateAndPersistScores("4204202");

    expect(result).toEqual(MOCK_REPORT);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("persiste scores via transaction quando município existe", async () => {
    mockCalculateMunicipalOds.mockResolvedValue(MOCK_REPORT);
    mockMunicipalityFindUnique.mockResolvedValue(MUNICIPALITY);

    const result = await calculateAndPersistScores("4204202");

    expect(result).toEqual(MOCK_REPORT);
    expect(mockTransaction).toHaveBeenCalledOnce();
    // 17 ODS scores + 1 global score (odsNumber 0)
    const upsertCalls = mockOdsScoreUpsert.mock.calls;
    expect(upsertCalls).toHaveLength(18);
  });

  it("inclui score global (odsNumber=0) na transaction", async () => {
    mockCalculateMunicipalOds.mockResolvedValue(MOCK_REPORT);
    mockMunicipalityFindUnique.mockResolvedValue(MUNICIPALITY);

    await calculateAndPersistScores("4204202");

    const globalUpsertCall = mockOdsScoreUpsert.mock.calls.find(
      ([args]) => args.where?.municipalityId_odsNumber_referenceYear?.odsNumber === 0,
    );
    expect(globalUpsertCall).toBeDefined();
    const [args] = globalUpsertCall!;
    expect(args.create.score).toBe(MOCK_REPORT.globalScore);
    expect(args.create.sources).toEqual(["global"]);
  });

  it("faz upsert com campos corretos para cada ODS", async () => {
    const reportWithOneOds = {
      ...MOCK_REPORT,
      ods: [
        makeOds(1, 75),
        ...Array.from({ length: 16 }, (_, i) => ({
          odsNumber: i + 2,
          score: null,
          status: null,
          indicators: [],
          sources: [],
        })),
      ],
    };
    mockCalculateMunicipalOds.mockResolvedValue(reportWithOneOds);
    mockMunicipalityFindUnique.mockResolvedValue(MUNICIPALITY);

    await calculateAndPersistScores("4204202");

    const ods1Call = mockOdsScoreUpsert.mock.calls.find(
      ([args]) => args.where?.municipalityId_odsNumber_referenceYear?.odsNumber === 1,
    );
    expect(ods1Call).toBeDefined();
    const [args] = ods1Call!;
    expect(args.create.municipalityId).toBe(MUNICIPALITY.id);
    expect(args.create.odsNumber).toBe(1);
    expect(args.create.score).toBe(75);
    expect(args.create.referenceYear).toBe(2024);
    expect(args.update.score).toBe(75);
    expect(args.update.calculatedAt).toBeInstanceOf(Date);
  });

  it("lida com erro de DB sem lançar exceção (fire-and-forget seguro)", async () => {
    mockCalculateMunicipalOds.mockResolvedValue(MOCK_REPORT);
    mockMunicipalityFindUnique.mockResolvedValue(MUNICIPALITY);
    mockTransaction.mockRejectedValue(new Error("DB connection failed"));

    // Should reject (route layer catches it with .catch())
    await expect(calculateAndPersistScores("4204202")).rejects.toThrow("DB connection failed");
  });
});

describe("getScoreHistory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna array vazio para município desconhecido", async () => {
    mockMunicipalityFindUnique.mockResolvedValue(null);

    const result = await getScoreHistory("0000000");

    expect(result).toEqual([]);
  });

  it("retorna array vazio quando município existe mas não tem scores", async () => {
    mockMunicipalityFindUnique.mockResolvedValue({ odsScores: [] });

    const result = await getScoreHistory("4204202");

    expect(result).toEqual([]);
  });

  it("retorna scores via nested select quando município tem histórico", async () => {
    const scores = [
      { ...MOCK_DB_SCORE, referenceYear: 2024 },
      { ...MOCK_DB_SCORE, referenceYear: 2023 },
      { ...MOCK_DB_SCORE, referenceYear: 2022 },
    ];
    mockMunicipalityFindUnique.mockResolvedValue({ odsScores: scores });

    const result = await getScoreHistory("4204202");

    expect(result).toHaveLength(3);
    // Verifica que usa nested select com orderBy e take
    expect(mockMunicipalityFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { ibgeCode: "4204202" },
        select: expect.objectContaining({
          odsScores: expect.objectContaining({
            orderBy: [{ referenceYear: "desc" }, { odsNumber: "asc" }],
          }),
        }),
      }),
    );
  });

  it("respeita o parâmetro limit", async () => {
    mockMunicipalityFindUnique.mockResolvedValue({ odsScores: [MOCK_DB_SCORE] });

    await getScoreHistory("4204202", undefined, 5);

    expect(mockMunicipalityFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          odsScores: expect.objectContaining({ take: 5 }),
        }),
      }),
    );
  });

  it("usa limit padrão de 100 quando não especificado", async () => {
    mockMunicipalityFindUnique.mockResolvedValue({ odsScores: [] });

    await getScoreHistory("4204202");

    expect(mockMunicipalityFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          odsScores: expect.objectContaining({ take: 100 }),
        }),
      }),
    );
  });

  it("filtra por odsNumber quando fornecido", async () => {
    mockMunicipalityFindUnique.mockResolvedValue({ odsScores: [MOCK_DB_SCORE] });

    await getScoreHistory("4204202", 3);

    expect(mockMunicipalityFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          odsScores: expect.objectContaining({
            where: { odsNumber: 3 },
          }),
        }),
      }),
    );
  });

  it("não inclui filtro odsNumber quando undefined", async () => {
    mockMunicipalityFindUnique.mockResolvedValue({ odsScores: [] });

    await getScoreHistory("4204202", undefined);

    const callArgs = mockMunicipalityFindUnique.mock.calls[0][0];
    expect(callArgs.select.odsScores.where).toBeUndefined();
  });

  it("aceita odsNumber=0 para filtrar score global", async () => {
    const globalScore = { ...MOCK_DB_SCORE, odsNumber: 0, sources: ["global"] };
    mockMunicipalityFindUnique.mockResolvedValue({ odsScores: [globalScore] });

    const result = await getScoreHistory("4204202", 0);

    expect(mockMunicipalityFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          odsScores: expect.objectContaining({
            where: { odsNumber: 0 },
          }),
        }),
      }),
    );
    expect(result).toHaveLength(1);
    expect(result[0].odsNumber).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// assessComparability
// ---------------------------------------------------------------------------

describe("assessComparability", () => {
  it("retorna single_point_only quando há só 1 ponto com score", () => {
    const result = assessComparability([{ referenceYear: 2025, score: 75, indicatorCount: 17 }]);

    expect(result.enabled).toBe(false);
    expect(result.reason).toBe("single_point_only");
    expect(result.delta).toBeNull();
  });

  it("retorna missing_global_score quando não há pontos com score", () => {
    const result = assessComparability([{ referenceYear: 2023, score: null, indicatorCount: 0 }]);

    expect(result.enabled).toBe(false);
    expect(result.reason).toBe("missing_global_score");
  });

  it("retorna insufficient_coverage quando um ano tem < 12 ODS", () => {
    const result = assessComparability([
      { referenceYear: 2023, score: 52, indicatorCount: 1 },
      { referenceYear: 2025, score: 75, indicatorCount: 17 },
    ]);

    expect(result.enabled).toBe(false);
    expect(result.reason).toBe("insufficient_coverage");
    expect(result.previousCoverage).toBe(1);
    expect(result.currentCoverage).toBe(17);
  });

  it("retorna coverage_mismatch quando diferença > 2 ODS", () => {
    const result = assessComparability([
      { referenceYear: 2023, score: 65, indicatorCount: 12 },
      { referenceYear: 2025, score: 75, indicatorCount: 17 },
    ]);

    expect(result.enabled).toBe(false);
    expect(result.reason).toBe("coverage_mismatch");
  });

  it("retorna ok com delta quando ambos têm >= 12 ODS e diferença <= 2", () => {
    const result = assessComparability([
      { referenceYear: 2024, score: 70, indicatorCount: 16 },
      { referenceYear: 2025, score: 75, indicatorCount: 17 },
    ]);

    expect(result.enabled).toBe(true);
    expect(result.reason).toBe("ok");
    expect(result.delta).toBe(5);
    expect(result.currentYear).toBe(2025);
    expect(result.previousYear).toBe(2024);
  });

  it("retorna ok quando cobertura é exatamente igual", () => {
    const result = assessComparability([
      { referenceYear: 2024, score: 80, indicatorCount: 15 },
      { referenceYear: 2025, score: 75, indicatorCount: 15 },
    ]);

    expect(result.enabled).toBe(true);
    expect(result.reason).toBe("ok");
    expect(result.delta).toBe(-5);
  });

  it("considera apenas os 2 últimos pontos válidos", () => {
    const result = assessComparability([
      { referenceYear: 2021, score: 30, indicatorCount: 3 },
      { referenceYear: 2024, score: 70, indicatorCount: 16 },
      { referenceYear: 2025, score: 75, indicatorCount: 17 },
    ]);

    expect(result.enabled).toBe(true);
    expect(result.reason).toBe("ok");
    expect(result.previousYear).toBe(2024);
    expect(result.currentYear).toBe(2025);
  });
});
