import { Link } from "react-router-dom";
import { useExecutiveReport } from "../../hooks/useExecutiveReport";
import { usePublishedReport, useRequestPublishReport } from "../../hooks/usePublishedReport";
import { useAuthContext } from "../../contexts/AuthContext";
import { useToast } from "../ui/Toast";
import { PublishedReportStamp } from "./PublishedReportStamp";

interface ExecutiveReportPanelProps {
  ibgeCode: string;
  showReportLink?: boolean;
}

const PRIORITY_ODS = [3, 4, 6] as const;

const PRIORITY_LABEL: Record<"alta" | "media" | "baixa", string> = {
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
};

const PRIORITY_CLASS: Record<"alta" | "media" | "baixa", string> = {
  alta: "bg-danger/10 text-danger",
  media: "bg-warning/10 text-warning",
  baixa: "bg-muted text-muted-foreground",
};

const STATUS_CLASS: Record<string, string> = {
  verde: "bg-success/10 text-success",
  amarelo: "bg-warning/10 text-warning",
  vermelho: "bg-danger/10 text-danger",
};

export function ExecutiveReportPanel({
  ibgeCode,
  showReportLink = true,
}: ExecutiveReportPanelProps) {
  const { currentUser } = useAuthContext();
  const { showToast } = useToast();
  const { data, isLoading, isError, error } = useExecutiveReport(ibgeCode);
  const { data: published } = usePublishedReport(ibgeCode);
  const requestPublish = useRequestPublishReport(ibgeCode);

  const canRequestPublish =
    currentUser?.role === "admin" ||
    currentUser?.role === "prefeito" ||
    currentUser?.role === "secretario";

  if (isLoading) {
    return (
      <div className="bg-card rounded-xl shadow-card p-6 space-y-3 animate-pulse">
        <div className="h-5 w-64 bg-muted rounded" />
        <div className="h-4 w-full bg-muted rounded" />
        <div className="h-4 w-11/12 bg-muted rounded" />
        <div className="h-4 w-9/12 bg-muted rounded" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="bg-card rounded-xl shadow-card p-6">
        <h3 className="text-lg font-semibold text-foreground">Relatório Executivo (MDO)</h3>
        <p className="text-sm text-muted-foreground mt-2">
          Não foi possível carregar o relatório executivo para este município.
        </p>
        {error?.message && (
          <p className="text-xs text-muted-foreground/80 mt-1">Detalhe: {error.message}</p>
        )}
      </div>
    );
  }

  const topRecommendation = data.recommendations[0];
  const pilotOds = PRIORITY_ODS.map((n) => data.odsScores.find((o) => o.odsNumber === n)).filter(
    Boolean,
  );

  return (
    <div className="bg-card rounded-xl shadow-card p-6 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Relatório Executivo (MDO)</h3>
          <p className="text-sm text-muted-foreground">
            Gerado em {new Date(data.generatedAt).toLocaleString("pt-BR")}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-primary/10 text-primary">
            Confiança {Math.round(data.confidence * 100)}%
          </span>
          {published && (
            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-success/10 text-success">
              Publicado oficialmente
            </span>
          )}
          {showReportLink && (
            <Link
              to="/reports"
              className="text-xs font-medium px-2.5 py-1 rounded-full border border-border text-foreground hover:bg-accent transition-colors"
            >
              Relatório completo →
            </Link>
          )}
          {canRequestPublish && !published && (
            <button
              type="button"
              disabled={requestPublish.isPending}
              onClick={() =>
                requestPublish.mutate(undefined, {
                  onSuccess: (r) =>
                    showToast(
                      `Publicação enviada para aprovação HITL (${r.hitlRequestId.slice(0, 8)}…).`,
                      "success",
                    ),
                  onError: (err) => showToast(err.message, "error"),
                })
              }
              className="text-xs font-medium px-2.5 py-1 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {requestPublish.isPending ? "Enviando…" : "Solicitar publicação"}
            </button>
          )}
        </div>
      </div>

      {pilotOds.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {pilotOds.map((ods) => (
            <span
              key={ods!.odsNumber}
              className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_CLASS[ods!.status] ?? "bg-muted"}`}
            >
              ODS {ods!.odsNumber}: {ods!.score.toFixed(0)} · {ods!.status}
            </span>
          ))}
        </div>
      )}

      <p className="text-sm leading-relaxed text-foreground">{data.summary}</p>

      {topRecommendation && (
        <div className="border border-border rounded-lg p-4 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <p className="font-medium text-sm text-foreground">{topRecommendation.title}</p>
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full ${PRIORITY_CLASS[topRecommendation.priority]}`}
            >
              Prioridade {PRIORITY_LABEL[topRecommendation.priority]}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            ODS alvo: {topRecommendation.targetOds} · Impacto: {topRecommendation.estimatedImpact}
          </p>
          <p className="text-sm text-foreground">{topRecommendation.rationale}</p>
        </div>
      )}

      {published && (
        <PublishedReportStamp
          institutionStamp={published.institutionStamp}
          publishedAt={published.publishedAt}
        />
      )}
    </div>
  );
}
