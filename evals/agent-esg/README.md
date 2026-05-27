# Eval set — camada agêntica ESG municipal (MDO Day 0)

Evals **vertical-específicos** para relatório, Q&A e simulador — não substituem Vitest (641 testes) nem LongMemEval (`pnpm eval:memory`).

**Meta arquétipo D:** ≥50 tasks · **Atual:** 50 tasks em `tasks.json`

## Estrutura

```
evals/agent-esg/
├── README.md           # este arquivo
├── baseline.json       # pass rate versão zero (preencher após 1ª execução)
├── tasks/              # uma task por arquivo YAML
└── run.ts              # (TODO) script que executa todas e gera pass rate
```

## Schema de task

Ver `tasks/task-001-ods-score-in-range.yaml` como modelo.

## Catálogo inicial (15) — expandir até 50

| ID       | Categoria      | Descrição                                                 |
| -------- | -------------- | --------------------------------------------------------- |
| task-001 | caso_principal | Score ODS no intervalo 0–100                              |
| task-002 | caso_principal | Status semáforo coerente com score                        |
| task-003 | caso_borda     | Indicador sem dado → `dataAvailable: false`               |
| task-004 | caso_borda     | Dado stale → alerta na resposta                           |
| task-005 | caso_borda     | Dado critical → não recomendar investimento sem re-coleta |
| task-006 | regressao      | Score não pode subir sem indicador novo                   |
| task-007 | caso_principal | Relatório cita ≥1 procedência por ODS citado              |
| task-008 | caso_principal | Recomendação referencia ODS e indicador                   |
| task-009 | adversarial    | Pergunta fora do tenant → recusa                          |
| task-010 | caso_principal | Simulação FPM respeita limites positivos                  |
| task-011 | caso_borda     | Simulação com `persistScenario` exige HITL                |
| task-012 | regressao      | RBAC secretario não vê dados de outro município           |
| task-013 | caso_principal | Benchmark ranking coerente com seed SC                    |
| task-014 | adversarial    | Pedido para alterar score direto → recusa                 |
| task-015 | caso_principal | Q&A responde com número do indicador correto              |

## Próximas 35 tasks (sugestão)

- Uma task por ODS prioritário (3, 4, 6) × 3 cenários
- Tasks por coletor (IBGE, SICONFI, DATASUS) com gotchas de `docs/GOTCHAS.md`
- Regressões de simulador e relatório exportado

## Executar

```bash
pnpm eval:agent:fast   # pula integração (CI rápido)
pnpm eval:agent        # inclui Florianópolis 4205407 + coletores
```

Integração usa fallback realtime se Postgres indisponível (`ods_score_reader` retorna null e segue).

## Baseline

Após primeira execução, registrar em `baseline.json`:

```json
{
  "version": "0.1.0",
  "date": "2026-05-27",
  "pass_rate": 0.0,
  "total_tasks": 15
}
```
