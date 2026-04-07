# MASTER PLAN: ELEVANDO O IOC ESG MUNICIPAL À CLASSE MUNDIAL

**Data:** 07/04/2026
**Projeto:** IOC ESG Municipal — https://github.com/Joubertjr/ioc-esg-municipal
**Autor:** Manus AI (Estrategista)
**Destinatário:** Claude Code / Cursor (Engenheiro Executor)

---

## 🎯 DIRETRIZ PRINCIPAL PARA O CLAUDE CODE

Olá Claude Code! Você foi encarregado de elevar o projeto IOC ESG Municipal a um padrão de **classe mundial**. 

Este não é apenas um projeto de refatoração. O objetivo é transformar um sistema funcional (que já possui 14 agentes coletores e backend robusto) na **melhor e mais inovadora plataforma de inteligência de dados governamentais do Brasil em 2026**, com potencial para vencer prêmios internacionais (Information is Beautiful Awards, Prêmio CONIP).

**Sua missão autônoma:**
1. Leia este documento integralmente.
2. **Pesquise e valide** as recomendações apresentadas aqui acessando a base de código atual.
3. **Tome decisões arquiteturais** baseadas nas sugestões deste plano e no contexto das pesquisas anexas.
4. Execute as mudanças de forma iterativa, garantindo que nenhum dos 885 testes atuais quebre.

---

## 1. O CONTEXTO ATUAL DO PROJETO

O projeto já é um sucesso técnico, mas precisa de um salto de qualidade em UX/UI, integração de dados e comunicação de impacto.

**O que já existe (Não quebre isso):**
- Backend: Node.js + Fastify + Prisma + PostgreSQL + Redis.
- 14 Agentes Coletores de dados abertos (IBGE, SICONFI, DATASUS, etc.).
- Motor de cálculo para 17 ODS com scores de 0-100.
- Simulador de impacto FPM (MiroFish).
- Frontend: React 18 + Vite + TypeScript + TailwindCSS + Recharts.

**O Problema Atual:**
O frontend foi concebido com uma mentalidade *desktop-first* de 2020. Possui um hamburger menu, modais intrusivos, gráficos ilegíveis em telas pequenas (radar com 17 eixos) e navegação truncada. O prefeito (usuário final) acessa o sistema às 7h da manhã pelo celular com uma mão só — a UX atual falha nesse cenário crítico.

---

## 2. A NOVA ARQUITETURA FRONTEND (PADRÃO 2026)

Após uma *wide research* extensa sobre as melhores empresas SaaS B2B de 2026 (Linear, Vercel, Figma) e plataformas governamentais premiadas, defini a stack exata que você deve implementar.

### 2.1 Stack Tecnológica Obrigatória
- **Manter:** React, Vite, TypeScript, TailwindCSS, Recharts, Zustand, TanStack Query.
- **Atualizar:** TailwindCSS para **v4** (muito mais rápido, usa CSS nativo).
- **Adicionar (Core):** `shadcn/ui` (para componentes base acessíveis).
- **Adicionar (Analytics):** `@tremor/react` (para KPI cards, gráficos e tabelas).
- **Adicionar (Animações):** `framer-motion` (para micro-interações).
- **Adicionar (Mapas):** `maplibre-gl` (para mapas interativos sem custo de API).

### 2.2 O Fim do Hamburger Menu (Prioridade Máxima)
Você deve **remover completamente** o hamburger menu e implementar os padrões de 2026:

1. **Mobile (md:hidden):** Implementar uma **Floating Bottom Tab Bar**.
   - Deve flutuar acima do rodapé (`bottom-4`).
   - Deve ter *glassmorphism* (`bg-white/80 backdrop-blur-xl`).
   - 4 ações principais: Início, ODS, Simular, Relatório.
2. **Desktop (hidden md:flex):** Implementar um **Navigation Rail**.
   - Barra lateral fixa e muito estreita (`w-16`).
   - Apenas ícones com tooltips no hover.
   - Libera espaço horizontal vital para o dashboard de dados.

### 2.3 Bento Grid e UI/UX de Classe Mundial
- Refatore a `DashboardPage.tsx` usando a **Regra 3-30-300** e o **Bento Grid Layout**:
  - **3 segundos:** 4 KPI cards no topo (score geral, pior ODS, tendência, ranking).
  - **30 segundos:** Área central com breakdown por ODS em barras horizontais.
  - **300 segundos:** Tabela de ranking com busca na base.
- **Aposente o Radar Chart com 17 eixos:** Use small multiples de barras horizontais para comparações. Mantenha o radar apenas para uma visão de perfil agregado (5 dimensões máximas) e adicione um polígono de benchmark (média estadual) ao fundo.
- Substitua o `OdsDetailDrawer` (que ocupa 100% da tela mobile) por **Contextual Bottom Sheets** (que deslizam de baixo para cima, mantendo a tela anterior visível ao fundo).
- Adicione **micro-interações significativas**: use Framer Motion para criar efeitos de *count-up* nos scores (ex: de 0 a 72 ao carregar a página) e transições suaves ao rolar a tela.

---

## 3. INTEGRAÇÃO DE DADOS E INTELIGÊNCIA (DESCOBERTAS ESTRATÉGICAS)

A auditoria de fontes revelou oportunidades massivas de melhoria que você deve implementar para tornar os dados do IOC inquestionáveis e a plataforma verdadeiramente inteligente.

### 3.1 API REST do SICONFI (Substituir Scraping)
A descoberta mais estratégica: o SICONFI possui uma **API REST documentada e disponível** em `https://apidatalake.tesouro.gov.br/docs/siconfi/`.
**Sua Tarefa:** Refatore o agente coletor de FPM atual. Elimine qualquer abordagem de scraping e passe a usar chamadas diretas à API do Tesouro Nacional (endpoints prioritários: `/rreo` e `/rgf`).

### 3.2 Novas Fontes de Alto Valor (Integrar aos Agentes)
A pesquisa identificou fontes superiores que já fornecem dados processados:
- **IEPS Data (`https://iepsdata.org.br/`):** Contém dados de saúde municipal desde 2010 já limpos e padronizados. Isso reduzirá drasticamente o esforço do agente coletor do ODS 3.
- **QEdu (`https://www.qedu.org.br/`):** Melhor fonte estruturada para indicadores educacionais municipais (ODS 4).
- **SDG Index API (`https://sdg-transformation-center-sdsn.hub.arcgis.com/`):** O relatório de 2025 disponibilizou uma API pública via ArcGIS Hub com dados de 167 países. Use isso para benchmarking global.

### 3.3 Evolução Metodológica e de IA
- **Cálculo de Score (Média Geométrica):** Atualmente o sistema pode estar usando média aritmética. Altere o motor de cálculo para usar a **Média Geométrica**, conforme validado pela metodologia do IDHM (ONU) e COINr. A média geométrica penaliza o desenvolvimento desbalanceado, refletindo a verdadeira sustentabilidade.
- **Comparação Peer-to-Peer:** Implemente o método de *clustering hierárquico de Ward* (referência: Peer City Identification Tool do Chicago Fed) para agrupar municípios por faixa populacional, PIB per capita e região, permitindo que prefeitos se comparem com cidades similares, não apenas vizinhos geográficos.
- **Geração de Relatórios com IA:** O ecossistema brasileiro de IA municipal (ex: Pró-Cidadão, Lia, Rio 3 Open) está avançado. Prepare a arquitetura para geração de relatórios narrativos automatizados (PDF/DOCX) usando APIs de LLM, transformando dados brutos em insights acionáveis ("Seu município melhorou 5 pontos em Saúde devido a...").

---

## 4. O SEU PLANO DE AÇÃO (COMO EXECUTAR)

Claude Code, não tente fazer tudo de uma vez. Siga esta ordem de execução estrita. Após cada fase, rode os testes e valide o build.

### FASE 1: Modernização da Infraestrutura Frontend
1. Verifique as dependências no `package.json`.
2. Instale `framer-motion`, `lucide-react`, `clsx`, `tailwind-merge` e inicialize o `shadcn/ui`.
3. Instale `@tremor/react` para os componentes analíticos.
4. Atualize o TailwindCSS para a v4 e configure o Dark Mode de primeira classe (tons de `slate-950` em vez de preto puro).

### FASE 2: Revolução da Navegação (Mobile-First)
1. Delete o componente do hamburger menu.
2. Crie `FloatingBottomTabBar.tsx` (apenas para mobile).
3. Crie `NavigationRail.tsx` (apenas para desktop).
4. Refatore o `AppShell.tsx` para usar a nova estrutura.

### FASE 3: Bento Grid, UX e Acessibilidade
1. Refatore a `DashboardPage.tsx` para usar o Bento Grid Layout e a Regra 3-30-300.
2. Substitua o Radar Chart ilegível por small multiples de barras horizontais (Tremor `ProgressBar`).
3. Crie o `OdsBottomSheet.tsx` para substituir modais e drawers em dispositivos móveis.
4. Implemente as animações de *count-up* nos scores principais.
5. Garanta acessibilidade: nunca use cor como único indicador (adicione ícones ✓/⚠/✗) e forneça tabelas de dados alternativas para gráficos.

### FASE 4: Inteligência de Dados e Refatoração de Agentes
1. Refatore o agente do FPM para usar a API REST do SICONFI.
2. Altere o cálculo do Score Geral para Média Geométrica.
3. Avalie e crie testes de integração para o IEPS Data (ODS 3) e QEdu (ODS 4).
4. Implemente o algoritmo de clustering para comparação Peer-to-Peer.

---

## 5. MENSAGEM FINAL PARA O CLAUDE CODE

Você tem autonomia para tomar decisões técnicas. Se uma biblioteca específica que sugeri (ex: Tremor) conflitar com a versão do React que estamos usando, você tem total liberdade para escolher a melhor alternativa (ex: Recharts puro + Shadcn), desde que o resultado final cumpra o requisito de UX de classe mundial.

Você tem à sua disposição, no arquivo ZIP de contexto, todas as pesquisas detalhadas que fundamentam este plano. Consulte-as se precisar de aprofundamento em metodologias de UX, referências de design ou endpoints de APIs.

**Sua primeira ação:** Responda confirmando que leu este plano, analise a estrutura de pastas do projeto (`ls -la`), e apresente como você planeja executar a FASE 1. 

*Mãos à obra. Vamos construir o melhor software governamental do Brasil e prepará-lo para vencer o Prêmio CONIP 2026.*
