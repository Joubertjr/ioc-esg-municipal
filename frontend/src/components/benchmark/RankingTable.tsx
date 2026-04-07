import type { RankingEntry } from "../../types/benchmark";
import type { OdsStatus } from "../../types/api";

interface RankingTableProps {
  ranking: RankingEntry[];
  highlightCode?: string;
  globalAverage: number | null;
}

// ---- Status helpers ----

function scoreToStatus(score: number): OdsStatus {
  return score >= 70 ? "verde" : score >= 40 ? "amarelo" : "vermelho";
}

const STATUS_CONFIG: Record<
  OdsStatus,
  { icon: string; label: string; textColor: string; barColor: string }
> = {
  verde: {
    icon: "✓",
    label: "No caminho",
    textColor: "text-green-700",
    barColor: "bg-green-500",
  },
  amarelo: {
    icon: "⚠",
    label: "Atenção",
    textColor: "text-amber-600",
    barColor: "bg-amber-400",
  },
  vermelho: {
    icon: "✗",
    label: "Crítico",
    textColor: "text-red-600",
    barColor: "bg-red-500",
  },
};

// ---- Medal helpers ----

const MEDAL_LABEL: Record<number, { text: string; className: string }> = {
  1: { text: "🥇", className: "text-yellow-500" },
  2: { text: "🥈", className: "text-gray-400" },
  3: { text: "🥉", className: "text-amber-600" },
};

// ---- Sub-components ----

function StatusCell({ score }: { score: number }) {
  const status = scoreToStatus(score);
  const config = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${config.textColor}`}>
      <span>{config.icon}</span>
      <span>{config.label}</span>
    </span>
  );
}

function TableHead() {
  return (
    <thead>
      <tr className="bg-gray-50 border-b border-gray-200">
        <th
          scope="col"
          className="sticky top-0 bg-gray-50 px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide w-12 z-10"
        >
          #
        </th>
        <th
          scope="col"
          className="sticky top-0 bg-gray-50 px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide z-10"
        >
          Município
        </th>
        <th
          scope="col"
          className="sticky top-0 bg-gray-50 px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide z-10"
        >
          Score Global
        </th>
        <th
          scope="col"
          className="sticky top-0 bg-gray-50 px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-36 z-10"
        >
          Status
        </th>
      </tr>
    </thead>
  );
}

// ---- Main component ----

export function RankingTable({ ranking, highlightCode, globalAverage }: RankingTableProps) {
  if (ranking.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 p-8 text-center">
        <p className="text-sm text-gray-500">Nenhum dado de ranking disponível.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden">
      <div className="max-h-[600px] overflow-y-auto">
        <table className="w-full text-sm" aria-label="Ranking de municípios">
          <TableHead />
          <tbody className="divide-y divide-gray-100 bg-white">
            {ranking.map((entry) => {
              const isHighlighted = entry.ibgeCode === highlightCode;
              const status = scoreToStatus(entry.globalScore);
              const config = STATUS_CONFIG[status];
              const medal = MEDAL_LABEL[entry.position];

              return (
                <tr
                  key={entry.ibgeCode}
                  className={`transition-colors ${
                    isHighlighted ? "bg-blue-50 border-l-4 border-l-blue-500" : "hover:bg-gray-50"
                  }`}
                  aria-selected={isHighlighted}
                >
                  {/* Posição */}
                  <td className="px-4 py-3 w-12 text-center">
                    {medal ? (
                      <span
                        className={`font-semibold ${medal.className}`}
                        aria-label={`${entry.position}º lugar`}
                      >
                        {medal.text}
                      </span>
                    ) : (
                      <span className="text-gray-500 font-medium">{entry.position}</span>
                    )}
                  </td>

                  {/* Município */}
                  <td className="px-4 py-3">
                    <span
                      className={`font-medium ${isHighlighted ? "text-blue-800" : "text-gray-900"}`}
                    >
                      {entry.municipalityName ?? entry.ibgeCode}
                    </span>
                  </td>

                  {/* Score */}
                  <td className="px-4 py-3 text-right tabular-nums">
                    <span
                      className={`font-bold text-base ${
                        status === "verde"
                          ? "text-green-700"
                          : status === "amarelo"
                            ? "text-amber-600"
                            : "text-red-600"
                      }`}
                    >
                      {entry.globalScore}
                    </span>
                    <span className="text-gray-400 text-xs">/100</span>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3 w-36">
                    <StatusCell score={entry.globalScore} />
                    {/* Mini progress bar */}
                    <div className="mt-1 h-1 w-full bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${config.barColor}`}
                        style={{
                          width: `${Math.min(100, Math.max(0, entry.globalScore))}%`,
                        }}
                        role="progressbar"
                        aria-valuenow={entry.globalScore}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer: média global */}
      <div className="bg-gray-50 border-t border-gray-200 px-4 py-2 flex items-center justify-between">
        <span className="text-xs text-gray-500">
          {ranking.length} município{ranking.length !== 1 ? "s" : ""}
        </span>
        {globalAverage !== null ? (
          <span className="text-xs font-medium text-gray-700">
            Média: <span className="font-bold">{globalAverage}/100</span>
          </span>
        ) : (
          <span className="text-xs text-gray-400">Média: —</span>
        )}
      </div>
    </div>
  );
}
