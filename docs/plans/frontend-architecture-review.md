# Frontend Architecture Review — IOC ESG Municipal

> Gerado em 2026-04-06 | Revisão completa sem edição de código

---

## Resumo executivo

O frontend está em estado **funcional e bem estruturado para MVP**. A base técnica é sólida — React 18, TypeScript strict, React Query, lazy loading, Error Boundary, Toast system. Os gaps não bloqueiam produção imediata, mas criam débito técnico que se agravará quando o projeto escalar para os 295 municípios e depois para os 5.570.

**Nota geral: 7/10** — bom para MVP, requer investimento antes do lançamento comercial.

---

## 1. Estrutura de Pastas

### Estado atual

```
frontend/
  index.html
  package.json
  vite.config.ts
  tailwind.config.js
  tsconfig.json
  src/
    main.tsx
    App.tsx
    index.css
    pages/
      DashboardPage.tsx
      LoginPage.tsx
      SimulatorPage.tsx
      ReportsPage.tsx
      MonitoringPage.tsx
    components/
      layout/
        AppShell.tsx
      ods/
        OdsCard.tsx
        OdsDetailDrawer.tsx
        GlobalScore.tsx
        CoverageSummary.tsx
      charts/
        OdsRadarChart.tsx
      ui/
        ErrorBoundary.tsx
        Skeleton.tsx
        Toast.tsx
    hooks/
      useAuth.ts
      useOdsReport.ts
    lib/
      api.ts
      queryClient.ts
    types/
      api.ts
```

### Avaliacao

**Pontos positivos:**

- Separacao clara entre `pages/`, `components/`, `hooks/`, `lib/`, `types/`
- A pasta `components/ui/` existe para componentes primitivos reutilizaveis
- A pasta `components/ods/` agrupa dominio especifico

**Gaps:**

1. **`components/layout/` sub-utilizada.** Existe apenas `AppShell.tsx`. Nao ha separacao entre layout primitivos (Header, Sidebar, Footer) e o shell completo. Quando o produto crescer (ex: layout diferente para prefeito vs secretario), isso vai exigir refatoracao.

2. **`pages/` sem subdiretorios.** Todas as 5 paginas estao no mesmo nivel. Quando o produto crescer para 10-15 paginas, a flat list dificulta navegacao.

3. **Diretorio `hooks/` anêmico.** Somente 2 hooks. O estado de UI mais complexo (filtros, ordenacao, target em MonitoringPage; allocation sliders em SimulatorPage) esta embutido diretamente nas pages.

4. **Ausencia de `stores/`.** Zustand esta instalado no `package.json` mas nao ha nenhum store criado. O estado do `ibgeCode` selecionado e duplicado em cada page.

5. **`lib/` deveria ter subpastas.** Quando o projeto crescer, `lib/` vai acumular utilitarios de formatacao, date handling, etc. misturados com a camada de API.

---

## 2. Roteamento

### Estado atual

- **React Router v6** com `BrowserRouter`, `Routes`, `Route`
- **Lazy loading implementado** em todas as 5 pages com `React.lazy` + `.then(m => ({ default: m.Page }))`
- **`ProtectedRoute`** implementado como componente wrapper
- **Fallback** via `<Suspense fallback={<PageLoader />}>`
- Redirect catch-all `path="*"` para `/dashboard`

### Avaliacao

**Pontos positivos:**

- Lazy loading correto em todas as rotas protegidas — impacto imediato no bundle inicial
- A estrutura de `<Suspense>` englobando todas as rotas e correta

**Gaps:**

1. **`ProtectedRoute` faz fetch a cada montagem.** O componente chama `checkSession()` toda vez que e montado, incluindo quando o usuario navega entre rotas internas. Nao ha cache para o resultado da sessao.

   Impacto: cada navegacao entre Dashboard -> Simulator -> Reports dispara um `fetch /api/auth/me`. Com latencia de rede real (prefeito em municipio pequeno com 4G ruim), isso introduz flicker de loading entre paginas.

   Correcao: elevar o estado de sessao para um `AuthContext` ou store Zustand com TTL, verificando apenas na montagem inicial ou quando o token expira.

2. **Nenhuma rota de 404 customizada.** O `path="*"` redireciona silenciosamente para `/dashboard` em vez de mostrar uma pagina "nao encontrada". Para um produto B2G onde prefeitos vao clicar em links de email, um 404 correto e importante.

3. **Sem rotas parametrizadas.** Nao ha `/:ibgeCode/dashboard` ou similar — o municipio selecionado e estado local de cada page, nao parte da URL. Isso significa que o usuario nao pode compartilhar um link "dashboard do municipio X" por email ou bookmark.

4. **Ausencia de rota `/` com conteudo proprio.** O redirect `/ -> /dashboard` e correto para usuarios logados, mas nao ha tratamento condicional: usuario nao logado que acessa `/` e redirecionado para `/dashboard`, que entao o redireciona para `/login`. Funciona, mas e redundante.

---

## 3. Gerenciamento de Estado

### Estado atual

| Estado                      | Onde vive                            | Tecnologia                 |
| --------------------------- | ------------------------------------ | -------------------------- |
| Dados ODS do municipio      | `useOdsReport` hook                  | React Query (server state) |
| Dados de municipios (lista) | `SimulatorPage` local query          | React Query                |
| `ibgeCode` selecionado      | `useState` em cada page              | Local state — duplicado    |
| `selectedOds` (drawer)      | `useState` em DashboardPage          | Local state — correto      |
| `allocation` (sliders)      | `useState` em SimulatorPage          | Local state — correto      |
| `filterStatus` e `sortKey`  | `useState` em MonitoringPage         | Local state — correto      |
| Resultado da simulacao      | `useState` em SimulatorPage          | Local state — correto      |
| Session/auth                | In-memory `refreshToken` em `api.ts` | Modulo global — fragil     |
| Toasts                      | `useState` em `ToastProvider`        | Context — correto          |

**QueryClient configurado:** `staleTime: 5 min`, `retry: 2`, `refetchOnWindowFocus: false`

### Avaliacao

**Pontos positivos:**

- React Query usado corretamente para server state
- `enabled: /^\d{7}$/.test(ibgeCode)` previne fetch com codigo invalido
- `staleTime: 5min` e razoavel para dados de ODS que nao mudam frequentemente
- Separacao clara entre estado de UI (local) e servidor (React Query)

**Gaps:**

1. **`ibgeCode` duplicado em todas as 4 pages.** Cada page tem `const [ibgeCode, setIbgeCode] = useState(DEFAULT_IBGE_CODE)`. Se o usuario seleciona Blumenau no Dashboard e navega para Reports, volta para Florianopolis. Esta e a falha de UX mais visivel.

   Solucao: store Zustand `useAppStore` com `{ ibgeCode, setIbgeCode }` — exatamente para isso o Zustand foi instalado. Estado de UI persistente entre paginas, sem context hell.

2. **`refreshToken` como variavel de modulo em `api.ts`.** O token esta em closure de modulo ES — correto para XSS (nao vai para localStorage), mas e resetado ao recarregar a pagina. Alem disso, o estado de autenticacao (logado/nao logado) nao e reativo — nenhum componente sabe que o usuario foi deslogado sem um redirect forcado.

3. **Sem otimistic updates.** O simulador faz `POST /api/simulator/simulate` e espera a resposta. Para uma UX premium (prefeito demo ao TCE), um estado de resultado parcial ou animacao de progresso seria melhor do que o spinner simples.

4. **QueryClient sem `gcTime` customizado.** O padrao do React Query v5 e 5 minutos de garbage collection. Para dados de ODS que sao pesados e raramente mudam, um `gcTime: 30 * 60 * 1000` (30min) evitaria re-fetches desnecessarios ao retornar para uma rota.

---

## 4. Tipagem

### Estado atual

- **`tsconfig.json` com `strict: true` e `noImplicitAny: true`** — correto
- **`src/types/api.ts`** — tipos de resposta da API completamente definidos
- **`shared/types/domain/`** — tipos de dominio em `municipality.ts`, `ods.ts`, `simulation.ts`
- Props de componentes tipadas em todas as interfaces encontradas
- `OdsStatus` como union type, nao como `any`
- `InvestmentArea` como union type com Record de labels

### Avaliacao

**Pontos positivos:**

- Nenhum `any` encontrado em nenhum arquivo do src
- Todas as props de componentes tem interfaces declaradas
- O `handleResponse<T>` na api.ts usa generics corretamente

**Gaps:**

1. **Duplicacao de tipos entre `src/types/api.ts` e `shared/types/domain/`.** O frontend define suas proprias interfaces (`OdsSummary`, `MunicipalOdsReport`) que duplicam parcialmente o que esta em `shared/types/domain/ods.ts`. Isso e um risco de divergencia — se o backend mudar o schema do ODS, o frontend pode continuar compilando com o tipo antigo.

   Ideal: o frontend deveria importar os tipos de resposta de API de `shared/types/`, ou pelo menos re-exportar a partir dali.

2. **`AuthResponse` definida duas vezes.** Ha uma `AuthResponse` em `src/types/api.ts` (com campo `user`) e outra em `src/hooks/useAuth.ts` (com campos `token` e `refreshToken`). Sao tipos diferentes representando endpoints diferentes, mas o nome duplicado e confuso.

3. **`ODS_FULL_NAMES` e `ODS_SHORT_NAMES` duplicados entre pages.** Tanto `ReportsPage.tsx` quanto `MonitoringPage.tsx` declaram o mesmo Record `{ 1: "Erradicacao...", ... }` localmente. A fonte de verdade ja existe em `shared/constants/ods.ts` com os nomes corretos (com acentos). As pages usam versoes sem acentos que divergem ligeiramente.

4. **`RECOMMENDATIONS` hardcoded em `ReportsPage.tsx`.** O Record de 17 recomendacoes esta embutido diretamente na page. Deveria estar em `shared/constants/` ou em um arquivo dedicado `src/lib/recommendations.ts`.

---

## 5. Design System

### Estado atual

- **Tailwind CSS v3.4** com configuracao minima (sem extensoes de tema)
- **Shadcn/ui**: instalado no `package.json`? Nao — **nao foi instalado**. `clsx` e `tailwind-merge` presentes mas sem componentes Shadcn
- Design implementado 100% com classes Tailwind utilitarias
- Paleta de cores: `blue-600` como cor primaria, `gray-*` para neutros, semaforo verde/amarelo/vermelho para status ODS
- Componentes primitivos customizados: `Skeleton`, `Toast`, `ErrorBoundary`

### Avaliacao

**Pontos positivos:**

- Consistencia visual impressionante para um projeto sem design system formal — o semaforo ODS (verde/amarelo/vermelho) e aplicado de forma uniforme
- `STATUS_COLORS`, `STATUS_TEXT_COLORS`, `STATUS_LABELS` centralizados em `src/types/api.ts`
- Toast com 3 tipos (error/success/info) e auto-dismiss

**Gaps:**

1. **Shadcn/ui nao esta instalado.** O `package.json` nao tem `@radix-ui/*`. O CLAUDE.md especifica "Shadcn/ui" como parte da stack aprovada. Ha um gap entre a especificacao e a implementacao. Consequencia: botoes, inputs, selects e drawers sao todos HTML nativo + Tailwind — funciona, mas perde acessibilidade e consistencia que Shadcn forneceria gratuitamente.

2. **`tailwind.config.js` sem extensao de tema.** A paleta de ODS (17 cores especificas como `#E5243B`, `#DDA63A`, etc.) esta hardcoded como `style={{ backgroundColor: ods.color }}` em vez de tokens CSS ou Tailwind theme. Isso inviabiliza modo escuro e torna impossivel mudar o tema sem grep global.

3. **Sem sistema de tipografia consistente.** Cada componente define seu proprio `text-sm`, `text-xs`, `text-2xl` inline. Nao ha tokens de tipografia reutilizaveis. Quando o produto escalar, pequenas inconsistencias vao acumular.

4. **Icones SVG inline espalhados.** Ha dezenas de SVGs inline em `AppShell.tsx` (8 icones), `LoginPage.tsx`, `ReportsPage.tsx`, etc. Nao ha um sistema de icones — cada SVG e copiado e colado. Risco de inconsistencia de `strokeWidth`, `viewBox`, tamanho.

5. **`clsx` e `tailwind-merge` instalados mas nao usados.** Nenhum arquivo importa essas bibliotecas. A combinacao de classes condicionais e feita com template literals (`\`text-sm ${condition ? 'text-green-600' : 'text-red-600'}\``). Isso funciona mas cria risco de conflito de classes Tailwind em casos mais complexos.

---

## 6. Responsividade

### Estado atual

- `AppShell`: header com `hidden md:flex` para nav desktop e hamburger para mobile
- Mobile menu implementado com toggle state
- Grid responsivo: `grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6` no dashboard
- `min-h-screen` e flexbox usados corretamente
- `max-w-7xl mx-auto px-4` como container padrao

### Avaliacao

**Pontos positivos:**

- Abordagem mobile-first correta com breakpoints progressivos
- O `MunicipalityCombobox` tem largura responsiva: `w-44 sm:w-56 lg:w-64`
- O header e sticky com `z-30`
- Menu hamburger funcional para mobile

**Gaps:**

1. **`OdsDetailDrawer` nao e responsivo para mobile.** O drawer tem `w-96 max-w-full`, o que funciona em telas pequenas, mas o conteudo interno (tabela de indicadores) nao tem scroll horizontal. Em telas < 400px a tabela vai transbordar.

2. **`ReportsPage` — tabela sem overflow controlado.** A tabela de "Desempenho por ODS" tem `overflow-x-auto` no container, mas a tabela de "Indicadores Detalhados" dentro do `AccordionRow` nao tem. Em mobile, as colunas Valor/Score/Status/Fonte/Ano vao se comprimir ilegiblemente.

3. **`SimulatorPage` — sliders em mobile.** Os range inputs com `accent-blue-600` nao tem altura de toque adequada para mobile (alvos de toque muito pequenos segundo WCAG 2.5.5 que recomenda minimo 44x44px).

4. **Sem testes visuais de responsividade.** Nao ha Playwright testes de viewport mobile ou snapshots visuais.

---

## 7. Acessibilidade

### Estado atual

- `lang="pt-BR"` no `<html>` do `index.html` — correto
- `<header>`, `<main>`, `<nav>` usados semanticamente no AppShell
- `aria-label="Abrir menu"` no hamburger button
- `aria-live="polite"` no container de toasts
- `role="alert"` nos items de toast
- `htmlFor` / `id` nos inputs de Login, Simulator e Monitoring
- `autoComplete` nos campos de login/registro
- `focus:outline-none focus:ring-2 focus:ring-blue-500` em botoes e inputs
- `Escape` fecha o drawer via `addEventListener("keydown")`

### Avaliacao

**Pontos positivos:**

- A base de acessibilidade e melhor do que a media dos projetos SaaS — `aria-live`, `role="alert"`, `lang`, `autoComplete` todos presentes
- Focus ring visivel em todos os elementos interativos
- Keyboard navigation funciona no drawer (Escape fecha)

**Gaps (WCAG 2.1 AA):**

1. **`OdsCard` e um `<button>` sem `aria-label` descritivo.** O texto visivel e apenas o `shortName` (ex: "Pobreza"), mas sem contexto do que acontece ao clicar. `aria-label="Ver detalhes do ODS 1 - Erradicacao da Pobreza"` seria correto.

2. **`OdsDetailDrawer` sem `role="dialog"` e `aria-modal`.** O drawer e visualmente um modal/dialog mas nao tem semantica de dialog. Screen readers nao vao anunciar que um dialog foi aberto. Tambem nao ha `focus trap` — ao abrir o drawer com teclado, o foco continua na pagina de fundo.

3. **`MunicipalityCombobox` nao segue padrao ARIA combobox.** Falta `role="combobox"`, `aria-expanded`, `aria-autocomplete`, `role="listbox"` na `<ul>` e `role="option"` nos `<li>`. Usuarios de screen reader nao sabem que e um autocomplete.

4. **Contraste de cor: status "amarelo".** `text-amber-700` sobre `bg-amber-100` tem ratio de contraste de aproximadamente 3.5:1, abaixo do minimo WCAG AA de 4.5:1 para texto normal. Todos os badges de status "Amarelo" falham neste critério.

5. **Botao de fechar no drawer usa `&times;` sem `aria-label`.** O `<button>` com `<span className="text-lg leading-none">&times;</span>` nao tem texto acessivel. Deveria ter `aria-label="Fechar"`.

6. **`OdsRadarChart` sem descricao alternativa.** O SVG/canvas do Recharts nao e acessivel para screen readers. Nao ha `aria-label` no container nem uma descricao textual alternativa dos dados.

7. **Ausencia de `skip to main content`.** Nao ha link de "pular para o conteudo" antes do header, o que e um requisito basico para navegacao por teclado.

---

## 8. Error Handling

### Estado atual

- `ErrorBoundary` (class component) em volta de toda a aplicacao em `App.tsx`
- `handleRetry` limpa o estado de erro e permite tentar novamente
- Mensagem de erro do servidor exposta no boundary (campo `error.message`)
- Erros de fetch exibidos inline nas pages com banner vermelho + botao "Tentar novamente"
- `useEffect` em DashboardPage, ReportsPage e MonitoringPage captura erros do React Query e mostra Toast
- `handleResponse` em `api.ts` extrai `body.message ?? body.error` de respostas de erro

### Avaliacao

**Pontos positivos:**

- A estrategia e de dois niveis: React Query erros mostrados inline, erros de render capturados pelo boundary
- O `ErrorBoundary` tem um fallback sensato com botao de retry

**Gaps:**

1. **Um unico `ErrorBoundary` para toda a app.** Se um componente de ODS throw (ex: dado invalido vindo da API), toda a pagina cai para o fallback de erro. A granularidade correta seria `ErrorBoundary` por secao de pagina (ex: envolver apenas o grid de ODS cards, nao o AppShell).

2. **`componentDidCatch` usa `console.error`.** Em producao, isso deveria enviar para um servico de monitoramento (ex: Sentry). Atualmente os erros de render sao perdidos em producao.

3. **Dupla exibicao de erro.** Quando React Query falha, o `useEffect` mostra um Toast E o banner inline ja esta sendo renderizado condicionalmente com `{isError && ...}`. O usuario ve duas notificacoes de erro simultaneas.

4. **Sem `onError` global no QueryClient.** Erros de queries nao capturadas por um `useEffect` (ex: a query de municipios em SimulatorPage) falham silenciosamente — apenas o estado `isError` da query fica true, mas nao ha Toast para esse caso.

5. **Exposicao da mensagem de erro tecnico ao usuario.** O banner exibe `{error?.message ?? "Verifique se o servidor esta rodando."}`. Para um prefeito, "Failed to fetch" ou "NetworkError" nao e uma mensagem util. Precisaria de traducao de erros para linguagem de dominio.

---

## 9. i18n

### Estado atual

- Nenhum sistema de i18n instalado (sem `react-i18next`, `formatjs`, etc.)
- Todas as strings estao hardcoded em portugues
- Datas com `toLocaleDateString("pt-BR", { dateStyle: "long" })` — correto
- Numeros com `toLocaleString("pt-BR", ...)` — correto
- Moeda com `toLocaleString("pt-BR", { style: "currency", currency: "BRL" })` — correto

### Avaliacao

**Pontos positivos:**

- A formatacao de numeros, datas e moedas usa a API nativa `Intl` com locale `pt-BR` — isso e correto e nao requer mudanca para i18n
- Como o mercado e 100% Brasil (prefeitos brasileiros), i18n nao e prioridade imediata

**Gaps:**

1. **Strings de UI espalhadas sem sistema de chaves.** Quando for necessario corrigir uma string (ex: mudar "Tentar novamente" para "Recarregar"), seria preciso grep em todos os arquivos.

2. **Textos sem acentuacao em alguns lugares.** Ha inconsistencia: `shared/constants/ods.ts` tem acentos ("Erradicação da Pobreza") mas `ReportsPage.tsx` e `MonitoringPage.tsx` tem versoes sem acento ("Erradicacao da Pobreza"). Isso sugere que os Records locais foram criados manualmente em vez de importar de `shared/constants`.

3. **Recomendacao:** para a fase atual (MVP Brasil), i18n nao e necessario. Mas recomenda-se centralizar strings em `src/lib/strings.ts` para facilitar manutencao futura.

---

## 10. SEO

### Estado atual

- `<html lang="pt-BR">` — correto
- `<title>IOC ESG Municipal</title>` — estatico, sem variacao por pagina
- Nenhuma meta description
- Nenhum Open Graph tag
- Nenhum `<meta name="robots">`
- SPA pura (CSR) sem SSR ou pre-rendering

### Avaliacao

**Pontos positivos:**

- `lang="pt-BR"` ajuda crawlers a entenderem o idioma

**Gaps:**

1. **Titulo estatico.** Todos os acessos mostram "IOC ESG Municipal" na tab do browser. O ideal seria "Dashboard - Florianopolis | IOC ESG Municipal" para indicar o municipio atual.

2. **Zero meta tags.** Para um produto B2G, o SEO nao e o driver principal de aquisicao (nao e produto self-serve para prefeitos acharem via Google). Mas quando prefeitos compartilharem links de relatorios por email/WhatsApp, o preview sem Open Graph vai parecer amador.

3. **CSR pura nao e um problema para este produto.** A plataforma e protegida por login — os prefeitos nao chegam via SEO organico. SSR (Next.js) nao e necessario e seria overengineering. O que importa e o meta title correto para a tab do browser e o Open Graph para previews em links compartilhados.

4. **Recomendacao:** usar `document.title` dinamico ou uma biblioteca leve como `react-helmet-async` para atualizar o titulo da pagina e meta description com base no municipio selecionado.

---

## Hierarquia de componentes atual (mapeamento completo)

```
App
  QueryClientProvider
  ToastProvider (Context)
  BrowserRouter
    ErrorBoundary (root, class component)
      Suspense (fallback: PageLoader)
        Routes
          /login -> LoginPage (lazy)
          /dashboard -> ProtectedRoute -> DashboardPage (lazy)
          /simulator -> ProtectedRoute -> SimulatorPage (lazy)
          /reports -> ProtectedRoute -> ReportsPage (lazy)
          /monitoring -> ProtectedRoute -> MonitoringPage (lazy)

DashboardPage
  AppShell (ibgeCode, onSelect, referenceYear)
    header [sticky]
      MunicipalityCombobox (combobox customizado)
      nav [desktop]
      nav [mobile, hamburger]
    main
  GlobalScore (score, status, isLoading)
  CoverageSummary (odsCount, isLoading)
  OdsRadarChart (ods[], isLoading)
  OdsCard[] (ods, onClick)  -- ou OdsCardSkeleton[]
  OdsDetailDrawer (ods | null, onClose)

SimulatorPage
  AppShell
  [form]
    [select municipio -- via municipalities query]
    [input totalAmount]
    [range inputs x8 -- allocation sliders]
  ScoreDisplay (local, nao exportado)
  DeltaBadge (local, nao exportado)
  OdsResultCard[] (local, nao exportado)

ReportsPage
  AppShell
  GlobalGauge (local, nao exportado)
  ExecutiveSummary (local, nao exportado)
  AccordionRow[] (local, nao exportado)
  [tabela ODS]
  [tabela Indicadores Detalhados]
  [secao Recomendacoes]

MonitoringPage
  AppShell
  SummaryStats (local, nao exportado)
  StatusBadge (local, nao exportado)
  GapBadge (local, nao exportado)
  OdsRow[] (local, nao exportado)
  [controles: range target, filtros, sort]
```

---

## Gaps prioritizados por impacto

### Prioridade 1 — UX critica (afeta prefeito diretamente)

| Gap                          | Descricao                     | Efeito                  |
| ---------------------------- | ----------------------------- | ----------------------- |
| `ibgeCode` duplicado         | Municipio resetado ao navegar | Frustracao imediata     |
| `ProtectedRoute` sem cache   | Fetch a cada navegacao        | Flicker de loading      |
| Drawer sem focus trap        | Teclado nao fica no drawer    | Inacessivel por teclado |
| Duplicacao de Toast + banner | Dois erros ao mesmo tempo     | Confusao visual         |

### Prioridade 2 — Corretude tecnica

| Gap                          | Descricao                                    | Risco                    |
| ---------------------------- | -------------------------------------------- | ------------------------ |
| `ODS_FULL_NAMES` duplicado   | Diverge de `shared/constants/ods.ts`         | Dados errados ao usuario |
| `AuthResponse` duplicado     | Dois tipos com mesmo nome                    | Confusao em manutencao   |
| `ErrorBoundary` unico        | Pagina inteira cai por erro parcial          | UX degradada             |
| Sem `onError` no QueryClient | Erros silenciosos em queries sem `useEffect` | Bugs invisiveis          |

### Prioridade 3 — Escalabilidade

| Gap                                | Descricao                                           | Quando importa                               |
| ---------------------------------- | --------------------------------------------------- | -------------------------------------------- |
| Shadcn/ui ausente                  | Acessibilidade de primitivos abaixo do especificado | Ao escalar para 100+ municipios              |
| Icones SVG inline                  | Inconsistencia e manutencao                         | Ao adicionar novas paginas                   |
| `clsx`/`tailwind-merge` nao usados | Classes conflitantes em componentes complexos       | Ao criar componentes reutilizaveis           |
| Titulo estatico                    | Tab do browser generica                             | Ao usuario ter multiplas abas abertas        |
| Sem path params para `ibgeCode`    | Links nao compartilhaveis                           | Quando prefeito quiser enviar link por email |

### Prioridade 4 — Polimento

| Gap                                | Descricao                            |
| ---------------------------------- | ------------------------------------ |
| Contraste amber (WCAG)             | Status amarelo nao passa AA          |
| Combobox sem ARIA                  | Screen readers nao entendem o widget |
| OdsCard sem aria-label descritivo  | Leitores de tela nao dao contexto    |
| RadarChart sem alternativa textual | Graficos inacessiveis                |
| Sem `skip to main content`         | Navegacao por teclado ineficiente    |

---

## Lista de arquivos a criar (recomendados)

```
src/
  stores/
    useAppStore.ts        -- ibgeCode global, selectedMunicipality
    useAuthStore.ts       -- session state reativa
  lib/
    strings.ts            -- todas as strings de UI centralizadas
    recommendations.ts    -- move RECOMMENDATIONS de ReportsPage.tsx
    format.ts             -- formatCurrency, formatScore, formatDate
  hooks/
    useMunicipalities.ts  -- extrai query de lista de municipios
    useSimulation.ts      -- extrai mutation do SimulatorPage
  components/
    icons/
      index.tsx           -- centraliza todos os SVG icons
    ui/
      Dialog.tsx          -- wrapper acessivel sobre o drawer/modal pattern
      ComboboxAccessible.tsx -- combobox com ARIA correto
```

---

## Dependencias externas recomendadas

| Biblioteca                 | Versao | Motivo                                                |
| -------------------------- | ------ | ----------------------------------------------------- |
| `@radix-ui/react-dialog`   | latest | Dialog/Drawer acessivel (focus trap, ARIA)            |
| `@radix-ui/react-combobox` | latest | Combobox com ARIA correto para MunicipalityCombobox   |
| `react-helmet-async`       | latest | Titulo de pagina dinamico por rota                    |
| `lucide-react`             | latest | Sistema de icones consistente (substitui SVGs inline) |

**Nao recomendado neste momento:** Shadcn/ui completo (overhead de instalacao e CLI para MVP); Next.js (overengineering para produto B2G autenticado); react-i18next (mercado Brasil only).

---

## Decisoes de arquitetura recomendadas

### ADR-001: Estado global para `ibgeCode`

**Decisao:** Mover `ibgeCode` para `useAppStore` (Zustand) com persistencia em `sessionStorage`.
**Motivo:** O Zustand ja esta instalado. O municipio selecionado e um estado de sessao do usuario, nao estado de componente.
**Impacto:** Remover `useState(DEFAULT_IBGE_CODE)` de 4 pages. `AppShell.onSelect` passa a chamar `setIbgeCode` do store.

### ADR-002: AuthContext para estado reativo de sessao

**Decisao:** Criar `AuthContext` com `isAuthenticated`, `user`, `checkSession` cacheado.
**Motivo:** `ProtectedRoute` atual nao e cacheado — verifica sessao a cada montagem.
**Impacto:** Elimina flicker entre rotas internas. A verificacao so acontece na montagem do `AuthProvider` (uma vez por sessao do browser).

### ADR-003: Importar ODS metadata de shared/constants

**Decisao:** Remover `ODS_FULL_NAMES` e `ODS_SHORT_NAMES` das pages. Importar `ODS_DEFINITIONS` de `shared/constants/ods.ts`.
**Motivo:** Unica fonte de verdade para nomes dos ODS, incluindo acentuacao correta.
**Impacto:** Elimina divergencia de nomes entre pages e shared/constants.

### ADR-004: ErrorBoundary granular por secao

**Decisao:** Adicionar `ErrorBoundary` em volta de secoes criticas (grid ODS, radar chart, tabelas).
**Motivo:** Um erro em OdsRadarChart nao deve derrubar GlobalScore e OdsCards.
**Impacto:** UX degradada parcialmente em vez de pagina completamente quebrada.
