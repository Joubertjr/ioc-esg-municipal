import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "../lib/api";
import type { HitlPendingResponse, HitlRequestItem } from "../types/api";

export function useHitlPending(enabled: boolean) {
  return useQuery<HitlPendingResponse, Error>({
    queryKey: ["hitl-pending"],
    queryFn: () => apiGet<HitlPendingResponse>("/api/agent/hitl/pending"),
    enabled,
    refetchInterval: 30_000,
  });
}

export function useHitlApprove() {
  const qc = useQueryClient();
  return useMutation<HitlRequestItem, Error, string>({
    mutationFn: (id) => apiPost<HitlRequestItem>(`/api/agent/hitl/${id}/approve`, {}),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["hitl-pending"] });
      void qc.invalidateQueries({ queryKey: ["published-report"] });
    },
  });
}

export function useHitlReject() {
  const qc = useQueryClient();
  return useMutation<HitlRequestItem, Error, { id: string; reviewNote?: string }>({
    mutationFn: ({ id, reviewNote }) =>
      apiPost<HitlRequestItem>(`/api/agent/hitl/${id}/reject`, { reviewNote }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["hitl-pending"] }),
  });
}
