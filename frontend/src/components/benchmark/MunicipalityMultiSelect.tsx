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
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/10"
            >
              {getMunicipalityName(code)}
              <button
                type="button"
                onClick={() => handleRemove(code)}
                aria-label={`Remover ${getMunicipalityName(code)}`}
                className="ml-0.5 text-primary/60 hover:text-primary transition-colors leading-none"
              >
                ×
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={handleClear}
            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors border border-border"
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
          className="w-full px-3 py-1.5 text-sm bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent disabled:bg-muted disabled:text-muted-foreground/60 disabled:cursor-not-allowed"
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
          <ul className="absolute top-full left-0 mt-1 w-full bg-card border border-border rounded-xl shadow-popover max-h-60 overflow-y-auto z-50">
            {filtered.map((m) => {
              const isSelected = selected.includes(m.ibgeCode);
              return (
                <li key={m.ibgeCode}>
                  <button
                    type="button"
                    disabled={isSelected}
                    className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                      isSelected
                        ? "bg-accent text-primary cursor-default"
                        : "hover:bg-accent text-foreground"
                    }`}
                    onClick={() => handleSelect(m.ibgeCode)}
                  >
                    <span className="font-medium">{m.name}</span>
                    <span className="text-muted-foreground/60 ml-2 text-xs">{m.ibgeCode}</span>
                    {isSelected && <span className="ml-1 text-primary text-xs">selecionado</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Validation hint */}
      {!isValid && selected.length > 0 && (
        <p className="mt-1.5 text-xs text-warning">
          Selecione pelo menos 2 municípios para comparar.
        </p>
      )}
      {selected.length === 0 && (
        <p className="mt-1.5 text-xs text-muted-foreground/60">
          Selecione pelo menos 2 municípios para habilitar a comparação.
        </p>
      )}
    </div>
  );
}
