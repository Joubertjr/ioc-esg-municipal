import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AppShell } from "../components/layout/AppShell";
import { useToast } from "../components/ui/Toast";
import { apiGet, apiPost } from "../lib/api";
import type {
  InvestmentArea,
  InvestmentAllocation,
  SimulationRequest,
  SimulationResult,
  MunicipalityListItem,
  OdsSimulationResult,
} from "../types/api";
import { INVESTMENT_AREA_LABELS } from "../types/api";

const DEFAULT_IBGE_CODE = "4205407"; // Florianopolis

const INVESTMENT_AREAS = Object.keys(INVESTMENT_AREA_LABELS) as InvestmentArea[];

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

function ScoreDisplay({
  label,
  score,
}: {
  label: string;
  score: number | null;
}) {
  const color =
    score === null
      ? "text-gray-400"
      : score >= 70
        ? "text-green-600"
        : score >= 40
          ? "text-amber-500"
          : "text-red-600";

  return (
    <div className="text-center">
      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
        {label}
      </p>
      <p className={`text-4xl font-bold tabular-nums ${color}`}>
        {score !== null ? score.toFixed(1) : "—"}
      </p>
    </div>
  );
}

function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta === null) return null;
  const positive = delta >= 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded ${
        positive
          ? "bg-green-100 text-green-700"
          : "bg-red-100 text-red-700"
      }`}
    >
      {positive ? "+" : ""}
      {delta.toFixed(1)}
    </span>
  );
}

function OdsResultCard({ ods }: { ods: OdsSimulationResult }) {
  return (
    <div
      className="bg-white rounded-lg border border-gray-200 p-3 flex flex-col gap-1"
      style={{ borderTopColor: ods.color, borderTopWidth: 3 }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500">
          ODS {ods.odsNumber}
        </span>
        <DeltaBadge delta={ods.delta} />
      </div>
      <p className="text-xs text-gray-700 leading-tight line-clamp-2">
        {ods.shortName}
      </p>
      <div className="flex items-center gap-2 mt-1 text-sm">
        <span className="text-gray-500 tabular-nums">
          {ods.currentScore !== null ? ods.currentScore.toFixed(0) : "—"}
        </span>
        <span className="text-gray-400">→</span>
        <span
          className={`font-semibold tabular-nums ${
            ods.projectedScore === null
              ? "text-gray-400"
              : ods.projectedScore >= 70
                ? "text-green-600"
                : ods.projectedScore >= 40
                  ? "text-amber-500"
                  : "text-red-600"
          }`}
        >
          {ods.projectedScore !== null ? ods.projectedScore.toFixed(0) : "—"}
        </span>
      </div>
    </div>
  );
}

export function SimulatorPage() {
  const [ibgeCode, setIbgeCode] = useState(DEFAULT_IBGE_CODE);
  const [totalAmountRaw, setTotalAmountRaw] = useState("1000000");
  const [allocation, setAllocation] = useState<InvestmentAllocation>(
    buildDefaultAllocation,
  );
  const [result, setResult] = useState<SimulationResult | null>(null);
  const { showToast } = useToast();

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
    queryFn: () =>
      apiGet<{ data: MunicipalityListItem[]; total: number }>("/api/municipalities"),
    staleTime: 60 * 60 * 1000,
  });

  const simulateMutation = useMutation<SimulationResult, Error, SimulationRequest>({
    mutationFn: (payload) =>
      apiPost<SimulationResult>("/api/simulator/simulate", payload),
    onSuccess: (data) => setResult(data),
    onError: (err) => showToast(err.message ?? "Erro ao simular. Tente novamente.", "error"),
  });

  const handleAllocationChange = useCallback(
    (area: InvestmentArea, value: number) => {
      setAllocation((prev) => ({ ...prev, [area]: value }));
    },
    [],
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
          <h1 className="text-2xl font-bold text-gray-900">
            Simulador de Investimentos
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Simule o impacto de diferentes alocacoes de FPM nos indices ODS do municipio.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Municipality + Amount */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">
              Parametros da simulacao
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Municipality select */}
              <div>
                <label
                  htmlFor="municipality"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Municipio
                </label>
                {municipalities.length > 0 ? (
                  <select
                    id="municipality"
                    value={ibgeCode}
                    onChange={(e) => setIbgeCode(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {municipalities.map((m) => (
                      <option key={m.ibgeCode} value={m.ibgeCode}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-sm text-gray-400 italic">
                    Usando o seletor do cabecalho acima.
                  </p>
                )}
              </div>

              {/* Total amount */}
              <div>
                <label
                  htmlFor="total-amount"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Valor total a investir (R$)
                </label>
                <input
                  id="total-amount"
                  type="text"
                  inputMode="numeric"
                  value={totalAmountRaw}
                  onChange={(e) =>
                    setTotalAmountRaw(e.target.value.replace(/[^\d]/g, ""))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {totalAmount > 0 && (
                  <p className="text-xs text-gray-400 mt-1">
                    {formatCurrency(totalAmount)}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Allocation sliders */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900">
                Distribuicao por area (%)
              </h2>
              <span
                className={`text-sm font-semibold ${
                  allocationSum === 100
                    ? "text-green-600"
                    : "text-red-600"
                }`}
              >
                Total: {allocationSum}%
              </span>
            </div>

            {allocationSum !== 100 && (
              <p className="text-xs text-red-600 mb-4">
                A soma das porcentagens deve ser exatamente 100%.
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {INVESTMENT_AREAS.map((area) => (
                <div key={area}>
                  <div className="flex justify-between mb-1">
                    <label
                      htmlFor={`area-${area}`}
                      className="text-sm font-medium text-gray-700"
                    >
                      {INVESTMENT_AREA_LABELS[area]}
                    </label>
                    <span className="text-sm text-gray-500 tabular-nums">
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
                    onChange={(e) =>
                      handleAllocationChange(area, parseInt(e.target.value, 10))
                    }
                    className="w-full accent-blue-600"
                  />
                  {totalAmount > 0 && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {formatCurrency((totalAmount * allocation[area]) / 100)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={
              simulateMutation.isPending ||
              allocationSum !== 100 ||
              totalAmount <= 0
            }
            className="inline-flex items-center gap-2 w-full sm:w-auto px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            {simulateMutation.isPending && (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {simulateMutation.isPending ? "Simulando..." : "Simular impacto"}
          </button>

          {simulateMutation.isError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">
                {simulateMutation.error?.message ?? "Erro ao simular. Tente novamente."}
              </p>
            </div>
          )}
        </form>

        {/* Results */}
        {result && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-6 text-center">
                Resultado da simulacao —{" "}
                {result.municipalityName ?? result.ibgeCode}
              </h2>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-8">
                <ScoreDisplay
                  label="Score atual"
                  score={result.currentGlobalScore}
                />

                <div className="text-center">
                  <p className="text-xs text-gray-400 mb-1">impacto</p>
                  <DeltaBadge delta={result.globalDelta} />
                </div>

                <ScoreDisplay
                  label="Score projetado"
                  score={result.projectedGlobalScore}
                />
              </div>

              <p className="text-xs text-gray-400 text-center mt-4">
                Investimento simulado: {formatCurrency(result.totalAmount)}
              </p>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                Impacto por Objetivo de Desenvolvimento Sustentavel
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {result.ods.map((ods) => (
                  <OdsResultCard key={ods.odsNumber} ods={ods} />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
