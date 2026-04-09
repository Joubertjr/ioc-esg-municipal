# PLANO DE IMPLEMENTAÇÃO: Módulo LongMemEval para IOC ESG Municipal

**Data:** 09/04/2026
**Autor:** Manus AI (Estrategista)
**Destinatário:** Claude Code (Engenheiro Executor)
**Prioridade:** Alta
**Estimativa total:** 8-10 horas de desenvolvimento

---

## 1. Contexto Estratégico

O **LongMemEval** é um benchmark acadêmico publicado no ICLR 2025 [1] que avalia cinco capacidades cognitivas fundamentais de sistemas de IA em interações sustentadas: extração de informação, raciocínio multissessão, raciocínio temporal, atualização de conhecimento e abstenção. O paper original demonstrou que mesmo modelos comerciais avançados sofrem uma queda de acurácia de aproximadamente 30% quando submetidos a contextos longos com centenas de sessões, evidenciando que a memória de longo prazo é primariamente um desafio de engenharia de sistemas e não apenas de escala de contexto.

No projeto **IOC ESG Municipal**, operamos uma arquitetura multi-agente com 14 coletores de dados públicos (IBGE, SICONFI, DATASUS, INEP, INPE, ANA, ANATEL, ANEEL, SNIS, SISVAN, TSE, PNCP, Convênios, SNIS-RS) que alimentam um motor de cálculo para os 17 ODS da ONU. O sistema inclui um `memory-manager` baseado em Obsidian vault com três camadas de memória (registradores, cache e disco), um serviço de recomendações inteligentes (`recommendation_service.ts`) e um simulador de impacto FPM (`simulator_service.ts`). A complexidade deste pipeline exige que o sistema retenha e raciocine sobre dados de múltiplas fontes, múltiplos anos e múltiplas sessões de interação com o prefeito.

**Problema que este módulo resolve:** Atualmente não temos nenhuma forma automatizada de medir se o sistema "esquece" dados relevantes ao processar grandes volumes de informação municipal, se confunde a cronologia dos indicadores, ou se alucina respostas quando um coletor falha. O módulo LongMemEval-ESG será o nosso **teste de regressão cognitiva**.

---

## 2. Análise Técnica do LongMemEval Original

O repositório de referência [2] possui a seguinte estrutura relevante:

| Componente                        | Descrição                                                                                            | Adaptação para ESG                                            |
| --------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `data/longmemeval_s_cleaned.json` | Dataset com ~500 instâncias, ~40 sessões, ~115k tokens                                               | Gerar dataset equivalente com sessões de dados ESG municipais |
| `src/evaluation/evaluate_qa.py`   | Avaliador que usa GPT-4o como juiz                                                                   | Portar para TypeScript, usar nosso cliente LLM existente      |
| `src/retrieval/`                  | Módulos de RAG (BM25, contriever, openai)                                                            | Adaptar para testar nosso pipeline de recuperação de dados    |
| 6 tipos de questão                | single-session-user, single-session-assistant, preference, temporal, knowledge-update, multi-session | Mapear para cenários ESG concretos                            |

O dataset original simula conversas entre um usuário e um assistente pessoal. Para o nosso contexto, as "sessões" serão interações do prefeito com o sistema ESG, contendo dados reais de municípios catarinenses.

---

## 3. Arquitetura do Módulo LongMemEval-ESG

### 3.1. Estrutura de Diretórios

```text
backend/qa/
└── longmemeval/
    ├── README.md                    # Documentação do módulo
    ├── data/
    │   ├── esg_sessions.json        # Sessões simuladas com dados ESG reais
    │   ├── esg_questions.json       # Perguntas de avaliação por categoria
    │   └── golden_answers.json      # Respostas esperadas (ground truth)
    ├── src/
    │   ├── types.ts                 # Interfaces e schemas Zod
    │   ├── dataset_generator.ts     # Gerador de dataset a partir dos agentes reais
    │   ├── session_builder.ts       # Construtor de sessões no formato LongMemEval
    │   ├── evaluator.ts             # Motor de avaliação (LLM Judge)
    │   ├── metrics.ts               # Cálculo de métricas por dimensão cognitiva
    │   ├── reporter.ts              # Gerador de relatório JSON e console
    │   └── runner.ts                # Orquestrador principal (entry point)
    └── tests/
        ├── types.test.ts            # Testes dos schemas Zod
        ├── dataset_generator.test.ts # Testes do gerador
        ├── evaluator.test.ts        # Testes do avaliador (com mock LLM)
        └── metrics.test.ts          # Testes de cálculo de métricas
```

### 3.2. Mapeamento das 5 Dimensões Cognitivas para o Domínio ESG

A tabela abaixo detalha como cada dimensão do LongMemEval se traduz em cenários concretos do IOC ESG Municipal. Para cada dimensão, são fornecidos exemplos de perguntas que o dataset deve conter.

| Dimensão                    | Descrição Original                                | Cenário ESG                                                                    | Exemplo de Pergunta                                                                                                     |
| --------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| **Information Extraction**  | Recuperar fatos específicos de sessões anteriores | Recuperar indicadores ODS de um município em um ano específico                 | "Qual foi o score do ODS 4 (Educação) de Florianópolis em 2023?"                                                        |
| **Multi-Session Reasoning** | Sintetizar fragmentos de múltiplas sessões        | Cruzar dados de investimento (SICONFI) com resultados (INEP/DATASUS)           | "O aumento de 15% no investimento em educação de Joinville entre 2021-2023 resultou em melhoria no IDEB?"               |
| **Temporal Reasoning**      | Compreender cronologia e relevância temporal      | Ordenar recomendações e entender que dados mais recentes prevalecem            | "A recomendação de saneamento feita em março/2024 ainda é válida considerando os novos dados do SNIS de dezembro/2024?" |
| **Knowledge Updates**       | Sobrepor informações obsoletas com dados novos    | Prefeito informa conclusão de obra; sistema deve atualizar projeção            | "O prefeito informou que a ETE de Blumenau foi inaugurada em junho/2024. Qual é o novo score projetado do ODS 6?"       |
| **Abstention**              | Reconhecer limitações e evitar alucinações        | Admitir ausência de dados quando coletor falhou ou município não tem cobertura | "Qual é o índice de cobertura de esgoto de Bom Jardim da Serra?" (município sem dados SNIS)                             |

### 3.3. Formato do Dataset

O dataset seguirá o formato do LongMemEval original, adaptado para o contexto ESG. Cada instância contém um histórico de sessões e uma pergunta de avaliação:

```typescript
// Formato de uma sessão ESG
interface EsgSession {
  session_id: string; // "session_001"
  timestamp: string; // "2024-03-15T10:30:00Z"
  municipality_ibge: string; // "4205407" (Florianópolis)
  agent_source: string; // "datasus" | "ibge" | "siconfi" | etc.
  turns: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }>;
}

// Formato de uma pergunta de avaliação
interface EsgEvalQuestion {
  question_id: string;
  question_type: QuestionType; // "information_extraction" | "multi_session" | etc.
  question: string;
  answer: string; // Ground truth
  evidence_sessions: string[]; // IDs das sessões que contêm a evidência
  difficulty: "easy" | "medium" | "hard";
}
```

---

## 4. Plano de Execução para o Claude Code

> **Instrução principal:** Execute as fases abaixo em ordem sequencial. Cada fase deve resultar em código compilável (`pnpm tsc --noEmit` sem erros) e com testes passando antes de avançar para a próxima. Não quebre nenhum dos testes existentes do projeto.

### Fase 1: Fundação — Tipos e Schemas (Estimativa: 1h)

**Objetivo:** Criar a base tipada do módulo com validação Zod.

**Tarefas:**

1. Crie o diretório `backend/qa/longmemeval/` com toda a estrutura de subpastas (`data/`, `src/`, `tests/`).

2. Crie `backend/qa/longmemeval/src/types.ts` contendo:
   - Enum `QuestionType` com os 5 tipos: `information_extraction`, `multi_session_reasoning`, `temporal_reasoning`, `knowledge_update`, `abstention`.
   - Schema Zod `EsgSessionSchema` para validar sessões (campos: `session_id`, `timestamp`, `municipality_ibge`, `agent_source`, `turns`).
   - Schema Zod `EsgEvalQuestionSchema` para validar perguntas (campos: `question_id`, `question_type`, `question`, `answer`, `evidence_sessions`, `difficulty`).
   - Schema Zod `EvaluationResultSchema` para o resultado da avaliação (campos: `question_id`, `question_type`, `predicted_answer`, `expected_answer`, `is_correct`, `judge_reasoning`, `latency_ms`).
   - Interface `BenchmarkReport` com métricas agregadas por dimensão.

3. Crie `backend/qa/longmemeval/tests/types.test.ts` com testes unitários Vitest que validam os schemas com dados válidos e inválidos.

**Critério de aceite:** `pnpm vitest run backend/qa/longmemeval/tests/types.test.ts` passa sem erros.

**Referência de código existente:** Consulte `shared/types/domain/ods.ts` e `shared/types/agents/*.types.ts` para seguir os padrões de tipagem do projeto.

---

### Fase 2: Gerador de Dataset ESG (Estimativa: 2h)

**Objetivo:** Criar um gerador que transforma dados reais dos agentes coletores em sessões no formato LongMemEval.

**Tarefas:**

1. Crie `backend/qa/longmemeval/src/session_builder.ts`:
   - Função `buildSessionFromAgent(agentName: string, ibgeCode: string, data: unknown): EsgSession` que recebe os dados brutos de um agente e formata como uma sessão de diálogo.
   - Para cada agente, simule uma interação onde o "usuário" pede dados e o "assistente" responde com os indicadores reais.
   - Use os 14 agentes existentes como fonte: `ibge`, `siconfi`, `datasus`, `inep`, `inpe`, `ana`, `anatel`, `aneel`, `snis`, `sisvan`, `tse`, `pncp`, `convenios`, `snis_rs`.

2. Crie `backend/qa/longmemeval/src/dataset_generator.ts`:
   - Função principal `generateEsgDataset(ibgeCodes: string[]): Promise<{ sessions: EsgSession[], questions: EsgEvalQuestion[] }>`.
   - Para cada município, chame os coletores existentes (importando de `backend/agents/*/`) e construa sessões.
   - Gere automaticamente perguntas de cada tipo com base nos dados coletados.
   - Gere as golden answers (ground truth) a partir dos dados reais.
   - Use pelo menos 3 municípios catarinenses como base: Florianópolis (`4205407`), Joinville (`4209102`), Blumenau (`4202404`).

3. Crie `backend/qa/longmemeval/tests/dataset_generator.test.ts`:
   - Mock dos agentes coletores (não chame APIs reais nos testes).
   - Valide que o dataset gerado passa nos schemas Zod.
   - Valide que há pelo menos 1 pergunta de cada tipo.

**Critério de aceite:** O gerador produz um dataset válido com pelo menos 25 perguntas distribuídas pelas 5 dimensões.

**Referência de código existente:** Consulte `backend/agents/ibge/ibge_collector.ts` e `backend/services/ods/ods_score_service.ts` para entender como os dados fluem.

---

### Fase 3: Motor de Avaliação (Estimativa: 2h)

**Objetivo:** Implementar o avaliador LLM Judge que compara respostas do sistema com o ground truth.

**Tarefas:**

1. Crie `backend/qa/longmemeval/src/evaluator.ts`:
   - Classe `LongMemEvaluator` com método `evaluate(question: EsgEvalQuestion, predictedAnswer: string): Promise<EvaluationResult>`.
   - Use um cliente HTTP para chamar a API do LLM (OpenAI ou Anthropic). Reutilize o padrão de `axios` já presente no projeto.
   - Implemente o prompt de avaliação baseado no paper original do LongMemEval. O prompt deve instruir o LLM juiz a comparar a resposta prevista com a esperada e retornar `correct` ou `incorrect` com justificativa.
   - Implemente retry com backoff exponencial (3 tentativas) para resiliência.
   - A variável de ambiente `OPENAI_API_KEY` ou `ANTHROPIC_API_KEY` deve ser lida do `.env`.

2. O prompt do juiz deve seguir este template (adapte do paper [1]):

```text
You are an impartial judge evaluating the quality of an AI assistant's answer about Brazilian municipal ESG data.

Question: {question}
Expected Answer: {expected_answer}
Assistant's Answer: {predicted_answer}

Evaluate whether the assistant's answer is correct. Consider:
- For factual questions: the answer must contain the correct numerical value or fact.
- For reasoning questions: the logic must be sound and the conclusion correct.
- For abstention questions: the assistant should acknowledge lack of data rather than fabricate.

Respond with ONLY a JSON object:
{"correct": true/false, "reasoning": "brief explanation"}
```

3. Crie `backend/qa/longmemeval/tests/evaluator.test.ts`:
   - Mock do cliente HTTP/LLM.
   - Teste com resposta correta, incorreta e caso de abstenção.

**Critério de aceite:** Testes do evaluator passam com mocks. O evaluator é capaz de processar os 5 tipos de questão.

---

### Fase 4: Métricas e Relatório (Estimativa: 1h)

**Objetivo:** Calcular métricas agregadas por dimensão cognitiva e gerar relatório.

**Tarefas:**

1. Crie `backend/qa/longmemeval/src/metrics.ts`:
   - Função `calculateMetrics(results: EvaluationResult[]): BenchmarkReport`.
   - Calcule: acurácia global, acurácia por `QuestionType`, acurácia por dificuldade, latência média.
   - Identifique as dimensões mais fracas (score < 70%) como "áreas de atenção".

2. Crie `backend/qa/longmemeval/src/reporter.ts`:
   - Função `generateConsoleReport(report: BenchmarkReport): void` que imprime uma tabela formatada no console.
   - Função `saveJsonReport(report: BenchmarkReport, outputPath: string): Promise<void>` que salva em `docs/reports/memory_benchmark_YYYY-MM-DD.json`.

3. Crie `backend/qa/longmemeval/tests/metrics.test.ts`:
   - Teste com resultados simulados para validar os cálculos.

**Critério de aceite:** As métricas são calculadas corretamente e o relatório JSON é gerado.

---

### Fase 5: Runner e Integração (Estimativa: 1.5h)

**Objetivo:** Criar o orquestrador principal e integrar com o `package.json`.

**Tarefas:**

1. Crie `backend/qa/longmemeval/src/runner.ts`:
   - Entry point que orquestra: gerar dataset → injetar sessões no contexto → coletar respostas → avaliar → gerar relatório.
   - Aceite flags via CLI: `--ibge-codes`, `--question-types`, `--dry-run`, `--output-dir`.
   - No modo `--dry-run`, gere apenas o dataset sem chamar o LLM juiz (útil para validar o dataset).

2. Adicione o script no `package.json` raiz:

```json
{
  "scripts": {
    "qa:memory": "tsx backend/qa/longmemeval/src/runner.ts",
    "qa:memory:dry": "tsx backend/qa/longmemeval/src/runner.ts --dry-run"
  }
}
```

3. Crie `backend/qa/longmemeval/README.md` com documentação de uso:
   - Como rodar o benchmark.
   - Como interpretar os resultados.
   - Como adicionar novas perguntas ao dataset.

**Critério de aceite:** `pnpm qa:memory:dry` executa sem erros e gera o dataset. `pnpm qa:memory` (com API key configurada) executa o benchmark completo.

---

### Fase 6: Documentação e CI (Estimativa: 0.5h)

**Objetivo:** Integrar o módulo na documentação e no pipeline de CI.

**Tarefas:**

1. Crie um ADR em `docs/decisions/ADR-XXX-longmemeval-benchmark.md` (use o próximo número sequencial) documentando:
   - Contexto: necessidade de testar regressão cognitiva dos agentes.
   - Decisão: adotar LongMemEval adaptado para ESG.
   - Consequências: custo de API para o LLM juiz, necessidade de manutenção do dataset.

2. Atualize `CLAUDE.md` adicionando na seção de comandos:

```markdown
## QA de Memória (LongMemEval-ESG)

- `pnpm qa:memory` — roda o benchmark completo de memória de longo prazo
- `pnpm qa:memory:dry` — gera apenas o dataset sem avaliar (validação)
- Relatórios salvos em `docs/reports/memory_benchmark_*.json`
```

3. Atualize `docs/PROJECT_STATE.md` registrando o novo módulo.

4. Adicione um teste de sanidade em `tests/integration/qa/longmemeval.test.ts` que valida que o dataset pode ser gerado e que os schemas estão corretos (sem chamar APIs externas).

**Critério de aceite:** Toda a documentação está atualizada. O teste de sanidade passa no CI.

---

## 5. Dependências e Pré-requisitos

O módulo deve reutilizar ao máximo as dependências já existentes no projeto. A tabela abaixo lista o que já está disponível e o que pode ser necessário adicionar.

| Necessidade          | Já existe no projeto? | Pacote/Módulo                                                   |
| -------------------- | --------------------- | --------------------------------------------------------------- |
| Validação de schemas | Sim                   | `zod` (^3.22.4)                                                 |
| Cliente HTTP         | Sim                   | `axios` (^1.6.2)                                                |
| Logger               | Sim                   | `winston` (^3.11.0)                                             |
| Runner TypeScript    | Verificar             | `tsx` (pode precisar instalar como devDependency)               |
| Testes               | Sim                   | `vitest` (já configurado)                                       |
| Formatação de datas  | Sim                   | `date-fns` (^2.30.0)                                            |
| Cliente LLM (OpenAI) | **Não**               | `openai` (instalar como devDependency) — ou usar `axios` direto |

**Decisão recomendada sobre o cliente LLM:** Use `axios` diretamente para chamar a API da OpenAI, evitando uma nova dependência. O payload é simples (chat completions) e não justifica o SDK completo. Se o projeto já tiver planos de usar o SDK OpenAI em outros módulos, instale-o como dependência compartilhada.

---

## 6. Regras de Ouro

1. **TypeScript Strict.** Use Zod para validar toda entrada. Nenhuma tipagem `any`. Siga o `tsconfig.json` do projeto.

2. **Isolamento total.** O benchmark nunca deve escrever no banco de dados de produção. Use dados em memória ou arquivos JSON.

3. **Reutilização.** Importe os coletores existentes de `backend/agents/*/` para gerar dados reais. Não duplique lógica.

4. **Testes primeiro.** Cada arquivo `.ts` em `src/` deve ter um correspondente `.test.ts` em `tests/`. Mínimo de 80% de cobertura.

5. **Custo controlado.** O LLM juiz será chamado apenas no modo completo (`qa:memory`), nunca no CI. O modo `--dry-run` não faz chamadas externas.

6. **Não quebre nada.** Verifique que todos os testes existentes continuam passando após cada fase: `pnpm test`.

---

## 7. Prompt Inicial para o Claude Code

Copie e cole o bloco abaixo como primeiro prompt ao Claude Code para iniciar a implementação:

```
Leia o arquivo docs/PLANO_LONGMEMEVAL.md integralmente. Este é o plano de implementação do módulo LongMemEval-ESG para o projeto IOC ESG Municipal.

Sua missão: implementar o módulo seguindo as 6 fases descritas no plano, em ordem sequencial. Cada fase deve resultar em código compilável e com testes passando.

Comece pela Fase 1 (Fundação — Tipos e Schemas). Antes de codificar:
1. Leia backend/services/ods/ods_score_service.ts para entender o fluxo de dados.
2. Leia shared/types/domain/ods.ts para seguir os padrões de tipagem.
3. Leia backend/agents/ibge/ibge_collector.ts como exemplo de agente coletor.

Depois, crie o diretório backend/qa/longmemeval/ e implemente types.ts com os schemas Zod conforme especificado no plano. Crie os testes correspondentes e valide que passam.

Reporte: feito / em progresso / próximo passo exato.
```

---

## Referências

[1]: Wu, X. et al. "LongMemEval: Benchmarking Chat Assistants on Long-Term Interactive Memory." ICLR 2025. https://arxiv.org/abs/2410.10813

[2]: Repositório oficial LongMemEval. https://github.com/xiaowu0162/LongMemEval

[3]: Dataset HuggingFace. https://huggingface.co/datasets/xiaowu0162/longmemeval-cleaned
