# Auditoria de Seguranca — IOC ESG Municipal
> Data: 2026-04-01 | Status: Pendente de correcoes

## Criticos (bloqueia deploy em producao)

| ID | Achado | Arquivo | Correcao |
|----|--------|---------|----------|
| CRIT-01 | Zero autenticacao em todos endpoints | backend/index.ts | Criar middleware JWT em backend/middleware/auth.ts |
| CRIT-02 | CORS aberto para qualquer origem | backend/index.ts:12 | Restringir para ALLOWED_ORIGINS via .env |
| CRIT-03 | Zero rate limiting em endpoints HTTP | backend/routes/ | express-rate-limit: 60/min individual, 5/min batch |

## Altos (corrigir neste sprint)

| ID | Achado | Arquivo | Correcao |
|----|--------|---------|----------|
| ALTO-01 | .env com JWT_SECRET placeholder | .env | Gerar via openssl rand -base64 32 |
| ALTO-02 | Sem headers seguranca (HSTS, CSP) | backend/index.ts | Instalar helmet |
| ALTO-03 | Batch nao valida ibgeCodes individuais | routes/agents.ts | Filtrar com regex /^\d{7}$/ |
| ALTO-04 | SSRF potencial via ibgeCode em URLs | agents/*_collector.ts | Allowlist de hosts no fetchWithRetry |
| ALTO-05 | Redis sem autenticacao | docker-compose.yml | requirepass + REDIS_URL com credencial |
| ALTO-06 | Adminer exposto sem protecao | docker-compose.yml | Remover do compose de producao |

## Medios

- MED-01: JWT 7 dias sem refresh token
- MED-02: console.log em scripts (usar Winston)
- MED-03: Sem verificacao de ownership (IDOR futuro)
- MED-04: Race condition thundering herd no withCache
- MED-05: Cache sem validacao Zod na leitura
- MED-06: Sem invalidacao manual de cache
- MED-07: Stack trace sem separacao dev/prod

## Ordem de resolucao
1. CRIT-01 + CRIT-02 + CRIT-03 (auth + CORS + rate limit)
2. ALTO-02 (helmet)
3. ALTO-03 + ALTO-04 (validacao batch + SSRF)
4. ALTO-05 + ALTO-06 (Redis + Adminer)
5. MED-03 + MED-04 (IDOR + thundering herd)
