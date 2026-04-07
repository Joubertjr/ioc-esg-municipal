import type { MunicipalOdsReport } from "../../types/api";

interface CoverageSummaryProps {
  odsCount: MunicipalOdsReport["odsCount"];
  isLoading: boolean;
}

export function CoverageSummary({ odsCount, isLoading }: CoverageSummaryProps) {
  if (isLoading) {
    return <div className="h-8 w-80 rounded bg-gray-200 animate-pulse" />;
  }

  const precisamAtencao = odsCount.amarelo + odsCount.vermelho;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm font-medium text-gray-700">
          {odsCount.withData}/{odsCount.total} ODS com dados
        </span>
        <div className="flex gap-2">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <span className="font-bold">✓</span>
            {odsCount.verde} verde
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
            <span className="font-bold">⚠</span>
            {odsCount.amarelo} amarelo
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <span className="font-bold">✗</span>
            {odsCount.vermelho} vermelho
          </span>
        </div>
      </div>

      {precisamAtencao > 0 && (
        <p className="text-xs text-amber-700">
          {precisamAtencao === 1
            ? "1 ODS precisa de atenção"
            : `${precisamAtencao} ODS precisam de atenção`}
        </p>
      )}
    </div>
  );
}
