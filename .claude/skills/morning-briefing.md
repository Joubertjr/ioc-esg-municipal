---
name: morning-briefing
description: Standup autônomo diário. Configure como Desktop scheduled task às 9h ou /loop 24h. Analisa o estado do projeto e propõe prioridades do dia.
allowed-tools: Read, Bash(git *), Bash(pnpm test *)
model: claude-sonnet-4-6
---
# Morning Briefing — IOC ESG Municipal

## Analise e produza relatório

```bash
git log --oneline --since="24 hours ago"
git branch -a --sort=-committerdate | head -5
pnpm test 2>&1 | tail -5
```

## Relatório de saída

```markdown
# Briefing IOC ESG — [DATA]

## Status: [🟢 Saudável | 🟡 Atenção | 🔴 Crítico]

## Desenvolvido nas últimas 24h
- [commits e o que foi feito]

## Estado dos testes
- [N passando | N falhando]
- [nome dos testes falhando]

## Prioridades de hoje (ordem)
1. [mais urgente com justificativa]
2. [segundo]
3. [terceiro]

## Bloqueadores
[algo que precisa de decisão humana]

## Próximos marcos
[o que está próximo de concluir]
```

Salve em `.claude/logs/briefing-$(date +%Y%m%d).md`
