import {
  HitlCheckInputSchema,
  HitlCheckResponseSchema,
  type HitlCheckInput,
  type HitlCheckResponse,
} from "./schemas.js";

/** Regras G-HITL-IOC documentadas em docs/mdo/hitl-queue.md */
export function checkHitlRequirement(input: HitlCheckInput): HitlCheckResponse {
  const parsed = HitlCheckInputSchema.parse(input);

  if (parsed.action === "set_ods_score_direct") {
    return HitlCheckResponseSchema.parse({
      action: parsed.action,
      requiresHitl: false,
      reason:
        "Ação proibida pelo tool-scope — scores são calculados apenas por coletores determinísticos.",
    });
  }

  if (parsed.action === "publish_report") {
    return HitlCheckResponseSchema.parse({
      action: parsed.action,
      requiresHitl: true,
      reason:
        "Publicação de relatório com carimbo institucional exige aprovação humana (G-HITL-IOC-02).",
      approverRoles: ["admin", "prefeito"],
    });
  }

  return HitlCheckResponseSchema.parse({
    action: parsed.action,
    requiresHitl: true,
    reason:
      "Persistir cenário de simulação FPM exige aprovação de prefeito ou admin (G-HITL-IOC-01).",
    approverRoles: ["admin", "prefeito"],
  });
}
