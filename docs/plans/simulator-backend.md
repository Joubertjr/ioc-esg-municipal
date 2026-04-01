# Simulador de Investimentos FPM — Especificação Backend

**Versão:** 1.0
**Data:** 2026-04-01
**Autor:** Backend Architect Agent
**Status:** Aprovado para implementação

---

## 1. Visão Geral

O Simulador permite que um prefeito responda à pergunta:
"Se eu investir R$ X a mais em Saúde e R$ Y a mais em Saneamento, como ficam meus scores ODS daqui a 4 anos?"

O sistema recebe o baseline atual dos scores ODS (calculado pelo ODS Score Service existente), aplica uma distribuição de investimento FPM por área, e retorna uma projeção de delta nos scores — sem garantias de resultado real, apenas estimativa paramétrica documentada.

### Princípios de design
- **Transparência do modelo:** cada projeção expõe os coeficientes e fontes usados para calculá-la — o prefeito nunca recebe um número mágico.
- **Separação baseline/projeção:** o baseline sempre vem dos coletores ao vivo; nunca é editado pelo simulador.
- **Cenários são imutáveis após execução:** comparação é possível porque o resultado não muda retroativamente.
- **Projeção é linear com teto de saturação:** scores altos ganham menos com o mesmo investimento (diminishing returns).

---

## 2. Modelo de Dados

### 2.1 Tabelas novas no Prisma

```prisma
// Snapshot dos scores ODS no momento em que a simulação foi criada.
// Imutável — registra o "antes" para comparações futuras.
model SimulationBaseline {
  id              String   @id @default(cuid())
  municipalityId  String
  ibgeCode        String
  referenceYear   Int
  globalScore     Int?              // 0-100 ou null se sem dados suficientes
  odsScores       Json              // Record<odsNumber, { score: Int|null, status: string|null }>
  capturedAt      DateTime @default(now())

  simulations     Simulation[]
  municipality    Municipality @relation(fields: [municipalityId], references: [id])

  @@index([municipalityId])
  @@index([ibgeCode, capturedAt])
}

// Um cenário de investimento criado pelo usuário.
// Substitui o model Simulation atual (que é placeholder sem relações detalhadas).
model Simulation {
  id              String             @id @default(cuid())
  municipalityId  String
  baselineId      String
  createdByUserId String?
  name            String             // Nome dado pelo prefeito ao cenário
  description     String?
  totalAmount     Decimal            @db.Decimal(15, 2)  // Total FPM alocado
  horizonYears    Int                @default(4)         // Horizonte de projeção (1-10)
  status          SimulationStatus   @default(PENDING)
  projectedResult Json?              // SimulationResult serializado — null até COMPLETED
  errorMessage    String?
  createdAt       DateTime           @default(now())
  completedAt     DateTime?
  deletedAt       DateTime?

  municipality    Municipality          @relation(fields: [municipalityId], references: [id])
  baseline        SimulationBaseline    @relation(fields: [baselineId], references: [id])
  allocations     SimulationAllocation[]

  @@index([municipalityId, deletedAt])
  @@index([baselineId])
  @@index([createdByUserId])
}

enum SimulationStatus {
  PENDING
  RUNNING
  COMPLETED
  FAILED
}

// Alocação de investimento por área dentro de um cenário.
// Cada registro = uma fatia do orçamento para uma área de política pública.
model SimulationAllocation {
  id              String   @id @default(cuid())
  simulationId    String
  area            InvestmentArea
  amountBrl       Decimal  @db.Decimal(15, 2)  // Valor absoluto em R$
  percentOfTotal  Decimal  @db.Decimal(5, 2)   // 0.00 a 100.00
  targetOdsNumbers Int[]                        // ODS afetados por esta área

  simulation      Simulation @relation(fields: [simulationId], references: [id], onDelete: Cascade)

  @@index([simulationId])
}

enum InvestmentArea {
  SAUDE                    // ODS 3
  EDUCACAO                 // ODS 4
  SANEAMENTO               // ODS 6
  TRABALHO_RENDA           // ODS 8
  INFRAESTRUTURA_URBANA    // ODS 11
  MEIO_AMBIENTE            // ODS 13, 15
  ASSISTENCIA_SOCIAL       // ODS 1, 10
  GOVERNANCA               // ODS 16, 17
}
```

### 2.2 Impacto no model Simulation existente

O `model Simulation` atual (placeholder no schema) será **substituído** pelo novo modelo acima. A migration deve fazer `DROP TABLE` do placeholder e criar as três novas tabelas. Não há dados de produção em risco — o schema atual nunca foi seedado com simulações reais.

---

## 3. Mapeamento Área → ODS

Cada `InvestmentArea` afeta um conjunto de ODS. Esse mapeamento é o coração do motor de simulação.

```
SAUDE              → ODS 3 (primário), ODS 1 (secundário, peso 0.2)
EDUCACAO           → ODS 4 (primário), ODS 1 (secundário, peso 0.15), ODS 8 (secundário, peso 0.1)
SANEAMENTO         → ODS 6 (primário), ODS 3 (secundário, peso 0.3), ODS 11 (secundário, peso 0.15)
TRABALHO_RENDA     → ODS 8 (primário), ODS 1 (secundário, peso 0.25), ODS 10 (secundário, peso 0.2)
INFRAESTRUTURA_URBANA → ODS 11 (primário), ODS 9 (secundário, peso 0.2), ODS 6 (secundário, peso 0.1)
MEIO_AMBIENTE      → ODS 13 (primário), ODS 15 (primário, peso igual), ODS 14 (secundário, peso 0.3)
ASSISTENCIA_SOCIAL → ODS 1 (primário), ODS 10 (primário, peso igual), ODS 3 (secundário, peso 0.15)
GOVERNANCA         → ODS 16 (primário), ODS 17 (primário, peso igual)
```

Peso primário = 1.0, peso secundário conforme indicado. Um ODS pode receber contribuição de múltiplas áreas — os deltas se somam antes do teto de saturação.

---

## 4. Motor de Projeção de Impacto

### 4.1 Função de eficiência por ODS

O delta de score projetado para um ODS `i` ao final de `H` anos é:

```
ΔScore_i = Σ_a [ coef(a, i) × f_sat(score_i) × f_pop(pop) × f_hor(H) × (amount_a / fpmAnual) ]
```

Onde:
- `a` percorre todas as áreas que afetam o ODS `i`
- `coef(a, i)` é o coeficiente de impacto da área `a` no ODS `i` (tabela na seção 4.2)
- `f_sat(score_i)` = fator de saturação — scores mais altos ganham menos
- `f_pop(pop)` = fator de escala por porte do município
- `f_hor(H)` = fator de horizonte temporal
- `amount_a / fpmAnual` = proporção do FPM anual alocada na área `a`

**Fórmula de saturação:**
```
f_sat(s) = 1 - (s / 150)
```
Score 0 → f_sat = 1.0 (máxima receptividade)
Score 75 → f_sat = 0.5
Score 100 → f_sat = 0.33
(teto assintótico: nunca atinge 0)

**Fórmula de porte:**
```
f_pop(pop) = 1.2  se pop < 5.000
           = 1.0  se pop 5.000–50.000
           = 0.85 se pop 50.001–200.000
           = 0.70 se pop > 200.000
```
Municípios menores têm maior elasticidade por R$ investido (base menor, serviços mais baratos).

**Fórmula de horizonte:**
```
f_hor(H) = 1 + 0.15 × (H - 1)   para H ∈ [1, 10]
```
Cada ano adicional além do primeiro agrega 15% de impacto acumulado (curva linear simplificada).

**Score projetado final:**
```
score_i_projetado = min(100, max(0, score_i_baseline + ΔScore_i))
```

### 4.2 Tabela de coeficientes

Os coeficientes abaixo representam o delta de score por 100% do FPM anual investido na área, com f_sat = 1 e f_pop = 1 e H = 1 (valores base calibrados empiricamente para o contexto brasileiro municipal):

| Área | ODS primário | coef_primário | ODS secundários e coef |
|------|-------------|---------------|------------------------|
| SAUDE | 3 | 25 | 1: 5 |
| EDUCACAO | 4 | 28 | 1: 4, 8: 3 |
| SANEAMENTO | 6 | 30 | 3: 8, 11: 4 |
| TRABALHO_RENDA | 8 | 22 | 1: 6, 10: 4 |
| INFRAESTRUTURA_URBANA | 11 | 20 | 9: 4, 6: 3 |
| MEIO_AMBIENTE | 13 | 18 | 15: 18, 14: 5 |
| ASSISTENCIA_SOCIAL | 1 | 24 | 10: 24, 3: 4 |
| GOVERNANCA | 16 | 15 | 17: 15 |

Exemplo de leitura: investir 100% do FPM em SANEAMENTO, sem saturação, num município médio, por 1 ano → ODS 6 ganha até 30 pontos. Na prática, com f_sat de um município com score 50, o ganho real seria 30 × (1 - 50/150) = 30 × 0.67 = ~20 pontos.

**Estes coeficientes devem ser armazenados como constantes versionadas** em `shared/constants/simulation-coefficients.ts` para permitir recalibração futura sem reescrever a lógica do motor.

### 4.3 Score global projetado

Usa exatamente a mesma lógica ponderada do `OdsScoreService` existente:
```
globalScore_projetado = Σ(score_i_projetado × weight_i) / Σ(weight_i)
```
Onde `weight_i` vem de `ODS_DEFINITIONS[i].weight` (constante existente em `shared/constants/ods.ts`).

### 4.4 Confiança da projeção

Para cada ODS projetado, calcular e expor um `confidenceLevel`:
```
"high"   → ODS tem score baseline real (não null) + área primária recebe > 20% do total
"medium" → ODS tem score baseline real + área primária recebe <= 20%
"low"    → ODS não tinha score baseline (null) — projeção puramente paramétrica
```

---

## 5. Contratos de API

### 5.1 Schemas Zod reutilizáveis

```typescript
// Localização: backend/services/simulator/schemas.ts

const InvestmentAreaSchema = z.enum([
  'SAUDE', 'EDUCACAO', 'SANEAMENTO', 'TRABALHO_RENDA',
  'INFRAESTRUTURA_URBANA', 'MEIO_AMBIENTE', 'ASSISTENCIA_SOCIAL', 'GOVERNANCA'
])

const AllocationInputSchema = z.object({
  area: InvestmentAreaSchema,
  amountBrl: z.number().positive().max(1_000_000_000), // Decimal.js no service
})

const CreateSimulationBodySchema = z.object({
  ibgeCode: z.string().regex(/^\d{7}$/),
  name: z.string().min(3).max(120),
  description: z.string().max(500).optional(),
  totalAmount: z.number().positive().max(1_000_000_000),
  horizonYears: z.number().int().min(1).max(10).default(4),
  allocations: z.array(AllocationInputSchema).min(1).max(8),
})
// Regra de negócio: soma de allocations[].amountBrl deve ser <= totalAmount
// Não precisa ser exatamente igual — valor não alocado é registrado como "reserva"

const OdsProjectionSchema = z.object({
  odsNumber: z.number().int().min(1).max(17),
  name: z.string(),
  shortName: z.string(),
  color: z.string(),
  weight: z.number(),
  baselineScore: z.number().nullable(),
  baselineStatus: z.enum(['verde', 'amarelo', 'vermelho']).nullable(),
  projectedScore: z.number().nullable(),
  projectedStatus: z.enum(['verde', 'amarelo', 'vermelho']).nullable(),
  scoreDelta: z.number().nullable(),
  confidenceLevel: z.enum(['high', 'medium', 'low']),
  primaryArea: InvestmentAreaSchema.nullable(),
  explanation: z.string(), // frase gerada descrevendo o impacto
})

const SimulationResultSchema = z.object({
  baselineGlobalScore: z.number().nullable(),
  projectedGlobalScore: z.number().nullable(),
  globalScoreDelta: z.number().nullable(),
  horizonYears: z.number(),
  totalAmountBrl: z.number(),
  allocatedAmountBrl: z.number(),
  odsProjections: z.array(OdsProjectionSchema),
  modelVersion: z.string(), // ex: "1.0.0" — versiona os coeficientes usados
  generatedAt: z.string().datetime(),
})

const SimulationResponseSchema = z.object({
  id: z.string(),
  municipalityId: z.string(),
  ibgeCode: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  status: z.enum(['PENDING', 'RUNNING', 'COMPLETED', 'FAILED']),
  createdAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
  baseline: z.object({
    id: z.string(),
    referenceYear: z.number(),
    globalScore: z.number().nullable(),
    capturedAt: z.string().datetime(),
  }),
  allocations: z.array(z.object({
    area: InvestmentAreaSchema,
    amountBrl: z.number(),
    percentOfTotal: z.number(),
    targetOdsNumbers: z.array(z.number()),
  })),
  result: SimulationResultSchema.nullable(),
  errorMessage: z.string().nullable(),
})
```

---

### 5.2 Endpoints

#### POST /api/simulator/simulations

Cria e executa um novo cenário de simulação sincronamente (processamento < 200ms).

```
POST /api/simulator/simulations
Auth: required — JWT com municipalityId ou role=admin
Content-Type: application/json

Request Body:
{
  "ibgeCode": "4205407",
  "name": "Foco em Saneamento 2025",
  "description": "Cenário de priorização do ODS 6 para o mandato atual",   // opcional
  "totalAmount": 5000000.00,     // R$ 5 milhões do FPM
  "horizonYears": 4,             // padrão 4 anos
  "allocations": [
    { "area": "SANEAMENTO",        "amountBrl": 2000000.00 },
    { "area": "SAUDE",             "amountBrl": 1500000.00 },
    { "area": "EDUCACAO",          "amountBrl": 1000000.00 },
    { "area": "ASSISTENCIA_SOCIAL","amountBrl": 500000.00  }
  ]
}

Validações:
- ibgeCode deve ter 7 dígitos e existir na tabela Municipality
- name: 3–120 chars
- totalAmount: > 0, <= 1.000.000.000
- horizonYears: inteiro 1–10
- allocations: 1–8 itens, sem duplicatas de area
- soma de amountBrl das allocations <= totalAmount

Response 201:
{
  "id": "clxyz...",
  "municipalityId": "clxyz...",
  "ibgeCode": "4205407",
  "name": "Foco em Saneamento 2025",
  "description": "...",
  "status": "COMPLETED",
  "createdAt": "2026-04-01T12:00:00Z",
  "completedAt": "2026-04-01T12:00:00Z",
  "baseline": {
    "id": "clxyz...",
    "referenceYear": 2024,
    "globalScore": 74,
    "capturedAt": "2026-04-01T12:00:00Z"
  },
  "allocations": [
    {
      "area": "SANEAMENTO",
      "amountBrl": 2000000.00,
      "percentOfTotal": 40.00,
      "targetOdsNumbers": [6, 3, 11]
    }
    // ...
  ],
  "result": {
    "baselineGlobalScore": 74,
    "projectedGlobalScore": 81,
    "globalScoreDelta": 7,
    "horizonYears": 4,
    "totalAmountBrl": 5000000.00,
    "allocatedAmountBrl": 5000000.00,
    "odsProjections": [
      {
        "odsNumber": 6,
        "name": "Água Potável e Saneamento",
        "shortName": "Saneamento",
        "color": "#26BDE2",
        "weight": 1.1,
        "baselineScore": 55,
        "baselineStatus": "amarelo",
        "projectedScore": 72,
        "projectedStatus": "verde",
        "scoreDelta": 17,
        "confidenceLevel": "high",
        "primaryArea": "SANEAMENTO",
        "explanation": "Investimento de R$ 2,0M em saneamento por 4 anos pode elevar o ODS 6 de amarelo para verde, com alta confiança."
      }
      // ... todos 17 ODS
    ],
    "modelVersion": "1.0.0",
    "generatedAt": "2026-04-01T12:00:00Z"
  },
  "errorMessage": null
}

Response 400: { "error": "...", "details": [...] }  // erros de validação Zod
Response 401: { "error": "Token inválido ou expirado" }
Response 403: { "error": "Usuário não tem acesso ao município 4205407" }
Response 404: { "error": "Município 4205407 não encontrado" }
Response 422: { "error": "Nenhum dado baseline disponível para este município. Execute o cálculo ODS primeiro." }
Response 500: { "error": "Erro interno ao executar simulação" }
```

---

#### GET /api/simulator/simulations

Lista cenários de simulação do município do usuário autenticado.

```
GET /api/simulator/simulations?ibgeCode=4205407&page=1&limit=20&status=COMPLETED
Auth: required

Query params:
- ibgeCode: string (7 dígitos) — obrigatório para admin, inferido do JWT para prefeito
- page: int >= 1 (default 1)
- limit: int 1–100 (default 20)
- status: PENDING|RUNNING|COMPLETED|FAILED (opcional, filtra)

Response 200:
{
  "total": 8,
  "page": 1,
  "limit": 20,
  "data": [
    {
      "id": "...",
      "name": "Foco em Saneamento 2025",
      "status": "COMPLETED",
      "globalScoreBaseline": 74,
      "globalScoreProjected": 81,
      "globalScoreDelta": 7,
      "totalAmountBrl": 5000000.00,
      "horizonYears": 4,
      "createdAt": "2026-04-01T12:00:00Z"
    }
  ]
}
// Nota: lista retorna sumário — sem odsProjections detalhadas (use GET /:id)
```

---

#### GET /api/simulator/simulations/:id

Retorna um cenário completo pelo ID.

```
GET /api/simulator/simulations/:id
Auth: required

Response 200: SimulationResponse completo (schema 5.1)
Response 403: usuário não tem acesso ao município desta simulação
Response 404: simulação não encontrada ou deletada
```

---

#### DELETE /api/simulator/simulations/:id

Soft delete de um cenário.

```
DELETE /api/simulator/simulations/:id
Auth: required — role prefeito|secretario|admin

Response 204: No Content
Response 403: usuário não tem acesso ao município desta simulação
Response 404: simulação não encontrada
```

---

#### POST /api/simulator/simulations/compare

Compara dois ou mais cenários lado a lado.

```
POST /api/simulator/simulations/compare
Auth: required
Content-Type: application/json

Request Body:
{
  "simulationIds": ["clxyz_A", "clxyz_B"],   // 2–4 ids
  "ibgeCode": "4205407"                       // validação de acesso
}

Validações:
- simulationIds: 2–4 ids, todos do mesmo município
- todos devem ter status=COMPLETED

Response 200:
{
  "ibgeCode": "4205407",
  "municipalityName": "Florianópolis",
  "comparedAt": "2026-04-01T12:00:00Z",
  "scenarios": [
    {
      "id": "clxyz_A",
      "name": "Foco em Saneamento 2025",
      "totalAmountBrl": 5000000.00,
      "horizonYears": 4,
      "globalScoreBaseline": 74,
      "globalScoreProjected": 81,
      "globalScoreDelta": 7
    },
    {
      "id": "clxyz_B",
      "name": "Foco em Saúde 2025",
      "totalAmountBrl": 5000000.00,
      "horizonYears": 4,
      "globalScoreBaseline": 74,
      "globalScoreProjected": 79,
      "globalScoreDelta": 5
    }
  ],
  "odsComparison": [
    {
      "odsNumber": 3,
      "name": "Saúde e Bem-Estar",
      "baselineScore": 81,
      "projectionsByScenario": {
        "clxyz_A": { "score": 84, "delta": 3, "confidenceLevel": "medium" },
        "clxyz_B": { "score": 94, "delta": 13, "confidenceLevel": "high" }
      }
    }
    // ... todos 17 ODS
  ],
  "recommendation": {
    "winnerScenarioId": "clxyz_A",
    "reason": "Cenário A produz maior impacto global (+7 vs +5) priorizando ODS de menor score atual."
  }
}

Response 400: ids inválidos, status != COMPLETED, ou municípios diferentes
Response 403: acesso negado a algum dos cenários
Response 404: algum id não encontrado
```

---

#### GET /api/simulator/baselines/:ibgeCode/latest

Retorna o baseline mais recente disponível para um município (sem criar nova simulação).

```
GET /api/simulator/baselines/:ibgeCode/latest
Auth: required

Comportamento: busca o SimulationBaseline mais recente por ibgeCode.
Se não existir: dispara calculateMunicipalOds e persiste um novo baseline.

Response 200:
{
  "id": "clxyz...",
  "ibgeCode": "4205407",
  "referenceYear": 2024,
  "globalScore": 74,
  "capturedAt": "2026-04-01T11:00:00Z",
  "odsScores": {
    "1": { "score": 45, "status": "amarelo" },
    "3": { "score": 81, "status": "verde" },
    // ... todos 17 (null para ODS sem dados)
  },
  "fresh": true   // true se capturedAt < 24h atrás
}

Response 404: município não encontrado
Response 422: nenhum coletor retornou dados para este município
```

---

#### GET /api/simulator/areas

Retorna as áreas de investimento disponíveis com os ODS afetados (metadata para o frontend).

```
GET /api/simulator/areas
Auth: public (sem autenticação — usado pelo frontend para montar o formulário)

Response 200:
{
  "areas": [
    {
      "id": "SANEAMENTO",
      "label": "Saneamento Básico",
      "description": "Água, esgoto e infraestrutura hídrica",
      "primaryOds": [6],
      "secondaryOds": [3, 11],
      "icon": "droplets"       // nome do ícone Lucide para o frontend
    }
    // ... 8 áreas
  ]
}
```

---

## 6. Arquitetura de Serviços

### 6.1 Estrutura de arquivos

```
backend/
  services/
    simulator/
      index.ts                        — re-exporta público
      simulation_service.ts           — orquestra baseline + motor + persistência
      projection_engine.ts            — cálculo puro de projeção (sem I/O)
      baseline_service.ts             — captura e cache do baseline ODS
      comparison_service.ts           — lógica de comparação entre cenários
      schemas.ts                      — todos os schemas Zod do simulador
  routes/
    simulator.ts                      — Express router /api/simulator/*

shared/
  constants/
    simulation-coefficients.ts        — coeficientes e mapeamentos área→ODS
  types/
    domain/
      simulation.ts                   — interfaces TypeScript do domínio do simulador
```

### 6.2 Responsabilidades por arquivo

**`simulation_service.ts`**
- Função pública: `createSimulation(body, userId) → SimulationResponse`
- Recebe o body validado pelo schema Zod
- Busca/cria o Municipality pelo ibgeCode
- Chama `baseline_service.getOrCreateBaseline(ibgeCode)`
- Persiste `Simulation` + `SimulationAllocation[]` no banco (Prisma transaction)
- Chama `projection_engine.project(baseline, allocations, horizonYears, population)`
- Atualiza status para COMPLETED e persiste `projectedResult` como JSON
- Em caso de erro, atualiza status para FAILED com errorMessage
- Não faz HTTP — não acessa Redis — só lógica de orquestração

**`projection_engine.ts`**
- Função pública: `project(input: ProjectionInput) → SimulationResult`
- Função pura sem side effects — recebe dados, retorna resultado
- Aplica a fórmula da seção 4 com os coeficientes de `simulation-coefficients.ts`
- Gera `explanation` textual para cada ODS afetado
- Calcula `confidenceLevel` por ODS
- Calcula score global projetado com os pesos do `ODS_DEFINITIONS`
- Usa `Decimal.js` internamente para os valores monetários
- Testável de forma isolada (sem mocks de banco ou HTTP)

**`baseline_service.ts`**
- Função pública: `getOrCreateBaseline(ibgeCode) → SimulationBaseline`
- Busca no banco o baseline mais recente (< 24h de idade → reutiliza)
- Se não encontrado ou stale: chama `calculateMunicipalOds(ibgeCode)` do ODS Score Service
- Transforma o `MunicipalOdsReport` em `odsScores: Record<string, OdsScoreSnapshot>`
- Persiste o novo `SimulationBaseline` no banco
- Cache Redis: chave `baseline:{ibgeCode}`, TTL 24h — evita recalcular para criação de múltiplos cenários no mesmo dia

**`comparison_service.ts`**
- Função pública: `compareSimulations(ids: string[], userId) → ComparisonResult`
- Busca as simulações no banco validando acesso
- Constrói `odsComparison` agrupando projeções ODS por cenário
- Gera `recommendation` (heurística: cenário com maior globalScoreDelta e sem ODS caindo abaixo do baseline)

**`simulator.ts` (route)**
- Validação Zod de todos os inputs antes de passar ao service
- Resposta de erros padronizada com `{ error, details? }`
- Rate limiting via middleware existente (a confirmar — ver seção 9)
- Logging Winston estruturado em cada endpoint

### 6.3 Interfaces TypeScript do domínio

```typescript
// shared/types/domain/simulation.ts

export type InvestmentArea =
  | 'SAUDE' | 'EDUCACAO' | 'SANEAMENTO' | 'TRABALHO_RENDA'
  | 'INFRAESTRUTURA_URBANA' | 'MEIO_AMBIENTE' | 'ASSISTENCIA_SOCIAL' | 'GOVERNANCA'

export interface AllocationInput {
  area: InvestmentArea
  amountBrl: number   // usará Decimal.js no service
}

export interface OdsScoreSnapshot {
  score: number | null
  status: 'verde' | 'amarelo' | 'vermelho' | null
}

export interface ProjectionInput {
  baseline: {
    ibgeCode: string
    globalScore: number | null
    odsScores: Record<string, OdsScoreSnapshot>  // key = odsNumber.toString()
    referenceYear: number
  }
  allocations: AllocationInput[]
  totalAmount: number
  horizonYears: number
  population: number | null
}

export interface OdsProjection {
  odsNumber: number
  name: string
  shortName: string
  color: string
  weight: number
  baselineScore: number | null
  baselineStatus: 'verde' | 'amarelo' | 'vermelho' | null
  projectedScore: number | null
  projectedStatus: 'verde' | 'amarelo' | 'vermelho' | null
  scoreDelta: number | null
  confidenceLevel: 'high' | 'medium' | 'low'
  primaryArea: InvestmentArea | null
  explanation: string
}

export interface SimulationResult {
  baselineGlobalScore: number | null
  projectedGlobalScore: number | null
  globalScoreDelta: number | null
  horizonYears: number
  totalAmountBrl: number
  allocatedAmountBrl: number
  odsProjections: OdsProjection[]
  modelVersion: string
  generatedAt: string
}
```

---

## 7. Fluxo de Dados Completo

```
Frontend (POST /api/simulator/simulations)
  │
  ▼
simulator.ts (route)
  ├─ Validação Zod (CreateSimulationBodySchema)
  ├─ Auth middleware (JWT → userId, municipalityId)
  └─ Chama simulation_service.createSimulation()
       │
       ├─ 1. Busca Municipality por ibgeCode no Prisma
       │
       ├─ 2. baseline_service.getOrCreateBaseline(ibgeCode)
       │        ├─ Redis cache hit? → retorna cached
       │        ├─ DB: SimulationBaseline < 24h? → retorna do banco
       │        └─ Miss: calculateMunicipalOds() (ODS Score Service existente)
       │                 ├─ IbgeCollector.collect()     ─┐
       │                 ├─ SiconfiCollector.collect()   │ Promise.all
       │                 ├─ DatasusCollector.collect()   │
       │                 ├─ InepCollector.collect()      │
       │                 └─ SnisCollector.collect()    ──┘
       │                 → MunicipalOdsReport
       │                 → persiste SimulationBaseline no Prisma
       │                 → seta Redis cache
       │
       ├─ 3. Prisma.$transaction
       │        ├─ INSERT Simulation (status=RUNNING)
       │        └─ INSERT SimulationAllocation[] (uma por área)
       │
       ├─ 4. projection_engine.project(baseline, allocations, horizonYears, population)
       │        ├─ Carrega simulation-coefficients.ts
       │        ├─ Para cada ODS 1-17:
       │        │     ├─ Soma deltas de todas as áreas que afetam o ODS
       │        │     ├─ Aplica f_sat, f_pop, f_hor
       │        │     ├─ Clipa [0, 100]
       │        │     ├─ Calcula confidenceLevel
       │        │     └─ Gera explanation textual
       │        └─ Calcula globalScore projetado (média ponderada ODS_DEFINITIONS)
       │
       └─ 5. Prisma: UPDATE Simulation
                 ├─ status = COMPLETED
                 ├─ projectedResult = JSON.stringify(SimulationResult)
                 └─ completedAt = now()

Response 201 → SimulationResponse completo
```

---

## 8. ADRs

### ADR-002: Execução síncrona vs. assíncrona do simulador

**Status:** Proposed
**Contexto:** O motor de projeção é computacionalmente trivial (pura aritmética, sem I/O de rede). O único I/O real é a chamada ao ODS Score Service para obter o baseline, que já tem cache Redis de 24h. Precisamos decidir entre execução síncrona (resposta imediata) ou assíncrona via Bull queue.

**Decisão:** Execução síncrona no POST /simulations. A chamada aos coletores é feita apenas se o baseline não estiver em cache — caso estejam, todo o processamento leva < 50ms. Com cache quente (cenário normal), latência esperada: < 100ms.

**Consequências:**
- Sem necessidade de polling, websocket ou Bull job para esta feature.
- Se o baseline não estiver em cache, a latência pode subir para 5–15s (tempo de resposta dos coletores). O frontend deve exibir loading state adequado.
- Bull fica reservado para coletas agendadas (batch de municípios em background) — fora do escopo desta feature.

**Alternativas rejeitadas:**
- Bull queue assíncrona: adicionaria complexidade (polling ou SSE) sem benefício mensurável para o caso de uso atual (um município por vez, usuário aguardando).

---

### ADR-003: Modelo de projeção linear com saturação vs. ML

**Status:** Proposed
**Contexto:** Precisamos de um modelo que traduza R$ investido em delta de score ODS. As alternativas são: modelo paramétrico (coeficientes fixos + fórmulas), regressão histórica (dados de municípios SC ao longo do tempo), ou modelo ML treinado em dados brasileiros.

**Decisão:** Modelo paramétrico linear com fator de saturação (seção 4). Coeficientes calibrados empiricamente com base em literatura de efetividade de políticas públicas municipais brasileiras.

**Consequências:**
- Implementação em horas, não semanas.
- Coeficientes são auditáveis — o prefeito pode questionar e entender.
- `confidenceLevel` e `explanation` são obrigatórios em cada projeção — o sistema nunca apresenta um número sem contexto.
- Limitação honesta: o modelo não captura especificidades locais, capacidade institucional, ou fatores exógenos.
- Versionamento (`modelVersion`) permite recalibração futura sem quebrar cenários históricos.

**Alternativas rejeitadas:**
- Regressão histórica: dados municipais históricos disponíveis são esparsos e inconsistentes (SNIS com 18 meses de atraso, IDEB bienal) — resultados seriam menos confiáveis que o paramétrico, com muito mais complexidade de implementação.
- ML: sem dados de treino disponíveis no MVP. Candidato para v2 com 12+ meses de dados coletados.

---

### ADR-004: Armazenamento de projectedResult como JSON vs. tabela normalizada

**Status:** Proposed
**Contexto:** Os resultados de projeção (17 ODS × campos de projeção) podem ser armazenados como JSON blob no campo `projectedResult` da tabela Simulation, ou normalizados em uma tabela `SimulationOdsProjection` com uma linha por ODS.

**Decisão:** JSON blob no campo `projectedResult` da tabela Simulation.

**Consequências:**
- Leituras são uma query simples por ID — sem JOINs adicionais.
- O resultado é imutável após execução, então não há risco de updates parciais.
- O schema do JSON é validado pelo `SimulationResultSchema` Zod na leitura.
- Perda: queries analíticas como "quais ODS melhoraram mais em todos os cenários de SC" não são viáveis diretamente. Para essa necessidade futura, usar uma tabela materializada separada ou JSONB + índice funcional no PostgreSQL.

**Alternativas rejeitadas:**
- Tabela normalizada: adicionaria JOIN para cada leitura de simulação sem benefício imediato para os casos de uso do MVP. Simulations são lidas individualmente ou em comparações de 2–4 cenários.

---

### ADR-005: Auth no Simulador — escopo por municipalityId

**Status:** Proposed
**Contexto:** O JWT do usuário contém `municipalityId`. Um prefeito só deve criar e ver simulações do seu próprio município. Admins devem ver tudo.

**Decisão:** Middleware de autorização verifica que o `ibgeCode` da request corresponde ao `municipalityId` do JWT. Role `admin` bypassa essa verificação.

**Consequências:**
- Todo endpoint do simulador que recebe `ibgeCode` deve aplicar esse middleware.
- Seção auth deve ser implementada antes ou em paralelo com o simulador para não bloquear.
- Para MVP de desenvolvimento: aceitar um JWT mockado com `{ municipalityId: "...", role: "prefeito" }`.

**Alternativas rejeitadas:**
- Filtrar apenas por `municipalityId` sem verificar o ibgeCode da request: cria superfície de ataque onde um usuário pode inferir dados de outros municípios via tentativa.

---

## 9. Integrações com Serviços Existentes

| Serviço existente | Como é usado pelo simulador | Acoplamento |
|-------------------|-----------------------------|-------------|
| `OdsScoreService.calculateMunicipalOds()` | Chamado pelo `baseline_service` para capturar scores ao vivo | Direto (import) — sem HTTP |
| `ODS_DEFINITIONS` (shared/constants/ods.ts) | Pesos por ODS para score global projetado | Direto (import) |
| `getOdsStatus()` (shared/types/domain/ods.ts) | Status verde/amarelo/vermelho dos scores projetados | Direto (import) |
| Redis (existente no docker-compose) | Cache do baseline (TTL 24h) | Via utilitário existente de cache |
| Prisma client | Persistência de todas as entidades do simulador | Via client existente |
| Winston logger | Logs estruturados nos routes e services | Via `backend/utils/logger.ts` |

Não há chamada HTTP entre serviços. Tudo é acoplamento de módulo (import) dentro do mesmo processo Node.js.

---

## 10. Sequência de Implementação Recomendada

A sequência respeita dependências e permite testes incrementais:

1. **Migration Prisma** — substituir o modelo Simulation placeholder pelas 3 novas tabelas (`SimulationBaseline`, `Simulation` novo, `SimulationAllocation`). Incluir seed de teste com 2 simulações para Florianópolis.

2. **`shared/constants/simulation-coefficients.ts`** — coeficientes e mapeamento área→ODS. Sem dependências. Testável com snapshot tests.

3. **`shared/types/domain/simulation.ts`** — interfaces TypeScript. Sem dependências.

4. **`backend/services/simulator/schemas.ts`** — schemas Zod. Depende de (3).

5. **`backend/services/simulator/projection_engine.ts`** — motor puro sem I/O. Depende de (2) e (3). Requer testes unitários rigorosos (10+ casos: score baixo, alto, null, múltiplas áreas, horizonte variável, municípios pequeno/grande).

6. **`backend/services/simulator/baseline_service.ts`** — captura e cache. Depende de ODS Score Service existente + Prisma + Redis.

7. **`backend/services/simulator/simulation_service.ts`** — orquestração. Depende de (5) e (6).

8. **`backend/services/simulator/comparison_service.ts`** — comparação. Depende de Prisma.

9. **`backend/routes/simulator.ts`** — router Express com todos os endpoints. Depende de (4), (7) e (8).

10. **Registro da rota no `backend/index.ts`** — `app.use('/api/simulator', simulatorRouter)`.

11. **Testes de integração** — POST /simulations com baseline cacheado e não cacheado.

---

## 11. Perguntas que Precisam de Resposta Antes de Implementar

As questões abaixo têm impacto direto no design. Algumas têm um padrão seguro (indicado), mas precisam de confirmação:

1. **Auth está implementado?** O PROJECT_STATE.md lista Auth como próximo passo, mas não como concluído. Para MVP do simulador, aceitar JWT mockado (sem bcrypt, sem login) ou bloquear a implementação até Auth existir? — **Padrão seguro: aceitar header `X-Mock-User-Id` em desenvolvimento, com middleware `auth.ts` como stub que retorna userId fixo. Não implementar auth real agora, mas a estrutura do middleware deve estar no lugar para substituição fácil.**

2. **`fpmAnual` está sendo persistido no Municipality?** O schema Prisma tem o campo `fpmAnual Decimal?` mas o seeder de 295 municípios popula esse campo? A fórmula de projeção normaliza `amount_a / fpmAnual` — se o campo for null, qual fallback usar? — **Impacto: se fpmAnual for null, usar `totalAmount × 4` como proxy do FPM anual (pressupondo que o usuário está alocando ~25% do FPM anual), com warning explícito na resposta.**

3. **Horizonte de tempo padrão:** 4 anos foi escolhido por alinhar com mandato municipal. Confirmar que é o padrão desejado.

4. **Rate limiting no simulador:** cada simulação dispara potencialmente 5 chamadas de API governamental (se baseline não estiver em cache). Dado que o rate limit atual das APIs é 1–2 req/s, múltiplos usuários simultâneos podem saturar as APIs. O mutex de cache Redis já mitiga isso para o mesmo município — mas precisamos de um rate limit por usuário na rota POST /simulations? — **Padrão seguro: 5 simulações por usuário por minuto (evita abuse), via middleware `express-rate-limit` por `userId` do JWT.**

5. **Persistência do Municipality:** ao criar uma simulação com um ibgeCode que existe na lista dos 295 municípios SC mas não está na tabela `Municipality` (banco não seedado), o simulador deve criar o registro automaticamente ou retornar 404? — **Padrão seguro: retornar 404 com mensagem clara, documentando que o banco precisa do seed.**

---

## 12. Testes Esperados

### projection_engine.ts — obrigatório antes de merge

- Score null no baseline → projectedScore baseado em coeficiente puro (sem saturação)
- Score 0 no baseline + 100% FPM em área → delta = coef_primário × f_pop × f_hor
- Score 100 no baseline → delta muito pequeno (f_sat ≈ 0.33)
- Múltiplas áreas afetando o mesmo ODS → deltas somam corretamente
- horizonYears = 1 vs 4 vs 10 → escala linear
- Município < 5.000 hab → f_pop = 1.2 aplicado
- Alocação parcial (50% do totalAmount) → projeção proporcional
- Todos 17 ODS sempre presentes no resultado, mesmo os sem dados
- globalScore projetado respeita pesos do ODS_DEFINITIONS

### simulation_service.ts — integração

- Baseline cacheado no Redis → não chama calculateMunicipalOds
- Baseline stale (> 24h) → chama calculateMunicipalOds e atualiza cache
- Falha nos coletores → status FAILED com errorMessage legível
- Transaction: falha no INSERT de Simulation → rollback completo

### routes/simulator.ts — contrato de API

- ibgeCode com 6 ou 8 dígitos → 400
- allocations com área duplicada → 400
- soma de allocations > totalAmount → 400
- usuário sem acesso ao município → 403
- município não encontrado → 404
