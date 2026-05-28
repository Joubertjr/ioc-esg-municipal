import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "../lib/api";
import type { PublishedExecutiveReport, PublishRequestResponse } from "../types/api";

export function usePublishedReport(ibgeCode: string) {
  return useQuery<PublishedExecutiveReport | null, Error>({
    queryKey: ["published-report", ibgeCode],
    queryFn: async () => {
      try {
        return await apiGet<PublishedExecutiveReport>(`/api/agent/reports/${ibgeCode}/published`);
      } catch (e) {
        if (e instanceof Error && e.message.includes("Nenhum relatório publicado")) {
          return null;
        }
        throw e;
      }
    },
    retry: false,
    staleTime: 60_000,
  });
}

export function useRequestPublishReport(ibgeCode: string) {
  const qc = useQueryClient();
  return useMutation<PublishRequestResponse, Error, void>({
    mutationFn: () =>
      apiPost<PublishRequestResponse>(`/api/agent/reports/${ibgeCode}/publish-request`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hitl-pending"] });
    },
  });
}
