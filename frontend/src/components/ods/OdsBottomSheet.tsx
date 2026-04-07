import { useEffect, useRef, useCallback } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OdsSummary } from "../../types/api";
import { ODS_DESCRIPTIONS } from "../../../../shared/constants/ods-descriptions";
import { IndicatorRow } from "./IndicatorRow";

// ---------------------------------------------------------------------------
// OdsBottomSheet — mobile-first detail panel (replaces fullscreen drawer)
// Slides up from the bottom with backdrop, swipe-to-dismiss support.
// On desktop (md+), the existing OdsDetailDrawer is used instead.
// ---------------------------------------------------------------------------

interface OdsBottomSheetProps {
  ods: OdsSummary | null;
  onClose: () => void;
}

export function OdsBottomSheet({ ods, onClose }: OdsBottomSheetProps) {
  const isOpen = ods !== null;
  const sheetRef = useRef<HTMLDivElement>(null);
  const startY = useRef<number | null>(null);
  const currentY = useRef<number | null>(null);

  // Close on ESC
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (isOpen) document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Swipe-to-dismiss handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
    currentY.current = e.touches[0].clientY;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (startY.current === null || !sheetRef.current) return;
    currentY.current = e.touches[0].clientY;
    const delta = currentY.current - startY.current;

    // Only allow dragging down (positive delta)
    if (delta > 0) {
      sheetRef.current.style.transform = `translateY(${delta}px)`;
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (startY.current === null || currentY.current === null || !sheetRef.current) {
      startY.current = null;
      currentY.current = null;
      return;
    }

    const delta = currentY.current - startY.current;
    sheetRef.current.style.transform = "";

    // Dismiss if dragged more than 120px down
    if (delta > 120) {
      onClose();
    }

    startY.current = null;
    currentY.current = null;
  }, [onClose]);

  const desc = ods ? ODS_DESCRIPTIONS[ods.odsNumber] : null;
  const updatedLabel = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        className={cn(
          "fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
        onClick={onClose}
      />

      {/* Bottom Sheet */}
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bottom-sheet-title"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 flex flex-col",
          "max-h-[85vh] rounded-t-2xl",
          "bg-card shadow-2xl border-t border-border",
          "transition-transform duration-300 ease-out",
          isOpen ? "translate-y-0" : "translate-y-full",
        )}
      >
        {ods && (
          <>
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>

            {/* Header */}
            <div
              className="px-5 py-3 text-white shrink-0 mx-3 rounded-xl"
              style={{ backgroundColor: ods.color }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-medium opacity-80">ODS {ods.odsNumber}</span>
                  <h2 id="bottom-sheet-title" className="text-base font-bold leading-snug">
                    {ods.name}
                  </h2>
                </div>
                <button
                  onClick={onClose}
                  aria-label="Fechar painel"
                  className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                >
                  <X className="size-4" />
                </button>
              </div>

              {/* Score */}
              {ods.score !== null && (
                <div className="mt-1.5 flex items-baseline gap-1">
                  <span className="text-2xl font-bold tabular-nums">{ods.score}</span>
                  <span className="text-sm opacity-80">/100</span>
                </div>
              )}
            </div>

            {/* Meta 2030 */}
            {desc && (
              <div className="mx-5 mt-3 p-3 bg-primary/5 rounded-lg border border-primary/10 shrink-0">
                <p className="text-xs font-semibold text-primary mb-0.5">Meta 2030</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{desc.meta2030}</p>
              </div>
            )}

            {/* Description */}
            {desc && (
              <p className="mx-5 mt-2 text-xs text-muted-foreground leading-relaxed">
                {desc.description}
              </p>
            )}

            {/* Indicators — scrollable */}
            <div className="px-5 py-3 overflow-y-auto flex-1 min-h-0">
              <h3 className="text-sm font-semibold text-foreground mb-2">
                Indicadores ({ods.indicators.length})
              </h3>

              {ods.indicators.length === 0 ? (
                <p className="text-muted-foreground text-sm italic">
                  Nenhum indicador disponível para este ODS neste município.
                </p>
              ) : (
                ods.indicators.map((ind) => (
                  <IndicatorRow key={ind.id} indicator={ind} odsNumber={ods.odsNumber} />
                ))
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-border text-xs text-muted-foreground/60 shrink-0 pb-safe">
              {ods.sources.length > 0 && (
                <p>Fontes: {ods.sources.map((s) => s.toUpperCase()).join(", ")}</p>
              )}
              <p className="mt-0.5">Atualizado em {updatedLabel}</p>
            </div>
          </>
        )}
      </div>
    </>
  );
}
