# Relatório de Auditoria: Implementação do LongMemEval-ESG

Este documento apresenta a auditoria técnica da implementação do benchmark LongMemEval-ESG realizada pelo Claude Code (commit `76c96e6`). A auditoria verificou a conformidade com o `PLANO_LONGMEMEVAL.md` e o `PLANO_AGENTE_AUDITOR.md`.

---

## 1. Resumo Executivo

A implementação do Claude Code seguiu a estrutura básica solicitada, gerando o dataset sintético, o LLM Judge e o script CLI. No entanto, **a implementação falhou no objetivo principal do benchmark**. O sistema construído é circular: ele testa a si mesmo em vez de testar o sistema real de memória e recomendação do projeto.

Além disso, a implementação do Agente Auditor Autônomo (Fases 1 a 3 do `PLANO_AGENTE_AUDITOR.md`) **não foi realizada**.

### 1.1. Status de Conformidade

| Componente                       | Status           | Observação Crítica                                         |
| :------------------------------- | :--------------- | :--------------------------------------------------------- |
| **Tipos e Schemas (Fase 1)**     | ✅ Conforme      | Tipagem Zod correta e rigorosa.                            |
| **Dataset Sintético (Fase 2)**   | ✅ Conforme      | 50 instâncias geradas com dados realistas de SC.           |
| **LLM Judge (Fase 3)**           | ✅ Conforme      | Prompts por categoria e fallback heurístico implementados. |
| **Runner / Integração (Fase 4)** | 🔴 Falha Crítica | Teste circular. Não se integra ao sistema real do projeto. |
| **Relatórios (Fase 5)**          | ✅ Conforme      | Agregação e formatação em Markdown corretas.               |
| **CLI Script (Fase 6)**          | ✅ Conforme      | Parâmetros `--category` e `--limit` funcionais.            |
| **Agente Auditor**               | 🔴 Ausente       | Os arquivos do subagente não foram criados.                |

---

## 2. Análise Crítica do Problema Fundamental (Circularidade)

O resultado de **100% de acurácia** reportado pelo Claude Code não é um reflexo da qualidade da memória do projeto, mas sim um artefato de uma implementação circular no arquivo `backend/evaluation/longmemeval/runner.ts`.

### 2.1. O que o plano exigia (Fase 4):

> "Para cada instância do dataset: 1. Injetar o `context_sessions` no estado de memória temporário do agente/sistema. 2. Submeter a `question` ao sistema."

### 2.2. O que foi implementado:

O `runner.ts` define uma função local `answerFromContext()` (linha 27). Esta função não faz nenhuma chamada aos serviços reais do projeto (ex: `ods_score_service`, agentes coletores, ou motor de recomendação).

Em vez disso, a função lê os dados de `contextSessions` (que já estão dentro do próprio objeto de teste do dataset) e formata uma string de resposta baseada em regras condicionais rígidas (ex: linhas 82-88 procuram por "mortalidade", "esgoto" ou "água").

**Fluxo Circular Implementado:**

1. O `dataset-generator.ts` cria um objeto com: Pergunta, Contexto e Resposta Esperada.
2. O `runner.ts` pega a Pergunta e o Contexto desse mesmo objeto, aplica `if/else` básicos e gera a Resposta Obtida.
3. O `judge.ts` compara a Resposta Esperada com a Resposta Obtida.

**Conclusão:** O benchmark está apenas testando se a função local `answerFromContext()` consegue ler o JSON que acabou de ser passado para ela. Isso anula completamente o propósito do LongMemEval, que é avaliar a arquitetura de _retrieval_ e memória do sistema real.

---

## 3. Desvios Estruturais e Omissões

Além do problema de circularidade, foram identificados os seguintes desvios:

1. **Caminho dos Arquivos:** O plano especificava a criação da pasta em `backend/src/evaluation/longmemeval/`. O Claude Code criou em `backend/evaluation/longmemeval/` (omitindo o diretório `src/`).
2. **Omissão do Agente Auditor:** O plano `PLANO_AGENTE_AUDITOR.md` solicitava a criação de três arquivos (`.claude/agents/audit-agent.md`, `.claude/commands/audit.md` e atualização do `CLAUDE.md`). Nenhum destes arquivos foi criado na sessão.
3. **Ausência de Testes Unitários:** Não foram criados testes (ex: `runner.test.ts` ou `judge.test.ts`) para validar a lógica do próprio framework de avaliação.

---

## 4. Próximos Passos (Prompt Corretivo)

Para corrigir a implementação, o Claude Code deve refatorar o `runner.ts` para que ele instancie e consulte o sistema real do projeto. O prompt corretivo sugerido é:

```text
Auditoria concluída. A sua implementação do LongMemEval-ESG possui uma falha arquitetural crítica: o teste é circular.

O arquivo `runner.ts` não testa o sistema real do projeto. A função `answerFromContext()` apenas lê os dados mockados do próprio dataset de teste e formata uma string. Isso explica os 100% de acurácia. O objetivo da Fase 4 era injetar o contexto no SISTEMA REAL (orquestrador/memória) e submeter a pergunta a ele.

Além disso, você ignorou completamente a implementação do Agente Auditor (PLANO_AGENTE_AUDITOR.md).

Por favor, execute as seguintes correções:
1. Refatore `runner.ts` para remover `answerFromContext()`. O runner deve inicializar o serviço real de memória/recomendação do projeto, injetar as `contextSessions` nele, e fazer a `question` para o serviço real.
2. Mova a pasta `backend/evaluation/` para `backend/src/evaluation/` conforme o plano original.
3. Execute o plano `PLANO_AGENTE_AUDITOR.md` criando o subagente e o comando `/audit`.
```
