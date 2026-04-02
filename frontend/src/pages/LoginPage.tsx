import { useState, useCallback } from "react";
import { useAuth } from "../hooks/useAuth";

type Mode = "login" | "register";

export function LoginPage() {
  const { login, register } = useAuth();

  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setErrorMessage(null);
      setIsSubmitting(true);
      try {
        if (mode === "login") {
          await login(email, password);
        } else {
          if (!name.trim()) {
            setErrorMessage("Informe seu nome completo.");
            return;
          }
          await register(name.trim(), email, password);
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Erro ao autenticar.";
        setErrorMessage(message);
      } finally {
        setIsSubmitting(false);
      }
    },
    [mode, name, email, password, login, register],
  );

  const toggleMode = useCallback(() => {
    setMode((prev) => (prev === "login" ? "register" : "login"));
    setErrorMessage(null);
    setName("");
    setEmail("");
    setPassword("");
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      {/* Branding */}
      <div className="mb-8 text-center">
        <div className="inline-flex items-center gap-2 mb-2">
          <span className="text-2xl font-bold text-gray-900">
            IOC ESG Municipal
          </span>
          <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
            SC
          </span>
        </div>
        <p className="text-sm text-gray-500">
          Plataforma de Gestao ESG para Municipios
        </p>
      </div>

      {/* Card */}
      <div className="w-full max-w-md bg-white rounded-xl shadow-md border border-gray-200 p-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">
          {mode === "login" ? "Entrar na plataforma" : "Criar conta"}
        </h2>

        {errorMessage && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{errorMessage}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {mode === "register" && (
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Nome completo
              </label>
              <input
                id="name"
                type="text"
                autoComplete="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Joao da Silva"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          )}

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              E-mail
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="prefeito@municipio.sc.gov.br"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Senha
            </label>
            <input
              id="password"
              type="password"
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium text-sm rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            {isSubmitting
              ? "Aguarde..."
              : mode === "login"
                ? "Entrar"
                : "Criar conta"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={toggleMode}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
          >
            {mode === "login"
              ? "Nao tem conta? Cadastre-se"
              : "Ja tem conta? Entrar"}
          </button>
        </div>
      </div>

      {/* Footer */}
      <p className="mt-8 text-xs text-gray-400 text-center">
        Dados publicos. Transparencia total. Conforme Lei 14.133/2021.
      </p>
    </div>
  );
}
