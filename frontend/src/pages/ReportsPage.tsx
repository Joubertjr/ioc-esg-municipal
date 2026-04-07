import { useState, useCallback, useEffect } from "react";
import { useOdsReport } from "../hooks/useOdsReport";
import { AppShell } from "../components/layout/AppShell";
import { useToast } from "../components/ui/Toast";
import type { OdsSummary, OdsStatus } from "../types/api";
import { getIndicatorMeta } from "../../../shared/constants/ods-descriptions";

const DEFAULT_IBGE_CODE = "4205407"; // Florianópolis

// Nomes completos dos ODS em pt-BR com acentuação correta
const ODS_FULL_NAMES: Record<number, string> = {
  1: "Erradicação da Pobreza",
  2: "Fome Zero e Agricultura Sustentável",
  3: "Saúde e Bem-Estar",
  4: "Educação de Qualidade",
  5: "Igualdade de Gênero",
  6: "Água Potável e Saneamento",
  7: "Energia Acessível e Limpa",
  8: "Trabalho Decente e Crescimento Econômico",
  9: "Indústria, Inovação e Infraestrutura",
  10: "Redução das Desigualdades",
  11: "Cidades e Comunidades Sustentáveis",
  12: "Consumo e Produção Responsáveis",
  13: "Ação Contra a Mudança Global do Clima",
  14: "Vida na Água",
  15: "Vida Terrestre",
  16: "Paz, Justiça e Instituições Eficazes",
  17: "Parcerias e Meios de Implementação",
};

const RECOMMENDATIONS: Record<number, string> = {
  1: "Ampliar programas de transferência de renda e inclusão produtiva para famílias vulneráveis.",
  2: "Investir em agricultura familiar, bancos de alimentos e programas de segurança alimentar.",
  3: "Expandir atendimento na atenção básica, vacinas e programas preventivos de saúde.",
  4: "Melhorar infraestrutura escolar, formação de professores e programas de redução de evasão.",
  5: "Criar centros de atendimento a mulheres, capacitação profissional e políticas de igualdade.",
  6: "Ampliar cobertura de água tratada e esgotamento sanitário, especialmente em áreas rurais.",
  7: "Investir em iluminação pública eficiente (LED) e fontes renováveis de energia.",
  8: "Fomentar microempresas, qualificação profissional e redução do desemprego juvenil.",
  9: "Melhorar infraestrutura de estradas, conectividade digital e apoio a pequenas indústrias.",
  10: "Ampliar serviços públicos em periferias e políticas de inclusão de grupos vulneráveis.",
  11: "Investir em mobilidade urbana, habitação social e áreas de lazer e cultura.",
  12: "Implantar coleta seletiva, compostagem e educação ambiental nas escolas.",
  13: "Elaborar plano municipal de adaptação climática e gestão de riscos de desastres.",
  14: "Proteger nascentes, rios e mananciais; combater o descarte irregular em corpos hídricos.",
  15: "Ampliar áreas verdes urbanas, reflorestamento e fiscalização contra desmatamento.",
  16: "Fortalecer ouvidoria municipal, transparência orçamentária e acesso a serviços públicos.",
  17: "Buscar parcerias com outros municípios, governo estadual e organizações internacionais.",
};

function statusBadge(status: OdsStatus | null): JSX.Element {
  if (!status) {
    return (
      <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500 print:border print:border-gray-300">
        Sem dados
      </span>
    );
  }
  const map: Record<OdsStatus, string> = {
    verde: "bg-green-100 text-green-800 print:border print:border-green-400",
    amarelo: "bg-amber-100 text-amber-800 print:border print:border-amber-400",
    vermelho: "bg-red-100 text-red-800 print:border print:border-red-400",
  };
  const label: Record<OdsStatus, string> = {
    verde: "Verde",
    amarelo: "Amarelo",
    vermelho: "Vermelho",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${map[status]}`}>
      {label[status]}
    </span>
  );
}

function scoreColor(score: number | null): string {
  if (score === null) return "text-gray-400";
  if (score >= 70) return "text-green-700";
  if (score >= 40) return "text-amber-600";
  return "text-red-600";
}

function GlobalGauge({ score }: { score: number | null }) {
  const pct = score !== null ? Math.min(100, Math.max(0, score)) : 0;
  const circumference = 2 * Math.PI * 45;
  const offset = circumference - (pct / 100) * circumference;
  const color =
    score === null ? "#9ca3af" : score >= 70 ? "#16a34a" : score >= 40 ? "#d97706" : "#dc2626";

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="120" height="120" viewBox="0 0 100 100" className="rotate-[-90deg]">
        <circle cx="50" cy="50" r="45" fill="none" stroke="#e5e7eb" strokeWidth="10" />
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <div className="-mt-[88px] flex flex-col items-center justify-center h-[120px]">
        <span className={`text-3xl font-bold tabular-nums ${scoreColor(score)}`}>
          {score !== null ? score.toFixed(1) : "—"}
        </span>
        <span className="text-xs text-gray-500 mt-0.5">Score ESG</span>
      </div>
    </div>
  );
}

function ExecutiveSummary({
  report,
}: {
  report: {
    municipalityName: string | null;
    globalScore: number | null;
    globalStatus: OdsStatus | null;
    odsCount: { verde: number; amarelo: number; vermelho: number; withData: number; total: number };
    referenceYear: number;
  };
}) {
  const name = report.municipalityName ?? "o município";
  const score = report.globalScore;
  const { verde, amarelo, vermelho, withData, total } = report.odsCount;

  const performance =
    score === null
      ? "não possui dados suficientes para calcular o score global"
      : score >= 70
        ? `apresenta desempenho satisfatório com score ESG de ${score.toFixed(1)}`
        : score >= 40
          ? `apresenta desempenho moderado com score ESG de ${score.toFixed(1)}, exigindo atenção em áreas específicas`
          : `apresenta desempenho crítico com score ESG de ${score.toFixed(1)}, demandando ações imediatas`;

  return (
    <div className="space-y-2 text-sm text-gray-700 leading-relaxed">
      <p>
        O município de <strong>{name}</strong> {performance} no ano de referência{" "}
        {report.referenceYear}.
      </p>
      {withData > 0 && (
        <p>
          De {total} Objetivos de Desenvolvimento Sustentável avaliados, {withData} possuem dados
          disponíveis: <strong className="text-green-700">{verde} em situação verde</strong> (score
          ≥ 70), <strong className="text-amber-600">{amarelo} em situação amarela</strong> (score
          40–69) e <strong className="text-red-600">{vermelho} em situação vermelha</strong> (score
          &lt; 40).
        </p>
      )}
      {vermelho > 0 && (
        <p>
          Os {vermelho} ODS em situação crítica requerem priorização no planejamento orçamentário e
          na alocação do Fundo de Participação dos Municípios (FPM).
        </p>
      )}
      <p>
        Este relatório foi gerado automaticamente com base em dados públicos de fontes
        governamentais (IBGE, SICONFI, DATASUS, INEP, SNIS, INPE) e deve ser utilizado como subsídio
        para decisões de política pública alinhadas à Agenda 2030 da ONU.
      </p>
    </div>
  );
}

interface AccordionRowProps {
  ods: OdsSummary;
}

function AccordionRow({ ods }: AccordionRowProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden print:break-inside-avoid">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-gray-50 transition-colors text-left print:hidden"
      >
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: ods.color }} />
          <span className="text-sm font-medium text-gray-900">
            ODS {ods.odsNumber} — {ODS_FULL_NAMES[ods.odsNumber] ?? ods.name}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-sm font-semibold tabular-nums ${scoreColor(ods.score)}`}>
            {ods.score !== null ? ods.score.toFixed(1) : "—"}
          </span>
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Print: always show */}
      <div className={`${open ? "block" : "hidden"} print:block`}>
        {ods.indicators.length === 0 ? (
          <div className="px-4 py-3 text-sm text-gray-400 italic bg-gray-50">
            Nenhum indicador disponível para este ODS.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-t border-gray-200">
                <th className="text-left px-4 py-2 font-medium text-gray-600">Indicador</th>
                <th className="text-right px-4 py-2 font-medium text-gray-600">Valor</th>
                <th className="text-right px-4 py-2 font-medium text-gray-600">Score</th>
                <th className="text-center px-4 py-2 font-medium text-gray-600">Status</th>
                <th className="text-right px-4 py-2 font-medium text-gray-600">Fonte</th>
                <th className="text-right px-4 py-2 font-medium text-gray-600">Ano</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {ods.indicators.map((ind) => {
                const meta = getIndicatorMeta(ods.odsNumber, ind.indicatorName);
                return (
                  <tr key={ind.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-800">{ind.indicatorName}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-gray-600">
                      {ind.value !== null
                        ? ind.value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })
                        : "—"}
                      {ind.value !== null && meta?.unit ? (
                        <span className="ml-1 text-xs text-gray-400">{meta.unit}</span>
                      ) : null}
                    </td>
                    <td
                      className={`px-4 py-2 text-right tabular-nums font-medium ${scoreColor(ind.score)}`}
                    >
                      {ind.score !== null ? ind.score.toFixed(1) : "—"}
                    </td>
                    <td className="px-4 py-2 text-center">{statusBadge(ind.status)}</td>
                    <td className="px-4 py-2 text-right text-gray-500 text-xs">{ind.source}</td>
                    <td className="px-4 py-2 text-right text-gray-500 text-xs">
                      {ind.referenceYear}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export function ReportsPage() {
  const [ibgeCode, setIbgeCode] = useState(DEFAULT_IBGE_CODE);
  const { data: report, isLoading, isError, error, refetch } = useOdsReport(ibgeCode);
  const { showToast } = useToast();

  useEffect(() => {
    if (isError && error) {
      showToast(error.message ?? "Erro ao carregar dados ODS.", "error");
    }
  }, [isError, error, showToast]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const belowThreshold = report?.ods.filter((o) => o.score !== null && o.score < 70) ?? [];

  return (
    <>
      {/* Print-only styles injected via a style tag */}
      <style>{`
        @media print {
          header, nav, button, .no-print { display: none !important; }
          main { padding: 0 !important; max-width: 100% !important; }
          body { font-size: 11pt; }
          .print\\:break-inside-avoid { break-inside: avoid; }
        }
      `}</style>

      <AppShell
        ibgeCode={ibgeCode}
        onSelect={setIbgeCode}
        referenceYear={report?.referenceYear ?? null}
      >
        {/* Page header actions */}
        <div className="flex items-center justify-between mb-6 no-print">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Relatório ESG Municipal</h1>
            <p className="text-sm text-gray-500 mt-1">
              Relatório completo de desempenho nos 17 ODS da Agenda 2030.
            </p>
          </div>
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
              />
            </svg>
            Imprimir / Exportar PDF
          </button>
        </div>

        {isError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-red-800">Erro ao carregar dados ODS</p>
              <p className="text-xs text-red-600 mt-1">
                {error?.message ?? "Verifique se o servidor está rodando."}
              </p>
            </div>
            <button
              onClick={() => refetch()}
              className="px-3 py-1.5 text-sm font-medium text-red-700 bg-red-100 rounded-md hover:bg-red-200 transition-colors"
            >
              Tentar novamente
            </button>
          </div>
        )}

        {isLoading && (
          <div className="space-y-4">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        )}

        {!isLoading && !report && !isError && (
          <div className="text-center py-20 text-gray-400">
            <svg
              className="w-12 h-12 mx-auto mb-3 opacity-40"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <p className="text-sm">Nenhum relatório gerado ainda</p>
            <p className="text-xs mt-1">Selecione um município para gerar o relatório ESG.</p>
          </div>
        )}

        {report && (
          <div className="space-y-10 bg-white rounded-xl border border-gray-200 p-8 print:border-0 print:shadow-none print:p-0">
            {/* Report Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 pb-8 border-b border-gray-200">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold uppercase tracking-widest text-blue-600">
                    IOC ESG Municipal
                  </span>
                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                    SC
                  </span>
                </div>
                <h2 className="text-2xl font-bold text-gray-900">
                  {report.municipalityName ?? report.ibgeCode}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Relatório ESG — Ano de Referência {report.referenceYear} &nbsp;|&nbsp; IBGE{" "}
                  {report.ibgeCode}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Gerado em {new Date().toLocaleDateString("pt-BR", { dateStyle: "long" })}
                </p>
              </div>
              <GlobalGauge score={report.globalScore} />
            </div>

            {/* Section 1: Resumo Executivo */}
            <section>
              <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">
                  1
                </span>
                Resumo Executivo
              </h3>
              <div className="bg-blue-50 rounded-lg p-5 border border-blue-100">
                <ExecutiveSummary report={report} />
              </div>
            </section>

            {/* Section 2: Desempenho por ODS */}
            <section>
              <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">
                  2
                </span>
                Desempenho por ODS
              </h3>
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-4 py-3 font-semibold text-gray-700 w-12">Nº</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-700">Objetivo</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-700 w-20">
                        Score
                      </th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-700 w-36 hidden sm:table-cell">
                        Progresso
                      </th>
                      <th className="text-center px-4 py-3 font-semibold text-gray-700 w-24">
                        Status
                      </th>
                      <th className="text-center px-4 py-3 font-semibold text-gray-700 w-16 hidden md:table-cell">
                        Peso
                      </th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-700 hidden md:table-cell">
                        Fontes
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {report.ods.map((ods) => {
                      const pct = ods.score !== null ? Math.min(100, Math.max(0, ods.score)) : 0;
                      const barColor =
                        ods.score === null
                          ? "bg-gray-200"
                          : ods.score >= 70
                            ? "bg-green-500"
                            : ods.score >= 40
                              ? "bg-amber-400"
                              : "bg-red-500";
                      return (
                        <tr key={ods.odsNumber} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3">
                            <div
                              className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                              style={{ backgroundColor: ods.color }}
                            >
                              {ods.odsNumber}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-800 font-medium">
                            {ODS_FULL_NAMES[ods.odsNumber] ?? ods.name}
                          </td>
                          <td
                            className={`px-4 py-3 text-right font-semibold tabular-nums ${scoreColor(ods.score)}`}
                          >
                            {ods.score !== null ? ods.score.toFixed(1) : "—"}
                          </td>
                          <td className="px-4 py-3 hidden sm:table-cell">
                            <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">{statusBadge(ods.status)}</td>
                          <td className="px-4 py-3 text-center text-xs font-medium text-gray-500 hidden md:table-cell">
                            {ods.weight.toFixed(1)}×
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-xs hidden md:table-cell">
                            {ods.sources.length > 0 ? ods.sources.join(", ") : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Section 3: Indicadores Detalhados */}
            <section>
              <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">
                  3
                </span>
                Indicadores Detalhados
              </h3>
              <div className="space-y-2">
                {report.ods.map((ods) => (
                  <AccordionRow key={ods.odsNumber} ods={ods} />
                ))}
              </div>
            </section>

            {/* Section 4: Recomendações */}
            {belowThreshold.length > 0 && (
              <section>
                <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">
                    4
                  </span>
                  Recomendações de Investimento
                </h3>
                <p className="text-xs text-gray-500 mb-4">
                  Os ODS abaixo obtiveram score inferior a 70 e requerem investimento prioritário.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {belowThreshold.map((ods) => (
                    <div
                      key={ods.odsNumber}
                      className="rounded-lg border border-l-4 p-4 bg-white print:break-inside-avoid"
                      style={{ borderLeftColor: ods.color }}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                          style={{ backgroundColor: ods.color }}
                        >
                          {ods.odsNumber}
                        </div>
                        <span className="text-sm font-semibold text-gray-900">
                          ODS {ods.odsNumber} — {ods.shortName}
                        </span>
                        <span
                          className={`ml-auto text-sm font-bold tabular-nums ${scoreColor(ods.score)}`}
                        >
                          {ods.score?.toFixed(1)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 leading-relaxed">
                        {RECOMMENDATIONS[ods.odsNumber] ??
                          "Consulte especialistas para definir ações de melhoria para este ODS."}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Legenda de cores — visível na impressão */}
            <div className="flex items-center justify-center gap-6 py-3 rounded-lg bg-gray-50 border border-gray-200 text-xs text-gray-600 print:border print:border-gray-300">
              <span className="font-medium text-gray-700">Legenda:</span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-green-500 shrink-0" />
                Verde (score ≥ 70)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-amber-400 shrink-0" />
                Amarelo (40–69)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-red-500 shrink-0" />
                Vermelho (&lt;40)
              </span>
            </div>

            {/* Footer */}
            <div className="pt-6 border-t border-gray-200 text-xs text-gray-400 text-center">
              <p>
                Dados públicos obtidos via IBGE, SICONFI, DATASUS, INEP, SNIS, INPE e PNCP. Este
                relatório é de caráter informativo e não substitui análise técnica especializada.
              </p>
              <p className="mt-1">
                IOC ESG Municipal — Plataforma de Gestão Pública com Impacto ODS &copy;{" "}
                {new Date().getFullYear()}
              </p>
            </div>
          </div>
        )}
      </AppShell>
    </>
  );
}
