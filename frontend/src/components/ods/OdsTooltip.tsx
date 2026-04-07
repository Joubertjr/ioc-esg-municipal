import { ODS_DESCRIPTIONS } from "../../../../shared/constants/ods-descriptions";

interface OdsTooltipProps {
  odsNumber: number;
  name: string;
  children: React.ReactNode;
}

export function OdsTooltip({ odsNumber, name, children }: OdsTooltipProps) {
  const desc = ODS_DESCRIPTIONS[odsNumber];
  if (!desc) return <>{children}</>;

  return (
    <div className="group relative">
      {children}
      <div className="invisible group-hover:visible group-focus-within:visible absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg pointer-events-none transition-opacity opacity-0 group-hover:opacity-100 group-focus-within:opacity-100">
        <p className="font-semibold mb-1">
          ODS {odsNumber} — {name}
        </p>
        <p className="text-gray-300 mb-2">{desc.description}</p>
        <p className="text-gray-400 text-[10px]">Meta 2030: {desc.meta2030}</p>
        <p className="text-blue-300 mt-2 text-[10px]">Clique para detalhes →</p>
        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
          <div className="w-2 h-2 bg-gray-900 rotate-45" />
        </div>
      </div>
    </div>
  );
}
