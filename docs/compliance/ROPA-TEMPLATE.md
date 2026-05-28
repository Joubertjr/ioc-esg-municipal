# RoPA — Registro de Operações de Tratamento (template IOC ESG)

**Controlador:** [Nome do município]  
**Operador / encarregado:** [DPO municipal]  
**Produto:** IOC ESG Municipal

## 1. Finalidade

Monitoramento de indicadores ODS municipais, simulação de cenários FPM e relatórios ESG para gestão pública.

## 2. Categorias de dados

| Categoria                    | Exemplos                                                 | Base legal sugerida                                |
| ---------------------------- | -------------------------------------------------------- | -------------------------------------------------- |
| Dados agregados municipais   | Scores ODS, indicadores IBGE/SICONFI                     | Interesse público / execução de políticas públicas |
| Dados de usuários do sistema | E-mail, papel (prefeito/secretário), município vinculado | Execução de contrato / legítimo interesse          |
| Trilha de auditoria agêntica | `AgentAuditLog` — ação, hash de prompt, timestamp        | Obrigação legal / accountability                   |

## 3. Operações

- Coleta via APIs públicas (14 fontes)
- Processamento determinístico de scores
- Camada agêntica (Q&A, relatório executivo) com HITL para ações sensíveis
- Retenção conforme política municipal (definir prazo)

## 4. Compartilhamento

- Provedores LLM (se `AGENT_LLM_QA_ENABLED=true`): Anthropic/OpenAI — revisar DPA
- Hospedagem: [cloud provider]

## 5. Medidas técnicas

- RBAC (`admin|prefeito|secretario|viewer`)
- Escopo municipal (IDOR)
- HITL para persistência de cenário e publicação de relatório
- Audit log append-only (`AgentAuditLog`)

## 6. Direitos dos titulares

Canal: [e-mail DPO] · Prazo de resposta conforme LGPD.

---

_Template — preencher e assinar com o DPO antes de produção._
