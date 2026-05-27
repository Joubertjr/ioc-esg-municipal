import { describe, it, expect } from "vitest";
import { mapEsgReportToExecutiveReport } from "../../../../backend/services/agent/executive_report_mapper.js";
import { ExecutiveReportSchema } from "../../../../backend/services/agent/schemas.js";
import type { EsgReport } from "../../../../backend/services/reports/report_service.js";
import type { MunicipalOdsReport } from "../../../../backend/services/ods/ods_score_service.js";

const ESG_FIXTURE: EsgReport = {
  ibgeCode: "4205407",
  municipalityName: "Florianópolis",
  generatedAt: "2026-05-27T12:00:00.000Z",
  referenceYear: 2024,
  executiveSummary:
    "O município apresenta score ESG global de 55/100, indicando desempenho moderado, com oportunidades de melhoria.",
  globalScore: 55,
  globalStatus: "amarelo",
  coverage: { total: 17, withData: 3, percentage: 18 },
  statusBreakdown: { verde: 1, amarelo: 1, vermelho: 1 },
  odsDetails: [],
  recommendations: [
    {
      odsNumber: 6,
      odsName: "Água potável e saneamento",
      currentScore: 35,
      targetScore: 70,
      priority: "alta",
      investmentArea: "saneamento básico",
      description:
        "Investir em saneamento básico para elevar o score de 35 para 70 (+35 pontos). Prioridade alta — score abaixo de 40.",
    },
  ],
  strengths: [],
  weaknesses: [],
};

const MUNICIPAL_FIXTURE: MunicipalOdsReport = {
  ibgeCode: "4205407",
  municipalityName: "Florianópolis",
  referenceYear: 2024,
  globalScore: 55,
  globalStatus: "amarelo",
  geometricScore: 50,
  geometricStatus: "amarelo",
  odsCount: { total: 17, withData: 3, verde: 1, amarelo: 1, vermelho: 1 },
  dataFreshness: {
    newestYear: 2024,
    oldestYear: 2022,
    ageYears: 2,
    staleness: "recent",
    sources: [{ name: "IBGE", referenceYear: 2024, ageYears: 2, staleness: "recent" }],
  },
  ods: [
    {
      odsNumber: 3,
      name: "Saúde",
      shortName: "ODS 3",
      color: "#4C9F38",
      weight: 1,
      score: 65,
      status: "amarelo",
      indicators: [
        {
          id: "1",
          municipalityId: "x",
          odsNumber: 3,
          indicatorName: "cobertura_aps",
          value: 80,
          score: 65,
          status: "amarelo",
          source: "DATASUS",
          referenceYear: 2024,
          referenceDate: new Date("2024-01-01"),
          dataAvailable: true,
        },
      ],
      sources: ["DATASUS"],
      dataFreshness: {
        newestYear: 2024,
        oldestYear: 2024,
        ageYears: 2,
        staleness: "recent",
        sources: [],
      },
    },
    {
      odsNumber: 6,
      name: "Saneamento",
      shortName: "ODS 6",
      color: "#26BDE2",
      weight: 1,
      score: 35,
      status: "vermelho",
      indicators: [
        {
          id: "2",
          municipalityId: "x",
          odsNumber: 6,
          indicatorName: "agua",
          value: 70,
          score: 35,
          status: "vermelho",
          source: "SNIS",
          referenceYear: 2023,
          referenceDate: new Date("2023-01-01"),
          dataAvailable: true,
        },
      ],
      sources: ["SNIS"],
      dataFreshness: {
        newestYear: 2023,
        oldestYear: 2023,
        ageYears: 3,
        staleness: "stale",
        sources: [],
      },
    },
  ],
};

describe("mapEsgReportToExecutiveReport", () => {
  it("produz payload válido pelo ExecutiveReportSchema", () => {
    const report = mapEsgReportToExecutiveReport(ESG_FIXTURE, MUNICIPAL_FIXTURE);
    expect(() => ExecutiveReportSchema.parse(report)).not.toThrow();
    expect(report.municipalityId).toBe("4205407");
    expect(report.odsScores.length).toBe(2);
    expect(report.recommendations.length).toBeGreaterThanOrEqual(1);
    expect(report.citations.some((c) => c.sourceName === "DATASUS")).toBe(true);
  });

  it("inclui recomendação padrão quando ESG não tem recomendações", () => {
    const esgSemRecs = { ...ESG_FIXTURE, recommendations: [] };
    const report = mapEsgReportToExecutiveReport(esgSemRecs, MUNICIPAL_FIXTURE);
    expect(report.recommendations[0]?.priority).toBe("baixa");
  });
});
