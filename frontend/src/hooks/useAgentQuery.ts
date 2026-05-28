import { useMutation } from "@tanstack/react-query";
import { apiPost } from "../lib/api";
import type { AgentQueryInput, AgentQueryResponse } from "../types/api";

export function useAgentQuery() {
  return useMutation<AgentQueryResponse, Error, AgentQueryInput>({
    mutationFn: (input) => apiPost<AgentQueryResponse>("/api/agent/query", input),
  });
}
