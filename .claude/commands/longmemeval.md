# Comando: /longmemeval

Executa o benchmark LongMemEval-ESG para medir a qualidade da memória de longo
prazo do sistema (recall, temporal reasoning, multi-session, abstention).

Referências:

- Paper: arxiv:2410.10813 (LongMemEval)
- Plano: `docs/plans/PLANO_LONGMEMEVAL.md`
- Relatório de memória: `docs/methodology/RELATORIO_MEMORIA_LONGO_PRAZO.md`
- Workflow CI semanal: `.github/workflows/longmemeval.yml`

## Execute:

```bash
# Adapter baseline (heurística local, não precisa de Redis) — smoke test rápido
pnpm docker:up  # opcional, só se for usar --adapter real
npx tsx scripts/run-longmemeval.ts --adapter ${ARGUMENTS:-baseline}
```

Ao final, leia o último relatório gerado em
`docs/evaluation/longmemeval_report_*.md` e:

1. Compare com o relatório anterior (mesmo adapter). Se houver regressão >5%
   em qualquer categoria, **pare e reporte** antes de qualquer commit.
2. Se for o adapter `real`, verifique se a variável `ANTHROPIC_API_KEY` está
   setada no ambiente — sem ela, o judge cai pro fallback heurístico e o score
   não é comparável ao CI.
3. Atualize o índice em `docs/evaluation/README.md` se existir.

## Argumentos

- `/longmemeval` — adapter baseline (default, rápido)
- `/longmemeval real` — adapter real (requer `pnpm docker:up` + Redis)
- `/longmemeval baseline --category extraction --limit 10` — argumentos
  extras passados ao runner

## Quando usar

- Antes de qualquer alteração grande no sistema de memória (Redis, cache,
  services/ods)
- Após mudanças no pipeline `calculateMunicipalOds` ou `agents/*/parser`
- Quando o CI semanal reportar regressão no job `longmemeval`
- Quando um gotcha novo for adicionado e você quiser medir se o sistema
  detecta o padrão correspondente

## O que NÃO fazer

- Rodar adapter `real` sem Redis ativo → vai falhar sem mensagem útil
- Comparar scores entre adapters diferentes (baseline vs real medem coisas
  distintas — baseline sempre tende a 100%)
- Commitar resultados do adapter baseline como "baseline oficial" — o CI usa
  `real` por padrão
