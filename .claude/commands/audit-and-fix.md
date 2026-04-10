# Comando: /audit-and-fix

Ciclo completo de melhoria: auditoria + correcao + verificacao + relatorio.

## Execute:

1. Execute `/audit` primeiro (auditoria completa de 5 dimensoes, ou foco na dimensao passada em $ARGUMENTS).

2. Aguarde o relatorio ser salvo em `docs/evidence/audit/AUDIT_*.md`.

3. Execute `/audit-fix` para processar todos os achados do audit.

4. O fluxo completo segue automaticamente: improvement-coordinator → orchestrator (fixes) → fix-verifier → resolution-reporter.

## Argumentos opcionais:

- `/audit-and-fix` — ciclo completo (todas as dimensoes)
- `/audit-and-fix security` — foco em seguranca
- `/audit-and-fix tests` — foco em testes
- `/audit-and-fix code` — foco em qualidade de codigo
- `/audit-and-fix data` — foco em dados ESG
- `/audit-and-fix architecture` — foco em arquitetura
