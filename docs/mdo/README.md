# MDO no IOC ESG Municipal

Aplicação da [Metodologia MDO v0.1.5](https://github.com/Joubertjr/metodologia-mdo) à camada agêntica do produto.

| Documento                                                | Conteúdo                                   |
| -------------------------------------------------------- | ------------------------------------------ |
| [CLASSIFICACAO-MDO.md](./CLASSIFICACAO-MDO.md)           | Arquétipo D regulado, princípios, gatilhos |
| [DAY0-CHECKLIST.md](./DAY0-CHECKLIST.md)                 | 5 ações universais                         |
| [glossario.md](./glossario.md)                           | 15 termos operacionais                     |
| [tool_scope.md](./tool_scope.md)                         | 6 ferramentas + HITL                       |
| [ROTEIRO-90MIN-IOC.md](./ROTEIRO-90MIN-IOC.md)           | Resumo tese + paralelo Carla → prefeito    |
| [hitl-queue.md](./hitl-queue.md)                         | Gatilhos HITL (G-HITL-IOC-01…06)           |
| [PLANO-ENTREGA-COMPLETO.md](./PLANO-ENTREGA-COMPLETO.md) | Plano mestre pós-PMF                       |

**Código Day 0:** `backend/services/agent/` · **Evals:** `evals/agent-esg/`

**APIs (determinísticas, contrato MDO):**

- `GET /api/agent/reports/:ibgeCode/executive`
- `POST /api/agent/query`
- `POST /api/agent/hitl/check`

```bash
pnpm eval:agent:fast   # CI — domínio sem integração pesada
pnpm eval:agent        # 50 tasks incl. integração Florianópolis
```
