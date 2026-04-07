import { ODS_DEFINITIONS } from "../../../../shared/constants/ods";

export interface OdsComparisonTableProps {
  comparison: Array<{
    odsNumber: number;
    municipalityScore: number | null;
    benchmarkAverage: number | null;
    delta: number | null;
    aboveAverage: boolean | null;
  }>;
  averages: Array<{
    odsNumber: number;
    average: number | null;
    min: number | null;
    max: number | null;
    count: number;
  }>;
}

/** Renders a score cell or a "—" placeholder when data is absent. */
function ScoreCell({ score }: { score: number | null }) {
  if (score === null) {
    return <span className="text-muted-foreground/60 text-xs">—</span>;
  }

  const color =
    score >= 70
      ? "text-green-700 font-semibold"
      : score >= 40
        ? "text-amber-700 font-semibold"
        : "text-red-600 font-semibold";

  return <span className={`text-sm ${color}`}>{score}</span>;
}

/** Delta badge: green arrow up or red arrow down. */
function DeltaBadge({
  delta,
  aboveAverage,
}: {
  delta: number | null;
  aboveAverage: boolean | null;
}) {
  if (delta === null || aboveAverage === null) {
    return <span className="text-muted-foreground/60 text-xs">—</span>;
  }

  const isPositive = aboveAverage;
  const formatted = `${isPositive ? "+" : ""}${delta.toFixed(1)}`;

  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded-full ${
        isPositive ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
      }`}
    >
      {isPositive ? "↑" : "↓"} {formatted}
    </span>
  );
}

export function OdsComparisonTable({ comparison, averages }: OdsComparisonTableProps) {
  // Build a lookup map from averages for O(1) access
  const averagesMap = new Map(averages.map((a) => [a.odsNumber, a]));

  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">Tabela Comparativa por ODS</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Município vs. média do grupo</p>
      </div>

      {/* overflow-x-auto provides horizontal scroll on mobile */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="bg-muted border-b border-border">
              <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground w-8">
                ODS
              </th>
              <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">
                Nome
              </th>
              <th className="text-center py-2 px-3 text-xs font-medium text-muted-foreground w-28">
                Município
              </th>
              <th className="text-center py-2 px-3 text-xs font-medium text-muted-foreground w-28">
                Média
              </th>
              <th className="text-center py-2 px-3 text-xs font-medium text-muted-foreground w-14">
                Mín
              </th>
              <th className="text-center py-2 px-3 text-xs font-medium text-muted-foreground w-14">
                Máx
              </th>
              <th className="text-center py-2 px-3 text-xs font-medium text-muted-foreground w-24">
                Delta
              </th>
            </tr>
          </thead>

          <tbody>
            {comparison.map((entry) => {
              const def = ODS_DEFINITIONS.find((d) => d.number === entry.odsNumber);
              const avg = averagesMap.get(entry.odsNumber);
              const color = def?.color ?? "#9ca3af";
              const name = def?.name ?? `ODS ${entry.odsNumber}`;

              return (
                <tr
                  key={entry.odsNumber}
                  className="border-b border-border hover:bg-accent transition-colors"
                >
                  {/* ODS number badge with brand color */}
                  <td className="py-2 px-3">
                    <span
                      className="inline-flex items-center justify-center w-6 h-6 rounded text-[10px] font-bold text-white shrink-0"
                      style={{ backgroundColor: color }}
                    >
                      {entry.odsNumber}
                    </span>
                  </td>

                  {/* Full ODS name */}
                  <td className="py-2 px-3">
                    <span className="text-xs text-foreground leading-tight">{name}</span>
                  </td>

                  {/* Municipality score + progress bar */}
                  <td className="py-2 px-3">
                    {entry.municipalityScore !== null ? (
                      <div className="space-y-1">
                        <div className="flex justify-between">
                          <ScoreCell score={entry.municipalityScore} />
                        </div>
                        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-blue-500 transition-all duration-500"
                            style={{ width: `${Math.min(100, entry.municipalityScore)}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground/60 italic">
                        Dados indisponíveis
                      </span>
                    )}
                  </td>

                  {/* Benchmark average + progress bar */}
                  <td className="py-2 px-3">
                    {entry.benchmarkAverage !== null ? (
                      <div className="space-y-1">
                        <div className="flex justify-between">
                          <ScoreCell score={entry.benchmarkAverage} />
                        </div>
                        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gray-400 transition-all duration-500"
                            style={{ width: `${Math.min(100, entry.benchmarkAverage)}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground/60">—</span>
                    )}
                  </td>

                  {/* Min */}
                  <td className="py-2 px-3 text-center">
                    {avg?.min !== null && avg?.min !== undefined ? (
                      <span className="text-xs text-muted-foreground">{avg.min.toFixed(0)}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground/40">—</span>
                    )}
                  </td>

                  {/* Max */}
                  <td className="py-2 px-3 text-center">
                    {avg?.max !== null && avg?.max !== undefined ? (
                      <span className="text-xs text-muted-foreground">{avg.max.toFixed(0)}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground/40">—</span>
                    )}
                  </td>

                  {/* Delta badge */}
                  <td className="py-2 px-3 text-center">
                    <DeltaBadge delta={entry.delta} aboveAverage={entry.aboveAverage} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      {comparison.length > 0 && (
        <div className="flex flex-wrap items-center gap-4 px-4 py-2 border-t border-border bg-muted">
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-2 rounded-full bg-blue-500" />
            <span className="text-[10px] text-muted-foreground">Score do município</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-2 rounded-full bg-gray-400" />
            <span className="text-[10px] text-muted-foreground">Média do grupo</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-green-700 font-medium">↑ positivo</span>
            <span className="text-[10px] text-muted-foreground/60">/</span>
            <span className="text-[10px] text-red-600 font-medium">↓ negativo</span>
            <span className="text-[10px] text-muted-foreground">vs. média</span>
          </div>
        </div>
      )}
    </div>
  );
}
