import { useMutation } from "@tanstack/react-query";
import { apiGet } from "../lib/api";
import type { RecommendedScenario } from "../types/api";

export function useRecommendedScenario() {
  const mutation = useMutation<RecommendedScenario, Error, string>({
    mutationFn: (ibgeCode: string) =>
      apiGet<RecommendedScenario>(`/api/recommendations/${ibgeCode}/scenario`),
  });

  return {
    fetchScenario: mutation.mutateAsync,
    isPending: mutation.isPending,
  };
}
