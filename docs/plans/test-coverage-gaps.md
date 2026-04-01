# Gaps de Cobertura de Testes — IOC ESG Municipal
> Data: 2026-04-01 | 77 testes existentes, ~88 faltantes identificados

## Cobertura Atual: ~45%

## Arquivos sem NENHUM teste (Prioridade Critica)

| Arquivo | Testes faltantes | Risco |
|---------|------------------|-------|
| backend/utils/http-client.ts | 6 | Retry/timeout nao testados |
| backend/utils/cache.ts | 5 | Redis fallback nao testado |
| backend/routes/agents.ts | 10 | Validacao HTTP nao testada |
| backend/routes/ods.ts | 5 | Endpoints sem cobertura |

## Boundary Values Faltantes (Prioridade Alta)

26 testes de fronteira em funcoes de scoring:
- scoreIdeb: 0, 4.0, 7.0, 10.0, negativo
- scorePctBaixaRenda: 20, 70, >70
- scoreEquilibrioFiscal: 0.7, 1.0, 1.1, >1.1
- scorePctSaude: 10, 15, 25
- scorePctEducacao: 15, 25, 35
- scoreDependenciaFpm: 5, 30, >60
- scoreAtendimentoAgua: 70, 95
- scoreAtendimentoEsgoto: 50, 90
- scorePerdaFaturamento: 15, 35, 60, >60

## Testes de Integracao Necessarios

- ibge_api.integration.test.ts — API real + validacao Zod
- siconfi_api.integration.test.ts — RREO real + FPM
- datasus_api.integration.test.ts — Previne Brasil + fallback
- cache_redis.integration.test.ts — Redis real + TTL + degradation
- agents_routes.e2e.test.ts — Supertest com servidor Express

## Meta: 77 -> 165 testes (cobertura ~85%)
