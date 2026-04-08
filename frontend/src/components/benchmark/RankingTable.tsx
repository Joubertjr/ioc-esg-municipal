import type { RankingEntry } from "../../types/api";
import type { OdsStatus } from "../../types/api";
import { getMunicipalityName } from "../../lib/municipalityLookup";

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
    textColor: "text-success",
    barColor: "bg-success",
  },
  amarelo: {
    icon: "⚠",
    label: "Atenção",
    textColor: "text-warning",
    barColor: "bg-warning",
  },
  vermelho: {
    icon: "✗",
    label: "Crítico",
    textColor: "text-danger",
    barColor: "bg-danger",
  },
};

// ---- Medal helpers ----

const MEDAL_LABEL: Record<number, { text: string; className: string }> = {
  1: { text: "🥇", className: "text-warning" },
  2: { text: "🥈", className: "text-muted-foreground" },
  3: { text: "🥉", className: "text-warning" },
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
      <tr className="bg-muted border-b border-border">
        <th
          scope="col"
          className="sticky top-0 bg-muted px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide w-12 z-10"
        >
          #
        </th>
        <th
          scope="col"
          className="sticky top-0 bg-muted px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide z-10"
        >
          Município
        </th>
        <th
          scope="col"
          className="sticky top-0 bg-muted px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide z-10"
        >
          Score Global
        </th>
        <th
          scope="col"
          className="sticky top-0 bg-muted px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide w-36 z-10"
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
      <div className="bg-card rounded-xl shadow-card p-8 text-center">
        <p className="text-sm text-muted-foreground">Nenhum dado de ranking disponível.</p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl shadow-card overflow-hidden">
      <div className="max-h-[600px] overflow-y-auto">
        <table className="w-full text-sm" aria-label="Ranking de municípios">
          <TableHead />
          <tbody className="divide-y divide-border bg-card">
            {ranking.map((entry) => {
              const isHighlighted = entry.ibgeCode === highlightCode;
              const status = scoreToStatus(entry.globalScore);
              const config = STATUS_CONFIG[status];
              const medal = MEDAL_LABEL[entry.position];

              return (
                <tr
                  key={entry.ibgeCode}
                  className={`transition-colors ${
                    isHighlighted ? "bg-primary/10 border-l-4 border-l-primary" : "hover:bg-accent"
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
                      <span className="text-muted-foreground font-medium">{entry.position}</span>
                    )}
                  </td>

                  {/* Município */}
                  <td className="px-4 py-3">
                    <span
                      className={`font-medium ${isHighlighted ? "text-primary" : "text-foreground"}`}
                    >
                      {entry.municipalityName ?? getMunicipalityName(entry.ibgeCode)}
                    </span>
                  </td>

                  {/* Score */}
                  <td className="px-4 py-3 text-right tabular-nums">
                    <span
                      className={`font-bold text-base ${
                        status === "verde"
                          ? "text-success"
                          : status === "amarelo"
                            ? "text-warning"
                            : "text-danger"
                      }`}
                    >
                      {entry.globalScore}
                    </span>
                    <span className="text-muted-foreground/60 text-xs">/100</span>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3 w-36">
                    <StatusCell score={entry.globalScore} />
                    {/* Mini progress bar */}
                    <div className="mt-1 h-1.5 w-full bg-muted rounded-full overflow-hidden">
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
      <div className="bg-muted border-t border-border px-4 py-2 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {ranking.length} município{ranking.length !== 1 ? "s" : ""}
        </span>
        {globalAverage !== null ? (
          <span className="text-xs font-medium text-foreground">
            Média: <span className="font-bold">{globalAverage}/100</span>
          </span>
        ) : (
          <span className="text-xs text-muted-foreground/60">Média: —</span>
        )}
      </div>
    </div>
  );
}
