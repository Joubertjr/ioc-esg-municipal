# ANÁLISE DETALHADA LINHA A LINHA: Plataformas ESG/ODS de Classe Mundial

**Documento Analisado:** Pesquisa para o redesign do IOC ESG Municipal  
**Data da Análise:** Abril 2026  
**Autor da Análise:** Manus AI

---

## RESUMO EXECUTIVO

Esta pesquisa é um **documento estratégico de referência de classe mundial** que consolida as melhores práticas de 8 plataformas internacionais premiadas (SDG Index, IDSC-BR, Our World in Data, Gapminder, Atlas Brasil, Firjan IFDM, Yale EPI, e outras) em um **roadmap executável para o IOC ESG Municipal**.

O documento não é apenas teórico — cada recomendação é fundamentada em:

- **Pesquisa cognitiva e UX** (Nielsen, AHRQ, eye-tracking studies)
- **Precedentes comprovados** (plataformas que ganharam prêmios internacionais)
- **Padrões brasileiros** (IDSC-BR, Atlas Brasil, Firjan IFDM)
- **Frameworks comportamentais** (EAST do UK Behavioural Insights Team)

**Implicação para o IOC:** Se implementadas as 10 recomendações priorizadas, o IOC pode se tornar a **primeira plataforma brasileira de scoring ODS municipal a ganhar prêmios internacionais** (CONIP, Information is Beautiful Awards, Bloomberg Mayors Challenge).

---

## SEÇÃO 1: AS PLATAFORMAS PREMIADAS E O QUE AS TORNA EXCEPCIONAIS

### 1.1 SDG Index — O Padrão-Ouro Global (Linhas 9-11)

**O que é:** A plataforma de referência global para monitoramento de ODS, cobrindo 193 países com scores 0-100 por ODS.

**Por que é importante para o IOC:**

- **Hierarquia de informação comprovada:** O SDG Index segue uma estrutura de navegação que funciona: capa → 2 CTAs primários → 5 ferramentas interativas. Isso é o oposto de dashboards "tudo em uma tela".
- **Semáforo de 4 cores com setas de tendência:** Verde/Amarelo/Laranja/Vermelho + setas (↑/→/↓) é o padrão que o IOC já usa, validado globalmente.
- **Princípio dos "dois piores indicadores":** O SDG Index deliberadamente mostra apenas os 2 piores indicadores por ODS para evitar que bom desempenho em uma área mascare problemas em outra. **Aplicação para IOC:** Se um município tem ODS 3 (Saúde) com score 85, mas mortalidade infantil está piorando, o dashboard deve destacar isso.

**Métrica de sucesso:** O SDG Index é citado ~2.000 vezes em literatura acadêmica — é o benchmark de facto global.

**Ação para Claude Code:** Estudar a arquitetura de navegação do SDG Index (sustainabledevelopment.report) e replicar a hierarquia: Score Geral → Breakdown por ODS → Indicadores Individuais.

---

### 1.2 IDSC-BR — O Benchmark Brasileiro Obrigatório (Linhas 13-15)

**O que é:** O Índice de Desenvolvimento Sustentável das Cidades — a ÚNICA plataforma do mundo que monitora **todos os 5.570 municípios** de um país na Agenda 2030.

**Por que é crítico para o IOC:**

- **Metodologia auditada:** Auditada pelo JRC (Joint Research Centre) da Comissão Europeia — não é amador.
- **Normalização min-max com metas fixas:** Usa a mesma abordagem que o IOC já adota. Scores são interpretados como **"percentual do desempenho ótimo"** (ex: 73 = 73% da meta alcançada).
- **Tratamento de dados faltantes como advocacy:** IDSC-BR não penaliza municípios por dados faltantes — ao contrário, incentiva preenchimento. **Aplicação para IOC:** Quando um indicador não tem dados, mostrar como "oportunidade de melhoria no monitoramento" em vez de penalizar o score.
- **Financiamento público:** Financiado por Caixa, MMA e União Europeia — modelo de sustentabilidade para o IOC.

**Diferença crítica com SDG Index:** IDSC-BR é **municipal** (5.570 cidades), enquanto SDG Index é **nacional** (193 países). O IOC opera no nível municipal — IDSC-BR é o competitor direto e a referência metodológica.

**Ação para Claude Code:** O IOC deve se posicionar como "complemento especializado" do IDSC-BR, oferecendo simuladores de impacto e geração de relatórios que o IDSC-BR não oferece.

---

### 1.3 Our World in Data e Gapminder — Referências em Data Storytelling (Linhas 17-19)

**Our World in Data (OWID):**

- **Stack:** React + TypeScript + Mobx (OWID Grapher — open-source)
- **Prêmios:** Lovie Award 2019, 89 milhões de visitantes únicos em 2021
- **Diferencial:** Cada gráfico inclui aba de **fontes, dados baixáveis e código embarcável** — tudo Creative Commons BY
- **Aplicação para IOC:** Adicionar funcionalidade "Baixar dados" e "Embedar gráfico" em cada visualização

**Gapminder:**

- **Inovação:** Pioneirou o **bubble chart animado** mostrando 5 variáveis simultaneamente (eixo X, Y, tamanho, cor, tempo)
- **Prêmios:** Fast Company World Changing Ideas (2017), TIME 100 (2012), Royal Television Society Award (2014)
- **Princípio-chave:** _Slow reveal_ — introduzir elementos de dados progressivamente, como Hans Rosling fazia em TED Talks
- **Aplicação para IOC:** Usar animações para mostrar evolução histórica dos ODS (2015-2026), não apenas snapshot atual

**Insight crítico:** Ambas as plataformas combinam **narrativa longa com gráficos interativos incorporados**. Não é "apenas dashboard" — é "dashboard + storytelling".

**Ação para Claude Code:** Implementar seção "Histórias de Dados" no IOC com scrollytelling (usando `react-scrollama` + Recharts) mostrando evolução de cada ODS.

---

### 1.4 Atlas Brasil e Firjan IFDM — Padrões Brasileiros (Linhas 21-23)

**Atlas Brasil (PNUD/IPEA/FJP):**

- **Cobertura:** 5.570 municípios com 330+ indicadores
- **Métrica:** IDHM em escala 0-1 com 5 faixas claras (Muito Alto ≥0,800 até Muito Baixo <0,500)
- **Diferencial:** Cada município tem **página de perfil com narrativas textuais em linguagem simples**
- **Aplicação para IOC:** Gerar "Perfil Municipal" com texto explicativo automático para cada ODS

**Firjan IFDM (2025):**

- **Cobertura:** 5.550 municípios com 3 dimensões (Emprego & Renda, Educação, Saúde)
- **Resultado atual:** 47,3% dos municípios têm desenvolvimento baixo ou crítico
- **Aplicação para IOC:** Usar esse dado como **argumento de venda** — "Quase metade dos municípios brasileiros está em desenvolvimento baixo. O IOC ajuda a mudar isso."

**Yale Environmental Performance Index:**

- **Diferencial:** Parceria com escritório de design **Constructive** que criou "sistema de infográficos narrativos"
- **Stack:** Highcharts + D3.js
- **Aplicação para IOC:** Considerar parceria com agência de design para criar infográficos narrativos únicos

**Insight crítico:** Todas as plataformas brasileiras bem-sucedidas combinam **dados com narrativa em linguagem simples**. Prefeitos não entendem "score 0,73" — entendem "73% da meta alcançada".

---

## SEÇÃO 2: DESIGN SYSTEMS QUE ORIENTAM DASHBOARDS GOVERNAMENTAIS

### 2.1 US Web Design System (USWDS) — Linhas 28-29

**Princípios críticos:**

1. **"Reduza interação"** — mesmo interações simples têm custo de usabilidade
2. **"O dashboard deve explicar em linguagem simples o que o gráfico pretende comunicar"**

**Implicação para IOC:** Não adicione filtros, abas ou interações "porque é legal". Cada interação deve ter propósito claro.

**Limitação:** USWDS não inclui componentes de gauge, meter ou scoring — apenas gráficos de linha e barra.

**Ação para Claude Code:** Use Shadcn/ui (que segue USWDS) + Carbon Design System (IBM) para componentes de gauge e scoring.

---

### 2.2 GOV.UK Design System — Linhas 30-31

**Descoberta crítica:** **2/3 dos usuários do ONS acessam por mobile**.

**Princípio central:** _"Nenhum gráfico é totalmente acessível — sempre forneça tabela de dados alternativa."_

**Implicação para IOC:**

- Mobile-first não é responsivo — é arquitetura fundamentalmente diferente
- Cada gráfico deve ter tabela de dados alternativa
- Testar com 60%+ do tráfego em mobile

**Ação para Claude Code:** Implementar versão mobile com cards grandes, sparklines em vez de gráficos complexos, e drill-down como interação primária.

---

### 2.3 Carbon Design System (IBM) — Linhas 32-33

**Componentes mais relevantes para IOC:**

- **Gauge:** Arco visual mostrando distância a um threshold — perfeito para scores ODS
- **Bullet chart:** Progresso em relação a meta
- **KPI component:** Número grande com descrição

**Requisito de acessibilidade:** Contraste mínimo de **3,5:1** para elementos de dados (acima do WCAG).

**Ação para Claude Code:** Usar Carbon Design System como referência para componentes de gauge e KPI.

---

### 2.4 Ant Design Charts — Linhas 34-35

**Orientação de layout mais aplicável:**

- **Scorecard primeiro** → Filtros → Detalhes
- **5 a 9 módulos máximos** por tela
- Padrão "overview + detail"

**Componente mais relevante:** **ChartCard** (card com título, número total, tooltip e mini gráficos) — exatamente o que um dashboard ODS municipal precisa.

**Stack recomendado para IOC:**

- Shadcn/ui (componentes base)
- Recharts (gráficos)
- TanStack Table (tabelas)
- Ant Design Charts (inspiração de layout)

---

## SEÇÃO 3: METODOLOGIAS UX QUE TRANSFORMAM DADOS EM DECISÕES

### 3.1 Por Que Radar Charts São Problemáticos (Linhas 41-45)

**Pesquisa de eye-tracking (ScienceDirect 2023):**

- Gráficos de barras e linhas são **superiores** em eficácia, eficiência e facilidade percebida
- Problema fundamental: **área do polígono aumenta com o quadrado** dos valores (não linearmente)
- Ordenação dos eixos muda dramaticamente a forma percebida

**Recomendação para 17 ODS:**

- **NÃO usar radar chart com 17 eixos** — seria extremamente poluído
- **Usar radar apenas para perfil de performance com 5-8 eixos máximos** (agrupar os 17 ODS em 5 dimensões)
- **Máximo 4-5 polígonos sobrepostos**

**Para comparações entre municípios:** **Barras horizontais ordenadas** são inequivocamente superiores.

**Tipos de gráfico mais eficazes para IOC:**

- Barras horizontais (comparações municipais)
- Número grande + sparkline (scores compostos)
- Gráficos de linha (máximo 5 linhas para tendências)
- Mapas coropléticos (comparações geográficas)

**Citação de Cole Nussbaumer Knaflic:** _"Simples vence sofisticado — foque na mensagem, não no gráfico."_

**Ação para Claude Code:** Manter radar chart apenas para perfil agregado (5 dimensões). Para comparações, usar small multiples de barras horizontais.

---

### 3.2 Arquitetura de 3 Níveis com Progressive Disclosure (Linhas 47-51)

**Pesquisa de Nielsen/NNGroup:**

- Progressive disclosure melhora 3 dos 5 componentes de usabilidade: aprendizado, eficiência, taxa de erros
- **Designs com mais de 2 níveis de disclosure tipicamente têm baixa usabilidade**

**Recomendação para IOC (3 níveis):**

**Nível 1 — Score Resumo (tela de entrada):**

- Número grande (ex: "67/100") com cor do semáforo
- Sparkline de tendência
- Frase em linguagem natural (_"Seu município melhorou 5 pontos desde 2024"_)
- CTA claro (_"Ver detalhes por ODS →"_)

**Nível 2 — Breakdown por ODS (click-through):**

- 17 barras horizontais ordenadas por score
- Coloridas pelo semáforo de 4 cores
- Overlay de comparação (média estadual, média nacional)
- Cada barra é clicável para Nível 3

**Nível 3 — Indicadores Individuais (drill-down):**

- Indicadores componentes daquela ODS
- Fontes de dados
- Data de coleta
- Tendência histórica
- Municípios comparáveis

**Regra de ouro "3-30-300" de Kurt Buhler:**

- **3 segundos:** KPI cards (_"Está tudo bem?"_)
- **30 segundos:** Filtros e contexto (_"O que mudou?"_)
- **300 segundos:** Análise profunda (_"Por quê?"_)

**Ação para Claude Code:** Implementar exatamente esses 3 níveis com navegação clara entre eles.

---

### 3.3 EAST Framework — Transformando Scores em Ação (Linhas 53-60)

**Framework EAST do UK Behavioural Insights Team:**

- Citado ~350 vezes
- Endossado pela OECD OPSI
- Modelo mais comprovado para design de nudges em plataformas governamentais

**Aplicação ao IOC:**

**Easy (Fácil):**

- Pré-popular planos de ação baseados nos ODS com menor score
- Botão "one-click" para gerar relatório para câmara municipal
- Transformar _"Seu score ODS 4 é 38"_ em _"3 em cada 10 crianças do seu município concluem o ensino fundamental na idade certa. Veja o que fazer."_

**Attractive (Atrativo):**

- Números grandes e bold
- Personalização: _"Prefeito(a) [Nome], estas são suas prioridades."_
- **Framing de perda aumenta ação em ~7%:** Use _"Seu município está ficando para trás"_ ao invés de _"Seu município pode melhorar"_

**Social:**

- Prova social: _"85% dos municípios do seu estado já acessaram seus planos de ação."_
- Benchmarking entre pares — prefeitos respondem à competição entre pares

**Timely (Oportuno):**

- Alertas alinhados com ciclos de planejamento orçamentário
- Framing de custo imediato: _"Agir agora em saneamento (ODS 6) pode evitar R$X em custos de saúde no próximo ano."_

**Ação para Claude Code:** Implementar cada elemento do EAST framework como componente separado no IOC.

---

### 3.4 Acessibilidade e Literacia de Dados no Contexto Brasileiro (Linhas 62-64)

**Deficiência de visão de cores:**

- **8% dos homens** têm deficiência na visão de cores
- Semáforo vermelho/verde tradicional aparece como tons indistinguíveis de marrom/amarelo

**Solução:** **Nunca usar cor como único indicador**

- Acompanhar com ícones (✓, ⚠, ✗)
- Padrões visuais (sólido, tracejado, pontilhado)
- Rótulos textuais

**Paleta recomendada:** Azul/Laranja ou adicionar bordas e ícones de forma

**Literacia de dados no Brasil:**

- OECD (2019) identificou literacia de dados como uma das 6 habilidades essenciais para inovação no setor público
- Municipalidades têm percepção mais baixa de capacidade em dados

**Implicação para IOC:** Dashboard deve funcionar **simultaneamente como ferramenta de dados e ferramenta de educação em dados**.

**Ação para Claude Code:** Adicionar explicações contextuais, explorações guiadas e benchmarks de comparação em cada visualização.

---

## SEÇÃO 4: COMO CALCULAR E COMUNICAR SCORES

### 4.1 Normalização Min-Max com Metas Fixas (Linhas 70-74)

**Análise comparativa de técnicas de normalização:**

| Técnica                     | Vantagem                                                           | Desvantagem                                                          | Usado por                        |
| --------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------- | -------------------------------- |
| **Min-Max com metas fixas** | Comunicabilidade máxima, scores absolutos, precedente estabelecido | Requer definição de metas                                            | HDI, SDG Index, IDSC-BR, IOC     |
| **Z-score**                 | Estatisticamente robusto                                           | "_seu score é -0,5 desvios-padrão_" não significa nada para prefeito | Ninguém para comunicação pública |
| **Rank percentil**          | Útil como complemento                                              | Perde informação de desempenho absoluto                              | Complemento apenas               |

**Conclusão:** O IOC já usa a abordagem correta.

**Inovação do HDI:** **Média geométrica** ao invés de aritmética para agregar dimensões.

- Penaliza desenvolvimento desbalanceado
- Cidade com saúde 90 e educação 30 recebe score menor que 60/60
- Incentiva equilíbrio

**Recomendação para IOC:** Considerar adotar média geométrica em vez de aritmética para score composto.

**Tratamento de dados faltantes:**

- **Não penalizar** o município (calcular com indicadores disponíveis)
- Mostrar completude como métrica separada (_"Dados disponíveis: 85/100 indicadores"_)
- Tratar lacunas como oportunidade: _"Ajude-nos a melhorar o monitoramento reportando X."_

**Ação para Claude Code:** Implementar cálculo de score com média geométrica e tratamento de dados faltantes como advocacy.

---

### 4.2 Template de Comunicação de Score (Linhas 76-84)

**Padrão comprovado:** Score atual + Seta de tendência + Contexto

**Template recomendado:**

```
SEU MUNICÍPIO: Score 65/100 (Moderado — desafios significativos permanecem)
🟢 ODS 7 Energia: 92 ← No caminho
🟡 ODS 4 Educação: 71 ← Desafios permanecem
🔴 ODS 6 Água: 38 ← Desafios maiores ← COMECE AQUI
Sua maior oportunidade: melhorar água/saneamento (+17 pontos) elevaria seu score geral para 66.
```

**Estratégia de layering (AHRQ):** _"Exiba o score composto primeiro e não force o usuário a ver detalhes que não deseja."_

**Ação para Claude Code:** Implementar exatamente este template em cada página de município.

---

## SEÇÃO 5: INOVAÇÕES QUE DIFERENCIAM

### 5.1 Simuladores de Impacto e IA Generativa (Linhas 90-96)

**iSDG Model do PNUD:**

- Gera cenários de desenvolvimento específicos por país
- Simula implicações de intervenções políticas nos 17 ODS simultaneamente
- Exemplo mais próximo do simulador desejado para IOC

**Forio:**

- Usado pelo Banco Mundial e CDC para modelagem de políticas
- Interface interativa de cenários

**Implementação prática para IOC:**

- Componente de **sliders interativos** usando Recharts
- Prefeito ajusta investimento em saneamento
- Score ODS 6 projetado se move em tempo real
- Usar modelos de regressão baseados em dados históricos dos 5.570 municípios

**Geração de relatórios com IA:**

- **Madison AI** (deployado em City of Reno) **reduziu produção de staff reports em mais de 75%**
- Implementação para IOC: Botão "Gerar Relatório" que usa API de LLM (Claude/GPT)
- Template de relatório municipal
- Produz PDF/DOCX formatado com dados atuais
- Bibliotecas React: `@react-pdf/renderer` (PDF), `docx` (Word), `pptxgenjs` (PowerPoint)

**Comparação peer-to-peer:**

- **Peer City Identification Tool** do Federal Reserve Bank of Chicago cobre 960 cidades americanas
- Usa análise hierárquica de clusters (método de Ward)
- Para 5.570 municípios brasileiros: clustering por faixa populacional IBGE, PIB per capita, IDH, região
- Pesquisa sueca (Kolada): políticos preferem comparar com vizinhos geográficos sobre peers algoritmicamente determinados
- **Recomendação:** Oferecer ambas as opções

**Ação para Claude Code:** Implementar simulador de impacto + geração de relatórios com IA + comparação peer-to-peer como diferenciais competitivos.

---

### 5.2 Scrollytelling, Mobile-First e Tendências Emergentes (Linhas 98-102)

**Scrollytelling:**

- Narrativas dirigidas por scroll
- Flourish oferece no-code para planos Enterprise
- Em React: `react-scrollama` + Recharts
- Exemplo: World Bank Atlas of Sustainable Development Goals

**Mobile-first:**

- **Não é dashboard responsivo** — requer arquitetura fundamentalmente diferente
- Mostrar apenas 3-4 KPIs como cards grandes e tocáveis
- Substituir gráficos complexos por sparklines
- Usar scroll vertical ao invés de grid layout
- Drill-down como interação primária

**Tendências Gartner até 2027:**

- **Mais de 50% dos CDOs** financiarão programas de literacia de dados e IA
- **75% dos dashboards enterprise** serão substituídos por insights conversacionais gerados automaticamente

**Implicação para IOC:** Preparar-se para era de "dashboards conversacionais" — chatbot que responde perguntas em linguagem natural sobre ODS.

**Ação para Claude Code:** Implementar versão mobile-first + scrollytelling para relatórios anuais + preparar arquitetura para chatbot futuro.

---

### 5.3 Premiações e Posicionamento (Linhas 104-106)

**Bloomberg Philanthropies Mayors Challenge 2025-2026:**

- Premiou 24 cidades de 630+ candidatas com US$1M cada
- Vencedores relevantes: South Bend (IA para interpretar dados), Ghent (dados + tecnologia)
- Tendência: _"Muitos vencedores estão integrando IA de formas sofisticadas."_

**Prêmio CONIP (desde 1998):**

- Reconhece inovação em tecnologia governamental no Brasil
- Categorias: Políticas Públicas, IA, Transformação Digital
- **Nenhuma plataforma de scoring ODS ganhou até agora** — oportunidade clara

**Information is Beautiful Awards:**

- Considerado o "Oscar" da visualização de dados
- Categorias: Dashboard, Interactive
- Gamificação governamental tem precedentes: Hawaii.gov (badges), Salem MA ("What's The Point")

**Ação para Claude Code:** Submeter IOC simultaneamente ao Prêmio CONIP, Information is Beautiful Awards e Bloomberg Mayors Challenge.

---

## SEÇÃO 6: COMPONENTES ESPECÍFICOS — IMPLEMENTAÇÃO EM REACT

### 6.1 Score Cards — A Primeira Coisa que o Prefeito Vê (Linhas 112-114)

**Pesquisa cognitiva:** Memória de trabalho retém **3-4 chunks** de informação → **4 KPI cards** é o número ideal

**Cada card deve conter obrigatoriamente:**

- Nome da métrica (pequeno, atenuado)
- Valor (grande, bold, primário)
- Delta com seta (verde/vermelho)
- Sparkline de tendência
- Contexto/benchmark (_"Média estadual: 68,1"_)

**Implementação em Shadcn/ui + Tailwind + Recharts:**

```jsx
<Card>
  <CardHeader>
    <CardTitle>ODS 3 — Saúde</CardTitle>
  </CardHeader>
  <CardContent>
    <div className="text-4xl font-bold">72</div>
    <Badge variant={score > 70 ? "success" : "warning"}>↑ +3 desde 2024</Badge>
    <LineChart data={sparklineData} />
    <p className="text-sm text-gray-500">Média estadual: 68,1</p>
  </CardContent>
</Card>
```

**Layout recomendado:**

- 4 cards em row no topo
- Gráfico principal + perfil ODS no meio
- Tabela de ranking com drill-down na base

**Ação para Claude Code:** Implementar exatamente este componente.

---

### 6.2 Ranking de 5.570 Municípios — Search-First com Sticky Row (Linhas 116-118)

**Abordagem search-first obrigatória:**

- Barra de busca proeminente no topo
- Auto-suggest e fuzzy matching (tratar variações de acentuação)
- Após busca: mostrar município encontrado com 5 acima e 5 abaixo para contexto

**Padrão sticky row:**

- Fixa o município do usuário no topo com fundo distinto (`bg-blue-50 dark:bg-blue-950`)
- Restante rola normalmente

**Performance com 5.570 linhas:**

- **TanStack Table** (headless, compatível com Shadcn/ui)
- `@tanstack/react-virtual` para virtualização de scroll
- Sparklines inline nas células mostrando tendência recente
- Filtros: Estado (dropdown), faixa populacional, região, dimensão ODS

**Stack recomendado:**

- Shadcn/ui: componente `<DataTable>` (baseado em TanStack Table)
- Shadcn/ui: componente `<Command>` (cmdk) para autocomplete

**Ação para Claude Code:** Implementar tabela de 5.570 municípios com search-first, sticky row e virtualização.

---

### 6.3 Radar Charts — Quando Manter e Como Melhorar (Linhas 120-122)

**Radar chart do IOC é válido para:**

- Perfil de performance (a "forma" do desempenho ODS cria um perfil visual significativo)
- **Limitado a 5-8 eixos** — agrupar os 17 ODS em dimensões (Econômica, Social, Ambiental, Institucional, Parcerias)

**Melhorias obrigatórias:**

- Sobrepor **polígono do benchmark** (média estadual em cinza sutil) sob o polígono colorido
- Nunca exceder **4-5 polígonos** sobrepostos
- Para valores nulos: mostrar como zero com **linha tracejada** + tooltip explicando "dado indisponível"

**Alternativa recomendada para comparações precisas:**

- **Small multiples de barras horizontais** — 17 mini-gráficos com mesma escala 0-100
- Padrão endossado por Tufte como forma mais clara de comparar múltiplas dimensões

**Ação para Claude Code:** Manter radar chart apenas para perfil agregado (5 dimensões). Para comparações, usar small multiples de barras.

---

## TOP 10 RECOMENDAÇÕES PRIORIZADAS (Linhas 126-145)

### Recomendação 1: Comunicação "Percentual do Desempenho Ótimo"

**Ação:** Todo score deve ser acompanhado de frase explicativa.

- ❌ Evitar: "Score: 0,73"
- ✅ Usar: "73 significa que seu município alcançou 73% da meta ODS."

**Padrão:** IDSC-BR e SDG Index — comprovado com gestores brasileiros.

---

### Recomendação 2: Redesenhar Tela Principal com Regra 3-30-300

**Layout:**

1. **3 segundos:** 4 KPI cards no topo (score geral, pior ODS, tendência, ranking entre pares)
2. **30 segundos:** Área central com breakdown por ODS em barras horizontais ordenadas
3. **300 segundos:** Tabela de ranking com busca na base

**Máximo:** 9 módulos por tela

---

### Recomendação 3: Adicionar Narrativa Automática em Linguagem Natural

**Componente:** `<NarrativeSummary>` que gera texto como:

> "ODS 6 (Água Limpa) melhorou 3,2 pontos desde o último período, passando de 62,1 para 65,3, impulsionado por melhoria na cobertura de saneamento básico (+4,7%)."

---

### Recomendação 4: Substituir Radar Chart com 17 Eixos

**Ação:** Usar small multiples de barras horizontais para comparações, manter radar com 5 dimensões agregadas apenas para visão de perfil. Adicionar polígono de benchmark.

---

### Recomendação 5: Implementar Comparação Peer-to-Peer

**Clustering:** Faixa populacional IBGE, PIB per capita, região
**Opções:** Oferecer simultaneamente comparação com vizinhos geográficos e com peers algoritmicamente similares

---

### Recomendação 6: Criar Simulador de Impacto

**Funcionalidade:** Sliders interativos

- _"Se investir R$X em saneamento, seu score ODS 6 projetado sobe Y pontos."_
- Usar modelos de regressão baseados em dados históricos dos 5.570 municípios

---

### Recomendação 7: Implementar Geração de Relatórios com IA

**Botão:** "Gerar Relatório para Câmara"
**Output:** PDF/DOCX formatado com dados atuais, análise narrativa e recomendações
**Stack:** `@react-pdf/renderer` + API de LLM com template de relatório municipal

---

### Recomendação 8: Resolver Acessibilidade Completa

**Ações:**

- Nunca usar cor como único indicador (adicionar ícones ✓/⚠/✗)
- Fornecer tabela de dados alternativa para cada gráfico
- Garantir contraste ≥3,5:1 para elementos de dados
- Testar com navegação por teclado

---

### Recomendação 9: Construir Alertas Proativos Alinhados ao Ciclo Orçamentário

**Notificações:**

- Quando novos dados são publicados
- Quando scores cruzam thresholds
- Quando municípios pares apresentam melhoria significativa
- **Stack:** Web Push API + service workers

---

### Recomendação 10: Submeter a Prêmios Internacionais

**Simultaneamente:**

- **Prêmio CONIP** (categoria Políticas Públicas ou IA)
- **Information is Beautiful Awards** (categoria Dashboard)
- **Bloomberg Mayors Challenge** como ferramenta inovadora de gestão municipal ODS

**Justificativa:** Nenhuma plataforma brasileira de scoring ODS ganhou esses prêmios — IOC é candidato natural para pioneirar essa conquista.

---

## CONCLUSÃO E IMPLICAÇÕES PARA O IOC

Esta pesquisa consolida **8 anos de inovação em plataformas de dados governamentais** em um roadmap executável. As 10 recomendações não são "nice-to-have" — são o **mínimo viável para competir em nível internacional**.

**Implementação prioritária (Fase 1):**

1. Recomendações 1-4 (comunicação, layout, narrativa, gráficos)
2. Recomendações 8 (acessibilidade)

**Implementação secundária (Fase 2):** 3. Recomendações 5-7 (peer-to-peer, simulador, IA) 4. Recomendações 9-10 (alertas, prêmios)

**Diferencial competitivo:** Se o IOC implementar as 10 recomendações, será a **primeira plataforma brasileira de scoring ODS municipal a ganhar prêmios internacionais**.

---

**Análise concluída por:** Manus AI  
**Data:** Abril 2026  
**Status:** Pronto para implementação pelo Claude Code
