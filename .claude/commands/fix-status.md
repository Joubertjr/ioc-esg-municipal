# Comando: /fix-status

Mostra o status atual dos fixes em andamento.

## Execute:

1. Leia o dispatch manifest mais recente: `ls -t docs/evidence/audit/DISPATCH_*.md | head -1`

2. Se existir verification report correspondente, leia tambem.

3. Exiba no terminal:

```
Ciclo de Melhoria — Status

Audit:        docs/evidence/audit/AUDIT_YYYY-MM-DD.md
Dispatch:     docs/evidence/audit/DISPATCH_YYYY-MM-DD.md
Verification: [existe/pendente]

Achados:
  C1 [security]  IDOR em rotas         → security-auditor + api-developer  [FIXED/PENDING/IN_PROGRESS]
  C2 [security]  axios SSRF            → devops-engineer                   [FIXED/PENDING/IN_PROGRESS]
  W1 [tests]     9/15 mappers sem test  → test-writer                      [FIXED/PENDING/IN_PROGRESS]
  ...

Resumo: X/N resolvidos (Y%)
```

4. Se houver TaskList ativa, cruze com o dispatch para mostrar tasks em andamento.

Nao requer agentes — apenas leitura de arquivos.
