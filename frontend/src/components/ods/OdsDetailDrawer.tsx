import { useEffect, useRef } from "react";
import type { OdsSummary } from "../../types/api";
import { ODS_DESCRIPTIONS } from "../../../../shared/constants/ods-descriptions";
import { IndicatorRow } from "./IndicatorRow";

interface OdsDetailDrawerProps {
  ods: OdsSummary | null;
  onClose: () => void;
}

export function OdsDetailDrawer({ ods, onClose }: OdsDetailDrawerProps) {
  const isOpen = ods !== null;
  const drawerRef = useRef<HTMLDivElement>(null);

  // Fecha com ESC
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (isOpen) document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  // Foca o primeiro elemento interativo ao abrir (acessibilidade WCAG 2.1 — 2.4.3)
  useEffect(() => {
    if (!isOpen || !drawerRef.current) return;
    const focusable = drawerRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    if (focusable.length > 0) focusable[0].focus();
  }, [isOpen]);

  // Armadilha de foco: mantém o Tab dentro do drawer enquanto aberto
  useEffect(() => {
    if (!isOpen || !drawerRef.current) return;
    const el = drawerRef.current;

    function handleTab(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      const focusable = Array.from(
        el.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((node) => !node.hasAttribute("disabled"));
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement;

      if (e.shiftKey) {
        if (active === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", handleTab);
    return () => document.removeEventListener("keydown", handleTab);
  }, [isOpen]);

  const desc = ods ? ODS_DESCRIPTIONS[ods.odsNumber] : null;
  const updatedLabel = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return (
    <>
      {/* Fundo escuro — oculto para leitores de tela */}
      <div
        aria-hidden="true"
        className={`fixed inset-0 bg-black/30 z-40 transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* Painel lateral */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        className={`fixed inset-y-0 right-0 w-96 max-w-full bg-card shadow-2xl z-50 transition-transform duration-300 flex flex-col ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {ods && (
          <>
            {/* Cabeçalho colorido com o número do ODS */}
            <div className="px-6 py-4 text-white shrink-0" style={{ backgroundColor: ods.color }}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium opacity-80">ODS {ods.odsNumber}</span>
                  <h2 id="drawer-title" className="text-lg font-bold leading-snug">
                    {ods.name}
                  </h2>
                </div>
                <button
                  onClick={onClose}
                  aria-label="Fechar painel"
                  className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 focus:outline-none focus:ring-2 focus:ring-white/60 transition-colors"
                >
                  <span className="text-lg leading-none" aria-hidden="true">
                    &times;
                  </span>
                </button>
              </div>

              {/* Score global do ODS */}
              {ods.score !== null && (
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-3xl font-bold tabular-nums">{ods.score}</span>
                  <span className="text-sm opacity-80">/100</span>
                </div>
              )}

              {/* Descrição oficial */}
              {desc && (
                <p className="mt-2 text-sm opacity-90 leading-relaxed">{desc.description}</p>
              )}
            </div>

            {/* Chamada de destaque: Meta 2030 */}
            {desc && (
              <div className="mx-6 mt-4 p-3 bg-primary/10 rounded-lg border border-primary/10 shrink-0">
                <p className="text-xs font-semibold text-primary mb-1">Meta 2030</p>
                <p className="text-xs text-primary leading-relaxed">{desc.meta2030}</p>
              </div>
            )}

            {/* Lista de indicadores */}
            <div className="px-6 py-4 overflow-y-auto flex-1">
              <h3 className="text-sm font-semibold text-foreground mb-3">
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

            {/* Rodapé: fontes e data de atualização */}
            <div className="px-6 py-3 border-t border-border text-xs text-muted-foreground/60 shrink-0">
              {ods.sources.length > 0 && (
                <p>Fontes: {ods.sources.map((s) => s.toUpperCase()).join(", ")}</p>
              )}
              <p className="mt-1">Atualizado em {updatedLabel}</p>
            </div>
          </>
        )}
      </div>
    </>
  );
}
