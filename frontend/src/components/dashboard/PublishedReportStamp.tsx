interface PublishedReportStampProps {
  institutionStamp: string;
  publishedAt: string;
  className?: string;
}

/** Carimbo institucional para tela e impressão PDF (G-HITL-IOC-02). */
export function PublishedReportStamp({
  institutionStamp,
  publishedAt,
  className = "",
}: PublishedReportStampProps) {
  return (
    <footer
      className={`mt-8 pt-4 border-t-2 border-foreground/20 text-center print:break-inside-avoid ${className}`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-foreground">
        Documento oficial publicado
      </p>
      <p className="text-sm text-foreground mt-1 max-w-2xl mx-auto">{institutionStamp}</p>
      <p className="text-xs text-muted-foreground mt-2">
        Registro: {new Date(publishedAt).toLocaleString("pt-BR")}
      </p>
    </footer>
  );
}
