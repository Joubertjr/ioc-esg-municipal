# Compliance LGPD — IOC ESG Municipal

## Documentos

| Arquivo                                | Uso                                 |
| -------------------------------------- | ----------------------------------- |
| [ROPA-TEMPLATE.md](./ROPA-TEMPLATE.md) | Registro de operações de tratamento |
| [DPIA-TEMPLATE.md](./DPIA-TEMPLATE.md) | Avaliação de impacto                |

## Checklist DPO (antes de produção)

- [ ] RoPA preenchido e arquivado
- [ ] DPIA assinado com parecer
- [ ] `pnpm prisma migrate deploy` (migrations HITL + publicação)
- [ ] DPA com provedor LLM (se `AGENT_LLM_QA_ENABLED=true`)
- [ ] Política de retenção para `AgentAuditLog` e `PublishedExecutiveReport`
- [ ] Treinamento de prefeito/secretário sobre fila HITL

## Controles técnicos implementados

- RBAC e escopo municipal
- Fila `HitlRequest` (persistir cenário + publicar relatório)
- `PublishedExecutiveReport` com carimbo institucional
- `AgentAuditLog` append-only
- Consulta `GET /api/agent/audit/logs` (admin/prefeito)

## Migração de banco

Ver [../mdo/MIGRACAO-MDO.md](../mdo/MIGRACAO-MDO.md).
