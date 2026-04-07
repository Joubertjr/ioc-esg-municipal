# Frontend Integration Review

> Revisao de integracao dos componentes React com o backend Express
> Data: 2026-04-06

## Resultado

**4 problemas que causam erro ou dado incorreto ao usuario.** Nenhum deles e bloqueante de login, mas 3 causam falha silenciosa ou comportamento errado em producao.

---

## Problema 1 — CSRF bloqueia POST /api/simulator/simulate em producao (CRITICO)

**Arquivo:** `frontend/src/lib/api.ts` linha 99-107

**O que acontece:** O backend valida CSRF em todas as requisicoes POST autenticadas via cookie. O middleware `authenticateToken` checa `Origin` ou `Referer` contra `ALLOWED_ORIGINS`. O `apiPost` envia `credentials: "include"` (cookie) sem nenhum header `Origin` personalizado — o browser inclui `Origin` automaticamente apenas quando a requisicao vai para uma origem diferente (cross-origin). Em desenvolvimento com Vite (`localhost:5173` → `localhost:3000`) o `Origin` cross-origin e enviado e funciona. Em producao, se frontend e backend estiverem no mesmo dominio (ex: nginx fazendo proxy), o browser NAO envia `Origin` em same-origin requests e o header `Referer` pode estar ausente ou bloqueado por politicas de privacidade. Nesse caso o CSRF check retorna 403 para qualquer POST.

**Efeito para o usuario:** "Simulacao" e "Logout" retornam 403. O simulador mostra a mensagem de erro generico "Erro ao simular. Tente novamente."

**Correcao:** O frontend precisa enviar o header `X-Requested-With: XMLHttpRequest` e o backend precisa aceitar esse header como prova de intencao CSRF, ou adicionar a URL de producao em `ALLOWED_ORIGINS`. A correcao mais robusta e adicionar o header no `apiPost` e atualizar `verifyCsrf` para aceita-lo.

---

## Problema 2 — SimulatorPage chama endpoint errado (BUG FUNCIONAL)

**Arquivo:** `frontend/src/pages/SimulatorPage.tsx` linha 152

```ts
mutationFn: (payload) =>
  apiPost<SimulationResult>("/api/simulator/simulate", payload),
```

**Backend real:** `POST /api/simulator/simulate` — endpoint correto.

**Verificacao:** Correto. Nao ha bug aqui.

**Mas ha um problema relacionado:** O `SimulatorPage` consulta `GET /api/municipalities` para popular o `<select>` de municipio (linhas 140-148). Quando esse endpoint retorna lista vazia (banco nao populado com seed), o componente exibe o texto `"Usando o seletor do cabecalho acima."` — o usuario fica sem selector dedicado na pagina e precisa usar o combobox do header. O estado de `ibgeCode` no SimulatorPage e independente do ibgeCode do DashboardPage: o usuario troca municipio no dashboard, vai para o simulador e o simulador mostra Florianopolis (DEFAULT_IBGE_CODE). Nao ha sincronizacao de municipio entre paginas.

**Efeito para o usuario:** Usuario seleciona municipio X no dashboard, navega para o simulador e ve Florianopolis selecionado. Executa simulacao para municipio errado sem perceber.

**Correcao:** Persistir `ibgeCode` selecionado em estado global (Zustand) ou `sessionStorage`, compartilhado entre todas as paginas.

---

## Problema 3 — AuthResponse no frontend diverge do backend em /register (BUG DE TIPO)

**Frontend:** `frontend/src/types/api.ts` linha 109-116

```ts
export interface AuthResponse {
  token: string;
  user: { id: string; name: string; email: string };
}
```

**Hook useAuth:** `frontend/src/hooks/useAuth.ts` linha 16-18 (interface local)

```ts
interface AuthResponse {
  token: string;
  refreshToken: string;
}
```

**Backend /register:** `backend/routes/auth.ts` linha 62-65

```json
{ "user": {...}, "token": "...", "refreshToken": "..." }
```

**Backend /login:** `backend/routes/auth.ts` linha 113-117

```json
{ "token": "...", "refreshToken": "...", "user": {...} }
```

O `useAuth` usa a interface local (correta, com `refreshToken`), ignora o campo `user` da resposta do register. O tipo exportado em `api.ts` (`AuthResponse`) NAO tem `refreshToken` e NAO e usado pelo `useAuth`. Isso nao quebra o runtime (o campo existe mas o tipo nao o declara), mas o tipo em `api.ts` e enganoso: qualquer componente que importe `AuthResponse` de `types/api.ts` e tente acessar `.refreshToken` vai ter erro de TypeScript.

**Efeito para o usuario:** Sem efeito direto hoje. Risco de regressao quando outro desenvolvedor usar o tipo exportado.

**Correcao:** Unificar os dois `AuthResponse`. O tipo em `api.ts` deve incluir `refreshToken: string` e o tipo local em `useAuth.ts` deve ser removido em favor do importado.

---

## Problema 4 — ProtectedRoute reinicia checkSession a cada navegacao (UX DEGRADADA)

**Arquivo:** `frontend/src/App.tsx` linhas 35-47

```tsx
function ProtectedRoute({ children }) {
  const [session, setSession] = useState<SessionState>("loading");

  useEffect(() => {
    checkSession().then((ok) =>
      setSession(ok ? "authenticated" : "unauthenticated")
    );
  }, []);
  ...
}
```

Cada rota protegida e uma instancia separada de `ProtectedRoute`. Ao navegar de `/dashboard` para `/simulator`, o React monta um novo `ProtectedRoute` com `useState("loading")` inicial, dispara `GET /api/auth/me`, e exibe o spinner de loading por ~100-300ms antes de mostrar o conteudo.

**Efeito para o usuario:** Spinner breve visivel em cada troca de pagina — parece que o app esta carregando dados novos a cada clique no menu.

**Correcao:** Elevar o estado de sessao para o nivel do `App` com `useState` + `useEffect` unico, ou usar React Query com `queryKey: ["session"]` e `staleTime: Infinity` para cachear o resultado do `checkSession`.

---

## O que esta correto (nao ha bug)

| Item                                                                                                         | Status          |
| ------------------------------------------------------------------------------------------------------------ | --------------- |
| Rotas definidas — todos os 4 componentes existem como arquivos                                               | OK              |
| Rotas protegidas verificam autenticacao via `checkSession`                                                   | OK              |
| Redirect apos login/register via `navigate("/dashboard")`                                                    | OK              |
| `useOdsReport` — queryKey `["ods-report", ibgeCode]`, enabled valida 7 digitos                               | OK              |
| `MunicipalOdsReport` frontend vs backend — campos identicos                                                  | OK              |
| `SimulationResult` frontend vs backend — campos identicos                                                    | OK              |
| Logout revoga refreshToken e limpa cookie                                                                    | OK              |
| AppShell usa `SC_MUNICIPALITIES` estatico (sem fetch de API)                                                 | OK, intencional |
| `MunicipalityListItem` no SimulatorPage — campos `ibgeCode, name, population` batem com backend              | OK              |
| Municipio sem dados: `useOdsReport` retorna 404, isError=true, mensagem exibida com botao "Tentar novamente" | OK              |

---

## Resumo de correcoes por prioridade

| Prioridade | Problema                                    | Arquivo                                                       |
| ---------- | ------------------------------------------- | ------------------------------------------------------------- |
| ALTA       | CSRF bloqueia POSTs em same-origin producao | `frontend/src/lib/api.ts` + `backend/middleware/auth.ts`      |
| ALTA       | ibgeCode nao sincronizado entre paginas     | Criar store Zustand ou usar sessionStorage                    |
| MEDIA      | `AuthResponse` duplicado/inconsistente      | `frontend/src/types/api.ts` + `frontend/src/hooks/useAuth.ts` |
| BAIXA      | `ProtectedRoute` spinner por navegacao      | `frontend/src/App.tsx`                                        |
