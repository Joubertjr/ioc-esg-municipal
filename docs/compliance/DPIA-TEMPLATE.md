# DPIA — Avaliação de Impacto à Proteção de Dados (template IOC ESG)

## 1. Descrição do tratamento

Plataforma SaaS B2G para análise ESG municipal (ODS + FPM), incluindo simulador, relatórios e assistente agêntico com aprovação humana (HITL).

## 2. Necessidade e proporcionalidade

| Pergunta                                     | Resposta                                                                     |
| -------------------------------------------- | ---------------------------------------------------------------------------- |
| O tratamento é necessário para a finalidade? | Sim — decisões de investimento público baseadas em evidência                 |
| Dados mínimos?                               | Preferência por agregados; evitar dados pessoais nos indicadores             |
| LLM necessário?                              | Opcional (`AGENT_LLM_QA_ENABLED`); fallback determinístico sempre disponível |

## 3. Riscos identificados

| Risco                                  | Severidade | Mitigação implementada                            |
| -------------------------------------- | ---------- | ------------------------------------------------- |
| Alucinação LLM em recomendação         | Alta       | P-011 fallback determinístico; HITL G-HITL-IOC-03 |
| Persistência não autorizada de cenário | Média      | G-HITL-IOC-01 + fila `HitlRequest`                |
| Vazamento cross-município              | Alta       | `requireMunicipalityScope` + JWT                  |
| Dado desatualizado em decisão          | Média      | `staleness` + G-HITL-IOC-04                       |

## 4. Medidas complementares recomendadas

- [ ] Assinar DPA com provedor LLM
- [ ] Definir retenção e purge de `AgentAuditLog`
- [ ] Treinamento de prefeito/secretários sobre HITL

## 5. Parecer do DPO

| Campo      | Valor                                                 |
| ---------- | ----------------------------------------------------- |
| Data       | ****\_\_\_****                                        |
| Decisão    | [ ] Aprovado [ ] Aprovado com ressalvas [ ] Rejeitado |
| Assinatura | ****\_\_\_****                                        |

---

_Template MDO arquétipo D — IOC ESG Municipal._
