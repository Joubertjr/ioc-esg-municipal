---
name: research
description: Pesquisa técnica focada para suportar decisões de arquitetura. Use antes de escolher bibliotecas, padrões ou abordagens técnicas.
allowed-tools: WebSearch, WebFetch, Read
model: claude-opus-4-6
effort: high
---
# Research — Decisão Técnica

## Argumento: `/research <tópico>`

## Execute

1. Busque fontes primárias (docs oficiais, RFCs, papers)
2. Busque comparações práticas recentes (2024-2026)
3. Verifique discussões da comunidade (GitHub issues, Stack Overflow)

## Produza relatório estruturado

```markdown
# Research: $ARGUMENTS
Data: [data]

## Contexto
[Por que precisamos desta decisão]

## Opções avaliadas

### Opção A: [nome]
**Prós:** [lista]
**Contras:** [lista]
**Uso no projeto:** [como se encaixaria]

### Opção B: [nome]
**Prós:** [lista]
**Contras:** [lista]
**Uso no projeto:** [como se encaixaria]

## Recomendação
**Escolha:** [opção recomendada]
**Motivo:** [justificativa técnica]
**Trade-offs aceitos:** [o que perdemos]

## Fontes
- [URL 1]
- [URL 2]
```

Salve em `docs/plans/research-$ARGUMENTS-$(date +%Y%m%d).md`
Se a pesquisa levar a uma decisão: crie ADR em `docs/decisions/`.
