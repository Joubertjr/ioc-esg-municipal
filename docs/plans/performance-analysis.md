# Analise de Performance — IOC ESG Municipal
> Data: 2026-04-01 | Status: Baseline estabelecido

## Latencias Estimadas

| Endpoint | Cache hit | Cache miss | Pior caso |
|----------|-----------|------------|-----------|
| GET /api/ods/:ibgeCode | ~5ms | 1.5-5s | 93s (DATASUS down) |
| GET /api/agents/inep/:ibgeCode | ~1ms | ~1ms | ~1ms |
| GET /api/agents/snis/:ibgeCode | ~1ms | ~1ms | ~1ms |
| POST /api/ods/compare (10 mun) | ~5ms | 1.5-5s | 93s |

## Gargalos Criticos

### 1. DATASUS bloqueia Promise.all por ate 93s
- timeout(30s) x retries(3) + fallback quadrimestral
- Solucao: Promise.race com budget de 10s por fonte

### 2. SICONFI faz 2 chamadas sequenciais em cache miss
- fetchRreo(year) vazio -> fetchRreo(year-1)
- Dobra latencia para municipios em jan-mar

### 3. collectBatch sequencial: 295 mun = 7-30 min
- Sleep 500ms aplicado mesmo em cache hit
- Solucao: pular sleep quando dado vem do Redis

### 4. POST /compare dispara 50 HTTP sem throttle
- 10 municipios x 5 coletores = 50 calls simultaneas
- rateLimit de API_CONFIGS nao e aplicado no codigo
- Solucao: p-limit com concurrency por API

## Otimizacoes Priorizadas

1. Circuit breaker DATASUS (4-6h) -> p99 de 93s para 10s
2. Skip sleep em cache hit (1-2h) -> batch 2.5min para 10s
3. Rate limiting real com p-limit (3-4h) -> elimina 429
4. Fix race condition singleton Redis (1h)
5. Cache nivel servico para calculateMunicipalOds (2-3h)

## Escala para 5.570 municipios
- Batch refresh sequencial: 2-16 horas por agente (inviavel)
- Necessario: Bull queue com workers paralelos
- JSONs estaticos -> tabelas PostgreSQL com indice
