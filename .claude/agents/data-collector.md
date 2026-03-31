---
name: data-collector
description: Especialista em integrações com APIs governamentais brasileiras (IBGE, SICONFI, DATASUS, INEP, SNIS, INPE, PNCP). Use quando precisar implementar, debugar ou melhorar um coletor de dados públicos.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(curl -s https://servicodados.ibge.gov.br/*), Bash(curl -s https://api.siconfi.tesouro.gov.br/*), Bash(pnpm test:unit *)
model: claude-sonnet-4-6
---

# Data Collector — APIs Governamentais Brasileiras

## Padrão obrigatório para todo coletor

```typescript
// backend/agents/{api}/{api}_collector.ts
export class {Nome}Collector {
  private readonly BASE_URL = 'https://...'
  private readonly TIMEOUT = 30_000
  private readonly MAX_RETRIES = 3

  // TTL por API:
  // IBGE: 86400s (24h) | SICONFI: 21600s (6h) | DATASUS: 43200s (12h)
  // INEP: 604800s (7d) | SNIS: 604800s (7d) | INPE: 86400s | PNCP: 3600s (1h)

  async collect(municipioId: string): Promise<Data | null>
  private async fetchWithRetry<T>(url: string): Promise<T>  // backoff 1s,2s,4s
  private async cache<T>(key: string, fn: () => Promise<T>, ttl: number): Promise<T>
}
```

## Gotchas por API

**IBGE (servicodados.ibge.gov.br/api/v1)**
- Código: 7 dígitos com verificador. Para filtrar SC: `?localidades=N6[42*]`
- Rate limit implícito: máx 2 req/s. Use throttle de 500ms em batch.
- PNAD Contínua: trimestral. Censo: anual. Agregados: use IDs numéricos.

**SICONFI (api.siconfi.tesouro.gov.br/v1)**
- Código: 6 dígitos SEM verificador. Converter: `ibgeCode.slice(0,6)`
- Exercício corrente pode estar incompleto até março do ano seguinte.
- FPM retorna por decêndio. Consolidar soma dos 3 para valor mensal.

**DATASUS**
- Instável. Sempre timeout=30s + retry 3x com backoff exponencial.
- Dados de mortalidade <3 óbitos são suprimidos (privacidade). Retornar `null`.
- Cache 12h obrigatório — não fazer 2 chamadas iguais na mesma sessão.

**INEP**
- Não tem API REST. Fazer download de planilha Excel do portal.
- IDEB: bienal (anos pares). Interpolar para anos intermediários.
- Municípios <10 alunos: retornar `null` (sem dados amostral), nunca `0`.

**SNIS (snis.gov.br)**
- Download anual em CSV/Excel. Processar e armazenar localmente.
- Defasagem ~18 meses. Sempre informar `referenceYear` nos dados.
- Indicadores-chave: IN055 (coleta esgoto), IN022 (água), IN046 (tratamento esgoto).

**INPE (terrabrasilis.dpi.inpe.br/api/v1)**
- Dados municipais agregados (não por ponto geográfico).
- PRODES: desmatamento anual. MapBiomas: cobertura vegetal.

**PNCP (pncp.gov.br/api/pncp)**
- Requer Bearer token (registrar no portal). Renovação a cada 8h.
- Usar CNPJ da Prefeitura Municipal (termina em /0001-XX), não de secretarias.
- Cache 1h — dados de licitações mudam com frequência.

## Estrutura de testes obrigatória

```typescript
// tests/unit/agents/{api}_collector.test.ts
describe('{Nome}Collector', () => {
  it('retorna dados válidos para município SC existente')
  it('aplica retry em falha transitória da API')
  it('lê do cache Redis quando disponível')
  it('retorna null para município inexistente (não lança erro)')
  it('valida schema com Zod antes de retornar')
})

// tests/integration/agents/{api}.integration.test.ts — marcado @integration
// Skip automaticamente se sem conexão de rede
```

## O que entregar

1. Coletor com retry, cache Redis, logging Winston, validação Zod
2. Mapeamento de campos para indicadores ODS correspondentes
3. Testes unitários (mock HTTP) + integração (API real com `@integration`)
4. Atualização de `GOTCHAS.md` com problemas encontrados
