---
name: audit
description: Auditoria funcional end-to-end da plataforma. Navega todas as páginas como prefeito de Florianópolis, verifica dados, captura screenshots light/dark, e reporta achados.
allowed-tools: Bash(*), Read, Glob, Grep, Agent, Write, Edit
---

# Auditoria Funcional E2E — IOC ESG Municipal

## Contexto
Roda uma auditoria completa da perspectiva do prefeito de Florianópolis.
Verifica: dados carregam, sem skeleton infinito, sem erros, screenshots de evidência.

## Passos

### 1. Verificar stack rodando
```bash
# Verifica se backend está rodando
curl -sf http://localhost:3000/health && echo "Backend: OK" || echo "Backend: DOWN — rode 'docker compose up -d' primeiro"

# Verifica se frontend está rodando
curl -sf http://localhost:5173 > /dev/null && echo "Frontend: OK" || echo "Frontend: DOWN"
```

Se a stack não estiver rodando, avise o usuário para subir com `docker compose up --build`.

### 2. Executar suite de auditoria
```bash
PLAYWRIGHT_SKIP_WEBSERVER=1 npx playwright test tests/e2e/audit.spec.ts --reporter=list 2>&1
```

### 3. Analisar resultados
- Leia o output do Playwright
- Se houver falhas, leia os screenshots de evidência em `docs/evidence/YYYY-MM-DD-audit/`
- Para cada falha, identifique: página, tipo de problema (skeleton infinito, erro, dados ausentes), causa provável

### 4. Reportar achados
Formato:
```
AUDITORIA FUNCIONAL — YYYY-MM-DD

| Página        | Status | Observação |
|---------------|--------|------------|
| Dashboard     | ✅/❌  | ...        |
| Simulador     | ✅/❌  | ...        |
| Benchmark     | ✅/❌  | ...        |
| Relatórios    | ✅/❌  | ...        |
| Monitoramento | ✅/❌  | ...        |

Screenshots: docs/evidence/YYYY-MM-DD-audit/
Achados críticos: N
```

### 5. Se houver achados críticos
- Crie um plano de correção
- Priorize por impacto ao usuário
- Corrija e rode a auditoria novamente
