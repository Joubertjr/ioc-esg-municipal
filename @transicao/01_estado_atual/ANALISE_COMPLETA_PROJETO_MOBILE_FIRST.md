# ANÁLISE COMPLETA DO PROJETO IOC ESG MUNICIPAL
## Sugestão Preliminar: Mobile-First Redesign

**Data:** 07/04/2026  
**Projeto:** https://github.com/Joubertjr/ioc-esg-municipal  
**Status Atual:** 6 Fases Concluídas | 885+ testes passando | 14 agentes coletores ativos

---

## 1. O QUE JÁ EXISTE (E ESTÁ FUNCIONANDO)

O projeto está muito mais avançado do que a maioria dos projetos similares. Aqui está o inventário completo:

### 1.1 Backend (Completo)
- **14 Agentes Coletores** de dados abertos: IBGE, SICONFI, DATASUS, INEP, SNIS, INPE, PNCP, TSE, ANEEL, SNIS-RS, ANA, Convênios, ANATEL, SISVAN
- **17 ODS** com scores 0-100 calculados
- **Simulador FPM** — projeta impacto de investimento nos ODS
- **Relatório ESG** — narrativo com recomendações rule-based
- **Benchmark** — comparativo entre municípios, ranking SC
- **Recomendações Inteligentes** — gap analysis vs benchmark SC
- **Auth completo** — JWT + refresh token rotation + RBAC
- **19 rotas de API** documentadas e testadas
- **Docker + Nginx + CI/CD** — infraestrutura de produção pronta

### 1.2 Frontend (7 Páginas)
| Página | Rota | Status |
|--------|------|--------|
| Login | /login | ✅ Concluído |
| Onboarding | /onboarding | ✅ Concluído |
| Dashboard | /dashboard | ✅ Concluído |
| Simulador | /simulator | ✅ Concluído |
| Relatórios | /reports | ✅ Concluído |
| Monitoramento | /monitoring | ✅ Concluído |
| Benchmark | /benchmark | ✅ Concluído |

### 1.3 Stack Tecnológico
- **Frontend:** React 18 + TypeScript + Vite + TailwindCSS + Recharts + TanStack Query + Zustand
- **Backend:** Node.js + TypeScript + Fastify + Prisma + PostgreSQL + Redis
- **Infra:** Docker + Nginx + GitHub Actions + SSH Deploy

---

## 2. O PROBLEMA IDENTIFICADO: NÃO É MOBILE-FIRST

### 2.1 Evidências no Código

Analisando o `AppShell.tsx`, `DashboardPage.tsx` e outros componentes, identifiquei que o projeto foi desenvolvido **desktop-first**:

```tsx
// AppShell.tsx — Navegação mobile é um "afterthought"
<button className="hidden md:flex ...">  // Desktop primeiro
<button className="md:hidden ...">       // Mobile como exceção
<main className="max-w-7xl mx-auto px-4 py-8"> // Layout desktop
```

```tsx
// DashboardPage.tsx — Grid desktop-first
<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
// Começa em 2 colunas (mobile) mas foi pensado para 6 (desktop)
```

```tsx
// OdsDetailDrawer.tsx — Drawer lateral (padrão desktop)
<div className="fixed inset-y-0 right-0 w-96 max-w-full ...">
// w-96 = 384px — ocupa quase toda a tela em mobile
```

### 2.2 Problemas Críticos para Mobile

| Componente | Problema | Impacto |
|-----------|---------|--------|
| `AppShell` | Hamburger menu (padrão 2010) | UX ruim — usuário não sabe onde está |
| `OdsDetailDrawer` | Drawer lateral w-96 | Ocupa 100% da tela mobile |
| `OdsRadarChart` | Radar com 17 eixos | Ilegível em tela pequena |
| `DashboardPage` | Seção radar + score lado a lado | Quebra em mobile |
| `BenchmarkPage` | Tabela comparativa | Scroll horizontal forçado |
| `ReportsPage` | Relatório longo | Difícil navegar em mobile |
| `MunicipalityCombobox` | Input w-44 sm:w-56 lg:w-64 | Muito pequeno em mobile |

---

## 3. SUGESTÃO PRELIMINAR: MOBILE-FIRST REDESIGN

### 3.1 Princípio Central

> **"O prefeito vai abrir o app no celular às 7h da manhã antes de entrar na prefeitura."**

Isso define TUDO:
- Tela pequena (375-430px)
- Uma mão só
- 30 segundos de atenção
- Precisa de resposta, não de dados

### 3.2 Nova Arquitetura de Navegação: Bottom Tab Bar

**Substituir** o hamburger menu por uma **Bottom Tab Bar** (padrão iOS/Android):

```
┌─────────────────────────────────┐
│  IOC ESG Municipal              │
│  Florianópolis ▾                │
├─────────────────────────────────┤
│                                 │
│         CONTEÚDO                │
│                                 │
│                                 │
│                                 │
│                                 │
│                                 │
├─────────────────────────────────┤
│  🏠      📊      🔮      📄     │
│ Início  ODS   Simular  Relat.  │
└─────────────────────────────────┘
```

**Implementação Tailwind:**
```tsx
// Novo componente: BottomTabBar.tsx
<nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 
                flex items-center justify-around h-16 z-50 md:hidden">
  <TabItem to="/dashboard" icon={<HomeIcon />} label="Início" />
  <TabItem to="/monitoring" icon={<ChartIcon />} label="ODS" />
  <TabItem to="/simulator" icon={<SimIcon />} label="Simular" />
  <TabItem to="/reports" icon={<ReportIcon />} label="Relatório" />
</nav>
```

### 3.3 Nova Dashboard Mobile: "3 Cards + Ação"

**Substituir** o layout atual (radar + score + grid de 17 ODS) por:

```
┌─────────────────────────────────┐
│  Florianópolis                  │
│  Score ESG: 72/100 🟢           │
│  ↑ +3 pontos este mês           │
├─────────────────────────────────┤
│  🚨 ATENÇÃO URGENTE             │
│  ┌─────────────────────────┐    │
│  │ ODS 6 — Saneamento      │    │
│  │ Score: 38/100 🔴        │    │
│  │ "Cobertura de esgoto    │    │
│  │  abaixo da média SC"    │    │
│  │ [Ver o que fazer →]     │    │
│  └─────────────────────────┘    │
├─────────────────────────────────┤
│  📊 SEUS 17 ODS                 │
│  ┌──────┐ ┌──────┐ ┌──────┐    │
│  │ODS 1 │ │ODS 2 │ │ODS 3 │    │
│  │ 78 🟢│ │ 65 🟡│ │ 42 🔴│    │
│  └──────┘ └──────┘ └──────┘    │
│  [Ver todos os 17 ODS →]        │
├─────────────────────────────────┤
│  💡 RECOMENDAÇÃO DO DIA         │
│  "Invista R$ 500k em saneamento │
│   para subir ODS 6 de 38→55"   │
│  [Simular este cenário →]       │
└─────────────────────────────────┘
```

### 3.4 Substituir Drawer por Bottom Sheet

**Problema:** `OdsDetailDrawer` usa drawer lateral (w-96) — padrão desktop.

**Solução:** Bottom Sheet (padrão mobile):

```tsx
// OdsDetailBottomSheet.tsx (novo componente)
<div className={`
  fixed inset-x-0 bottom-0 z-50 
  bg-white rounded-t-2xl shadow-2xl
  transform transition-transform duration-300
  ${isOpen ? 'translate-y-0' : 'translate-y-full'}
  max-h-[85vh] overflow-y-auto
`}>
  {/* Handle bar */}
  <div className="flex justify-center pt-3 pb-1">
    <div className="w-10 h-1 bg-gray-300 rounded-full" />
  </div>
  
  {/* Conteúdo */}
  <div className="px-4 pb-8">
    <div className="flex items-center gap-3 py-4" style={{ color: ods.color }}>
      <span className="text-3xl font-bold">{ods.score}</span>
      <div>
        <p className="font-bold text-lg">{ods.name}</p>
        <p className="text-sm opacity-70">ODS {ods.odsNumber}</p>
      </div>
    </div>
    {/* Meta 2030, indicadores, etc. */}
  </div>
</div>
```

### 3.5 Substituir Radar Chart por "ODS Scorecard" Mobile

**Problema:** Radar chart com 17 eixos é ilegível em mobile (comprovado por pesquisa GOV.UK e IDSC-BR).

**Solução:** Grid de cards 3x6 com mini progress bars:

```tsx
// OdsMobileGrid.tsx (novo componente)
<div className="grid grid-cols-3 gap-2">
  {ods.map(item => (
    <button
      key={item.odsNumber}
      onClick={() => setSelected(item)}
      className="flex flex-col items-center p-2 rounded-xl border-2"
      style={{ borderColor: item.color + '40', backgroundColor: item.color + '10' }}
    >
      <span className="text-xs font-bold" style={{ color: item.color }}>
        ODS {item.odsNumber}
      </span>
      <span className="text-xl font-bold text-gray-800 my-1">
        {item.score ?? '—'}
      </span>
      {/* Mini progress bar */}
      <div className="w-full h-1 bg-gray-200 rounded-full">
        <div 
          className="h-1 rounded-full transition-all"
          style={{ 
            width: `${item.score ?? 0}%`, 
            backgroundColor: item.color 
          }}
        />
      </div>
    </button>
  ))}
</div>
```

### 3.6 Simulador Mobile: "Calculadora de Impacto"

**Redesign do SimulatorPage** para mobile:

```
┌─────────────────────────────────┐
│  💰 Simulador de Impacto        │
├─────────────────────────────────┤
│  Quanto você quer investir?     │
│  ┌─────────────────────────┐    │
│  │ R$ [_____________]      │    │
│  └─────────────────────────┘    │
│  [R$ 100k] [R$ 500k] [R$ 1M]   │
├─────────────────────────────────┤
│  Em qual área?                  │
│  ┌──────────┐ ┌──────────┐     │
│  │🏥 Saúde  │ │📚 Educ.  │     │
│  │ ODS 3    │ │ ODS 4    │     │
│  └──────────┘ └──────────┘     │
│  ┌──────────┐ ┌──────────┐     │
│  │💧 Sanea. │ │🌿 Meio A.│     │
│  │ ODS 6    │ │ ODS 13   │     │
│  └──────────┘ └──────────┘     │
├─────────────────────────────────┤
│  [Calcular Impacto →]           │
└─────────────────────────────────┘
```

---

## 4. COMPONENTES A CRIAR (Para Claude Code)

### Prioridade ALTA (Mobile-First)

| Componente | Substitui | Esforço |
|-----------|---------|--------|
| `BottomTabBar.tsx` | Hamburger menu | 2h |
| `OdsDetailBottomSheet.tsx` | `OdsDetailDrawer.tsx` | 3h |
| `OdsMobileGrid.tsx` | `OdsRadarChart.tsx` (mobile) | 3h |
| `DashboardMobilePage.tsx` | Layout atual do dashboard | 4h |
| `SimulatorMobilePage.tsx` | Layout atual do simulador | 3h |

### Prioridade MÉDIA

| Componente | Descrição | Esforço |
|-----------|---------|--------|
| `AlertCard.tsx` | Card de alerta urgente (ODS crítico) | 2h |
| `ScoreHero.tsx` | Score global com delta e contexto | 2h |
| `RecommendationCTA.tsx` | CTA de recomendação do dia | 1h |
| `QuickActions.tsx` | Ações rápidas (Simular, Exportar, Compartilhar) | 2h |

---

## 5. ESTRATÉGIA DE IMPLEMENTAÇÃO

### Abordagem: Responsive Progressivo

**NÃO** reescrever tudo. **SIM** adicionar camadas mobile:

```tsx
// Padrão para cada página
export function DashboardPage() {
  return (
    <>
      {/* Mobile: componentes mobile-first */}
      <div className="md:hidden">
        <DashboardMobileLayout />
      </div>
      
      {/* Desktop: layout atual (mantido) */}
      <div className="hidden md:block">
        <DashboardDesktopLayout />
      </div>
    </>
  );
}
```

Isso permite:
- ✅ Não quebrar o que já funciona
- ✅ Desenvolver mobile em paralelo
- ✅ Testar independentemente
- ✅ Migrar gradualmente

---

## 6. PADRÕES DE DESIGN MOBILE (Para Claude Code)

### 6.1 Tipografia Mobile
```css
/* Títulos: mínimo 18px em mobile */
.title-mobile { font-size: 18px; font-weight: 700; }
/* Corpo: mínimo 14px */
.body-mobile { font-size: 14px; line-height: 1.5; }
/* Labels: mínimo 12px */
.label-mobile { font-size: 12px; }
```

### 6.2 Touch Targets (WCAG 2.5.5)
```css
/* Mínimo 44x44px para qualquer elemento clicável */
.touch-target { min-height: 44px; min-width: 44px; }
```

### 6.3 Espaçamento Mobile
```css
/* Padding de conteúdo */
.content-mobile { padding: 16px; }
/* Gap entre cards */
.card-gap { gap: 8px; }
/* Margin inferior para Bottom Tab Bar */
.main-mobile { padding-bottom: 80px; }
```

### 6.4 Cores e Status (Manter os atuais)
```
Verde: #22c55e (score ≥ 70) — Tailwind: green-500
Amarelo: #f59e0b (score 40-69) — Tailwind: amber-400
Vermelho: #ef4444 (score < 40) — Tailwind: red-500
```

---

## 7. O QUE MANDAR PARA O CLAUDE CODE

### Mensagem Recomendada:

```
Olá Claude Code!

Analisei o projeto IOC ESG Municipal e identifiquei que o frontend 
foi desenvolvido desktop-first. O produto será usado principalmente 
em mobile (prefeitos e secretários no celular).

TAREFA: Implementar Mobile-First Redesign

PRIORIDADE 1 — Bottom Tab Bar (substitui hamburger):
- Criar: frontend/src/components/layout/BottomTabBar.tsx
- Modificar: frontend/src/components/layout/AppShell.tsx
- 4 tabs: Início, ODS, Simular, Relatório
- Visível apenas em mobile (md:hidden)
- Altura: h-16, fixed bottom-0

PRIORIDADE 2 — Bottom Sheet (substitui Drawer lateral):
- Criar: frontend/src/components/ods/OdsDetailBottomSheet.tsx
- Substituir OdsDetailDrawer no DashboardPage (mobile)
- max-h-[85vh], rounded-t-2xl, handle bar visual
- Manter OdsDetailDrawer para desktop

PRIORIDADE 3 — ODS Mobile Grid (substitui Radar em mobile):
- Criar: frontend/src/components/ods/OdsMobileGrid.tsx
- Grid 3 colunas, cards com score + mini progress bar
- Cores por ODS (usar ods.color existente)
- Substituir OdsRadarChart no DashboardPage (mobile)

PRIORIDADE 4 — Dashboard Mobile Layout:
- Criar: frontend/src/components/layout/DashboardMobileLayout.tsx
- Estrutura: ScoreHero → AlertCard (ODS crítico) → OdsMobileGrid → RecommendationCTA
- Usar dados dos hooks existentes (useOdsReport, useRecommendations)

REGRAS:
- Não quebrar o desktop (usar md:hidden / hidden md:block)
- Manter todos os hooks e APIs existentes
- TailwindCSS apenas (sem libs externas)
- Touch targets mínimo 44px
- Padding-bottom 80px no main (espaço para Bottom Tab Bar)
- Testes para novos componentes

Use o agente frontend-architect para planejar antes de implementar.
```

---

## 8. PRÓXIMAS FASES DO BACKLOG (Já Identificadas)

| # | Item | Tipo | Impacto |
|---|------|------|--------|
| 1 | **Mobile-First Redesign** (este documento) | UX | 🔴 Crítico |
| 2 | Integração Simulador ↔ Recomendações | Feature | 🔴 Alto |
| 3 | Exportar Relatório PDF | Feature | 🟡 Médio |
| 4 | Multi-tenant (isolamento por município) | Segurança | 🔴 Alto |
| 5 | Notificações por email (alertas ODS crítico) | Feature | 🟡 Médio |
| 6 | Dashboard Admin | Feature | 🟡 Médio |
| 7 | PWA (Progressive Web App) | Mobile | 🔴 Alto |
| 8 | Domínio + SSL | Infra | 🔴 Crítico |

---

## 9. RECOMENDAÇÃO FINAL

O projeto está **tecnicamente excelente** — 885+ testes, 14 agentes, infraestrutura completa. O gap principal é a **experiência mobile**.

**Próximo passo imediato:** Enviar o prompt da seção 7 para o Claude Code implementar o Mobile-First Redesign.

**Depois:** Considerar transformar em **PWA (Progressive Web App)** para que o prefeito possa "instalar" no celular sem precisar de App Store — isso é um diferencial enorme para o mercado B2G.

---

_Análise gerada em 07/04/2026 | IOC ESG Municipal v1.0_
