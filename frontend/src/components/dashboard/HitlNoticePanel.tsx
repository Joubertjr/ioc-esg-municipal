import { useHitlCheck } from "../../hooks/useHitlCheck";

/** Exibe regras HITL para ações sensíveis (G-HITL-IOC). */
export function HitlNoticePanel() {
  const { data, isLoading } = useHitlCheck("persist_scenario");

  if (isLoading || !data?.requiresHitl) return null;

  return (
    <div className="bg-warning/10 border border-warning/30 rounded-xl p-4 text-sm">
      <p className="font-medium text-foreground">Aprovação humana necessária (HITL)</p>
      <p className="text-muted-foreground mt-1">{data.reason}</p>
      {data.approverRoles && (
        <p className="text-xs text-muted-foreground mt-2">
          Aprovadores: {data.approverRoles.join(", ")}
        </p>
      )}
    </div>
  );
}
