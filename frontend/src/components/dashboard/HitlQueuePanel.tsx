import { useAuthContext } from "../../contexts/AuthContext";
import { useHitlApprove, useHitlPending, useHitlReject } from "../../hooks/useHitlQueue";

const ACTION_LABEL: Record<string, string> = {
  persist_scenario: "Persistir cenário FPM",
  publish_report: "Publicar relatório",
};

export function HitlQueuePanel() {
  const { currentUser } = useAuthContext();
  const canReview = currentUser?.role === "admin" || currentUser?.role === "prefeito";
  const { data, isLoading, isError } = useHitlPending(Boolean(canReview));
  const approve = useHitlApprove();
  const reject = useHitlReject();

  if (!canReview) return null;

  if (isLoading) {
    return <div className="bg-card rounded-xl shadow-card p-4 animate-pulse h-20" aria-hidden />;
  }

  if (isError) return null;

  const items = data?.items ?? [];
  if (items.length === 0) return null;

  return (
    <div className="bg-card rounded-xl shadow-card p-6 space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-foreground">Fila HITL</h3>
        <p className="text-sm text-muted-foreground">
          {items.length} pedido(s) aguardando sua aprovação
        </p>
      </div>

      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.id} className="border border-border rounded-lg p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium text-foreground">
                {ACTION_LABEL[item.action] ?? item.action}
              </span>
              <span className="text-xs text-muted-foreground">
                {new Date(item.createdAt).toLocaleString("pt-BR")}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={approve.isPending || reject.isPending}
                onClick={() => approve.mutate(item.id)}
                className="px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                Aprovar
              </button>
              <button
                type="button"
                disabled={approve.isPending || reject.isPending}
                onClick={() => reject.mutate({ id: item.id })}
                className="px-3 py-1.5 text-xs font-medium rounded-md border border-border hover:bg-accent disabled:opacity-50"
              >
                Rejeitar
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
