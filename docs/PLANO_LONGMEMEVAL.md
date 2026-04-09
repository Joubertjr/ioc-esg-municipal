# Plano de Implementação: LongMemEval-ESG (Versão Revisada)

Este documento define o plano técnico e metodológico para implementar o benchmark **LongMemEval** adaptado ao contexto do projeto **IOC ESG Municipal**. O objetivo é avaliar e garantir que os agentes coletores e o motor de recomendação possuam uma memória de longo prazo robusta, capaz de manter o contexto através de múltiplas sessões de coleta, lidar com atualizações de dados e cruzar informações de diferentes fontes (ODS).

Esta revisão incorpora os aprendizados das implementações State-of-the-Art (SOTA) do LongMemEval, incluindo OMEGA (95.4%), Mastra Observational Memory (94.8%), Backboard (93.4%), Hindsight (91.4%) e o framework SelRoute (Abril 2026) [1] [2] [3] [4] [5].

---

## 1. Fundamentação Teórica e Arquiteturas SOTA

O LongMemEval original testa cinco capacidades cognitivas fundamentais em interações sustentadas através de seis categorias de questões. As implementações que alcançaram os melhores resultados no leaderboard global adotaram estratégias arquiteturais específicas que devem inspirar a nossa adaptação:

### 1.1. Categorias de Avaliação e Desempenho SOTA

A avaliação divide-se em categorias que testam diferentes aspectos da memória. A tabela abaixo resume o desempenho típico dos sistemas SOTA em cada categoria, evidenciando onde residem os maiores desafios [2] [5]:

| Categoria de Questão          | Foco do Teste                                   | Teto de Desempenho (SOTA) | Estratégia de Retrieval Ideal (SelRoute) |
| :---------------------------- | :---------------------------------------------- | :------------------------ | :--------------------------------------- |
| **Single-Session User**       | Recuperação verbatim de fatos do usuário.       | ~97%                      | Busca Lexical (FTS/BM25)                 |
| **Single-Session Assistant**  | Recuperação semântica de fatos do assistente.   | ~98%                      | Busca Semântica (Embeddings)             |
| **Knowledge Update**          | Rastreamento de fatos que mudaram no tempo.     | ~93%                      | Busca Lexical Enriquecida                |
| **Temporal Reasoning**        | Resolução de tempo relativo e ordem de eventos. | ~91%                      | Busca Híbrida (Lexical + Semântica)      |
| **Multi-Session**             | Síntese de informações dispersas.               | ~87% (Gargalo)            | Busca Híbrida Enriquecida                |
| **Single-Session Preference** | Lembrança de preferências declaradas.           | Volátil (70-100%)         | Busca Semântica (Embeddings)             |

O framework SelRoute demonstrou que nenhuma estratégia única de _retrieval_ domina todas as categorias. O roteamento baseado no tipo de query (Query-Type-Aware Routing) é fundamental para maximizar o desempenho [5].

### 1.2. Padrões Arquiteturais Vencedores

As arquiteturas que ultrapassaram a barreira dos 90% de acurácia no LongMemEval compartilham características comuns que devem ser consideradas no design da nossa memória ESG:

**1. Memória Observacional e Biomimética:** Sistemas como Mastra (Observational Memory) e Hindsight não utilizam RAG tradicional com resumo de sessões. Em vez disso, empregam agentes de _background_ (Observer/Reflector) que geram um log denso e estruturado de observações (eventos, fatos, opiniões) [2] [3]. Essa abordagem oferece compressão eficiente (3-6x para texto, até 40x para tool calls) mantendo a janela de contexto estável [2].

**2. Ancoragem Temporal Explícita:** O raciocínio temporal exige que as memórias sejam estritamente ancoradas no tempo. O Mastra utiliza três datas por observação (data da observação, data referenciada, data relativa), permitindo ao modelo julgar a cronologia e descartar informações obsoletas [2].

**3. Enriquecimento de Vocabulário no Armazenamento:** A expansão de chaves (_fact-augmented key expansion_) ou enriquecimento determinístico de vocabulário (ex: hiperônimos) melhora drasticamente a busca lexical para categorias como _Knowledge Update_ e _Multi-Session_, embora possa degradar a busca semântica pura [5].

---

## 2. Adaptação para o Contexto ESG Municipal

No projeto IOC ESG Municipal, a "conversa" não é entre um usuário humano e um chatbot genérico, mas sim entre o **sistema orquestrador** e os **14 agentes coletores de dados** (ex: DATASUS, SNIS, INEP), ao longo de diferentes ciclos de coleta (anos base, semestres).

### 2.1. Mapeamento das Capacidades Cognitivas

O LongMemEval-ESG avaliará o motor de recomendação e a memória do sistema através das seguintes capacidades:

**1. Extração de Informação (Information Extraction)**

- _Definição:_ Precisão na recuperação de dados coletados em ciclos anteriores.
- _Exemplo ESG:_ "Qual foi a taxa de mortalidade infantil (DATASUS) reportada para o município de Joinville no ciclo de coleta de 2022?"

**2. Raciocínio Multissessão (Multi-Session Reasoning)**

- _Definição:_ Habilidade de sintetizar dados de múltiplos agentes para compor um indicador complexo.
- _Exemplo ESG:_ "Considerando os dados do SNIS (saneamento) de 2023 e do DATASUS (saúde) de 2023, qual é a correlação observada entre a cobertura de esgoto e as internações por doenças hídricas em Blumenau?"

**3. Raciocínio Temporal (Temporal Reasoning)**

- _Definição:_ Compreensão da evolução dos indicadores ao longo do tempo.
- _Exemplo ESG:_ "A nota do IDEB (INEP) de Florianópolis apresentou tendência de alta ou de baixa entre os ciclos de 2019, 2021 e 2023? Qual foi a variação percentual?"

**4. Atualização de Conhecimento (Knowledge Updates)**

- _Definição:_ Capacidade de sobrepor dados preliminares ou projetados com dados consolidados mais recentes.
- _Exemplo ESG:_ "O agente TCE-SC reportou inicialmente uma despesa com pessoal de 48% para o município X em 2023. Após a revisão do balanço no segundo semestre, qual é o valor atualizado e definitivo?"

**5. Abstenção (Abstention)**

- _Definição:_ Reconhecimento da falta de dados, evitando alucinações.
- _Exemplo ESG:_ "Qual é a taxa de emissão de GEE (Gases de Efeito Estufa) do setor industrial para o município de Apiúna em 2024?" _(Resposta esperada: "Não possuo dados do agente SEEG para Apiúna no ano de 2024.")_

---

## 3. Metodologia de Avaliação (LLM-as-a-Judge)

Seguindo o padrão do LongMemEval original, a avaliação não utilizará métricas de sobreposição de palavras (como F1-score ou ROUGE), pois estas penalizam respostas corretas que incluem contexto adicional [2].

A avaliação será conduzida por um **LLM Judge** (ex: GPT-4o-mini ou superior, conforme recomendado pelas implementações SOTA para garantir consistência [1] [4]), utilizando prompts de avaliação específicos para cada categoria de questão. O resultado será binário (Correto/Incorreto) para cada questão, e a acurácia global será a média não ponderada das categorias [2].

---

## 4. Fases de Implementação (Para Claude Code)

O Claude Code deve executar a implementação em 6 fases estritas. A arquitetura reutilizará a infraestrutura existente do projeto (Node.js, TypeScript, Zod, Vitest).

### Fase 1: Definição de Tipos e Schemas (Zod)

**Objetivo:** Criar os tipos base para o dataset de avaliação e para os resultados do LLM Judge.

- **Ação:** Criar `backend/src/evaluation/longmemeval/types.ts`.
- **Requisitos Técnicos:**
  - Definir enum `QuestionCategory` (Extraction, MultiSession, Temporal, Update, Abstention).
  - Definir interface `EvaluationInstance` contendo: `id`, `municipio`, `category`, `question`, `context_sessions` (array de dados simulando coletas passadas), e `expected_answer` (ground truth).
  - Definir schema Zod `LLMJudgeResponseSchema` com campos `is_correct` (boolean) e `reasoning` (string).

### Fase 2: Gerador de Dataset Sintético ESG

**Objetivo:** Construir um gerador determinístico de instâncias de teste baseadas no contexto dos 14 agentes.

- **Ação:** Criar `backend/src/evaluation/longmemeval/dataset-generator.ts`.
- **Requisitos Técnicos:**
  - Implementar funções geradoras para cada uma das 5 categorias mapeadas na Seção 2.1.
  - Utilizar dados mockados realistas de municípios de SC (ex: Joinville, Blumenau, Chapecó).
  - Gerar pelo menos 10 instâncias por categoria (total de 50 instâncias para o benchmark inicial).
  - O gerador deve produzir um arquivo JSON consolidado (`data/longmemeval_esg_dataset.json`).

### Fase 3: Motor de Avaliação (LLM Judge)

**Objetivo:** Implementar o avaliador automatizado usando a API da OpenAI/Anthropic.

- **Ação:** Criar `backend/src/evaluation/longmemeval/judge.ts`.
- **Requisitos Técnicos:**
  - Implementar a classe `LongMemEvalJudge`.
  - Criar prompts de sistema específicos para cada `QuestionCategory`, instruindo o LLM a ser rigoroso com números e fatos, ignorando formatações verbosas.
  - Integrar com o provedor de LLM configurado no projeto (utilizando o `LLMService` existente ou cliente direto).
  - Garantir parse estrito da resposta usando o schema Zod da Fase 1.

### Fase 4: Integração com o Sistema de Memória Atual

**Objetivo:** Conectar o dataset ao sistema de recomendação/memória do projeto para gerar as respostas a serem julgadas.

- **Ação:** Criar `backend/src/evaluation/longmemeval/runner.ts`.
- **Requisitos Técnicos:**
  - Para cada instância do dataset:
    1. Injetar o `context_sessions` no estado de memória temporário do agente/sistema.
    2. Submeter a `question` ao sistema.
    3. Capturar a `actual_answer`.
    4. Enviar `question`, `expected_answer` e `actual_answer` para o `LongMemEvalJudge`.
  - Garantir isolamento de contexto entre cada instância (limpar a memória antes de cada teste).

### Fase 5: Agregação de Métricas e Relatório

**Objetivo:** Consolidar os resultados binários em métricas de acurácia por categoria e global.

- **Ação:** Criar `backend/src/evaluation/longmemeval/reporter.ts`.
- **Requisitos Técnicos:**
  - Calcular a acurácia (%) por categoria.
  - Calcular a acurácia global (média não ponderada).
  - Gerar um relatório em Markdown detalhando os erros (falsos negativos) e os raciocínios do LLM Judge.
  - Salvar o relatório em `docs/evaluation/longmemeval_report_YYYYMMDD.md`.

### Fase 6: CLI e Scripts NPM

**Objetivo:** Expor o benchmark como um comando executável no monorepo.

- **Ação:** Atualizar `package.json` e criar script de entrada.
- **Requisitos Técnicos:**
  - Criar `backend/scripts/run-longmemeval.ts`.
  - Adicionar script no `package.json` do backend: `"eval:memory": "ts-node scripts/run-longmemeval.ts"`.
  - Garantir que o script aceite parâmetros como `--category` (para rodar testes específicos) e `--limit` (para testes rápidos).

---

## 5. Prompt de Execução para o Claude Code

Para iniciar a implementação, copie e cole o bloco abaixo no terminal do Claude Code na raiz do projeto:

```text
Você atuará como Engenheiro de Avaliação de IA. Sua missão é implementar o módulo LongMemEval-ESG no backend do projeto, seguindo estritamente a arquitetura SOTA baseada no Mastra OM, Hindsight e conceitos de roteamento do SelRoute.

Leia o documento `docs/PLANO_LONGMEMEVAL.md` para entender a fundamentação teórica e os requisitos de negócio.

Inicie a execução iterativa das Fases 1 a 6 descritas no documento.
Regras estritas:
1. Comece pela Fase 1 (Tipos Zod). Não avance para a próxima fase sem garantir que o código compila sem erros TypeScript.
2. Na Fase 2, garanta que os dados sintéticos dos agentes (DATASUS, SNIS, INEP, etc.) sejam coerentes com o domínio municipal de Santa Catarina.
3. Na Fase 3, o LLM Judge deve retornar JSON estruturado validado pelo Zod.
4. Utilize as bibliotecas já instaladas no projeto (Zod, Axios/Fetch, etc.). Não adicione novas dependências sem necessidade absoluta.
5. Após concluir a Fase 6, execute o comando `pnpm run eval:memory --limit 5` para provar que a pipeline ponta a ponta funciona e gera o relatório em Markdown.

Reporte seu progresso ao final de cada fase.
```

---

## Referências

[1] Backboard-io. (2026). _Backboard LongMemEval Benchmark — 93.4% accuracy on 500 questions_. GitHub. https://github.com/Backboard-io/Backboard-longmemEval-results
[2] Barnes, T. (2026). _Observational Memory: 95% on LongMemEval_. Mastra Research. https://mastra.ai/research/observational-memory
[3] Latimer, C. (2025). _Introducing Hindsight: Agent Memory That Works Like Human Memory_. Vectorize. https://vectorize.io/blog/introducing-hindsight-agent-memory-that-works-like-human-memory
[4] Sosa, J. (2026). _How I Built a Memory System That Scores 95.4% on LongMemEval_. Dev.to. https://dev.to/singularityjason/how-i-built-a-memory-system-that-scores-954-on-longmemeval-1-on-the-leaderboard-2md3
[5] McKee, M. (2026). _SelRoute: Query-Type-Aware Routing for Long-Term Conversational Memory Retrieval_. arXiv:2604.02431v1. https://arxiv.org/html/2604.02431v1
