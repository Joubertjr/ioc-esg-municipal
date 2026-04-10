# Comando: /monthly-reflection

Sintetiza todos os `daily/YYYY-MM-*.md` do mês corrente (ou mês passado se
executado no início do mês) em um documento de reflexão consolidado,
persistido em `~/obsidian-vault/ioc-esg-municipal/long-term/reflections/YYYY-MM.md`.

Inspiração: Generative Agents (Park et al, UIST 2023) — agentes periodicamente
refletem sobre memórias recentes, pontuando por **importância + recência +
relevância**, e geram insights de nível mais alto que servem como memórias
semânticas no futuro.

## Execute:

Siga este roteiro exato usando o agente `memory-manager`:

````
Use o agente memory-manager para executar uma REFLEXÃO MENSAL.

Passos:

1. Determine o mês-alvo (YYYY-MM):
   - Se o argumento $ARGUMENTS for fornecido (ex: "2026-03"), use-o.
   - Senão, se hoje for dia <=5, use o mês anterior.
   - Senão, use o mês corrente.

2. Leia TODOS os arquivos em ~/obsidian-vault/ioc-esg-municipal/daily/YYYY-MM-*.md
   do mês-alvo. Se não houver arquivos, pare e reporte.

3. Extraia em memória:
   - Commits mencionados (hash curto + mensagem)
   - Decisões arquiteturais tomadas
   - Bugs resolvidos e sua causa-raiz
   - Feedback do usuário (textualmente)
   - Padrões repetidos em >=3 dias distintos
   - Métricas citadas (cobertura de testes, perf, uptime)
   - Referências a ADRs, gotchas novos, lessons-learned

4. Pontue cada item (0-10) em três dimensões:
   - IMPORTÂNCIA: quanto afeta o produto ou o fluxo de trabalho
   - RECÊNCIA: decaimento exponencial (dia final do mês = 10, dia 1 = 3)
   - RELEVÂNCIA: alinhamento com objetivos de Fase atual (ler PROJECT_STATE.md)
   Score final = (2*importância + recência + relevância) / 4

5. Sintetize os top-15 itens em um documento estruturado:

   ```markdown
   ---
   tags: [reflection, monthly, long-term]
   month: YYYY-MM
   generated: YYYY-MM-DD
   source_dailies: N
   format_version: 1
   ---

   # Reflexão Mensal — YYYY-MM

   ## Resumo executivo (5 linhas)

   ## Conquistas (ordenadas por impacto)
   1. ...

   ## Padrões observados
   - Padrão X aparece em N dias → possível refactor / gotcha / ADR

   ## Decisões arquiteturais
   - Link para ADRs criados no mês

   ## Aprendizados de alto nível
   Insights que podem virar lessons-learned.md ou CLAUDE.md.

   ## Métricas (quando disponíveis)
   | Métrica | Início do mês | Fim do mês | Delta |

   ## Gotchas adicionados
   Lista de entradas novas em long-term/gotchas.md neste mês.

   ## Bugs resolvidos
   Causa-raiz + link para commit.

   ## Feedback do usuário (textual)
   > citação

   ## Próximo mês — hipóteses
   O que a reflexão sugere para priorizar.
````

6. Salve em ~/obsidian-vault/ioc-esg-municipal/long-term/reflections/YYYY-MM.md.
   Crie o diretório 'reflections' se não existir.

7. Adicione uma linha em ~/obsidian-vault/ioc-esg-municipal/long-term/lessons-learned.md:
   "- [YYYY-MM] Reflexão mensal consolidada → reflections/YYYY-MM.md"

8. Reporte: quantos dailies foram lidos, top-3 insights, caminho do arquivo gerado.

```

## Argumentos

- `/monthly-reflection` — mês corrente (ou anterior se dia <=5)
- `/monthly-reflection 2026-03` — mês específico
- `/monthly-reflection all` — todos os meses desde o início (bootstrap único)

## Quando usar

- Dia 1-5 de cada mês, automaticamente ou manualmente
- Antes de fechar uma Fase (Fase 4 → Fase 5) para consolidar aprendizados
- Após incidentes grandes, para capturar causa-raiz no nível certo

## Quando NÃO usar

- Meses incompletos (reflexão prematura dilui sinal)
- Quando não há dailies suficientes (>=5 dias) — pare e reporte ao usuário
```
