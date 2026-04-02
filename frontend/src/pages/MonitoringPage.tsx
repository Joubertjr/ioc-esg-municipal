import { useState, useMemo } from "react";
import { useOdsReport } from "../hooks/useOdsReport";
import { AppShell } from "../components/layout/AppShell";
import type { OdsSummary, OdsStatus } from "../types/api";

const DEFAULT_IBGE_CODE = "4205407"; // Florianopolis
const DEFAULT_TARGET = 70;

type SortKey = "odsNumber" | "scoreAsc" | "gapDesc";
type FilterStatus = "all" | OdsStatus;

const ODS_SHORT_NAMES: Record<number, string> = {
  1: "Erradicacao da Pobreza",
  2: "Fome Zero",
  3: "Saude e Bem-Estar",
  4: "Educacao de Qualidade",
  5: "Igualdade de Genero",
  6: "Agua e Saneamento",
  7: "Energia Limpa",
  8: "Trabalho Decente",
  9: "Industria e Inovacao",
  10: "Reducao de Desigualdades",
  11: "Cidades Sustentaveis",
  12: "Consumo Responsavel",
  13: "Acao Climatica",
  14: "Vida na Agua",
  15: "Vida Terrestre",
  16: "Paz e Justica",
  17: "Parcerias",
};

function scoreColor(score: number | null): string {
  if (score === null) return "text-gray-400";
  if (score >= 70) return "text-green-700";
  if (score >= 40) return "text-amber-600";
  return "text-red-600";
}

function progressBarColor(score: number | null): string {
  if (score === null) return "bg-gray-300";
  if (score >= 70) return "bg-green-500";
  if (score >= 40) return "bg-amber-400";
  return "bg-red-500";
}

function StatusBadge({ status }: { status: OdsStatus | null }) {
  if (!status) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
        <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
        Sem dados
      </span>
    );
  }
  const map: Record<OdsStatus, { bg: string; dot: string; label: string }> = {
    verde: { bg: "bg-green-100 text-green-800", dot: "bg-green-500", label: "Verde" },
    amarelo: { bg: "bg-amber-100 text-amber-800", dot: "bg-amber-400", label: "Amarelo" },
    vermelho: { bg: "bg-red-100 text-red-800", dot: "bg-red-500", label: "Vermelho" },
  };
  const { bg, dot, label } = map[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${bg}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

function GapBadge({ gap }: { gap: number | null }) {
  if (gap === null) return <span className="text-gray-400 text-sm">—</span>;
  if (gap <= 0) {
    return (
      <span className="text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
        Meta atingida
      </span>
    );
  }
  return (
    <span className="text-xs font-semibold text-red-700 bg-red-50 px-2 py-0.5 rounded-full tabular-nums">
      -{gap.toFixed(1)} pts
    </span>
  );
}

interface OdsRowProps {
  ods: OdsSummary;
  target: number;
}

function OdsRow({ ods, target }: OdsRowProps) {
  const gap = ods.score !== null ? target - ods.score : null;
  const pct = ods.score !== null ? Math.min(100, Math.max(0, ods.score)) : 0;
  const targetPct = Math.min(100, Math.max(0, target));

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 hover:border-gray-300 transition-colors">
      <div className="flex items-start gap-4">
        {/* ODS number circle */}
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
          style={{ backgroundColor: ods.color }}
        >
          {ods.odsNumber}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <p className="text-sm font-medium text-gray-900 truncate">
              {ODS_SHORT_NAMES[ods.odsNumber] ?? ods.shortName}
            </p>
            <div className="flex items-center gap-2 shrink-0">
              <StatusBadge status={ods.status} />
              <GapBadge gap={gap} />
            </div>
          </div>

          {/* Progress bar */}
          <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden mt-2">
            <div
              className={`h-full rounded-full transition-all duration-500 ${progressBarColor(ods.score)}`}
              style={{ width: `${pct}%` }}
            />
            {/* Target marker */}
            <div
              className="absolute top-0 h-full w-0.5 bg-gray-500 opacity-60"
              style={{ left: `${targetPct}%` }}
              title={`Meta: ${target}`}
            />
          </div>

          {/* Score labels */}
          <div className="flex items-center justify-between mt-1">
            <span className={`text-sm font-semibold tabular-nums ${scoreColor(ods.score)}`}>
              {ods.score !== null ? ods.score.toFixed(1) : "—"}
              <span className="text-xs font-normal text-gray-400 ml-1">atual</span>
            </span>
            <span className="text-xs text-gray-400">
              Meta: <span className="font-medium text-gray-600">{target}</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryStats({
  verde,
  amarelo,
  vermelho,
  noData,
  total,
}: {
  verde: number;
  amarelo: number;
  vermelho: number;
  noData: number;
  total: number;
}) {
  const items = [
    { label: "Verde (meta atingida)", value: verde, color: "text-green-700", bg: "bg-green-100", bar: "bg-green-500" },
    { label: "Amarelo (atencao)", value: amarelo, color: "text-amber-700", bg: "bg-amber-100", bar: "bg-amber-400" },
    { label: "Vermelho (critico)", value: vermelho, color: "text-red-700", bg: "bg-red-100", bar: "bg-red-500" },
    { label: "Sem dados", value: noData, color: "text-gray-600", bg: "bg-gray-100", bar: "bg-gray-300" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {items.map(({ label, value, color, bg, bar }) => (
        <div key={label} className={`rounded-lg p-4 ${bg}`}>
          <div className={`text-2xl font-bold tabular-nums ${color}`}>{value}</div>
          <div className="text-xs text-gray-600 mt-0.5">{label}</div>
          <div className="mt-2 h-1.5 bg-white bg-opacity-60 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${bar}`}
              style={{ width: total > 0 ? `${(value / total) * 100}%` : "0%" }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function MonitoringPage() {
  const [ibgeCode, setIbgeCode] = useState(DEFAULT_IBGE_CODE);
  const [target, setTarget] = useState(DEFAULT_TARGET);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [sortKey, setSortKey] = useState<SortKey>("odsNumber");

  const { data: report, isLoading, isError, error, refetch } = useOdsReport(ibgeCode);

  const { verde, amarelo, vermelho, noData } = useMemo(() => {
    if (!report) return { verde: 0, amarelo: 0, vermelho: 0, noData: 0 };
    return {
      verde: report.odsCount.verde,
      amarelo: report.odsCount.amarelo,
      vermelho: report.odsCount.vermelho,
      noData: report.odsCount.total - report.odsCount.withData,
    };
  }, [report]);

  const filteredAndSorted = useMemo(() => {
    if (!report) return [];

    let list = [...report.ods];

    // Filter
    if (filterStatus !== "all") {
      list = list.filter((o) => o.status === filterStatus);
    }

    // Sort
    if (sortKey === "scoreAsc") {
      list.sort((a, b) => {
        if (a.score === null && b.score === null) return 0;
        if (a.score === null) return 1;
        if (b.score === null) return -1;
        return a.score - b.score;
      });
    } else if (sortKey === "gapDesc") {
      list.sort((a, b) => {
        const gapA = a.score !== null ? target - a.score : -Infinity;
        const gapB = b.score !== null ? target - b.score : -Infinity;
        return gapB - gapA;
      });
    } else {
      list.sort((a, b) => a.odsNumber - b.odsNumber);
    }

    return list;
  }, [report, filterStatus, sortKey, target]);

  const FILTER_OPTIONS: { value: FilterStatus; label: string }[] = [
    { value: "all", label: "Todos" },
    { value: "vermelho", label: "Vermelho" },
    { value: "amarelo", label: "Amarelo" },
    { value: "verde", label: "Verde" },
  ];

  const SORT_OPTIONS: { value: SortKey; label: string }[] = [
    { value: "odsNumber", label: "Numero ODS" },
    { value: "scoreAsc", label: "Menor score" },
    { value: "gapDesc", label: "Maior gap" },
  ];

  return (
    <AppShell
      ibgeCode={ibgeCode}
      onSelect={setIbgeCode}
      referenceYear={report?.referenceYear ?? null}
    >
      <div className="space-y-8">
        {/* Page title */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Monitoramento de Metas ODS</h1>
          <p className="text-sm text-gray-500 mt-1">
            Acompanhe o progresso do municipio em cada um dos 17 Objetivos de Desenvolvimento Sustentavel.
          </p>
        </div>

        {isError && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-red-800">Erro ao carregar dados ODS</p>
              <p className="text-xs text-red-600 mt-1">
                {error?.message ?? "Verifique se o servidor esta rodando."}
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

        {/* Summary cards */}
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="h-24 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : report ? (
          <SummaryStats
            verde={verde}
            amarelo={amarelo}
            vermelho={vermelho}
            noData={noData}
            total={report.odsCount.total}
          />
        ) : null}

        {/* Controls */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
            {/* Target score */}
            <div className="flex-1 min-w-[180px]">
              <label className="block text-xs font-medium text-gray-600 mb-1 uppercase tracking-wide">
                Meta de score
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={40}
                  max={100}
                  step={5}
                  value={target}
                  onChange={(e) => setTarget(parseInt(e.target.value, 10))}
                  className="flex-1 accent-blue-600"
                />
                <span className="text-sm font-bold text-blue-700 tabular-nums w-8 text-right">
                  {target}
                </span>
              </div>
            </div>

            {/* Filter */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1 uppercase tracking-wide">
                Filtrar por status
              </label>
              <div className="flex gap-1">
                {FILTER_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setFilterStatus(opt.value)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      filterStatus === opt.value
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Sort */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1 uppercase tracking-wide">
                Ordenar por
              </label>
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
                className="px-3 py-1.5 border border-gray-300 rounded-md text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* ODS list */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Array.from({ length: 17 }, (_, i) => (
              <div key={i} className="h-28 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : filteredAndSorted.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <svg className="w-12 h-12 mx-auto mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <p className="text-sm">Nenhum ODS encontrado com o filtro selecionado.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredAndSorted.map((ods) => (
              <OdsRow key={ods.odsNumber} ods={ods} target={target} />
            ))}
          </div>
        )}

        {/* Legend */}
        {!isLoading && filteredAndSorted.length > 0 && (
          <p className="text-xs text-gray-400 text-center">
            A linha vertical nas barras de progresso indica a meta configurada ({target} pontos).
            Score ≥ 70 = Verde | Score 40–69 = Amarelo | Score &lt; 40 = Vermelho.
          </p>
        )}
      </div>
    </AppShell>
  );
}
