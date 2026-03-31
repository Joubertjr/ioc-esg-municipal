import type { OdsSummary, OdsStatus } from "../../types/api";

interface OdsCardProps {
  ods: OdsSummary;
  onClick: () => void;
}

const DOT_COLOR: Record<OdsStatus, string> = {
  verde: "bg-green-500",
  amarelo: "bg-amber-400",
  vermelho: "bg-red-500",
};

export function OdsCard({ ods, onClick }: OdsCardProps) {
  const hasData = ods.score !== null;

  return (
    <button
      onClick={onClick}
      className={`relative text-left rounded-lg bg-white shadow-sm border border-gray-200 p-3 transition-all hover:shadow-md hover:scale-[1.02] cursor-pointer ${
        hasData ? "" : "opacity-40"
      }`}
      style={{ borderLeftWidth: "4px", borderLeftColor: ods.color }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span
          className="inline-flex items-center justify-center w-7 h-7 rounded text-xs font-bold text-white"
          style={{ backgroundColor: ods.color }}
        >
          {ods.odsNumber}
        </span>
        <span className="text-xs font-medium text-gray-600 leading-tight line-clamp-2">
          {ods.shortName}
        </span>
      </div>
      <div className="flex items-center justify-between">
        {hasData ? (
          <>
            <span className="text-2xl font-bold text-gray-900">{ods.score}</span>
            <span className={`w-3 h-3 rounded-full ${DOT_COLOR[ods.status!]}`} />
          </>
        ) : (
          <span className="text-sm text-gray-400">Sem dados</span>
        )}
      </div>
      {hasData && ods.sources.length > 0 && (
        <div className="mt-1 text-[10px] text-gray-400 uppercase tracking-wider">
          {ods.sources.join(" + ")}
        </div>
      )}
    </button>
  );
}

export function OdsCardSkeleton() {
  return (
    <div className="rounded-lg bg-white shadow-sm border border-gray-200 p-3 animate-pulse">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded bg-gray-200" />
        <div className="h-3 w-16 rounded bg-gray-200" />
      </div>
      <div className="h-8 w-12 rounded bg-gray-200" />
    </div>
  );
}
