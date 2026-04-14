# Comando: /monthly-reflection

Sintetiza todos os `daily/YYYY-MM-*.md` do mês corrente (ou mês passado se
executado no início do mês) em um documento de reflexão consolidado,
persistido em `~/obsidian-vault/ioc-esg-municipal/long-term/reflections/YYYY-MM.md`.

Inspiração: Generative Agents (Park et al, UIST 2023) — agentes periodicamente
refletem sobre memórias recentes, pontuando por **importância + recência +
relevância**, e geram insights de nível mais alto que servem como memórias
semânticas no futuro.

## Execute

Invoque o agente `memory-manager` passando o roteiro abaixo. Substitua
`$ARGUMENTS` se tiver sido fornecido.

### Roteiro da reflexão mensal

1. **Determine o mês-alvo (`YYYY-MM`):**
   - Se `$ARGUMENTS` for fornecido (ex.: `2026-03`), use-o.
   - Senão, se hoje for dia `<=5`, use o mês anterior.
   - Senão, use o mês corrente.

2. **Leia os dailies do mês:** todos os arquivos em
   `~/obsidian-vault/ioc-esg-municipal/daily/YYYY-MM-*.md`. Se não houver
   nenhum, pare e reporte ao usuário.

3. **Extraia:**
   - Commits mencionados (hash curto + mensagem).
   - Decisões arquiteturais tomadas.
   - Bugs resolvidos e sua causa-raiz.
   - Feedback do usuário (textualmente).
   - Padrões repetidos em `>=3` dias distintos.
   - Métricas citadas (cobertura de testes, perf, uptime).
   - Referências a ADRs, gotchas novos, lessons-learned.

4. **Pontue cada item (0-10) em três dimensões:**
   - `IMPORTÂNCIA`: quanto afeta o produto ou o fluxo de trabalho.
   - `RECÊNCIA`: decaimento linear (dia final do mês = 10, dia 1 = 3).
   - `RELEVÂNCIA`: alinhamento com a Fase atual (ler `ESTADO_ATUAL_SC.md`).
   - Score final = `(2*importância + recência + relevância) / 4`.

5. **Sintetize os top-15 itens** num documento estruturado (template abaixo).

6. **Salve em** `~/obsidian-vault/ioc-esg-municipal/long-term/reflections/YYYY-MM.md`.
   Crie o diretório `reflections/` se não existir.

7. **Atualize o índice** em `long-term/lessons-learned.md` adicionando uma
   linha: `- [YYYY-MM] Reflexão mensal consolidada → reflections/YYYY-MM.md`.

8. **Reporte ao usuário:** quantos dailies foram lidos, top-3 insights, e o
   caminho do arquivo gerado.

### Template do arquivo de reflexão

Salve em `long-term/reflections/YYYY-MM.md`. Use frontmatter com
`format_version: 1`, `month`, `generated`, `source_dailies`, `tags`.

Seções obrigatórias:

- `# Reflexão Mensal — YYYY-MM`
- `## Resumo executivo` (no máximo 5 linhas)
- `## Conquistas` (ordenadas por impacto)
- `## Padrões observados` (padrão X em N dias → refactor / gotcha / ADR)
- `## Decisões arquiteturais` (link para ADRs criados no mês)
- `## Aprendizados de alto nível` (insights que podem virar lessons-learned)
- `## Métricas` (tabela com início/fim/delta quando disponível)
- `## Gotchas adicionados` (lista de entradas novas em `long-term/gotchas.md`)
- `## Bugs resolvidos` (causa-raiz + link para commit)
- `## Feedback do usuário` (citações textuais)
- `## Próximo mês — hipóteses` (sugestões de priorização)

## Argumentos

- `/monthly-reflection` — mês corrente (ou anterior se dia `<=5`).
- `/monthly-reflection 2026-03` — mês específico.
- `/monthly-reflection all` — todos os meses desde o início (bootstrap único).

## Quando usar

- Dia 1-5 de cada mês, automaticamente ou manualmente.
- Antes de fechar uma Fase (Fase 4 → Fase 5) para consolidar aprendizados.
- Após incidentes grandes, para capturar causa-raiz no nível certo.

## Quando NÃO usar

- Meses incompletos (reflexão prematura dilui sinal).
- Quando não há dailies suficientes (`>=5` dias) — pare e reporte ao usuário.
