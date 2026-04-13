import { useState, useCallback, useMemo, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AppShell } from "../components/layout/AppShell";
import { useToast } from "../components/ui/Toast";
import { useAuthContext } from "../contexts/AuthContext";
import { apiGet, apiPost } from "../lib/api";
import type {
  InvestmentArea,
  InvestmentAllocation,
  SimulationRequest,
  SimulationResult,
  MunicipalityListItem,
  OdsSimulationResult,
  OdsStatus,
} from "../types/api";
import { INVESTMENT_AREA_LABELS } from "../types/api";
import { ODS_DEFINITIONS } from "../../../shared/constants/ods";

const DEFAULT_IBGE_CODE = "4205407"; // Florianópolis (fallback)

const INVESTMENT_AREAS = Object.keys(INVESTMENT_AREA_LABELS) as InvestmentArea[];

const AREA_ODS_MAP: Record<InvestmentArea, number[]> = {
  education: [4, 1, 8, 10],
  health: [3, 1],
  sanitation: [6, 3, 11, 14],
  environment: [13, 15, 11, 14],
  security: [16, 11],
  energy: [7, 9, 13],
  urbanization: [11, 9],
  governance: [16, 17],
};

function buildDefaultAllocation(): InvestmentAllocation {
  const share = Math.floor(100 / INVESTMENT_AREAS.length);
  const remainder = 100 - share * INVESTMENT_AREAS.length;
  const allocation = {} as InvestmentAllocation;
  INVESTMENT_AREAS.forEach((area, i) => {
    allocation[area] = share + (i === 0 ? remainder : 0);
  });
  return allocation;
}

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

function formatCurrencyRaw(value: string): string {
  const num = parseInt(value.replace(/\D/g, ""), 10);
  if (isNaN(num)) return "";
  return num.toLocaleString("pt-BR");
}

function getScoreColor(score: number | null): string {
  if (score === null) return "text-muted-foreground/60";
  if (score >= 70) return "text-success";
  if (score >= 40) return "text-warning";
  return "text-danger";
}

function getStatusLabel(status: OdsStatus | null): string {
  if (status === null) return "Sem dados";
  if (status === "verde") return "Bom";
  if (status === "amarelo") return "Regular";
  return "Crítico";
}

function getStatusBadgeClasses(status: OdsStatus | null): string {
  if (status === null) return "bg-muted text-muted-foreground";
  if (status === "verde") return "bg-success/10 text-success";
  if (status === "amarelo") return "bg-warning/10 text-warning";
  return "bg-danger/10 text-danger";
}

function ScoreDisplay({ label, score }: { label: string; score: number | null }) {
  const color = getScoreColor(score);
  const statusLabel =
    score === null ? null : score >= 70 ? "Bom" : score >= 40 ? "Regular" : "Crítico";

  const statusBadge =
    score === null
      ? null
      : score >= 70
        ? "bg-success/10 text-success"
        : score >= 40
          ? "bg-warning/10 text-warning"
          : "bg-danger/10 text-danger";

  return (
    <div className="text-center">
      <p className="text-[11px] text-muted-foreground uppercase tracking-[0.08em] font-medium mb-1">
        {label}
      </p>
      <p className={`text-5xl font-extrabold tabular-nums ${color}`}>
        {score !== null ? score.toFixed(1) : "—"}
      </p>
      <p className="text-xs text-muted-foreground/60 mt-0.5">/ 100</p>
      {statusLabel !== null && (
        <span
          className={`inline-block mt-1.5 text-xs font-semibold px-2 py-0.5 rounded-full ${statusBadge}`}
        >
          {statusLabel}
        </span>
      )}
    </div>
  );
}

function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta === null) return null;
  const positive = delta >= 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded ${
        positive ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
      }`}
    >
      {positive ? "↑" : "↓"}
      {positive ? "+" : ""}
      {delta.toFixed(1)}
    </span>
  );
}

function OdsResultCard({ ods }: { ods: OdsSimulationResult }) {
  const projectedColor = getScoreColor(ods.projectedScore);
  const statusLabel = getStatusLabel(ods.projectedStatus);
  const statusBadgeClasses = getStatusBadgeClasses(ods.projectedStatus);
  const progressPercent =
    ods.projectedScore !== null ? Math.min(100, Math.max(0, ods.projectedScore)) : 0;

  return (
    <div
      className="bg-card rounded-xl shadow-card p-3 flex flex-col gap-1"
      style={{ borderTopColor: ods.color, borderTopWidth: 3 }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground">ODS {ods.odsNumber}</span>
        <DeltaBadge delta={ods.delta} />
      </div>
      <p className="text-xs text-foreground leading-tight line-clamp-2">{ods.shortName}</p>
      <div className="flex items-center gap-2 mt-1 text-sm">
        <span className="text-muted-foreground tabular-nums">
          {ods.currentScore !== null ? ods.currentScore.toFixed(0) : "—"}
        </span>
        <span className="text-muted-foreground/60">→</span>
        <span className={`font-semibold tabular-nums ${projectedColor}`}>
          {ods.projectedScore !== null ? ods.projectedScore.toFixed(0) : "—"}
          {ods.projectedScore !== null && (
            <span className="text-xs font-normal text-muted-foreground/60">/100</span>
          )}
        </span>
      </div>
      {/* Mini barra de progresso */}
      <div className="w-full bg-muted rounded-full h-1.5 mt-1">
        <div
          className="h-1.5 rounded-full transition-all"
          style={{
            width: `${progressPercent}%`,
            backgroundColor: ods.color,
          }}
        />
      </div>
      <span
        className={`self-start mt-1 text-xs font-medium px-1.5 py-0.5 rounded ${statusBadgeClasses}`}
      >
        {statusLabel}
      </span>
    </div>
  );
}

function OdsBadge({ odsNumber }: { odsNumber: number }) {
  const def = ODS_DEFINITIONS.find((o) => o.number === odsNumber);
  const color = def?.color ?? "#6B7280";

  return (
    <span
      className="inline-flex items-center text-white text-xs font-semibold px-1.5 py-0.5 rounded"
      style={{ backgroundColor: color }}
    >
      ODS {odsNumber}
    </span>
  );
}

function EmptyResultsPlaceholder() {
  return (
    <div className="bg-card rounded-xl shadow-card p-10 flex flex-col items-center justify-center text-center gap-4">
      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
        <svg
          className="w-8 h-8 text-primary/40"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground">Nenhuma simulação executada ainda</p>
        <p className="text-sm text-muted-foreground mt-1 max-w-md">
          Configure os parâmetros acima e clique em &ldquo;Simular impacto&rdquo; para ver a
          projeção do score ESG do município.
        </p>
      </div>
    </div>
  );
}

export function SimulatorPage() {
  const location = useLocation();
  const { currentUser } = useAuthContext();
  const [ibgeCode, setIbgeCode] = useState(currentUser?.ibgeCode ?? DEFAULT_IBGE_CODE);
  const [totalAmountRaw, setTotalAmountRaw] = useState("1000000");
  const [displayValue, setDisplayValue] = useState("1.000.000");
  const [isFocused, setIsFocused] = useState(false);
  const [allocation, setAllocation] = useState<InvestmentAllocation>(buildDefaultAllocation);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [showScenarioBanner, setShowScenarioBanner] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    if (currentUser?.ibgeCode) {
      setIbgeCode(currentUser.ibgeCode);
    }
  }, [currentUser?.ibgeCode]);

  // Ler cenário pré-preenchido das recomendações (via navigate state)
  useEffect(() => {
    const state = location.state as {
      scenarioAllocation?: InvestmentAllocation;
      ibgeCode?: string;
      allOdsGreen?: boolean;
    } | null;
    if (state?.scenarioAllocation) {
      setAllocation(state.scenarioAllocation);
      if (state.ibgeCode) {
        setIbgeCode(state.ibgeCode);
      }
      setShowScenarioBanner(true);
      // Limpar state para que refresh não re-aplique
      window.history.replaceState({}, document.title);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const totalAmount = useMemo(() => {
    const parsed = parseFloat(totalAmountRaw.replace(/\D/g, ""));
    return isNaN(parsed) ? 0 : parsed;
  }, [totalAmountRaw]);

  const allocationSum = useMemo(
    () => INVESTMENT_AREAS.reduce((acc, area) => acc + allocation[area], 0),
    [allocation],
  );

  const { data: municipalitiesData } = useQuery<
    { data: MunicipalityListItem[]; total: number },
    Error
  >({
    queryKey: ["municipalities"],
    queryFn: () => apiGet<{ data: MunicipalityListItem[]; total: number }>("/api/municipalities?pageSize=300"),
    staleTime: 60 * 60 * 1000,
  });

  const simulateMutation = useMutation<SimulationResult, Error, SimulationRequest>({
    mutationFn: (payload) => apiPost<SimulationResult>("/api/simulator/simulate", payload),
    onSuccess: (data) => setResult(data),
    onError: (err) => showToast(err.message ?? "Erro ao simular. Tente novamente.", "error"),
  });

  const handleAllocationChange = useCallback((area: InvestmentArea, value: number) => {
    setAllocation((prev) => ({ ...prev, [area]: value }));
  }, []);

  const handleAmountFocus = useCallback(() => {
    setIsFocused(true);
    setDisplayValue(totalAmountRaw);
  }, [totalAmountRaw]);

  const handleAmountBlur = useCallback(() => {
    setIsFocused(false);
    const digits = totalAmountRaw.replace(/\D/g, "");
    const num = parseInt(digits, 10);
    if (!isNaN(num) && num > 0) {
      setDisplayValue(formatCurrencyRaw(digits));
    } else {
      setDisplayValue(digits);
    }
  }, [totalAmountRaw]);

  const handleAmountChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const digits = e.target.value.replace(/[^\d]/g, "");
      setTotalAmountRaw(digits);
      if (isFocused) {
        setDisplayValue(digits);
      }
    },
    [isFocused],
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (allocationSum !== 100) return;
      simulateMutation.mutate({ ibgeCode, totalAmount, allocation });
    },
    [ibgeCode, totalAmount, allocation, allocationSum, simulateMutation],
  );

  const municipalities = municipalitiesData?.data ?? [];

  return (
    <AppShell ibgeCode={ibgeCode} onSelect={setIbgeCode} referenceYear={null}>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Simulador de Investimentos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Simule o impacto de diferentes alocações de FPM nos índices ODS do município.
          </p>
        </div>

        {/* Banner de cenário pré-preenchido */}
        {showScenarioBanner && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <svg
                  className="h-5 w-5 text-primary mt-0.5 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="1.5"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z"
                  />
                </svg>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Cenário pré-preenchido a partir das recomendações
                  </p>
                  <p className="text-sm text-primary mt-1">
                    Os sliders foram ajustados para priorizar as áreas com maior necessidade de
                    investimento. Revise e clique em &ldquo;Simular impacto&rdquo;.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowScenarioBanner(false)}
                className="text-primary/40 hover:text-primary ml-4"
              >
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Município + Valor */}
          <div className="bg-card rounded-xl shadow-card p-6">
            <h2 className="text-base font-semibold text-foreground mb-4">
              Parâmetros da simulação
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Seletor de município */}
              <div>
                <label
                  htmlFor="municipality"
                  className="block text-sm font-medium text-foreground mb-1"
                >
                  Município
                </label>
                {municipalities.length > 0 ? (
                  <select
                    id="municipality"
                    value={ibgeCode}
                    onChange={(e) => setIbgeCode(e.target.value)}
                    className="w-full px-3 py-2 bg-card border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {municipalities.map((m) => (
                      <option key={m.ibgeCode} value={m.ibgeCode}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-sm text-muted-foreground/60 italic">
                    Usando o seletor do cabeçalho acima.
                  </p>
                )}
              </div>

              {/* Valor total */}
              <div>
                <label
                  htmlFor="total-amount"
                  className="block text-sm font-medium text-foreground mb-1"
                >
                  Valor total a investir (R$)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none select-none">
                    R$
                  </span>
                  <input
                    id="total-amount"
                    type="text"
                    inputMode="numeric"
                    value={isFocused ? totalAmountRaw : displayValue}
                    onChange={handleAmountChange}
                    onFocus={handleAmountFocus}
                    onBlur={handleAmountBlur}
                    className="w-full pl-9 pr-3 py-2 bg-card border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                {totalAmount > 0 && (
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    {formatCurrency(totalAmount)}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Sliders de alocação */}
          <div className="bg-card rounded-xl shadow-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-foreground">Distribuição por área (%)</h2>
              <span
                className={`text-sm font-semibold ${
                  allocationSum === 100 ? "text-success" : "text-danger"
                }`}
              >
                Total: {allocationSum}%
              </span>
            </div>

            {allocationSum !== 100 && (
              <p className="text-xs text-danger mb-4">
                A soma das porcentagens deve ser exatamente 100%.
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {INVESTMENT_AREAS.map((area) => (
                <div key={area}>
                  <div className="flex justify-between mb-1">
                    <label htmlFor={`area-${area}`} className="text-sm font-medium text-foreground">
                      {INVESTMENT_AREA_LABELS[area]}
                    </label>
                    <span className="text-sm text-muted-foreground tabular-nums">
                      {allocation[area]}%
                    </span>
                  </div>
                  <input
                    id={`area-${area}`}
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={allocation[area]}
                    onChange={(e) => handleAllocationChange(area, parseInt(e.target.value, 10))}
                    className="w-full accent-primary"
                  />
                  {totalAmount > 0 && (
                    <p className="text-xs text-muted-foreground/60 mt-0.5">
                      {formatCurrency((totalAmount * allocation[area]) / 100)}
                    </p>
                  )}
                  {/* ODS impactados */}
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    <span className="text-xs text-muted-foreground/60">Impacta:</span>
                    {AREA_ODS_MAP[area].map((odsNum) => (
                      <OdsBadge key={odsNum} odsNumber={odsNum} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={simulateMutation.isPending || allocationSum !== 100 || totalAmount <= 0}
            className="inline-flex items-center gap-2 w-full sm:w-auto px-8 py-3 bg-primary hover:bg-primary/90 disabled:bg-primary/40 text-white font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            {simulateMutation.isPending && (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
            )}
            {simulateMutation.isPending ? "Simulando..." : "Simular impacto"}
          </button>

          {simulateMutation.isError && (
            <div className="p-3 bg-danger/10 border border-danger/20 rounded-lg">
              <p className="text-sm text-danger">
                {simulateMutation.error?.message ?? "Erro ao simular. Tente novamente."}
              </p>
            </div>
          )}
        </form>

        {/* Resultados ou placeholder */}
        {result ? (
          <div className="space-y-6">
            <div className="bg-card rounded-xl shadow-card p-6">
              <h2 className="text-base font-semibold text-foreground mb-1 text-center">
                Projeção de Impacto nos ODS — {result.municipalityName ?? result.ibgeCode}
              </h2>
              <p className="text-xs text-muted-foreground/60 text-center mb-6">
                Comparativo entre score atual e projetado após investimento
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-8">
                <ScoreDisplay label="Score atual" score={result.currentGlobalScore} />

                <div className="text-center">
                  <p className="text-xs text-muted-foreground/60 mb-1">impacto</p>
                  <DeltaBadge delta={result.globalDelta} />
                </div>

                <ScoreDisplay label="Score projetado" score={result.projectedGlobalScore} />
              </div>

              <p className="text-xs text-muted-foreground/60 text-center mt-4">
                Investimento simulado: {formatCurrency(result.totalAmount)}
              </p>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">
                Impacto por Objetivo de Desenvolvimento Sustentável
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {result.ods.map((ods) => (
                  <OdsResultCard key={ods.odsNumber} ods={ods} />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <EmptyResultsPlaceholder />
        )}
      </div>
    </AppShell>
  );
}
