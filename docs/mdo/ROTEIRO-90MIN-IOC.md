# Roteiro 90 min — MDO aplicada ao IOC ESG (resumo Carla → Prefeito)

> Leitura orientada. Caso completo fictício: `metodologia-mdo/EXEMPLO-END-TO-END.md` (Carla/JuriBR).

## Paralelo Carla → IOC ESG

| Carla (JuriBR)                   | IOC ESG Municipal                                      |
| -------------------------------- | ------------------------------------------------------ |
| Advogada solo, vertical jurídico | Founder solo, vertical GovTech ESG                     |
| Cliente piloto com nome          | **Florianópolis** (`4205407`)                          |
| Glossário ≥10 termos             | `docs/mdo/glossario.md` (15 termos)                    |
| Schemas contrato                 | `backend/services/agent/schemas.ts` (Zod)              |
| Evals vertical                   | `evals/agent-esg/` (`pnpm eval:agent`)                 |
| Tool-scope                       | `docs/mdo/tool_scope.md` (6 ferramentas)               |
| Não multi-agent Day 0            | Coletores determinísticos + 1 workflow agêntico futuro |

## Tese Revisada (1 parágrafo)

Nascer com **contratos tipados + evals do vertical + glossário**. Semantic layer / KG / ontology só com **gatilho objetivo** (G-01 já parcial: 14 APIs). IOC já nasceu com tipos e 641 testes; a MDO formaliza a **camada agêntica** (relatório, Q&A, recomendações).

## ODS prioritários piloto (semana 3–8 do MVP)

1. **ODS 3** — Saúde (DATASUS, mortalidade, APS)
2. **ODS 4** — Educação (IDEB / INEP)
3. **ODS 6** — Saneamento (SNIS)

## Próximas leituras (se tiver tempo)

1. `metodologia-mdo/01-comeco-rapido/00-tese-revisada.md` (10 min)
2. `metodologia-mdo/06-decisao-arquitetural/05-sub-sadr-D-infra.md` (15 min)
3. `docs/GOTCHAS.md` — gotchas das APIs (10 min)
