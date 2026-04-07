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
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      {/* Branding */}
      <div className="mb-8 text-center">
        <div className="inline-flex items-center gap-2 mb-2">
          <span className="text-2xl font-bold text-gray-900">IOC ESG Municipal</span>
          <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
            SC
          </span>
        </div>
        <p className="text-sm text-gray-500">Plataforma de Gestão ESG para Municípios</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-lg bg-white rounded-xl shadow-md border border-gray-200 p-8">
        <h1 className="text-xl font-semibold text-gray-900 mb-2">Bem-vindo ao IOC ESG Municipal</h1>
        <p className="text-sm text-gray-500 mb-6">
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
            className="block text-sm font-medium text-gray-700 mb-1"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />

            {/* Dropdown de resultados */}
            {showDropdown && filteredOptions.length > 0 && (
              <ul className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                {!query.trim() && (
                  <li className="px-3 py-1.5 text-xs font-medium text-gray-400 uppercase tracking-wide">
                    Municípios populares
                  </li>
                )}
                {filteredOptions.map((option) => (
                  <li key={option.ibgeCode}>
                    <button
                      type="button"
                      onClick={() => handleSelect(option)}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition-colors ${
                        selected?.ibgeCode === option.ibgeCode
                          ? "bg-blue-50 text-blue-700 font-medium"
                          : "text-gray-700"
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
              <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg px-3 py-3">
                <p className="text-sm text-gray-500">Nenhum município encontrado para "{query}".</p>
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
          className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium text-sm rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
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
      <p className="mt-8 text-xs text-gray-400 text-center">
        Dados públicos. Transparência total. Conforme Lei 14.133/2021.
      </p>
    </div>
  );
}
