# Verification Report — 2026-04-09

**Dispatch source:** docs/evidence/audit/DISPATCH_2026-04-09.md
**Audit source:** docs/evidence/audit/AUDIT_2026-04-09.md
**Verified by:** fix-verifier

## Resumo

| Metrica  | Valor |
| :------- | :---- |
| Total    | 8     |
| PASS     | 3     |
| PARTIAL  | 0     |
| FAIL     | 0     |
| DEFERRED | 5     |

## Verificacao por Achado

### C1 — IDOR: Rotas sem isolamento por municipio autenticado — PASS

**Achado original:** Rotas reports, recommendations, ods permitem IDOR — prefeito de Florianopolis acessa dados de Sao Paulo
**Fix aplicado:** Middleware `requireMunicipalityScope` em `backend/middleware/auth.ts:186-234`
**Evidencia:**

- [x] Middleware verifica `req.user.municipalityId` contra `municipality.id` resolvido do ibgeCode
- [x] Admin bypass implementado (role === "admin" → next())
- [x] Log de tentativa IDOR via Winston com userId, ibgeCode, path
- [x] Aplicado em `backend/routes/reports.ts:10` — GET /:ibgeCode
- [x] Aplicado em `backend/routes/recommendations.ts:18` — GET /:ibgeCode/scenario
- [x] Aplicado em `backend/routes/recommendations.ts:51` — GET /:ibgeCode
- [x] Aplicado em `backend/routes/ods.ts:16` — GET /:ibgeCode
- [x] Aplicado em `backend/routes/ods.ts:76` — GET /:ibgeCode/history
- [x] TypeScript compila sem erros (`npx tsc --noEmit` = 0 errors)
- [x] 31 testes de rotas passando (reports: 5, ods: 18, recommendations: 8)
- [x] 7 test files atualizados com mock de `requireMunicipalityScope`

### C2 — Vulnerabilidade critica: axios SSRF — PASS

**Achado original:** axios@1.14.0 com CVE GHSA-3p68-rc4w-qgx5 (SSRF)
**Fix aplicado:** Upgrade axios para ^1.15.0 em `package.json`
**Evidencia:**

- [x] `package.json` mostra `"axios": "^1.15.0"`
- [x] `pnpm audit` nao reporta mais vulnerabilidade critical
- [x] TypeScript compila sem erros
- [x] Testes passando — upgrade nao introduziu regressao

### A5 — Vulnerabilidades high (minimatch, lodash) — PASS

**Achado original:** 4 high vulns (minimatch ReDoS via @typescript-eslint, lodash injection)
**Fix aplicado:** Upgrade de dependencias transitivas
**Evidencia:**

- [x] `pnpm audit` reduzido de 8 vulns → 2 moderate (dev-only)
- [x] Zero vulnerabilidades critical ou high restantes
- [x] Restantes: esbuild <=0.24.2 e vite <=6.4.1 (ambos dev-only, via vitest)

### A1 — LongMemEval dentro de backend — DEFERRED

**Motivo:** Requer refatoracao de tsconfig e movimentacao de diretorio. Proxima sessao.

### A2 — Bull Queue nao implementado — DEFERRED

**Motivo:** Feature nova de 8h de esforco. Backlog.

### A3 — Coletores com dados estaticos — DEFERRED

**Motivo:** Requer integracao com APIs externas. Incremental.

### A4 — 9/15 ODS mappers sem testes — DEFERRED

**Motivo:** 4h de esforco. Proxima sessao.

### A6 — Sem tag de staleness no score ESG — DEFERRED

**Motivo:** Feature frontend + backend. Proxima sessao.

## Verificacao Global

- [x] `npx tsc --noEmit` — zero erros
- [x] `npx vitest run` — todos passando
- [x] `pnpm audit` — zero critical, zero high (apenas 2 moderate dev-only)
- [x] Nenhuma regressao introduzida

## Achados Abertos (deferidos para proxima sessao)

| ID  | Severidade | Motivo                                      |
| :-- | :--------- | :------------------------------------------ |
| A1  | Warning    | Refatoracao de tsconfig — esforco medio     |
| A2  | Warning    | Feature nova Bull Queue — esforco alto (8h) |
| A3  | Warning    | Integracao APIs externas — incremental      |
| A4  | Warning    | 9 test suites — esforco medio (4h)          |
| A6  | Warning    | Feature frontend + backend — esforco medio  |
