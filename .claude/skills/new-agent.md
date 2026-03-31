---
name: new-agent
description: Implementa um novo coletor de dados de API governamental brasileira. Use com o nome da API. Ex: /new-agent ibge, /new-agent siconfi, /new-agent datasus, /new-agent inep, /new-agent snis, /new-agent inpe, /new-agent pncp
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(pnpm test:unit *), Bash(curl -s *), Task
model: claude-sonnet-4-6
---

# Skill: Novo Coletor de API Governamental

## Argumento: `/new-agent <nome-da-api>`

## ETAPA 1 — Análise
1. Leia `.claude/agents/data-collector.md` para gotchas desta API
2. Leia `backend/agents/` para seguir o padrão existente
3. Confirme quais indicadores ODS este agente vai alimentar

## ETAPA 2 — Checkpoint
```bash
git add -A && git commit -m "checkpoint: antes de /new-agent $ARGUMENTS"
git checkout -b feature/agent-$ARGUMENTS
```

## ETAPA 3 — Implemente na ordem

**3a. Types** — `shared/types/agents/$ARGUMENTS.types.ts`
```typescript
// Dados brutos da API (validados com Zod)
export const {Nome}ResponseSchema = z.object({ ... })
export type {Nome}Response = z.infer<typeof {Nome}ResponseSchema>

// Dados normalizados para ODS
export interface {Nome}MunicipalData {
  municipioId: string
  referenceYear: number
  referenceDate: Date
  dataAvailable: boolean
  indicators: { /* campos específicos */ }
}
```

**3b. Coletor** — `backend/agents/$ARGUMENTS/$ARGUMENTS_collector.ts`
```typescript
export class {Nome}Collector {
  private readonly BASE_URL = '...'
  private readonly TIMEOUT = 30_000
  private readonly CACHE_TTL = 86400 // ver TTL por API em data-collector.md

  async collect(ibgeCode: string): Promise<{Nome}MunicipalData | null>
  async collectBatch(ibgeCodes: string[]): Promise<Map<string, {Nome}MunicipalData>>
  private async fetchWithRetry<T>(url: string, retries = 3): Promise<T>
  // backoff: 1s, 2s, 4s
}
```

**3c. Mapeador ODS** — `backend/agents/$ARGUMENTS/$ARGUMENTS_ods_mapper.ts`
```typescript
// Converte dados brutos em indicadores ODS específicos
export function mapToOdsIndicators(data: {Nome}MunicipalData): OdsIndicator[]
```

**3d. Rota** — adicione em `backend/routes/agents.ts`
```
GET /api/agents/$ARGUMENTS/:ibgeCode
GET /api/agents/$ARGUMENTS/batch
```

## ETAPA 4 — Testes

```typescript
// tests/unit/agents/$ARGUMENTS_collector.test.ts
describe('$ARGUMENTS collector', () => {
  it('retorna dados válidos para município SC')
  it('aplica retry em falha transitória')
  it('lê do cache Redis quando disponível')
  it('valida schema Zod antes de retornar')
  it('retorna null para município inexistente sem lançar erro')
  it('converte código IBGE para formato da API corretamente')
})
```

## ETAPA 5 — Atualização de GOTCHAS
Adicione em `.claude/GOTCHAS.md` qualquer problema encontrado.

## ETAPA 6 — Commit
```bash
git commit -m "feat($ARGUMENTS): implementa coletor de dados governamentais

- Integra API $ARGUMENTS com retry 3x e cache Redis
- Mapeia indicadores para ODS correspondentes
- N testes unitários + M testes de integração"
```

Reporte: arquivos criados, ODS cobertos, TTL de cache, limitações encontradas.
