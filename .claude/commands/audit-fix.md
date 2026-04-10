# Comando: /audit-fix

Processa achados do ultimo audit report e despacha para agentes corretivos.

## Execute:

1. Use o agente `improvement-coordinator` para ler o audit report mais recente em `docs/evidence/audit/AUDIT_*.md`, parsear os achados e produzir o dispatch manifest.

2. Se um argumento foi fornecido ($ARGUMENTS), filtre:
   - `critical` — apenas achados 🔴 Critico
   - `warning` — apenas achados 🟡 Warning
   - `C1`, `C2`, `W1`, etc. — achado especifico por ID
   - `security`, `tests`, `code`, `data`, `architecture` — dimensao especifica

3. Apos o dispatch manifest ser produzido, use o `orchestrator` com a sequencia IMPROVEMENT LOOP para executar os fixes.

4. Apos os fixes, use o `fix-verifier` para verificar cada achado.

5. Por fim, use o `resolution-reporter` para fechar o ciclo.

## Argumentos opcionais:

- `/audit-fix` — processa todos os achados
- `/audit-fix critical` — apenas criticos
- `/audit-fix C1` — achado especifico
- `/audit-fix security` — dimensao seguranca
- `/audit-fix tests` — dimensao testes
