import { useEffect } from "react";
import type { OdsSummary, OdsStatus } from "../../types/api";

interface OdsDetailDrawerProps {
  ods: OdsSummary | null;
  onClose: () => void;
}

const STATUS_DOT: Record<OdsStatus, string> = {
  verde: "bg-green-500",
  amarelo: "bg-amber-400",
  vermelho: "bg-red-500",
};

export function OdsDetailDrawer({ ods, onClose }: OdsDetailDrawerProps) {
  const isOpen = ods !== null;

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (isOpen) document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/30 z-40 transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`fixed inset-y-0 right-0 w-96 max-w-full bg-white shadow-2xl z-50 transition-transform duration-300 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {ods && (
          <>
            {/* Header */}
            <div
              className="px-6 py-4 text-white"
              style={{ backgroundColor: ods.color }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium opacity-80">
                    ODS {ods.odsNumber}
                  </span>
                  <h2 className="text-lg font-bold">{ods.name}</h2>
                </div>
                <button
                  onClick={onClose}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                >
                  <span className="text-lg leading-none">&times;</span>
                </button>
              </div>
              {ods.score !== null && (
                <div className="mt-2 flex items-center gap-3">
                  <span className="text-3xl font-bold">{ods.score}</span>
                  <span className="text-sm opacity-80">/ 100</span>
                </div>
              )}
            </div>

            {/* Content */}
            <div className="px-6 py-4 overflow-y-auto" style={{ maxHeight: "calc(100vh - 140px)" }}>
              {ods.indicators.length === 0 ? (
                <p className="text-gray-500 text-sm italic">
                  Nenhum indicador disponivel para este ODS.
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b">
                      <th className="pb-2 font-medium">Indicador</th>
                      <th className="pb-2 font-medium text-right">Score</th>
                      <th className="pb-2 font-medium text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ods.indicators.map((ind) => (
                      <tr key={ind.id} className="border-b border-gray-100">
                        <td className="py-3">
                          <div className="font-medium text-gray-900">
                            {ind.indicatorName.replace(/_/g, " ")}
                          </div>
                          <div className="text-xs text-gray-400 mt-0.5">
                            {ind.source.toUpperCase()} &middot; {ind.referenceYear}
                          </div>
                          {ind.value !== null && (
                            <div className="text-xs text-gray-500 mt-0.5">
                              Valor: {typeof ind.value === "number" ? ind.value.toLocaleString("pt-BR") : ind.value}
                            </div>
                          )}
                        </td>
                        <td className="py-3 text-right font-mono font-bold text-gray-900">
                          {ind.score !== null ? ind.score : "—"}
                        </td>
                        <td className="py-3 text-center">
                          {ind.status ? (
                            <span
                              className={`inline-block w-3 h-3 rounded-full ${STATUS_DOT[ind.status]}`}
                            />
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {ods.sources.length > 0 && (
                <div className="mt-4 pt-4 border-t text-xs text-gray-400">
                  Fontes: {ods.sources.map((s) => s.toUpperCase()).join(", ")}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
