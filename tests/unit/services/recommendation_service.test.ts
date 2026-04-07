import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockGenerateEsgReport, mockCompareAgainstBenchmark, mockWithCache } = vi.hoisted(() => ({
  mockGenerateEsgReport: vi.fn(),
  mockCompareAgainstBenchmark: vi.fn(),
  // passthrough: invoca a fn diretamente, sem Redis
  mockWithCache: vi.fn((_key: string, _ttl: number, fn: () => unknown) => fn()),
}));

vi.mock("../../../backend/services/reports/report_service.js", () => ({
  generateEsgReport: mockGenerateEsgReport,
}));

vi.mock("../../../backend/services/benchmarks/benchmark_service.js", () => ({
  compareAgainstBenchmark: mockCompareAgainstBenchmark,
}));

vi.mock("../../../backend/utils/cache.js", () => ({
  withCache: mockWithCache,
}));

vi.mock("../../../backend/utils/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// ─── Import após mocks ────────────────────────────────────────────────────────

const { generateRecommendations } =
  await import("../../../backend/services/recommendations/recommendation_service.js");

type RecommendationReport =
  import("../../../backend/services/recommendations/recommendation_service.js").RecommendationReport;
type SmartRecommendation =
  import("../../../backend/services/recommendations/recommendation_service.js").SmartRecommendation;

// ─── Factories ────────────────────────────────────────────────────────────────

/**
 * Cria um OdsReportDetail mínimo compatível com o que generateEsgReport retorna.
 * score === null indica ODS sem dados coletados.
 */
function makeOdsDetail(
  odsNumber: number,
  score: number | null,
): {
  odsNumber: number;
  name: string;
  shortName: string;
  color: string;
  score: number | null;
  status: string | null;
  indicatorCount: number;
  sources: string[];
  indicators: Array<{ name: string; value: number | null; score: number | null; source: string }>;
} {
  return {
    odsNumber,
    name: `ODS ${odsNumber}`,
    shortName: `ODS${odsNumber}`,
    color: "#000000",
    score,
    status: score === null ? null : score >= 70 ? "verde" : score >= 40 ? "amarelo" : "vermelho",
    indicatorCount: score !== null ? 1 : 0,
    sources: score !== null ? ["test"] : [],
    indicators: [],
  };
}

/**
 * Cria um EsgReport completo com apenas os ODS especificados com dados.
 * Os demais 17 ODS terão score null (sem dados).
 */
function makeEsgReport(
  ibgeCode: string,
  municipalityName: string | null,
  odsScores: Partial<Record<number, number>>,
) {
  const odsDetails = Array.from({ length: 17 }, (_, i) => {
    const num = i + 1;
    const score = odsScores[num] ?? null;
    return makeOdsDetail(num, score);
  });

  return {
    ibgeCode,
    municipalityName,
    generatedAt: new Date().toISOString(),
    referenceYear: 2024,
    executiveSummary: "resumo de teste",
    globalScore: 55,
    globalStatus: "amarelo",
    coverage: { total: 17, withData: Object.keys(odsScores).length, percentage: 100 },
    statusBreakdown: { verde: 0, amarelo: 0, vermelho: 0 },
    odsDetails,
    recommendations: [],
    strengths: [],
    weaknesses: [],
  };
}

/**
 * Cria uma entrada de comparação de benchmark para um ODS específico.
 * delta positivo = município acima da média.
 */
function makeBenchmarkComparison(
  odsNumber: number,
  municipalityScore: number | null,
  benchmarkAverage: number | null,
) {
  const delta =
    municipalityScore !== null && benchmarkAverage !== null
      ? municipalityScore - benchmarkAverage
      : null;
  const aboveAverage = delta !== null ? delta >= 0 : null;

  return { odsNumber, municipalityScore, benchmarkAverage, delta, aboveAverage };
}

/** Constrói o retorno completo de compareAgainstBenchmark. */
function makeBenchmarkResult(
  ibgeCode: string,
  comparisons: Array<{
    odsNumber: number;
    municipalityScore: number | null;
    benchmarkAverage: number | null;
  }>,
) {
  const comparison = Array.from({ length: 17 }, (_, i) => {
    const num = i + 1;
    const entry = comparisons.find((c) => c.odsNumber === num);
    if (entry) return makeBenchmarkComparison(num, entry.municipalityScore, entry.benchmarkAverage);
    return makeBenchmarkComparison(num, null, null);
  });

  return {
    municipality: { ibgeCode, globalScore: 55 },
    benchmark: { globalAverage: 65 },
    comparison,
  };
}

// ─── Testes ───────────────────────────────────────────────────────────────────

describe("RecommendationService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // cache passthrough por padrão (executa fn diretamente)
    mockWithCache.mockImplementation((_key: string, _ttl: number, fn: () => unknown) => fn());
  });

  // ── Teste 1: retorna recomendações para município com ODS abaixo de 70 ──────

  it("retorna recomendações para município com ODS abaixo de 70", async () => {
    mockGenerateEsgReport.mockResolvedValue(makeEsgReport("4204202", "Blumenau", { 1: 35, 4: 55 }));
    mockCompareAgainstBenchmark.mockResolvedValue(
      makeBenchmarkResult("4204202", [
        { odsNumber: 1, municipalityScore: 35, benchmarkAverage: 60 },
        { odsNumber: 4, municipalityScore: 55, benchmarkAverage: 60 },
      ]),
    );

    const result = await generateRecommendations("4204202");

    expect(result).not.toBeNull();
    expect((result as RecommendationReport).recommendations.length).toBeGreaterThan(0);
    expect((result as RecommendationReport).recommendations.every((r) => r.currentScore < 70)).toBe(
      true,
    );
  });

  // ── Teste 2: prioridade "critica" quando score < 40 E abaixo da média ───────

  it("atribui prioridade critica quando score < 40 e abaixo da média estadual", async () => {
    // ODS 1 score=30, média estadual=60 → delta=-30 → abaixo da média → critica
    mockGenerateEsgReport.mockResolvedValue(makeEsgReport("4204202", "Blumenau", { 1: 30 }));
    mockCompareAgainstBenchmark.mockResolvedValue(
      makeBenchmarkResult("4204202", [
        { odsNumber: 1, municipalityScore: 30, benchmarkAverage: 60 },
      ]),
    );

    const result = (await generateRecommendations("4204202")) as RecommendationReport;
    const ods1 = result.recommendations.find((r) => r.odsNumber === 1);

    expect(ods1).toBeDefined();
    expect(ods1!.priority).toBe("critica");
  });

  // ── Teste 3: prioridade "alta" quando score < 40 mas acima da média ─────────

  it("atribui prioridade alta quando score < 40 mas acima da média estadual", async () => {
    // ODS 2 score=38, média estadual=30 → delta=+8 → acima da média → alta (não critica)
    mockGenerateEsgReport.mockResolvedValue(makeEsgReport("4204202", "Blumenau", { 2: 38 }));
    mockCompareAgainstBenchmark.mockResolvedValue(
      makeBenchmarkResult("4204202", [
        { odsNumber: 2, municipalityScore: 38, benchmarkAverage: 30 },
      ]),
    );

    const result = (await generateRecommendations("4204202")) as RecommendationReport;
    const ods2 = result.recommendations.find((r) => r.odsNumber === 2);

    expect(ods2).toBeDefined();
    expect(ods2!.priority).toBe("alta");
  });

  // ── Teste 4: prioridade "media" quando score 40–69 ──────────────────────────

  it("atribui prioridade media quando score está entre 40 e 69", async () => {
    // ODS 6 score=55 → não é < 40, logo media independente do benchmark
    mockGenerateEsgReport.mockResolvedValue(makeEsgReport("4204202", "Blumenau", { 6: 55 }));
    mockCompareAgainstBenchmark.mockResolvedValue(
      makeBenchmarkResult("4204202", [
        { odsNumber: 6, municipalityScore: 55, benchmarkAverage: 70 },
      ]),
    );

    const result = (await generateRecommendations("4204202")) as RecommendationReport;
    const ods6 = result.recommendations.find((r) => r.odsNumber === 6);

    expect(ods6).toBeDefined();
    expect(ods6!.priority).toBe("media");
  });

  // ── Teste 5: não gera recomendação para ODS >= 70 ───────────────────────────

  it("nao gera recomendacao para ODS com score >= 70", async () => {
    // ODS 3 score=75 → ponto forte, não recomendação; ODS 4 score=45 → recomendação
    mockGenerateEsgReport.mockResolvedValue(makeEsgReport("4204202", "Blumenau", { 3: 75, 4: 45 }));
    mockCompareAgainstBenchmark.mockResolvedValue(
      makeBenchmarkResult("4204202", [
        { odsNumber: 3, municipalityScore: 75, benchmarkAverage: 65 },
        { odsNumber: 4, municipalityScore: 45, benchmarkAverage: 60 },
      ]),
    );

    const result = (await generateRecommendations("4204202")) as RecommendationReport;
    const odsNumbers = result.recommendations.map((r) => r.odsNumber);

    expect(odsNumbers).not.toContain(3);
    expect(odsNumbers).toContain(4);
  });

  // ── Teste 6: strengths contém ODS >= 70 ordenados por score desc ────────────

  it("strengths contem ODS com score >= 70 ordenados por score decrescente", async () => {
    mockGenerateEsgReport.mockResolvedValue(
      makeEsgReport("4204202", "Blumenau", { 3: 85, 7: 72, 16: 90 }),
    );
    mockCompareAgainstBenchmark.mockResolvedValue(makeBenchmarkResult("4204202", []));

    const result = (await generateRecommendations("4204202")) as RecommendationReport;

    expect(result.strengths).toHaveLength(3);
    expect(result.strengths[0].score).toBe(90); // ODS 16
    expect(result.strengths[1].score).toBe(85); // ODS 3
    expect(result.strengths[2].score).toBe(72); // ODS 7
    expect(result.strengths.every((s) => s.score >= 70)).toBe(true);
  });

  // ── Teste 7: summary menciona quantidade de ODS críticos ────────────────────

  it("summary menciona a quantidade de ODS em situacao critica", async () => {
    // 2 ODS críticos: score < 40 e abaixo da média
    mockGenerateEsgReport.mockResolvedValue(makeEsgReport("4204202", "Blumenau", { 1: 20, 6: 35 }));
    mockCompareAgainstBenchmark.mockResolvedValue(
      makeBenchmarkResult("4204202", [
        { odsNumber: 1, municipalityScore: 20, benchmarkAverage: 60 },
        { odsNumber: 6, municipalityScore: 35, benchmarkAverage: 65 },
      ]),
    );

    const result = (await generateRecommendations("4204202")) as RecommendationReport;

    expect(result.criticalCount).toBe(2);
    expect(result.summary).toContain("2");
    // O serviço menciona "crítica" ou "critica" no summary quando há críticos
    expect(result.summary.toLowerCase()).toMatch(/cr[íi]tica/);
  });

  // ── Teste 8: cada recomendação tem actions não vazio ────────────────────────

  it("cada recomendacao tem um array de actions nao vazio", async () => {
    mockGenerateEsgReport.mockResolvedValue(
      makeEsgReport("4204202", "Blumenau", { 1: 30, 4: 50, 6: 60 }),
    );
    mockCompareAgainstBenchmark.mockResolvedValue(makeBenchmarkResult("4204202", []));

    const result = (await generateRecommendations("4204202")) as RecommendationReport;

    expect(result.recommendations.length).toBeGreaterThan(0);
    result.recommendations.forEach((rec) => {
      expect(Array.isArray(rec.actions)).toBe(true);
      expect(rec.actions.length).toBeGreaterThan(0);
    });
  });

  // ── Teste 9: estimatedImpact baseado no gap ──────────────────────────────────

  it("estimatedImpact e Alto quando gap absoluto > 20", async () => {
    // gap = municipalidade - media = 30 - 70 = -40 → |gap| = 40 > 20 → Alto
    mockGenerateEsgReport.mockResolvedValue(makeEsgReport("4204202", "Blumenau", { 6: 30 }));
    mockCompareAgainstBenchmark.mockResolvedValue(
      makeBenchmarkResult("4204202", [
        { odsNumber: 6, municipalityScore: 30, benchmarkAverage: 70 },
      ]),
    );

    const result = (await generateRecommendations("4204202")) as RecommendationReport;
    const ods6 = result.recommendations.find((r) => r.odsNumber === 6);

    expect(ods6!.estimatedImpact).toBe("Alto");
  });

  it("estimatedImpact e Medio quando gap absoluto entre 10 e 20", async () => {
    // gap = 50 - 65 = -15 → |gap| = 15 → entre 10 e 20 → Médio
    mockGenerateEsgReport.mockResolvedValue(makeEsgReport("4204202", "Blumenau", { 4: 50 }));
    mockCompareAgainstBenchmark.mockResolvedValue(
      makeBenchmarkResult("4204202", [
        { odsNumber: 4, municipalityScore: 50, benchmarkAverage: 65 },
      ]),
    );

    const result = (await generateRecommendations("4204202")) as RecommendationReport;
    const ods4 = result.recommendations.find((r) => r.odsNumber === 4);

    expect(ods4!.estimatedImpact).toBe("Médio");
  });

  it("estimatedImpact e Baixo quando gap absoluto <= 10", async () => {
    // gap = 55 - 60 = -5 → |gap| = 5 ≤ 10 → Baixo
    mockGenerateEsgReport.mockResolvedValue(makeEsgReport("4204202", "Blumenau", { 8: 55 }));
    mockCompareAgainstBenchmark.mockResolvedValue(
      makeBenchmarkResult("4204202", [
        { odsNumber: 8, municipalityScore: 55, benchmarkAverage: 60 },
      ]),
    );

    const result = (await generateRecommendations("4204202")) as RecommendationReport;
    const ods8 = result.recommendations.find((r) => r.odsNumber === 8);

    expect(ods8!.estimatedImpact).toBe("Baixo");
  });

  it("estimatedImpact e Medio quando nao ha dados de benchmark", async () => {
    // sem benchmark → gap null → "Médio"
    mockGenerateEsgReport.mockResolvedValue(makeEsgReport("4204202", "Blumenau", { 3: 50 }));
    mockCompareAgainstBenchmark.mockResolvedValue(makeBenchmarkResult("4204202", []));

    const result = (await generateRecommendations("4204202")) as RecommendationReport;
    const ods3 = result.recommendations.find((r) => r.odsNumber === 3);

    expect(ods3!.estimatedImpact).toBe("Médio");
  });

  // ── Teste 10: cache — segunda chamada não re-calcula ────────────────────────

  it("segunda chamada usa cache e nao invoca generateEsgReport novamente", async () => {
    // Sobrescreve withCache para simular cache real: primeira chamada executa fn,
    // segunda chamada retorna o valor armazenado sem chamar fn novamente.
    let cachedValue: unknown;
    mockWithCache.mockImplementation(async (_key: string, _ttl: number, fn: () => unknown) => {
      if (cachedValue !== undefined) return cachedValue;
      cachedValue = await fn();
      return cachedValue;
    });

    mockGenerateEsgReport.mockResolvedValue(makeEsgReport("4204202", "Blumenau", { 4: 55 }));
    mockCompareAgainstBenchmark.mockResolvedValue(
      makeBenchmarkResult("4204202", [
        { odsNumber: 4, municipalityScore: 55, benchmarkAverage: 65 },
      ]),
    );

    await generateRecommendations("4204202");
    await generateRecommendations("4204202");

    expect(mockGenerateEsgReport).toHaveBeenCalledTimes(1);
  });

  // ── Teste 11: graceful degradation quando benchmark falha ────────────────────

  it("retorna resultado mesmo quando compareAgainstBenchmark lanca erro", async () => {
    mockGenerateEsgReport.mockResolvedValue(makeEsgReport("4204202", "Blumenau", { 3: 35, 6: 55 }));
    mockCompareAgainstBenchmark.mockRejectedValue(new Error("timeout ao chamar benchmark"));

    const result = await generateRecommendations("4204202");

    expect(result).not.toBeNull();
    const report = result as RecommendationReport;
    expect(report.recommendations.length).toBeGreaterThan(0);
    // Sem benchmark, ranking deve indicar ausência de dados comparativos
    report.recommendations.forEach((rec) => {
      expect(rec.ranking).toBe("sem dados de comparação estadual");
    });
  });

  // ── Teste 12: ODS sem dados (score null) são ignorados ──────────────────────

  it("ignora ODS sem dados (score null) e nao os inclui em recommendations nem strengths", async () => {
    // ODS 1 score=null (sem dados), ODS 4 score=45 (com dados)
    mockGenerateEsgReport.mockResolvedValue(makeEsgReport("4204202", "Blumenau", { 4: 45 }));
    mockCompareAgainstBenchmark.mockResolvedValue(
      makeBenchmarkResult("4204202", [
        { odsNumber: 4, municipalityScore: 45, benchmarkAverage: 60 },
      ]),
    );

    const result = (await generateRecommendations("4204202")) as RecommendationReport;

    const allOdsNumbers = [
      ...result.recommendations.map((r) => r.odsNumber),
      ...result.strengths.map((s) => s.odsNumber),
    ];

    // ODS 1 tem score null → não deve aparecer em nenhuma lista
    expect(allOdsNumbers).not.toContain(1);
    // Apenas ODS 4 deve estar presente (com dados)
    expect(allOdsNumbers).toContain(4);
  });

  // ── Teste 13: ordenação por prioridade (critica > alta > media) ──────────────

  it("ordena recomendacoes por prioridade: critica > alta > media", async () => {
    // ODS 1: score=30, abaixo da média → critica
    // ODS 2: score=38, acima da média → alta
    // ODS 6: score=55 → media
    mockGenerateEsgReport.mockResolvedValue(
      makeEsgReport("4204202", "Blumenau", { 1: 30, 2: 38, 6: 55 }),
    );
    mockCompareAgainstBenchmark.mockResolvedValue(
      makeBenchmarkResult("4204202", [
        { odsNumber: 1, municipalityScore: 30, benchmarkAverage: 65 }, // abaixo → critica
        { odsNumber: 2, municipalityScore: 38, benchmarkAverage: 25 }, // acima  → alta
        { odsNumber: 6, municipalityScore: 55, benchmarkAverage: 65 }, // media
      ]),
    );

    const result = (await generateRecommendations("4204202")) as RecommendationReport;
    const priorities = result.recommendations.map((r) => r.priority);

    const priorityRank = { critica: 0, alta: 1, media: 2 } as const;
    for (let i = 0; i < priorities.length - 1; i++) {
      expect(priorityRank[priorities[i] as keyof typeof priorityRank]).toBeLessThanOrEqual(
        priorityRank[priorities[i + 1] as keyof typeof priorityRank],
      );
    }
    expect(priorities[0]).toBe("critica");
    expect(priorities[priorities.length - 1]).toBe("media");
  });

  // ── Teste 14: investmentArea é sempre uma string válida ──────────────────────

  it("cada recomendacao tem investmentArea como string nao vazia", async () => {
    mockGenerateEsgReport.mockResolvedValue(
      makeEsgReport("4204202", "Blumenau", {
        1: 30,
        2: 45,
        3: 60,
        4: 35,
        5: 65,
        6: 20,
        7: 50,
        8: 38,
        9: 55,
        10: 48,
        11: 62,
        12: 25,
        13: 58,
        14: 42,
        15: 67,
        16: 32,
        17: 50,
      }),
    );
    mockCompareAgainstBenchmark.mockResolvedValue(makeBenchmarkResult("4204202", []));

    const result = (await generateRecommendations("4204202")) as RecommendationReport;

    result.recommendations.forEach((rec) => {
      expect(typeof rec.investmentArea).toBe("string");
      expect(rec.investmentArea.length).toBeGreaterThan(0);
    });
  });

  // ── Teste 15: totalRecommendations e criticalCount são corretos ──────────────

  it("totalRecommendations e criticalCount refletem exatamente as listas geradas", async () => {
    // ODS 1: critica (score=25, abaixo da média)
    // ODS 6: critica (score=30, abaixo da média)
    // ODS 4: alta (score=38, acima da média)
    // ODS 9: media (score=55)
    mockGenerateEsgReport.mockResolvedValue(
      makeEsgReport("4204202", "Blumenau", { 1: 25, 4: 38, 6: 30, 9: 55 }),
    );
    mockCompareAgainstBenchmark.mockResolvedValue(
      makeBenchmarkResult("4204202", [
        { odsNumber: 1, municipalityScore: 25, benchmarkAverage: 70 }, // critica
        { odsNumber: 4, municipalityScore: 38, benchmarkAverage: 20 }, // alta (acima da média)
        { odsNumber: 6, municipalityScore: 30, benchmarkAverage: 65 }, // critica
        { odsNumber: 9, municipalityScore: 55, benchmarkAverage: 60 }, // media
      ]),
    );

    const result = (await generateRecommendations("4204202")) as RecommendationReport;

    expect(result.totalRecommendations).toBe(4);
    expect(result.totalRecommendations).toBe(result.recommendations.length);
    expect(result.criticalCount).toBe(2);
    expect(result.criticalCount).toBe(
      result.recommendations.filter((r) => r.priority === "critica").length,
    );
  });

  // ── Teste adicional: retorna null quando generateEsgReport retorna null ──────

  it("retorna null quando nao ha dados ESG para o municipio", async () => {
    mockGenerateEsgReport.mockResolvedValue(null);

    const result = await generateRecommendations("0000000");

    expect(result).toBeNull();
  });

  // ── Teste adicional: município sem nenhum ODS com problemas ─────────────────

  it("retorna lista vazia de recommendations quando todos ODS estao verde", async () => {
    mockGenerateEsgReport.mockResolvedValue(
      makeEsgReport("4205407", "Florianópolis", { 3: 80, 4: 75, 6: 90 }),
    );
    mockCompareAgainstBenchmark.mockResolvedValue(
      makeBenchmarkResult("4205407", [
        { odsNumber: 3, municipalityScore: 80, benchmarkAverage: 65 },
        { odsNumber: 4, municipalityScore: 75, benchmarkAverage: 65 },
        { odsNumber: 6, municipalityScore: 90, benchmarkAverage: 70 },
      ]),
    );

    const result = (await generateRecommendations("4205407")) as RecommendationReport;

    expect(result.recommendations).toHaveLength(0);
    expect(result.totalRecommendations).toBe(0);
    expect(result.criticalCount).toBe(0);
    expect(result.strengths).toHaveLength(3);
    expect(result.summary).toContain("satisfatório");
  });
});
