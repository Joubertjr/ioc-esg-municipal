---
name: new-ods
description: Implementa o cálculo completo de score ESG 0-100 para um ODS específico. Use com número 1-17. Ex: /new-ods 3 (Saúde), /new-ods 4 (Educação), /new-ods 6 (Saneamento)
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(pnpm test:unit *), Task
model: claude-sonnet-4-6
---

# Skill: Implementar Score ODS

## Argumento: `/new-ods <número-1-17>`

## ETAPA 1 — Análise
1. Leia `.claude/agents/ods-analyst.md` → indicadores e pesos do ODS $ARGUMENTS
2. Verifique quais coletores já existem em `backend/agents/`
3. Se coletor necessário não existe: execute `/new-agent <api>` primeiro
4. Leia types existentes em `shared/types/ods/`

## ETAPA 2 — Checkpoint
```bash
git checkout -b feature/ods-$ARGUMENTS-calculator
git add -A && git commit -m "checkpoint: antes de ODS $ARGUMENTS"
```

## ETAPA 3 — Types
```typescript
// shared/types/ods/ods$ARGUMENTS.types.ts
export interface ODS$ARGUMENTS_Score {
  score: number | null      // 0-100, null = sem dados
  status: 'verde' | 'amarelo' | 'vermelho' | 'sem_dados'
  trend: 'melhorando' | 'estavel' | 'piorando' | 'insuficiente'
  indicators: { /* campos específicos do ODS $ARGUMENTS */ }
  benchmarks: {
    estadual: number | null       // média SC
    similares: number | null      // municípios ±30% população
    top10pct: number | null       // top 10% do estado
    ranking: number | null        // posição no ranking SC
  }
  alerts: Alert[]
  dataAvailable: boolean
  referenceYear: number
  calculatedAt: Date
}
```

## ETAPA 4 — Calculator
```typescript
// backend/services/ods/ods$ARGUMENTS_calculator.ts
export class ODS$ARGUMENTS_Calculator {
  constructor(private readonly municipioId: string) {}

  async calculate(): Promise<ODS$ARGUMENTS_Score> {
    const raw = await this.collectIndicators()
    if (!raw.dataAvailable) return this.noDataResult()
    const norm = this.normalize(raw)         // min-max 0-100
    const score = this.weightedAverage(norm) // pesos do ods-analyst.md
    const status = this.classify(score)
    const trend = await this.detectTrend()
    const alerts = this.generateAlerts(norm, score)
    const benchmarks = await this.getBenchmarks(score)
    return { score, status, trend, indicators: norm, benchmarks, alerts,
             dataAvailable: true, referenceYear: raw.referenceYear,
             calculatedAt: new Date() }
  }

  private normalize(raw: Raw): Normalized {}    // min-max com clamp [0,100]
  private weightedAverage(n: Normalized): number {}  // pesos do ods-analyst.md
  private classify(s: number): 'verde'|'amarelo'|'vermelho' {
    return s >= 70 ? 'verde' : s >= 40 ? 'amarelo' : 'vermelho'
  }
  private async detectTrend(): Promise<string> {} // últimos 3 meses
  private generateAlerts(n: Normalized, s: number): Alert[] {}
  private async getBenchmarks(s: number): Promise<Benchmarks> {}
}
```

## ETAPA 5 — Rota
```
GET /api/ods/$ARGUMENTS/:ibgeCode           → ODS$ARGUMENTS_Score completo
GET /api/ods/$ARGUMENTS/:ibgeCode/history   → últimos 12 meses para gráfico
```

## ETAPA 6 — TDD rigoroso

**Red (escreva primeiro, devem FALHAR):**
```typescript
it('calcula score correto com dados válidos de referência')
it('retorna vermelho para indicador crítico documentado')
it('normaliza corretamente min e max histórico')
it('inverte indicador onde menor = melhor (ex: mortalidade)')
it('detecta tendência de piora em 3 meses consecutivos')
it('gera alerta quando variação > 10 pontos')
it('retorna status sem_dados quando dataAvailable = false')
it('benchmarks comparados apenas com municípios de porte similar')
```

**Green** → implementação mínima para passar
**Refactor** → limpeza mantendo testes verdes

## ETAPA 7 — Commit
```bash
git commit -m "feat(ods): calculator ODS $ARGUMENTS com N indicadores

- Score 0-100 normalizado com pesos documentados
- Benchmark vs média SC e municípios similares
- Alertas automáticos para variações críticas
- N testes cobrindo casos extremos"
```

Reporte: indicadores usados, fontes, coletores necessários, edge cases cobertos.
