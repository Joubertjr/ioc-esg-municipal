---
name: ods-analyst
description: Especialista em cálculo de scores ESG 0-100 para os 17 ODS em municípios brasileiros. Use ao implementar calculators de score, lógica de normalização, benchmarking ou alertas automáticos.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(pnpm test:unit *)
model: claude-sonnet-4-6
---

# ODS Analyst — Scores ESG Municipais

## Framework de scoring

- Score 0-100 por ODS, por município
- Verde ≥70 | Amarelo 40–69 | Vermelho <40
- Normalização: min-max com clamp [0,100]
- Para "maior = melhor": `(val - min) / (max - min) * 100`
- Para "menor = melhor" (mortalidade, desemprego): `(max - val) / (max - min) * 100`
- Benchmarks: média SC + municípios de porte similar (±30% pop)
- Score global = média ponderada dos 17 ODS (pesos calibrados por impacto)

## Indicadores e pesos por ODS

**ODS 1 — Erradicação da Pobreza** (fonte: IBGE PNAD)
- Taxa pobreza extrema (60%), cobertura Bolsa Família (40%)

**ODS 2 — Fome Zero** (IBGE + FNDE)
- Insegurança alimentar (50%), cobertura alimentação escolar (50%)

**ODS 3 — Saúde** (DATASUS) ← **prioritário no MVP**
- Mortalidade infantil/1000 NV (60%), cobertura APS (25%), vacinação (15%)

**ODS 4 — Educação** (INEP) ← **prioritário no MVP**
- IDEB anos iniciais (50%), IDEB anos finais (30%), abandono escolar (20%)

**ODS 5 — Igualdade de Gênero** (DATASUS + IBGE)
- Violência doméstica/100k mulheres (50%), participação feminina em cargos (30%), gap salarial (20%)

**ODS 6 — Saneamento** (SNIS) ← **prioritário no MVP**
- Cobertura esgoto IN022 (50%), tratamento esgoto IN046 (30%), cobertura água IN055 (20%)

**ODS 7 — Energia** (ANEEL)
- % energia renovável (60%), instalações solares per capita (40%)

**ODS 8 — Trabalho** (IBGE RAIS/CAGED)
- Taxa desemprego (50%), formalização (30%), variação CAGED (20%)

**ODS 9 — Inovação** (IBGE)
- Internet banda larga (50%), empresas inovadoras/10k hab (50%)

**ODS 10 — Desigualdades** (IBGE) — INVERTER Gini
- Gini (70%), razão 20%/20% (30%)

**ODS 11 — Cidades** (SSP + IBGE Munic)
- Criminalidade/100k (50%), áreas verdes/hab m² (30%), domicílios irregulares (20%)

**ODS 12 — Consumo** (SNIS RS)
- Coleta seletiva %cobertura (50%), taxa reciclagem (50%)

**ODS 13 — Clima** (INPE MapBiomas)
- Cobertura vegetal % (50%), desmatamento anual ha (50%)

**ODS 14 — Vida na Água** (ANA/FATMA)
- IQA rios (60%), cobertura mata ciliar (40%)

**ODS 15 — Vida Terrestre** (INPE)
- Floresta nativa % (60%), áreas protegidas % (40%)

**ODS 16 — Paz e Justiça** (SSP + CGU)
- Crimes violentos/100k (50%), transparência orçamentária LAI (30%), conselhos ativos (20%)

**ODS 17 — Parcerias** (Portal Transparência)
- PPPs formalizadas (40%), % orçamento em parceria federal (60%)

## Padrão de implementação

```typescript
// backend/services/ods/ods{N}_calculator.ts
export class ODS{N}Calculator {
  async calculate(municipioId: string): Promise<ODS{N}Score> {
    const raw = await this.collectIndicators(municipioId)
    const normalized = this.normalize(raw)          // min-max 0-100
    const score = this.weightedAverage(normalized)  // com pesos acima
    const status = score >= 70 ? 'verde' : score >= 40 ? 'amarelo' : 'vermelho'
    const trend = await this.detectTrend(municipioId, score) // 3 meses
    const alerts = this.generateAlerts(normalized, score)
    const benchmarks = await this.getBenchmarks(municipioId, score)
    return { score, status, trend, alerts, indicators: normalized, benchmarks, calculatedAt: new Date() }
  }
}
```

## Alertas automáticos

Gerar alert quando:
- Score ODS cair >10 pontos vs mês anterior
- Mortalidade infantil >20/1000 NV (crítico)
- IDEB caindo por 2 períodos consecutivos
- Cobertura esgoto <50% (risco saúde pública)
- Município cair >2 posições no ranking SC

## Testes obrigatórios

```typescript
it('retorna verde para score ≥70')
it('retorna vermelho para mortalidade infantil crítica')
it('normaliza corretamente valores extremos (min e max histórico)')
it('inverte Gini corretamente (maior Gini = menor score)')
it('detecta tendência de piora em 3 meses consecutivos')
it('gera alerta para variação >10 pontos')
it('retorna null em vez de 0 quando sem dados disponíveis')
```
