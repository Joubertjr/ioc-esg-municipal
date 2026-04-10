---
scope: global
applies_to: backend
---

# Backend — Regras de Arquitetura e Operação

> Aplicar em todo código dentro de `backend/`: routes, services, agents, middleware.

## Regras

### Estrutura de responsabilidades

- Controllers são **finos**: recebem request, chamam service, devolvem response — nenhuma lógica de negócio
- Toda lógica de negócio fica nos Services (`backend/services/`)
- Agents (`backend/agents/`) são responsáveis apenas por coleta e parsing de APIs externas — não calculam scores

### Logging

- Usar **Winston** para todos os logs — nunca `console.log`, `console.error` ou `console.warn` em produção
- Log estruturado em JSON com campos: `level`, `message`, `timestamp`, `municipalityId` (quando aplicável), `source`
- Nunca logar PII ou dados individuais — apenas dados agregados por município

### Cache Redis

- **Obrigatório** em toda chamada a API externa governamental
- TTLs por fonte (conforme `shared/constants/api-ttl.ts`): IBGE 24h, SICONFI 6h, DATASUS 12h, INEP/SNIS 7d, INPE 24h, PNCP 1h
- Chave de cache: `<source>:<endpoint>:<params-hash>`
- Nunca burlar cache em produção — use flag `force: true` apenas em testes

### Retry com backoff exponencial

- Toda chamada a API externa usa retry: 3 tentativas com delays 1s → 2s → 4s
- Timeout por requisição: 30s (DATASUS pode ser lento)
- Após 3 falhas, lançar `ExternalApiError` com `source`, `endpoint` e `lastError`

### Rate limiting

- Máximo **2 requisições/segundo** para APIs governamentais (IBGE, SICONFI, etc.)
- Implementar via `p-limit` ou `bottleneck` no nível do agent
- Rate limit adicional nas rotas públicas da API (via `express-rate-limit`)

### Tratamento de erros

- Nunca silenciar erros — sempre tratar explicitamente ou propagar com contexto adicional
- Usar classes de erro tipadas: `ExternalApiError`, `ValidationError`, `NotFoundError`
- Middleware de erro global em `backend/middleware/errorHandler.ts` formata resposta consistente
