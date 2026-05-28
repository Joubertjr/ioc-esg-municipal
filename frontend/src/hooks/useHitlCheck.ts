import { useQuery } from "@tanstack/react-query";
import { apiPost } from "../lib/api";
import type { HitlAction, HitlCheckResponse } from "../types/api";

export function useHitlCheck(action: HitlAction = "persist_scenario") {
  return useQuery<HitlCheckResponse, Error>({
    queryKey: ["hitl-check", action],
    queryFn: () => apiPost<HitlCheckResponse>("/api/agent/hitl/check", { action }),
    staleTime: 60_000,
  });
}
