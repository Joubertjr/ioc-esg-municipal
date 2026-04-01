# Revisao de Scoring ODS — Relatorio do ODS Analyst
> Data: 2026-04-01 | Status: Pendente de correcoes

## Correcoes Criticas (P0 — antes de producao)

### 1. ODS 10 duplica ODS 1
**Problema:** Mesmo indicador (`pct_baixa_renda`) com mesma formula conta 2x no score global (pesos 1.0 + 0.9).
**Correcao:** Implementar coeficiente Gini para ODS 10 (IBGE Atlas Brasil, indicador 30255).

### 2. ODS 11 usa proxies errados
**Problema:** Equilibrio fiscal e despesa urbanismo nao sao indicadores do ODS 11 (Cidades Sustentaveis).
**Correcao:** Trocar por criminalidade/100k (SSP-SC) + areas verdes/hab.

### 3. Mortalidade infantil ausente no ODS 3
**Problema:** Indicador mais importante da spec (peso 60%) e criterio de alerta critico nao esta implementado.
**Correcao:** Adicionar mortalidade infantil via DATASUS SIM (download anual).

### 4. Base de calculo ODS 3 e 4
**Problema:** Formula usa % sobre despesa total, nao sobre receita de impostos como exige a LRF.
**Correcao:** Mudar para `despesaSaude / receitaImpostos * 100`.

### 5. Agregacao por media simples ignora pesos
**Problema:** `ods_score_service.ts` usa media simples — ODS 3 com 7 indicadores domina sem justificativa.
**Correcao:** Implementar pesos por `indicatorName` e usar media ponderada.

### 6. referenceYear global e enganoso
**Problema:** Ano de referencia e `Math.max()` entre fontes, mas dados variam de 2022 a 2024.
**Correcao:** Armazenar `referenceYear` por ODS, nao global.

## ODS Nao Cobertos — Prioridade de Implementacao

| ODS | Indicador(es) | Fonte | Viabilidade | Prioridade |
|-----|---------------|-------|-------------|------------|
| 12 | Coleta seletiva + reciclagem | SNIS-RS | Facil | P1 |
| 7 | Solar per capita + cobertura energia | ANEEL SIGEL + IBGE | Facil | P1 |
| 9 | Internet banda larga + empresas/10k | ANATEL + IBGE | Facil | P1 |
| 2 | PNAE + baixo peso infantil | FNDE + SISVAN | Medio | P2 |
| 5 | Violencia domestica + mulheres eleitas | SSP-SC + TSE | Medio | P2 |
| 13 | Cobertura vegetal + desmatamento | INPE TerraBrasilis | Medio | P2 |
| 15 | Floresta nativa + areas protegidas | MMA/CNUC + INPE | Medio | P2 |
| 17 | Convenios federais/estaduais | Portal Transparencia | Facil | P2 |
| 16 | Criminalidade + IEGM | SSP-SC + TCE-SC | Medio | P3 |
| 14 | IQA rios + mata ciliar | ANA + MapBiomas | Dificil | P4 |

## Formulas de Scoring Sugeridas para ODS Faltantes

### ODS 2 — Fome Zero
- `cobertura_pnae`: >= 98% = 100, >= 80% = 70-100, < 80% = 0-70
- `baixo_peso_infantil`: invertido, <= 5% = 100, >= 20% = 0

### ODS 5 — Igualdade de Genero
- `violencia_domestica/100k`: invertido, <= 100 = 100, >= 600 = 0
- `mulheres_cargos_pct`: >= 40% = 100, <= 10% = 0

### ODS 7 — Energia
- `cobertura_energia`: >= 99% = 100, >= 90% = 50-100
- `instalacoes_solar/10k`: >= 50 = 100, = 0 = 0

### ODS 9 — Infraestrutura
- `internet_banda_larga`: >= 80% = 100, <= 20% = 0
- `empresas/10k`: >= 100 = 100, <= 20 = 0

### ODS 12 — Consumo Responsavel
- `coleta_seletiva`: >= 80% = 100, = 0% = 0
- `taxa_reciclagem`: >= 30% = 100, = 0% = 0

### ODS 13 — Acao Climatica
- `cobertura_vegetal`: >= 60% = 100, <= 10% = 0
- `desmatamento/km2`: invertido, <= 0.1 = 100, >= 5 = 0

### ODS 14 — Vida na Agua
- `iqa_medio`: >= 79 = 100, >= 52 = 50-100, < 36 = 0
- `mata_ciliar_pct`: >= 80% = 100, <= 20% = 0

### ODS 15 — Vida Terrestre
- `floresta_nativa_pct`: >= 50% = 100, <= 5% = 0
- `areas_protegidas_pct`: >= 30% = 100, = 0% = 0
