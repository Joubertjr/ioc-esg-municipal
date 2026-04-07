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
        const message = err instanceof Error ? err.message : "Erro ao autenticar.";
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
      <div className="w-full max-w-md bg-card rounded-xl shadow-md border border-border p-8">
        <h2 className="text-xl font-semibold text-foreground mb-6">
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
              <label htmlFor="name" className="block text-sm font-medium text-foreground mb-1">
                Nome completo
              </label>
              <input
                id="name"
                type="text"
                autoComplete="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: João da Silva"
                className="w-full px-3 py-2 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
              />
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1">
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
              className="w-full px-3 py-2 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-foreground mb-1">
              Senha
            </label>
            <input
              id="password"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3 py-2 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-primary hover:bg-primary/90 disabled:bg-primary/40 text-white font-medium text-sm rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            {isSubmitting && (
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
            {isSubmitting ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={toggleMode}
            className="text-sm text-primary hover:text-primary/80 font-medium transition-colors"
          >
            {mode === "login" ? "Não tem conta? Cadastre-se" : "Já tem conta? Entrar"}
          </button>
        </div>
      </div>

      {/* Footer */}
      <p className="mt-8 text-xs text-muted-foreground/60 text-center">
        Dados públicos. Transparência total. Conforme Lei 14.133/2021.
      </p>
    </div>
  );
}
