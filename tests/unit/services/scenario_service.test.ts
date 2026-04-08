import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockGenerateRecommendations, mockWithCache } = vi.hoisted(() => ({
  mockGenerateRecommendations: vi.fn(),
  // passthrough: invoca fn diretamente, sem Redis
  mockWithCache: vi.fn((_key: string, _ttl: number, fn: () => unknown) => fn()),
}));

vi.mock("../../../backend/services/recommendations/recommendation_service.js", () => ({
  generateRecommendations: mockGenerateRecommendations,
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

const { computeRecommendedScenario } =
  await import("../../../backend/services/recommendations/scenario_service.js");

type RecommendedScenario =
  import("../../../backend/services/recommendations/scenario_service.js").RecommendedScenario;
type SmartRecommendation =
  import("../../../backend/services/recommendations/recommendation_service.js").SmartRecommendation;

// ─── Factories ────────────────────────────────────────────────────────────────

/**
 * Cria um SmartRecommendation mínimo para uso nos testes do scenario_service.
 *
 * ODS_TO_AREA_MAP (shared/constants/ods_area_map.ts):
 *   3→health, 4→education, 6→sanitation, 7→energy, 8→urbanization,
 *   9→urbanization, 12→environment, 13→environment, 15→environment,
 *   16→governance, 1→governance, 2→governance, 5→governance,
 *   10→governance, 17→governance
 *
 * "security" tem ZERO ODS mapeados — nunca recebe peso.
 */
function makeRecommendation(
  odsNumber: number,
  priority: SmartRecommendation["priority"],
  gap: number | null = null,
): SmartRecommendation {
  return {
    odsNumber,
    odsName: `ODS ${odsNumber}`,
    priority,
    currentScore: 50,
    stateAverage: gap !== null ? 50 - gap : null,
    gap,
    ranking: gap !== null ? "abaixo da média estadual" : "sem dados de comparação estadual",
    actions: ["ação de teste"],
    investmentArea: "área de teste",
    estimatedImpact: "Médio",
  };
}

/** Cria o retorno de generateRecommendations com as recomendações fornecidas. */
function makeRecommendationReport(
  ibgeCode: string,
  municipalityName: string | null,
  recommendations: SmartRecommendation[],
) {
  return {
    ibgeCode,
    municipalityName,
    generatedAt: new Date().toISOString(),
    totalRecommendations: recommendations.length,
    criticalCount: recommendations.filter((r) => r.priority === "critica").length,
    summary: "resumo de teste",
    recommendations,
    strengths: [],
  };
}

// ─── Constantes derivadas do código ──────────────────────────────────────────
//
// ALL_INVESTMENT_AREAS (shared/constants/ods_area_map.ts):
//   ["education","health","sanitation","environment","security","energy","urbanization","governance"]
//
// buildEqualSplit: base = floor(100/8) = 12, remainder = 4
//   → education=13, health=13, sanitation=13, environment=13,
//     security=12, energy=12, urbanization=12, governance=12
//
// PRIORITY_WEIGHT: critica=3, alta=2, media=1
// getGapFactor: |gap|>20→1.5, |gap|>10→1.25, else 1.0

const EQUAL_SPLIT_EXPECTED = {
  education: 13,
  health: 13,
  sanitation: 13,
  environment: 13,
  security: 12,
  energy: 12,
  urbanization: 12,
  governance: 12,
};

// ─── Testes ───────────────────────────────────────────────────────────────────

describe("ScenarioService — computeRecommendedScenario", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // cache passthrough por padrão
    mockWithCache.mockImplementation((_key: string, _ttl: number, fn: () => unknown) => fn());
  });

  // ── 1. Retorno nulo quando generateRecommendations retorna null ──────────────

  it("retorna null quando nao ha recomendacoes para o municipio", async () => {
    mockGenerateRecommendations.mockResolvedValue(null);

    const result = await computeRecommendedScenario("0000000");

    expect(result).toBeNull();
  });

  // ── 2. Equal split quando lista de recomendações está vazia ─────────────────

  it("usa equal split quando lista de recomendacoes esta vazia", async () => {
    mockGenerateRecommendations.mockResolvedValue(
      makeRecommendationReport("4204202", "Blumenau", []),
    );

    const result = (await computeRecommendedScenario("4204202")) as RecommendedScenario;

    expect(result).not.toBeNull();
    expect(result.allocation).toEqual(EQUAL_SPLIT_EXPECTED);
    expect(result.reasoning).toHaveLength(0);
    expect(result.allOdsGreen).toBe(true);
    expect(result.basedOnRecommendations).toBe(0);
  });

  // ── 3. Equal split soma exatamente 100 ──────────────────────────────────────

  it("equal split soma exatamente 100", async () => {
    mockGenerateRecommendations.mockResolvedValue(
      makeRecommendationReport("4204202", "Blumenau", []),
    );

    const result = (await computeRecommendedScenario("4204202")) as RecommendedScenario;
    const total = Object.values(result.allocation).reduce((sum, v) => sum + v, 0);

    expect(total).toBe(100);
  });

  // ── 4. Alocação ponderada soma exatamente 100 ────────────────────────────────

  it("alocacao ponderada soma exatamente 100", async () => {
    // ODS 3→health (critica, gap=null): peso = 3 * 1.0 = 3
    // ODS 4→education (alta, gap=null): peso = 2 * 1.0 = 2
    // ODS 6→sanitation (media, gap=null): peso = 1 * 1.0 = 1
    mockGenerateRecommendations.mockResolvedValue(
      makeRecommendationReport("4204202", "Blumenau", [
        makeRecommendation(3, "critica"),
        makeRecommendation(4, "alta"),
        makeRecommendation(6, "media"),
      ]),
    );

    const result = (await computeRecommendedScenario("4204202")) as RecommendedScenario;
    const total = Object.values(result.allocation).reduce((sum, v) => sum + v, 0);

    expect(total).toBe(100);
  });

  // ── 5. Matemática de pesos: critica(3) × gap_factor(>20→1.5) ────────────────
  //
  // ODS 3 → health, prioridade critica, gap = -25 (|gap|=25 > 20 → 1.5)
  //   rawWeight = 3 * 1.5 = 4.5
  // Único ODS com dados → totalWeight = 4.5
  // health = floor(4.5/4.5 * 100) = 100; remainder = 0
  // Todas as outras áreas = floor(0/4.5 * 100) = 0

  it("aplica PRIORITY_WEIGHT critica(3) e gap_factor 1.5 para gap > 20", async () => {
    mockGenerateRecommendations.mockResolvedValue(
      makeRecommendationReport("4204202", "Blumenau", [
        makeRecommendation(3, "critica", -25), // ODS 3 → health
      ]),
    );

    const result = (await computeRecommendedScenario("4204202")) as RecommendedScenario;

    expect(result.allocation.health).toBe(100);
    // Todas as demais áreas devem ser 0 (apenas uma recomendação, uma área)
    expect(result.allocation.education).toBe(0);
    expect(result.allocation.sanitation).toBe(0);
    expect(result.allocation.environment).toBe(0);
    expect(result.allocation.security).toBe(0);
    expect(result.allocation.energy).toBe(0);
    expect(result.allocation.urbanization).toBe(0);
    expect(result.allocation.governance).toBe(0);
  });

  // ── 6. Matemática de pesos: alta(2) × gap_factor(>10→1.25) ─────────────────
  //
  // ODS 4 → education, prioridade alta, gap = -15 (|gap|=15 > 10 → 1.25)
  //   rawWeight = 2 * 1.25 = 2.5
  // ODS 6 → sanitation, prioridade media, gap = null (→ 1.0)
  //   rawWeight = 1 * 1.0 = 1.0
  // totalWeight = 3.5
  // education = floor(2.5/3.5 * 100) = floor(71.42) = 71
  // sanitation = floor(1.0/3.5 * 100) = floor(28.57) = 28
  // remainder = 100 - (71 + 28) = 1 → vai para a área de maior peso (education)
  // Final: education=72, sanitation=28, restante=0

  it("aplica PRIORITY_WEIGHT alta(2) e gap_factor 1.25 para gap > 10", async () => {
    mockGenerateRecommendations.mockResolvedValue(
      makeRecommendationReport("4204202", "Blumenau", [
        makeRecommendation(4, "alta", -15), // education: 2 * 1.25 = 2.5
        makeRecommendation(6, "media", null), // sanitation: 1 * 1.0 = 1.0
      ]),
    );

    const result = (await computeRecommendedScenario("4204202")) as RecommendedScenario;

    // totalWeight = 3.5
    // education = floor(2.5/3.5 * 100) = 71, +1 remainder = 72
    // sanitation = floor(1.0/3.5 * 100) = 28
    expect(result.allocation.education).toBe(72);
    expect(result.allocation.sanitation).toBe(28);
    expect(result.allocation.security).toBe(0);

    const total = Object.values(result.allocation).reduce((sum, v) => sum + v, 0);
    expect(total).toBe(100);
  });

  // ── 7. gap_factor 1.0 para gap <= 10 ────────────────────────────────────────
  //
  // ODS 7 → energy, critica, gap = -5 (|gap|=5 ≤ 10 → 1.0)
  //   rawWeight = 3 * 1.0 = 3.0
  // Única área → energy=100

  it("aplica gap_factor 1.0 quando gap absoluto e <= 10", async () => {
    mockGenerateRecommendations.mockResolvedValue(
      makeRecommendationReport("4204202", "Blumenau", [
        makeRecommendation(7, "critica", -5), // energy: 3 * 1.0 = 3
      ]),
    );

    const result = (await computeRecommendedScenario("4204202")) as RecommendedScenario;

    expect(result.allocation.energy).toBe(100);
    const total = Object.values(result.allocation).reduce((sum, v) => sum + v, 0);
    expect(total).toBe(100);
  });

  // ── 8. security NUNCA recebe alocação ponderada ──────────────────────────────
  //
  // Nenhum ODS no ODS_TO_AREA_MAP aponta para "security".
  // Mesmo com múltiplas recomendações pesadas, security deve ser 0.

  it("security sempre recebe 0 na alocacao ponderada pois nenhum ODS mapeia para ela", async () => {
    // Todos os 8 ODS mapeados para diferentes áreas (exceto security)
    mockGenerateRecommendations.mockResolvedValue(
      makeRecommendationReport("4204202", "Blumenau", [
        makeRecommendation(3, "critica", -30), // health
        makeRecommendation(4, "critica", -30), // education
        makeRecommendation(6, "critica", -30), // sanitation
        makeRecommendation(12, "critica", -30), // environment
        makeRecommendation(7, "critica", -30), // energy
        makeRecommendation(8, "critica", -30), // urbanization
        makeRecommendation(1, "critica", -30), // governance
      ]),
    );

    const result = (await computeRecommendedScenario("4204202")) as RecommendedScenario;

    expect(result.allocation.security).toBe(0);
    const total = Object.values(result.allocation).reduce((sum, v) => sum + v, 0);
    expect(total).toBe(100);
  });

  // ── 9. Múltiplos ODS na mesma área acumulam pesos ────────────────────────────
  //
  // ODS 8 → urbanization, critica, gap=null: peso = 3 * 1.0 = 3
  // ODS 9 → urbanization, alta, gap=null:   peso = 2 * 1.0 = 2
  // urbanization acumulado = 5
  //
  // ODS 3 → health, critica, gap=null: peso = 3 * 1.0 = 3
  //
  // totalWeight = 5 + 3 = 8
  // urbanization = floor(5/8 * 100) = floor(62.5) = 62
  // health = floor(3/8 * 100) = floor(37.5) = 37
  // remainder = 100 - 99 = 1 → top area (urbanization, peso 5)
  // Final: urbanization=63, health=37

  it("dois ODS na mesma area acumulam pesos corretamente", async () => {
    mockGenerateRecommendations.mockResolvedValue(
      makeRecommendationReport("4204202", "Blumenau", [
        makeRecommendation(8, "critica", null), // urbanization: 3
        makeRecommendation(9, "alta", null), // urbanization: 2  → total=5
        makeRecommendation(3, "critica", null), // health: 3
      ]),
    );

    const result = (await computeRecommendedScenario("4204202")) as RecommendedScenario;

    expect(result.allocation.urbanization).toBe(63);
    expect(result.allocation.health).toBe(37);
    expect(result.allocation.security).toBe(0);
    const total = Object.values(result.allocation).reduce((sum, v) => sum + v, 0);
    expect(total).toBe(100);
  });

  // ── 10. allOdsGreen = false quando há recomendações ─────────────────────────

  it("allOdsGreen e false quando ha recomendacoes", async () => {
    mockGenerateRecommendations.mockResolvedValue(
      makeRecommendationReport("4204202", "Blumenau", [makeRecommendation(4, "media")]),
    );

    const result = (await computeRecommendedScenario("4204202")) as RecommendedScenario;

    expect(result.allOdsGreen).toBe(false);
  });

  // ── 11. allOdsGreen = true quando não há recomendações (equal split) ─────────

  it("allOdsGreen e true quando nao ha recomendacoes (todos ODS verdes)", async () => {
    mockGenerateRecommendations.mockResolvedValue(
      makeRecommendationReport("4205407", "Florianópolis", []),
    );

    const result = (await computeRecommendedScenario("4205407")) as RecommendedScenario;

    expect(result.allOdsGreen).toBe(true);
  });

  // ── 12. basedOnRecommendations reflete o tamanho da lista ───────────────────

  it("basedOnRecommendations reflete o numero de recomendacoes recebidas", async () => {
    const recs = [
      makeRecommendation(3, "critica"),
      makeRecommendation(4, "alta"),
      makeRecommendation(6, "media"),
    ];
    mockGenerateRecommendations.mockResolvedValue(
      makeRecommendationReport("4204202", "Blumenau", recs),
    );

    const result = (await computeRecommendedScenario("4204202")) as RecommendedScenario;

    expect(result.basedOnRecommendations).toBe(3);
  });

  // ── 13. reasoning contem apenas áreas com alocação > 0 ──────────────────────

  it("reasoning contem apenas as areas que receberam alocacao positiva", async () => {
    // Apenas ODS 3 → health
    mockGenerateRecommendations.mockResolvedValue(
      makeRecommendationReport("4204202", "Blumenau", [makeRecommendation(3, "critica")]),
    );

    const result = (await computeRecommendedScenario("4204202")) as RecommendedScenario;

    expect(result.reasoning).toHaveLength(1);
    expect(result.reasoning[0].area).toBe("health");
    expect(result.reasoning[0].percentage).toBe(100);
    expect(result.reasoning[0].odsNumbers).toContain(3);
  });

  // ── 14. reasoning odsNumbers agrupa corretamente múltiplos ODS de uma área ──

  it("reasoning odsNumbers lista todos os ODS contribuindo para a area", async () => {
    // ODS 8 e 9 ambos → urbanization
    mockGenerateRecommendations.mockResolvedValue(
      makeRecommendationReport("4204202", "Blumenau", [
        makeRecommendation(8, "alta"),
        makeRecommendation(9, "media"),
      ]),
    );

    const result = (await computeRecommendedScenario("4204202")) as RecommendedScenario;

    const urbanizationReasoning = result.reasoning.find((r) => r.area === "urbanization");
    expect(urbanizationReasoning).toBeDefined();
    expect(urbanizationReasoning!.odsNumbers).toContain(8);
    expect(urbanizationReasoning!.odsNumbers).toContain(9);
    // Sem duplicatas
    expect(new Set(urbanizationReasoning!.odsNumbers).size).toBe(
      urbanizationReasoning!.odsNumbers.length,
    );
  });

  // ── 15. Campos de identidade do resultado ────────────────────────────────────

  it("resultado carrega ibgeCode, municipalityName e totalAmount corretos", async () => {
    mockGenerateRecommendations.mockResolvedValue(
      makeRecommendationReport("4205407", "Florianópolis", []),
    );

    const result = (await computeRecommendedScenario("4205407")) as RecommendedScenario;

    expect(result.ibgeCode).toBe("4205407");
    expect(result.municipalityName).toBe("Florianópolis");
    expect(result.totalAmount).toBeNull();
  });

  // ── 16. Comportamento de cache — segunda chamada não re-computa ──────────────

  it("segunda chamada usa cache e nao invoca generateRecommendations novamente", async () => {
    // Simula cache real: primeira chamada executa fn, segunda retorna valor armazenado
    let cachedValue: unknown;
    mockWithCache.mockImplementation(async (_key: string, _ttl: number, fn: () => unknown) => {
      if (cachedValue !== undefined) return cachedValue;
      cachedValue = await fn();
      return cachedValue;
    });

    mockGenerateRecommendations.mockResolvedValue(
      makeRecommendationReport("4204202", "Blumenau", [makeRecommendation(3, "critica")]),
    );

    await computeRecommendedScenario("4204202");
    await computeRecommendedScenario("4204202");

    expect(mockGenerateRecommendations).toHaveBeenCalledTimes(1);
  });

  // ── 17. Cache key inclui o ibgeCode ─────────────────────────────────────────

  it("withCache e chamado com chave que inclui ibgeCode", async () => {
    mockGenerateRecommendations.mockResolvedValue(
      makeRecommendationReport("4204202", "Blumenau", []),
    );

    await computeRecommendedScenario("4204202");

    expect(mockWithCache).toHaveBeenCalledWith(
      expect.stringContaining("4204202"),
      3600,
      expect.any(Function),
    );
  });

  // ── 18. ODS sem mapeamento de área são silenciosamente ignorados ─────────────
  //
  // Se um ODS não existir em ODS_TO_AREA_MAP, o loop faz `continue`.
  // Testamos com um ODS inexistente (999) — o serviço não deve travar.
  // Como o ODS 999 é ignorado, o totalWeight fica 0 → equal split.

  it("ODS sem mapeamento de area nao causa erro e resultado ainda soma 100", async () => {
    const invalidOdsRec = makeRecommendation(999, "critica"); // sem mapeamento
    mockGenerateRecommendations.mockResolvedValue(
      makeRecommendationReport("4204202", "Blumenau", [invalidOdsRec]),
    );

    const result = (await computeRecommendedScenario("4204202")) as RecommendedScenario;

    // ODS 999 ignorado → totalWeight=0 → equal split
    const total = Object.values(result.allocation).reduce((sum, v) => sum + v, 0);
    expect(total).toBe(100);
    expect(result.allocation).toEqual(EQUAL_SPLIT_EXPECTED);
  });

  // ── 19. Recomendação única — todos pesos concentrados numa área ──────────────

  it("recomendacao unica concentra 100 pct na area correspondente", async () => {
    // ODS 16 → governance
    mockGenerateRecommendations.mockResolvedValue(
      makeRecommendationReport("4204202", "Blumenau", [makeRecommendation(16, "alta")]),
    );

    const result = (await computeRecommendedScenario("4204202")) as RecommendedScenario;

    expect(result.allocation.governance).toBe(100);
    const othersSum = Object.entries(result.allocation)
      .filter(([area]) => area !== "governance")
      .reduce((sum, [, v]) => sum + v, 0);
    expect(othersSum).toBe(0);
  });

  // ── 20. Todas as prioridades críticas — distribuição proporcional por área ───
  //
  // ODS 3 → health:      critica, gap=null → 3 * 1.0 = 3
  // ODS 4 → education:   critica, gap=null → 3 * 1.0 = 3
  // totalWeight = 6
  // health = floor(3/6 * 100) = 50
  // education = floor(3/6 * 100) = 50
  // remainder = 0

  it("todas as recomendacoes criticas distribuem proporcionalmente entre areas", async () => {
    mockGenerateRecommendations.mockResolvedValue(
      makeRecommendationReport("4204202", "Blumenau", [
        makeRecommendation(3, "critica", null), // health: 3
        makeRecommendation(4, "critica", null), // education: 3
      ]),
    );

    const result = (await computeRecommendedScenario("4204202")) as RecommendedScenario;

    expect(result.allocation.health).toBe(50);
    expect(result.allocation.education).toBe(50);
    expect(result.allocation.security).toBe(0);
    const total = Object.values(result.allocation).reduce((sum, v) => sum + v, 0);
    expect(total).toBe(100);
  });

  // ── 21. municipalityName null é preservado ───────────────────────────────────

  it("preserva municipalityName null quando municipio nao tem nome", async () => {
    mockGenerateRecommendations.mockResolvedValue(makeRecommendationReport("4200051", null, []));

    const result = (await computeRecommendedScenario("4200051")) as RecommendedScenario;

    expect(result.municipalityName).toBeNull();
  });

  // ── 22. reasoning justification contém odsNumber e prioridade ───────────────

  it("reasoning justification contem o numero do ODS e a prioridade", async () => {
    mockGenerateRecommendations.mockResolvedValue(
      makeRecommendationReport("4204202", "Blumenau", [
        makeRecommendation(3, "critica"), // health
      ]),
    );

    const result = (await computeRecommendedScenario("4204202")) as RecommendedScenario;

    expect(result.reasoning.length).toBeGreaterThan(0);
    const justification = result.reasoning[0].justification;
    expect(justification).toContain("3"); // odsNumber
    expect(justification).toContain("critica"); // priority
  });
});
