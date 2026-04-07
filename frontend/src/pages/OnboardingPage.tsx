import { useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { SC_MUNICIPALITIES } from "../../../shared/constants/municipalities-sc";

// 5 municípios mais populosos de SC como sugestão inicial
const POPULAR_MUNICIPALITY_CODES = [
  "4205407", // Joinville
  "4202404", // Blumenau
  "4209102", // Florianópolis
  "4214805", // São José
  "4208203", // Itajaí
];

const POPULAR_MUNICIPALITIES = SC_MUNICIPALITIES.filter((m) =>
  POPULAR_MUNICIPALITY_CODES.includes(m.ibgeCode),
);

interface MunicipalityOption {
  ibgeCode: string;
  name: string;
}

export function OnboardingPage() {
  const navigate = useNavigate();
  const { updateMunicipality } = useAuth();

  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<MunicipalityOption | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filtra municípios pelo texto de busca (max 8 resultados)
  const filteredOptions = useMemo<MunicipalityOption[]>(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return POPULAR_MUNICIPALITIES;

    return SC_MUNICIPALITIES.filter((m) => m.name.toLowerCase().includes(trimmed)).slice(0, 8);
  }, [query]);

  const handleSelect = useCallback((option: MunicipalityOption) => {
    setSelected(option);
    setQuery(option.name);
    setErrorMessage(null);
  }, []);

  const handleQueryChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setQuery(value);

      // Limpa seleção se o usuário editar o campo após selecionar
      if (selected && value !== selected.name) {
        setSelected(null);
      }
    },
    [selected],
  );

  const handleContinue = useCallback(async () => {
    if (!selected) return;

    setIsSaving(true);
    setErrorMessage(null);

    try {
      await updateMunicipality(selected.ibgeCode);
      navigate("/dashboard");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Erro ao salvar município. Tente novamente.";
      setErrorMessage(message);
    } finally {
      setIsSaving(false);
    }
  }, [selected, updateMunicipality, navigate]);

  const showDropdown = query.trim().length > 0 || !selected;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      {/* Branding */}
      <div className="mb-8 text-center">
        <div className="inline-flex items-center gap-2 mb-2">
          <span className="text-2xl font-bold text-foreground">IOC ESG Municipal</span>
          <span className="px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary">
            SC
          </span>
        </div>
        <p className="text-sm text-muted-foreground">Plataforma de Gestão ESG para Municípios</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-lg bg-card rounded-xl shadow-md border border-border p-8">
        <h1 className="text-xl font-semibold text-foreground mb-2">
          Bem-vindo ao IOC ESG Municipal
        </h1>
        <p className="text-sm text-muted-foreground mb-6">
          Para começar, selecione o município que você administra.
        </p>

        {errorMessage && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{errorMessage}</p>
          </div>
        )}

        {/* Busca de município */}
        <div className="mb-6">
          <label
            htmlFor="municipality-search"
            className="block text-sm font-medium text-foreground mb-1"
          >
            Município
          </label>

          <div className="relative">
            <input
              id="municipality-search"
              type="text"
              autoComplete="off"
              value={query}
              onChange={handleQueryChange}
              placeholder="Buscar município..."
              className="w-full px-3 py-2 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
            />

            {/* Dropdown de resultados */}
            {showDropdown && filteredOptions.length > 0 && (
              <ul className="absolute z-10 mt-1 w-full bg-card border border-border rounded-md shadow-lg max-h-60 overflow-y-auto">
                {!query.trim() && (
                  <li className="px-3 py-1.5 text-xs font-medium text-muted-foreground/60 uppercase tracking-wide">
                    Municípios populares
                  </li>
                )}
                {filteredOptions.map((option) => (
                  <li key={option.ibgeCode}>
                    <button
                      type="button"
                      onClick={() => handleSelect(option)}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors ${
                        selected?.ibgeCode === option.ibgeCode
                          ? "bg-accent text-primary font-medium"
                          : "text-foreground"
                      }`}
                    >
                      {option.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/* Sem resultados */}
            {query.trim().length > 0 && filteredOptions.length === 0 && (
              <div className="absolute z-10 mt-1 w-full bg-card border border-border rounded-md shadow-lg px-3 py-3">
                <p className="text-sm text-muted-foreground">
                  Nenhum município encontrado para "{query}".
                </p>
              </div>
            )}
          </div>

          {selected && (
            <p className="mt-2 text-xs text-green-600 font-medium">
              Selecionado: {selected.name} (IBGE: {selected.ibgeCode})
            </p>
          )}
        </div>

        {/* Botão continuar */}
        <button
          type="button"
          onClick={handleContinue}
          disabled={!selected || isSaving}
          className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-primary hover:bg-primary/90 disabled:bg-primary/40 text-white font-medium text-sm rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          {isSaving && (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          )}
          {isSaving ? "Salvando..." : "Continuar"}
        </button>
      </div>

      {/* Footer */}
      <p className="mt-8 text-xs text-muted-foreground/60 text-center">
        Dados públicos. Transparência total. Conforme Lei 14.133/2021.
      </p>
    </div>
  );
}
