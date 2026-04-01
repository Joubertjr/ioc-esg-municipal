# Simulador de Investimentos FPM — Arquitetura Frontend
> Produzido pelo Frontend Architect Agent — 01/04/2026
> Baseado na leitura dos 10 componentes existentes do Dashboard

---

## 1. Contexto e Constraints

### O que existe hoje
- `AppShell` gerencia seleção de município com combobox e `ibgeCode` como string de 7 dígitos
- `DashboardPage` usa `useState` local para `ibgeCode` e `selectedOds`
- React Query (`queryClient.ts`) com `staleTime: 5min`, retry: 2, sem `refetchOnWindowFocus`
- Zustand já está instalado (`zustand ^4.4.7`) mas não usado — aguardando estado compartilhado
- Não existe roteamento real: `App.tsx` renderiza `DashboardPage` diretamente, apesar do `BrowserRouter`
- Tipos de domínio em `frontend/src/types/api.ts` mapeando o contrato do backend

### Decisões de design que seguimos
- Componentes funcionais com tipagem explícita de props
- Skeleton loaders para qualquer dado assíncrono
- Separação rigorosa: Feature (lógica) vs UI (presentacional)
- Padrão de cores ODS: `ods.color` como hex direto no style inline
- Status: verde ≥70 / amarelo 40–69 / vermelho <40

---

## 2. Introdução do Roteamento

O simulador exige roteamento real. Antes de criar a página, o `App.tsx` deve ser expandido:

```
/ → DashboardPage (existente)
/simulador → SimulatorPage (nova)
/relatorios → ReportsPage (futura)
/monitoramento → MonitoringPage (futura)
```

O `AppShell` será promovido a componente de layout compartilhado com `<Outlet />` do React Router, recebendo o estado global de município via Zustand.

---

## 3. State Management Design

### Problema com o estado atual
`DashboardPage` mantém `ibgeCode` localmente. Quando o usuário navegar para `/simulador`, o município selecionado seria perdido. O Zustand (já instalado) resolve isso.

### Store Global: `useMunicipalityStore`

```typescript
// Localização: frontend/src/stores/municipalityStore.ts

interface MunicipalityState {
  ibgeCode: string
  municipalityName: string | null

  setMunicipality: (ibgeCode: string, name: string | null) => void
}

// Persistência: sessionStorage (não localStorage — prefeito troca de municípios na sessão)
```

### Store de Simulação: `useSimulatorStore`

```typescript
// Localização: frontend/src/stores/simulatorStore.ts

interface AllocationEntry {
  odsNumber: number
  odsName: string
  odsColor: string
  amountBrl: number          // valor absoluto em R$
  percentageOfTotal: number  // derivado, mantido sincronizado
}

interface ScenarioResult {
  odsNumber: number
  baselineScore: number | null
  projectedScore: number | null
  scoreDelta: number | null
  projectedStatus: OdsStatus | null
  confidence: 'high' | 'medium' | 'low'
}

interface SimulatorState {
  // Step 1: Config
  totalBudgetBrl: number | null
  scenarioName: string

  // Step 2: Alocação
  allocations: AllocationEntry[]
  allocatedBrl: number          // soma de amountBrl (derivado)
  remainingBrl: number          // totalBudget - allocated (derivado)
  isAllocationValid: boolean    // remainingBrl >= 0

  // Step 3: Resultado
  simulationId: string | null
  simulationStatus: 'idle' | 'loading' | 'success' | 'error'
  results: ScenarioResult[]
  projectedGlobalScore: number | null

  // Actions
  setBudget: (amount: number) => void
  setScenarioName: (name: string) => void
  setAllocation: (odsNumber: number, amountBrl: number) => void
  resetAllocations: () => void
  resetSimulation: () => void
}
```

### Regra de invariante da alocação
- Quando o usuário altera `amountBrl` de um ODS, `percentageOfTotal` é recalculado automaticamente na store
- `remainingBrl` é sempre `totalBudgetBrl - sum(allocations.amountBrl)`
- O botão "Simular" fica desabilitado se `remainingBrl < 0` ou se nenhum ODS tiver alocação > 0

### Server State (React Query)
- Baseline ODS: reutiliza a query `["ods-report", ibgeCode]` já existente — zero fetch extra
- Simulação: `useMutation` para `POST /api/simulator/run`
- Histórico de cenários: `useQuery` para `GET /api/simulator/:ibgeCode/scenarios`

---

## 4. Hierarquia de Componentes

```
SimulatorPage                          [Page — src/pages/SimulatorPage.tsx]
  └── AppShell                         [Shared — existente, com nav tabs]
        └── SimulatorLayout            [Feature — src/pages/simulator/SimulatorLayout.tsx]
              ├── SimulatorStepper     [UI — mostra step 1/2/3 com progress]
              ├── Step 1: BudgetSetup  [Feature — src/pages/simulator/steps/BudgetSetupStep.tsx]
              │     ├── FpmBudgetInput [UI — input de valor monetário]
              │     └── ScenarioNameInput [UI — input de texto]
              ├── Step 2: AllocationEditor [Feature — src/pages/simulator/steps/AllocationEditorStep.tsx]
              │     ├── BaselineOdsSidebar  [UI — painel esquerdo com scores atuais]
              │     │     └── OdsScoreMiniCard [UI — reutiliza visual do OdsCard compacto]
              │     ├── BudgetSummaryBar     [UI — barra top com total/alocado/restante]
              │     └── OdsAllocationList   [Feature — lista scrollável com sliders]
              │           └── OdsAllocationRow [UI — 1 linha por ODS com slider + input]
              └── Step 3: SimulationResult [Feature — src/pages/simulator/steps/SimulationResultStep.tsx]
                    ├── ImpactSummaryPanel  [UI — score global antes vs depois]
                    ├── ScenarioCompareChart [UI — BarChart grouped recharts]
                    ├── OdsImpactTable      [UI — tabela antes/depois por ODS]
                    └── ReportExportButton  [UI — trigger de geração de PDF]
```

---

## 5. Especificação de Cada Componente

### `SimulatorPage`
```
Tipo: Page
Arquivo: src/pages/SimulatorPage.tsx
Props: nenhuma (lê ibgeCode do store global)
Estado interno: currentStep: 1 | 2 | 3
Estado externo: ibgeCode via useMunicipalityStore
Efeitos colaterais:
  - Ao montar: chama useOdsReport(ibgeCode) para pré-carregar baseline
  - Ao trocar de município: chama simulatorStore.resetSimulation()
Responsabilidade: Orquestra o stepper e decide qual Step renderizar
```

### `SimulatorLayout`
```
Tipo: Feature
Arquivo: src/pages/simulator/SimulatorLayout.tsx
Props: {
  currentStep: 1 | 2 | 3
  onStepChange: (step: 1 | 2 | 3) => void
  children: React.ReactNode
}
Estado interno: nenhum
Estado externo: nenhum
Responsabilidade: Container com grid (sidebar + main) e SimulatorStepper no topo
```

### `SimulatorStepper`
```
Tipo: UI (puramente presentacional)
Arquivo: src/pages/simulator/SimulatorStepper.tsx
Props: {
  currentStep: 1 | 2 | 3
  steps: Array<{ label: string; description: string }>
  onStepClick: (step: number) => void
}
Estado interno: nenhum
Responsabilidade: Barra de progresso horizontal com 3 steps clicáveis (step 2 e 3 desabilitados até condições)
Acessibilidade: aria-current="step" no step ativo, aria-disabled nos bloqueados
```

### `BudgetSetupStep` (Step 1)
```
Tipo: Feature
Arquivo: src/pages/simulator/steps/BudgetSetupStep.tsx
Props: {
  onNext: () => void
}
Estado interno: fieldErrors: { budget?: string; name?: string }
Estado externo:
  - totalBudgetBrl via useSimulatorStore
  - scenarioName via useSimulatorStore
  - setBudget, setScenarioName via useSimulatorStore
  - ibgeCode via useMunicipalityStore
Efeitos colaterais:
  - Busca FPM estimado do município: useQuery(["fpm", ibgeCode])
    para pré-preencher o campo com o FPM mensal do SICONFI
Responsabilidade: Formulário de configuração inicial do cenário
```

### `FpmBudgetInput`
```
Tipo: UI
Arquivo: src/pages/simulator/FpmBudgetInput.tsx
Props: {
  value: number | null
  onChange: (value: number) => void
  suggestedFpm: number | null    // valor do SICONFI para hint
  error?: string
}
Estado interno: rawInput: string (controla o campo de texto antes de parsear)
Responsabilidade:
  - Input formatado como moeda BRL (Intl.NumberFormat)
  - Mostra "Sugestão: R$ X.XXX (FPM mensal)" abaixo quando suggestedFpm disponível
  - Parse string → número ao perder foco
  - Validação: valor > 0, <= 500 milhões (teto de segurança)
```

### `AllocationEditorStep` (Step 2)
```
Tipo: Feature
Arquivo: src/pages/simulator/steps/AllocationEditorStep.tsx
Props: {
  onBack: () => void
  onNext: () => void
}
Estado interno: nenhum (tudo na store)
Estado externo:
  - allocations, totalBudgetBrl, remainingBrl, isAllocationValid via useSimulatorStore
  - ods baseline via useOdsReport(ibgeCode) [já cacheado do Dashboard]
Responsabilidade: Coordena sidebar de baseline com lista de alocação
Layout: grid de duas colunas em desktop (sidebar 280px + main flex-1)
         stack vertical em mobile
```

### `BaselineOdsSidebar`
```
Tipo: UI
Arquivo: src/pages/simulator/BaselineOdsSidebar.tsx
Props: {
  ods: OdsSummary[]
  isLoading: boolean
}
Estado interno: nenhum
Responsabilidade:
  - Lista fixa à esquerda mostrando scores atuais como referência
  - Versão compacta do OdsCard (sem onClick, sem hover)
  - Skeleton loader para cada card enquanto carrega
```

### `BudgetSummaryBar`
```
Tipo: UI
Arquivo: src/pages/simulator/BudgetSummaryBar.tsx
Props: {
  totalBrl: number
  allocatedBrl: number
  remainingBrl: number
}
Estado interno: nenhum
Responsabilidade:
  - Barra de progresso visual (allocated/total)
  - 3 counters: Total disponível / Alocado / Restante
  - Cor da barra: verde se remaining >= 0, vermelho se negativo
  - Valores formatados como BRL
Memoização: React.memo — re-render apenas quando valores mudam
```

### `OdsAllocationList`
```
Tipo: Feature
Arquivo: src/pages/simulator/OdsAllocationList.tsx
Props: {
  baseline: OdsSummary[]
}
Estado interno: nenhum (lê e escreve na store)
Estado externo: allocations, setAllocation via useSimulatorStore
Responsabilidade: Renderiza uma OdsAllocationRow por ODS, filtra ODS sem baseline por padrão
Performance: virtualização não necessária (17 linhas)
```

### `OdsAllocationRow`
```
Tipo: UI
Arquivo: src/pages/simulator/OdsAllocationRow.tsx
Props: {
  odsNumber: number
  odsName: string
  odsColor: string
  baselineScore: number | null
  currentAllocationBrl: number
  totalBudgetBrl: number
  onChange: (odsNumber: number, amountBrl: number) => void
}
Estado interno:
  - inputValue: string (valor bruto do input numérico)
  - isDragging: boolean (feedback visual no slider)
Estado externo: nenhum
Responsabilidade:
  - Slider range (0 até totalBudgetBrl)
  - Input numérico sincronizado com o slider
  - Badge colorido com score baseline
  - Os dois controles ficam sincronizados: alterar um atualiza o outro
Acessibilidade:
  - aria-label="Alocação para ODS N: Nome"
  - aria-valuemin, aria-valuemax, aria-valuenow no slider
```

### `SimulationResultStep` (Step 3)
```
Tipo: Feature
Arquivo: src/pages/simulator/steps/SimulationResultStep.tsx
Props: {
  onBack: () => void
  onReset: () => void
}
Estado interno: nenhum
Estado externo:
  - results, simulationStatus, projectedGlobalScore via useSimulatorStore
  - baseline ods via useOdsReport(ibgeCode) [cacheado]
Efeitos colaterais:
  - useMutation para POST /api/simulator/run
  - Dispara ao montar (se status === 'idle')
Responsabilidade: Exibe resultados da simulação ou loading/error state
```

### `ImpactSummaryPanel`
```
Tipo: UI
Arquivo: src/pages/simulator/ImpactSummaryPanel.tsx
Props: {
  baselineGlobalScore: number | null
  projectedGlobalScore: number | null
  baselineStatus: OdsStatus | null
  projectedStatus: OdsStatus | null
  isLoading: boolean
}
Estado interno: nenhum
Responsabilidade:
  - Dois gauges lado a lado: GlobalScore baseline e GlobalScore projetado
  - Seta/delta entre eles: "+N pontos" em verde ou "-N pontos" em vermelho
  - Reutiliza o componente GlobalScore existente (é puramente presentacional com props)
  - Skeleton loader durante processamento
```

### `ScenarioCompareChart`
```
Tipo: UI
Arquivo: src/pages/simulator/ScenarioCompareChart.tsx
Props: {
  results: ScenarioResult[]
  odsDefinitions: OdsDefinition[]
  isLoading: boolean
}
Estado interno: nenhum
Responsabilidade:
  - BarChart grouped do Recharts
  - Eixo X: shortName dos ODS com alocação > 0
  - Duas barras por ODS: azul (baseline) + verde/vermelho (projetado)
  - Tooltip customizado mostrando delta em pontos
  - Legenda: "Atual" / "Projetado"
  - Skeleton: div com animate-pulse e altura fixa 300px
Memoização: React.memo
```

### `OdsImpactTable`
```
Tipo: UI
Arquivo: src/pages/simulator/OdsImpactTable.tsx
Props: {
  results: ScenarioResult[]
  allocations: AllocationEntry[]
  odsDefinitions: OdsDefinition[]
}
Estado interno: sortKey: 'delta' | 'ods' | 'invested'
Responsabilidade:
  - Tabela com colunas: ODS | Investimento | Score Atual | Score Projetado | Delta | Confiança
  - Ordenável por delta (default: maior delta primeiro)
  - Delta positivo em verde, negativo em vermelho
  - Badge de confiança: high=verde, medium=amarelo, low=cinza
  - Linha de totais no rodapé
```

### `ReportExportButton`
```
Tipo: UI
Arquivo: src/pages/simulator/ReportExportButton.tsx
Props: {
  simulationId: string | null
  ibgeCode: string
  disabled: boolean
}
Estado interno: isGenerating: boolean
Efeitos colaterais:
  - POST /api/reports/simulation/:simulationId → download PDF
  - Feedback: spinner durante geração
Responsabilidade: Botão de ação único — exportar relatório do cenário simulado
```

---

## 6. Fluxos de UX

### Fluxo A: Simulação Completa (caminho feliz)

```
1. Usuário está no Dashboard e clica em "Simulador" no nav
2. Navegação para /simulador (Step 1 ativo)
3. Sistema mostra município atual selecionado no AppShell (estado global persiste)
4. Sistema mostra FPM mensal estimado como sugestão no campo de orçamento
5. Usuário confirma ou ajusta o valor do orçamento
6. Usuário digita nome do cenário (ex: "Foco em Saúde 2025")
7. Usuário clica em "Continuar" — validação: budget > 0 e nome preenchido
8. Step 2 é ativado — sistema carrega baseline ODS (já cacheado do Dashboard, zero latência)
9. Usuário vê sidebar esquerda com scores atuais e lista de ODS para alocar
10. Usuário move sliders ou digita valores para distribuir investimento
11. BudgetSummaryBar mostra progresso em tempo real
12. Usuário clica "Simular" — habilitado apenas quando algum ODS tem alocação > 0 e remaining >= 0
13. Sistema mostra loading (spinner no botão + skeleton no Step 3)
14. Sistema processa POST /api/simulator/run (~1-3 segundos)
15. Step 3 ativo: usuário vê ImpactSummaryPanel + ScenarioCompareChart + OdsImpactTable
16. Usuário pode clicar "Exportar Relatório" para gerar PDF
17. Usuário pode clicar "Novo Cenário" para resetar e repetir
```

### Fluxo B: Troca de Município no Step 2

```
1. Usuário está no Step 2 (AllocationEditorStep) com alocações preenchidas
2. Usuário troca de município no combobox do AppShell
3. Sistema exibe modal de confirmação: "Trocar de município vai resetar as alocações. Continuar?"
4. Se confirma: simulatorStore.resetSimulation() + ibgeCode atualizado + volta ao Step 1
5. Se cancela: município não muda, alocações preservadas
```

### Fluxo C: Erro na Simulação (Step 3)

```
1. POST /api/simulator/run retorna erro (timeout, 500, etc.)
2. Sistema exibe estado de erro no lugar do resultado:
   - Ícone de alerta + mensagem descritiva
   - Botão "Tentar novamente" (re-dispara a mutation)
   - Botão "Ajustar alocações" (volta ao Step 2, preservando as alocações)
3. Erro não reseta os dados de alocação — usuário pode tentar novamente sem redigitar
```

### Fluxo D: Orçamento Insuficiente (validação inline)

```
1. Usuário aloca mais do que o orçamento total
2. BudgetSummaryBar muda para vermelho com texto "Excesso: R$ X.XXX"
3. Botão "Simular" fica desabilitado com tooltip "Distribua dentro do orçamento disponível"
4. OdsAllocationRow com excesso recebe borda vermelha
5. Usuário ajusta sliders — em tempo real, a barra e o botão são atualizados
```

---

## 7. Contrato de API Necessário do Backend

O backend precisa implementar 3 novos endpoints:

### 7.1 `POST /api/simulator/run`

**Trigger:** Botão "Simular" no Step 2
**Timeout esperado:** < 5 segundos (cálculo in-memory, sem APIs externas)

Request body:
```typescript
{
  ibgeCode: string              // 7 dígitos
  scenarioName: string          // max 100 chars
  allocations: Array<{
    odsNumber: number           // 1-17
    amountBrl: number           // Decimal.js no backend, number no frontend
  }>
}
```

Response (sucesso 200):
```typescript
{
  simulationId: string          // UUID gerado pelo backend
  ibgeCode: string
  scenarioName: string
  referenceYear: number
  baselineGlobalScore: number | null
  projectedGlobalScore: number | null
  projectedGlobalStatus: 'verde' | 'amarelo' | 'vermelho' | null
  results: Array<{
    odsNumber: number
    odsName: string
    odsColor: string
    investmentBrl: number
    baselineScore: number | null
    projectedScore: number | null
    scoreDelta: number | null
    projectedStatus: 'verde' | 'amarelo' | 'vermelho' | null
    confidence: 'high' | 'medium' | 'low'
    impactFactors: string[]     // ex: ["SICONFI: +15% despesa saúde → ODS 3 +8pts"]
  }>
  computedAt: string            // ISO 8601
}
```

Regra de negócio para `projectedScore` (backend calcula):
- Para cada ODS com alocação > 0: score projetado = baselineScore + (impactoUnitario * valorAlocado)
- `impactoUnitario` é um coeficiente por ODS registrado no backend (ex: R$1M em saúde = +3pts no ODS3)
- ODS sem dados históricos (score=null): `projectedScore=null`, `confidence='low'`
- Capped em 0-100

### 7.2 `GET /api/simulator/:ibgeCode/scenarios`

**Uso:** Histórico de cenários simulados (implementação futura, spec agora)

Response:
```typescript
{
  ibgeCode: string
  scenarios: Array<{
    simulationId: string
    scenarioName: string
    projectedGlobalScore: number | null
    totalInvestedBrl: number
    computedAt: string
  }>
}
```

### 7.3 `GET /api/municipalities/:ibgeCode/fpm-estimate`

**Uso:** Pré-preencher sugestão de orçamento no Step 1
**Fonte:** SICONFI (já coletado pelo ODS Score Service — deve ser exposto separadamente)

Response:
```typescript
{
  ibgeCode: string
  municipalityName: string
  fpmMonthlyBrl: number | null    // média dos 3 decênios do mês mais recente
  fpmAnnualBrl: number | null     // fpmMonthly * 12
  referenceMonth: string          // "2024-12"
  dataSource: "siconfi"
}
```

---

## 8. Lista de Arquivos a Criar

### Novos tipos (shared)
```
shared/types/domain/simulation.ts        ← EXPANDIR (já existe, incompleto)
  Adicionar: SimulationRunRequest, SimulationRunResponse, ScenarioResult
```

### Novos tipos (frontend)
```
frontend/src/types/simulator.ts          ← Tipos locais do frontend para store e componentes
```

### Stores Zustand
```
frontend/src/stores/municipalityStore.ts ← Store global de município (migrar do useState local)
frontend/src/stores/simulatorStore.ts    ← Estado completo do simulador (ver seção 3)
```

### Hooks React Query
```
frontend/src/hooks/useSimulation.ts      ← useMutation para POST /api/simulator/run
frontend/src/hooks/useFpmEstimate.ts     ← useQuery para GET /api/municipalities/:ibgeCode/fpm-estimate
frontend/src/hooks/useScenarios.ts       ← useQuery para GET /api/simulator/:ibgeCode/scenarios
```

### Página principal
```
frontend/src/pages/SimulatorPage.tsx     ← Orquestra steps, lê store global
```

### Componentes do simulador
```
frontend/src/pages/simulator/SimulatorLayout.tsx
frontend/src/pages/simulator/SimulatorStepper.tsx

frontend/src/pages/simulator/steps/BudgetSetupStep.tsx
frontend/src/pages/simulator/steps/AllocationEditorStep.tsx
frontend/src/pages/simulator/steps/SimulationResultStep.tsx

frontend/src/pages/simulator/FpmBudgetInput.tsx
frontend/src/pages/simulator/ScenarioNameInput.tsx
frontend/src/pages/simulator/BaselineOdsSidebar.tsx
frontend/src/pages/simulator/BudgetSummaryBar.tsx
frontend/src/pages/simulator/OdsAllocationList.tsx
frontend/src/pages/simulator/OdsAllocationRow.tsx

frontend/src/pages/simulator/ImpactSummaryPanel.tsx
frontend/src/pages/simulator/ScenarioCompareChart.tsx
frontend/src/pages/simulator/OdsImpactTable.tsx
frontend/src/pages/simulator/ReportExportButton.tsx
```

### Modificações em arquivos existentes
```
frontend/src/App.tsx
  - Adicionar react-router-dom Routes com / e /simulador
  - Envolver com MunicipalityStoreProvider (ou apenas importar a store)

frontend/src/components/layout/AppShell.tsx
  - Adicionar nav tabs: "Dashboard" | "Simulador"
  - Receber activeTab como prop ou derivar do useLocation
  - Migrar ibgeCode para useMunicipalityStore (breaking change controlada)

frontend/src/pages/DashboardPage.tsx
  - Migrar setIbgeCode local para useMunicipalityStore.setMunicipality
  - Resto permanece idêntico
```

---

## 9. Considerações de Performance

### Memoização necessária
- `BudgetSummaryBar`: React.memo — re-renderiza a cada keystroke no slider
- `ScenarioCompareChart`: React.memo — chart pesado, só muda após simulação concluída
- `OdsAllocationRow`: React.memo com `areEqual` customizado comparando `currentAllocationBrl`
- `BaselineOdsSidebar`: React.memo — dados estáticos durante o Step 2 inteiro

### Lazy Loading
- `SimulatorPage`: `React.lazy()` com `Suspense` — só carrega ao navegar para `/simulador`
- Bundle splitting natural pelo React Router v6

### Cache Strategy
- Baseline ODS (`["ods-report", ibgeCode]`): `staleTime: 5min` já configurado — reutiliza sem re-fetch
- FPM Estimate (`["fpm-estimate", ibgeCode]`): `staleTime: 6h` (alinha com TTL do SICONFI)
- Resultado de simulação: NÃO vai para React Query — vai para simulatorStore (é efêmero, UI-only)
- Histórico de cenários: `staleTime: 1min`

### Optimistic Updates
- Não aplicável para simulação (o backend precisa calcular antes de mostrar)
- Aplicável apenas se implementarmos salvamento de cenários no DB

### Slider Performance
- Sliders disparam `onChange` em alta frequência durante drag
- `setAllocation` na store deve ser síncrono (Zustand é síncrono)
- `BudgetSummaryBar` e `OdsAllocationRow` re-renderizam a cada evento — memoização crítica aqui
- Considerar `throttle` de 16ms se profiling mostrar jank (improvável com 17 linhas)

---

## 10. Acessibilidade

- `SimulatorStepper`: `role="progressbar"` + `aria-valuenow` + `aria-valuetext`
- `OdsAllocationRow` sliders: `aria-label`, `aria-valuemin/max/now`, `aria-valuetext` com valor em BRL
- `BudgetSummaryBar`: `aria-live="polite"` para anunciar mudanças de saldo
- `SimulationResultStep` durante loading: `aria-busy="true"` no container
- Focus management: ao avançar de step, focar o heading do novo step via `ref.focus()`
- Contraste: badges de status ODS já seguem o padrão de cores existente (validado no Dashboard)

---

## 11. Dependências Externas Necessárias

Todas as dependências já estão no `package.json`:
- `recharts ^2.10.3` — BarChart grouped para ScenarioCompareChart
- `zustand ^4.4.7` — municipalityStore + simulatorStore
- `@tanstack/react-query ^5.17.0` — hooks de simulação
- `react-router-dom ^6.21.1` — roteamento /simulador

**Nenhuma nova dependência necessária.**

Considerar mas não obrigatório para v1:
- `@radix-ui/react-slider` — slider acessível (alternativa ao `<input type="range">` nativo)
  - Justificativa para adicionar: acessibilidade e customização visual superior
  - Justificativa para não adicionar: `input[type=range]` com Tailwind é suficiente para MVP

---

## 12. Riscos e Decisões Pendentes

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| Backend de simulação não existe | Alto | Especificar contrato agora (seção 7); frontend pode usar mock fixo no desenvolvimento |
| Coeficientes de impacto por ODS são estimativas | Médio | Exibir `confidence` nos resultados; documentar que são projeções, não garantias |
| Slider em mobile com 17 linhas | Médio | Testar em viewport 375px; substituir por inputs numéricos em mobile se necessário |
| Migração de ibgeCode para store global | Baixo | DashboardPage permanece funcional; mudança é aditiva |
| FPM mensal pode não estar disponível para alguns municípios | Baixo | Campo de orçamento não depende do endpoint — é só sugestão visual |

---

## 13. Ordem de Implementação Recomendada

Implementar nesta sequência (cada item é uma unidade entregável e testável):

1. **Stores** — `municipalityStore` + `simulatorStore` (sem UI, testável em isolamento)
2. **Roteamento** — Expandir `App.tsx` + `AppShell` com tabs de navegação
3. **Step 1** — `BudgetSetupStep` + `FpmBudgetInput` + hook `useFpmEstimate`
4. **Step 2** — `OdsAllocationRow` + `OdsAllocationList` + `BudgetSummaryBar` + `BaselineOdsSidebar`
5. **Step 3 com mock** — `SimulationResultStep` renderizando dados fixos (antes do backend existir)
6. **Integração backend** — hook `useSimulation` + endpoint real
7. **Polish** — memoização, acessibilidade, `ReportExportButton`

---

*Documento gerado pelo Frontend Architect Agent. Não contém código de implementação.*
*Backend contract da seção 7 deve ser revisado pelo Backend Architect antes da implementação.*
