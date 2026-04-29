import { useState, useCallback } from "react";
import { AppShell } from "../components/layout/AppShell";
import { useAuthContext } from "../contexts/AuthContext";
import {
  useMethodology,
  type OdsMethodology,
  type IndicatorMethodology,
} from "../hooks/useMethodology";

const DEFAULT_IBGE_CODE = "4205407";

const AGENT_LABELS: Record<string, string> = {
  ibge: "IBGE (Instituto Brasileiro de Geografia e Estatística)",
  siconfi: "SICONFI (Sistema de Informações Contábeis e Fiscais do Setor Público)",
  datasus: "DATASUS (Departamento de Informática do SUS)",
  inep: "INEP (Instituto Nacional de Estudos e Pesquisas Educacionais)",
  snis: "SNIS (Sistema Nacional de Informações sobre Saneamento)",
  inpe: "INPE (Instituto Nacional de Pesquisas Espaciais)",
  pncp: "PNCP (Portal Nacional de Contratações Públicas)",
  tse: "TSE (Tribunal Superior Eleitoral)",
  aneel: "ANEEL (Agência Nacional de Energia Elétrica)",
  snis_rs: "SNIS-RS (Resíduos Sólidos)",
  ana: "ANA (Agência Nacional de Águas)",
  convenios: "Plataforma +Brasil / SICONV",
  anatel: "ANATEL (Agência Nacional de Telecomunicações)",
  sisvan: "SISVAN (Sistema de Vigilância Alimentar e Nutricional)",
  ieps: "IEPS (Instituto de Estudos para Políticas de Saúde)",
};

function DirectionBadge({ direction }: { direction: "up" | "down" }) {
  if (direction === "up") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-success/10 text-success">
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 10l7-7m0 0l7 7m-7-7v18"
          />
        </svg>
        Maior = melhor
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-danger/10 text-danger">
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M19 14l-7 7m0 0l-7-7m7 7V3"
        />
      </svg>
      Menor = melhor
    </span>
  );
}

function IndicatorCard({ indicator }: { indicator: IndicatorMethodology }) {
  return (
    <div className="border border-border rounded-lg p-4 bg-card hover:shadow-sm transition-shadow print:break-inside-avoid">
      <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <h5 className="text-sm font-semibold text-foreground">{indicator.label}</h5>
          <p className="text-xs text-muted-foreground mt-0.5">{indicator.explanation}</p>
        </div>
        <DirectionBadge direction={indicator.goodDirection} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <div className="space-y-2">
          <div>
            <span className="font-medium text-muted-foreground">Fonte:</span>
            <p className="text-foreground mt-0.5">{indicator.source}</p>
          </div>
          <div>
            <span className="font-medium text-muted-foreground">Unidade:</span>
            <p className="text-foreground mt-0.5">{indicator.unit}</p>
          </div>
          <div>
            <span className="font-medium text-muted-foreground">Agente coletor:</span>
            <p className="text-foreground mt-0.5">
              {AGENT_LABELS[indicator.agent] ?? indicator.agent}
            </p>
          </div>
        </div>
        <div className="space-y-2">
          <div>
            <span className="font-medium text-muted-foreground">Fórmula de score:</span>
            <p className="text-foreground mt-0.5 font-mono text-[11px] bg-muted rounded px-2 py-1">
              {indicator.formula}
            </p>
          </div>
          <div>
            <span className="font-medium text-muted-foreground">Benchmarks:</span>
            <div className="mt-0.5 space-y-0.5">
              <p className="text-success">
                <span className="font-medium">Score 100:</span> {indicator.benchmarks.max}
              </p>
              <p className="text-danger">
                <span className="font-medium">Score 0:</span> {indicator.benchmarks.min}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 p-2 bg-muted/50 rounded text-xs text-muted-foreground italic">
        {indicator.benchmarks.description}
      </div>
    </div>
  );
}

function OdsSection({ ods }: { ods: OdsMethodology }) {
  const [open, setOpen] = useState(false);
  const uniqueSources = [...new Set(ods.indicators.map((i) => i.agent))];

  return (
    <div className="border border-border rounded-xl overflow-hidden print:break-inside-avoid">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 bg-card hover:bg-accent transition-colors text-left print:hidden"
      >
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
            style={{ backgroundColor: ods.color }}
          >
            {ods.odsNumber}
          </div>
          <div>
            <span className="text-sm font-semibold text-foreground">
              ODS {ods.odsNumber} — {ods.name}
            </span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-muted-foreground">
                {ods.indicators.length} indicador{ods.indicators.length !== 1 ? "es" : ""} · Peso{" "}
                {ods.weight.toFixed(1)}×
              </span>
              <span className="text-xs text-muted-foreground/60">
                · {uniqueSources.map((s) => s.toUpperCase()).join(", ")}
              </span>
            </div>
          </div>
        </div>
        <svg
          className={`w-5 h-5 text-muted-foreground/60 transition-transform shrink-0 ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <div className={`${open ? "block" : "hidden"} print:block`}>
        {/* ODS description and meta */}
        <div className="px-5 py-4 bg-muted/30 border-t border-border space-y-3">
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              Descrição ODS
            </h4>
            <p className="text-sm text-foreground">{ods.description}</p>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              Meta 2030
            </h4>
            <p className="text-sm text-foreground">{ods.meta2030}</p>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              Agregação
            </h4>
            <p className="text-sm text-foreground">{ods.aggregation}</p>
          </div>
        </div>

        {/* Indicators */}
        <div className="px-5 py-4 space-y-3 border-t border-border">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Indicadores e Fórmulas de Score
          </h4>
          {ods.indicators.map((ind) => (
            <IndicatorCard key={ind.name} indicator={ind} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function MethodologyPage() {
  const { currentUser } = useAuthContext();
  const [ibgeCode, setIbgeCode] = useState(currentUser?.ibgeCode ?? DEFAULT_IBGE_CODE);
  const { data: methodology, isLoading, isError, error } = useMethodology();

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const totalIndicators = methodology?.ods.reduce((sum, o) => sum + o.indicators.length, 0) ?? 0;
  const allSources = methodology
    ? [...new Set(methodology.ods.flatMap((o) => o.indicators.map((i) => i.agent)))]
    : [];

  return (
    <>
      <style>{`
        @media print {
          header, nav, button, .no-print { display: none !important; }
          main { padding: 0 !important; max-width: 100% !important; }
          body { font-size: 10pt; }
          .print\\:break-inside-avoid { break-inside: avoid; }
        }
      `}</style>

      <AppShell ibgeCode={ibgeCode} onSelect={setIbgeCode} referenceYear={null}>
        <div className="flex items-center justify-between mb-6 no-print">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Metodologia de Cálculo ODS</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Documentação completa das fórmulas, fontes de dados e benchmarks utilizados.
            </p>
          </div>
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
              />
            </svg>
            Imprimir / PDF
          </button>
        </div>

        {isError && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
            <p className="text-sm font-medium text-destructive">Erro ao carregar metodologia</p>
            <p className="text-xs text-destructive mt-1">
              {error?.message ?? "Verifique se o servidor está rodando."}
            </p>
          </div>
        )}

        {isLoading && (
          <div className="space-y-4">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />
            ))}
          </div>
        )}

        {methodology && (
          <div className="space-y-8">
            {/* Overview card */}
            <div className="bg-card rounded-xl border border-border p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-foreground">Visão Geral da Metodologia</h2>
                  <p className="text-xs text-muted-foreground mt-1">
                    Versão {methodology.version} · Atualizada em {methodology.lastUpdated}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-primary tabular-nums">
                    {totalIndicators}
                  </div>
                  <div className="text-xs text-muted-foreground">indicadores</div>
                </div>
              </div>

              {/* KPI cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="rounded-lg border border-border p-4 bg-muted/30">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    ODS Cobertos
                  </div>
                  <div className="text-xl font-bold text-foreground">17 / 17</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Todos os ODS da Agenda 2030
                  </div>
                </div>
                <div className="rounded-lg border border-border p-4 bg-muted/30">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Fontes de Dados
                  </div>
                  <div className="text-xl font-bold text-foreground">{allSources.length}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {allSources.map((s) => s.toUpperCase()).join(", ")}
                  </div>
                </div>
                <div className="rounded-lg border border-border p-4 bg-muted/30">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Score Global
                  </div>
                  <div className="text-xl font-bold text-foreground">Geométrico</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Padrão IDHM/PNUD ponderado
                  </div>
                </div>
              </div>

              {/* Status thresholds */}
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3">
                  Faixas de Classificação
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="flex items-start gap-3 p-3 rounded-lg border border-success/20 bg-success/5">
                    <div className="w-4 h-4 rounded-full bg-success shrink-0 mt-0.5" />
                    <div>
                      <div className="text-sm font-semibold text-success">Verde</div>
                      <div className="text-xs text-muted-foreground">
                        {methodology.statusThresholds.verde}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg border border-warning/20 bg-warning/5">
                    <div className="w-4 h-4 rounded-full bg-warning shrink-0 mt-0.5" />
                    <div>
                      <div className="text-sm font-semibold text-warning">Amarelo</div>
                      <div className="text-xs text-muted-foreground">
                        {methodology.statusThresholds.amarelo}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg border border-danger/20 bg-danger/5">
                    <div className="w-4 h-4 rounded-full bg-danger shrink-0 mt-0.5" />
                    <div>
                      <div className="text-sm font-semibold text-danger">Vermelho</div>
                      <div className="text-xs text-muted-foreground">
                        {methodology.statusThresholds.vermelho}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Global score methods */}
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3">
                  Método de Cálculo do Score Global
                </h3>
                <div className="space-y-3">
                  <div className="p-3 rounded-lg border border-primary/20 bg-primary/5">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-primary uppercase">
                        Preferido — Média Geométrica
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary text-white">
                        Em uso
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono">
                      {methodology.globalScoreMethod.geometric}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg border border-border bg-muted/30">
                    <div className="text-xs font-semibold text-muted-foreground uppercase mb-1">
                      Alternativo — Média Aritmética
                    </div>
                    <p className="text-xs text-muted-foreground font-mono">
                      {methodology.globalScoreMethod.arithmetic}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground italic">
                    {methodology.globalScoreMethod.preferred}
                  </p>
                </div>
              </div>

              {/* Weight table */}
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3">Pesos por ODS</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-2 font-semibold text-muted-foreground">
                          ODS
                        </th>
                        <th className="text-left py-2 px-2 font-semibold text-muted-foreground">
                          Nome
                        </th>
                        <th className="text-center py-2 px-2 font-semibold text-muted-foreground">
                          Peso
                        </th>
                        <th className="text-center py-2 px-2 font-semibold text-muted-foreground">
                          Indicadores
                        </th>
                        <th className="text-left py-2 px-2 font-semibold text-muted-foreground">
                          Fontes
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {methodology.ods.map((ods) => (
                        <tr key={ods.odsNumber} className="hover:bg-accent transition-colors">
                          <td className="py-2 px-2">
                            <div
                              className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                              style={{ backgroundColor: ods.color }}
                            >
                              {ods.odsNumber}
                            </div>
                          </td>
                          <td className="py-2 px-2 font-medium text-foreground">{ods.shortName}</td>
                          <td className="py-2 px-2 text-center font-semibold tabular-nums">
                            {ods.weight.toFixed(1)}×
                          </td>
                          <td className="py-2 px-2 text-center tabular-nums">
                            {ods.indicators.length}
                          </td>
                          <td className="py-2 px-2 text-muted-foreground">
                            {[...new Set(ods.indicators.map((i) => i.agent.toUpperCase()))].join(
                              ", ",
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Per-ODS sections */}
            <div>
              <h2 className="text-lg font-bold text-foreground mb-4">Detalhamento por ODS</h2>
              <div className="space-y-3">
                {methodology.ods.map((ods) => (
                  <OdsSection key={ods.odsNumber} ods={ods} />
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="pt-6 border-t border-border text-xs text-muted-foreground/60 text-center space-y-1">
              <p>
                Metodologia baseada em dados públicos de fontes governamentais brasileiras.
                Benchmarks calibrados para o perfil de municípios de Santa Catarina.
              </p>
              <p>
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
