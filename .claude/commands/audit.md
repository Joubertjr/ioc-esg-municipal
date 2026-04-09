# Comando: /audit

Executa uma auditoria autônoma completa do projeto usando o agente `audit-agent`.

## Execute:

Invoque o agente auditor com o seguinte prompt:

```
Use o agente audit-agent para executar uma auditoria completa do projeto IOC ESG Municipal. Siga o roteiro de 6 passos definido no agente, cobrindo as 5 dimensões (Arquitetura, Código, Dados ESG, Testes, Segurança). Gere o relatório completo em docs/evidence/audit/AUDIT_YYYY-MM-DD.md. Se um argumento de dimensão foi fornecido ($ARGUMENTS), foque nessa dimensão específica.
```

O agente é read-only — ele analisa mas não modifica código.

## Argumentos opcionais:

- `/audit` — auditoria completa (5 dimensões)
- `/audit architecture` — foco em arquitetura e design
- `/audit code` — foco em qualidade de código
- `/audit data` — foco em dados e conformidade ESG
- `/audit tests` — foco em cobertura e qualidade de testes
- `/audit security` — foco em segurança e hardening
