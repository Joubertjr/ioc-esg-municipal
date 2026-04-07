import { useState, useRef, useEffect, useCallback } from "react";
import { SC_MUNICIPALITIES } from "../../../../shared/constants/municipalities-sc";

interface MunicipalityMultiSelectProps {
  selected: string[];
  onChange: (codes: string[]) => void;
  maxItems?: number;
}

// Florianópolis, Joinville, Chapecó, Criciúma, São José
const POPULAR_CODES = ["4205407", "4209102", "4204202", "4205002", "4218707"];

function getMunicipalityName(ibgeCode: string): string {
  return SC_MUNICIPALITIES.find((m) => m.ibgeCode === ibgeCode)?.name ?? ibgeCode;
}

export function MunicipalityMultiSelect({
  selected,
  onChange,
  maxItems = 50,
}: MunicipalityMultiSelectProps) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce query 200ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = debouncedQuery
    ? SC_MUNICIPALITIES.filter((m) =>
        m.name.toLowerCase().includes(debouncedQuery.toLowerCase()),
      ).slice(0, 8)
    : SC_MUNICIPALITIES.filter((m) => POPULAR_CODES.includes(m.ibgeCode));

  const handleSelect = useCallback(
    (ibgeCode: string) => {
      if (selected.includes(ibgeCode)) return;
      if (selected.length >= maxItems) return;
      onChange([...selected, ibgeCode]);
      setQuery("");
      setDebouncedQuery("");
      inputRef.current?.focus();
    },
    [selected, onChange, maxItems],
  );

  const handleRemove = useCallback(
    (ibgeCode: string) => {
      onChange(selected.filter((c) => c !== ibgeCode));
    },
    [selected, onChange],
  );

  const handleClear = useCallback(() => {
    onChange([]);
  }, [onChange]);

  const isValid = selected.length >= 2;

  return (
    <div ref={wrapperRef} className="w-full">
      {/* Selected chips */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selected.map((code) => (
            <span
              key={code}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200"
            >
              {getMunicipalityName(code)}
              <button
                type="button"
                onClick={() => handleRemove(code)}
                aria-label={`Remover ${getMunicipalityName(code)}`}
                className="ml-0.5 text-blue-500 hover:text-blue-800 transition-colors leading-none"
              >
                ×
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={handleClear}
            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors border border-gray-200"
          >
            Limpar
          </button>
        </div>
      )}

      {/* Input */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          placeholder={
            selected.length >= maxItems
              ? `Máximo de ${maxItems} municípios atingido`
              : "Buscar município..."
          }
          disabled={selected.length >= maxItems}
          className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
          onFocus={() => {
            setIsOpen(true);
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
        />

        {/* Dropdown */}
        {isOpen && filtered.length > 0 && (
          <ul className="absolute top-full left-0 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto z-50">
            {filtered.map((m) => {
              const isSelected = selected.includes(m.ibgeCode);
              return (
                <li key={m.ibgeCode}>
                  <button
                    type="button"
                    disabled={isSelected}
                    className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                      isSelected
                        ? "bg-blue-50 text-blue-700 cursor-default"
                        : "hover:bg-blue-50 text-gray-900"
                    }`}
                    onClick={() => handleSelect(m.ibgeCode)}
                  >
                    <span className="font-medium">{m.name}</span>
                    <span className="text-gray-400 ml-2 text-xs">{m.ibgeCode}</span>
                    {isSelected && <span className="ml-1 text-blue-500 text-xs">selecionado</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Validation hint */}
      {!isValid && selected.length > 0 && (
        <p className="mt-1.5 text-xs text-amber-600">
          Selecione pelo menos 2 municípios para comparar.
        </p>
      )}
      {selected.length === 0 && (
        <p className="mt-1.5 text-xs text-gray-400">
          Selecione pelo menos 2 municípios para habilitar a comparação.
        </p>
      )}
    </div>
  );
}
