# HITL Queue — IOC ESG Municipal (camada agêntica)

> **MDO v0.1.5** · Arquétipo D regulado · Piloto: Florianópolis (`4205407`)

## Gatilhos operacionais (IOC)

| ID            | Disparador                                                         | Resposta                                                      |
| ------------- | ------------------------------------------------------------------ | ------------------------------------------------------------- |
| G-HITL-IOC-01 | `persistScenario: true` no simulador FPM                           | Aprovação `prefeito` ou `admin` na UI antes de salvar         |
| G-HITL-IOC-02 | Publicação de relatório executivo com carimbo institucional        | Revisão humana + registro em `audit-log-append`               |
| G-HITL-IOC-03 | Confidence do LLM &lt; 0.75 em recomendação com impacto financeiro | Item na fila; não exibir como decisão automática              |
| G-HITL-IOC-04 | Dado `staleness: critical` usado em recomendação de investimento   | Bloquear recomendação até re-coleta ou aviso explícito aceito |
| G-HITL-IOC-05 | Pedido LGPD (titular, ANPD, ofício)                                | Travar automação; encaminhar DPO                              |
| G-HITL-IOC-06 | Writeback em sistema externo (fora dos 6 tools do manifest)        | Recusar — atualizar `tool_scope.md` via PR                    |

## Fila mínima (estado)

| Campo      | Valor                                 |
| ---------- | ------------------------------------- |
| `pending`  | aguardando operador                   |
| `approved` | HITL concedido — ação pode prosseguir |
| `rejected` | negado — agente não executa writeback |

## SLA sugerido (piloto)

- Relatório prefeito: **≤ 4h úteis**
- Cenário FPM persistido: **≤ 24h**
- LGPD: **≤ 1h** (escalonar DPO)

## Evidência obrigatória (AP-10)

Todo item HITL deve registrar: `userId`, `municipalityId`, `action`, `toolNames`, `timestamp` — ver `AuditLogEntrySchema`.
