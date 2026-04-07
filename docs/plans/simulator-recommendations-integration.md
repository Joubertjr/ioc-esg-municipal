# Simulator <-> Recommendations Integration — Backend Spec

**Feature:** Backlog Item 4 — "Integração simulador <-> recomendações (auto-preencher cenário)"
**Date:** 2026-04-07
**Status:** Ready for implementation

---

## 1. Context and Constraints

### What already exists

**Recommendation service** produces `SmartRecommendation[]` where each entry has:

- `priority`: "critica" | "alta" | "media"
- `currentScore`: number (0–100)
- `gap`: number | null (negative = below state average, positive = above)
- `investmentArea`: free-text string (e.g., "saneamento básico", "educação") — **does not match** the 8 `InvestmentArea` enum values used by the simulator

**Simulator service** accepts `InvestmentAllocationRecord` with exactly these 8 keys:
`education | health | sanitation | environment | security | energy | urbanization | governance`

**The core problem:** the recommendation service's `investmentArea` field is a Portuguese prose label
(`"saúde"`, `"saneamento básico"`) whereas the simulator needs typed enum keys (`"health"`,
`"sanitation"`). The mapping must be authoritative and live in shared constants.

---

## 2. New Backend Endpoint

### GET /api/recommendations/:ibgeCode/scenario

Returns a ready-to-use simulation allocation derived from the municipality's current
recommendations. No new service is instantiated — this is a thin computation layer on top of
`generateRecommendations`.

```
GET /api/recommendations/:ibgeCode/scenario

Auth:    required — same as GET /api/recommendations/:ibgeCode (JWT, any role)
Params:  ibgeCode — 7-digit string
Query:   (none)
```

**Response 200:**

```json
{
  "ibgeCode": "4205407",
  "municipalityName": "Florianópolis",
  "totalAmount": null,
  "allocation": {
    "education": 12,
    "health": 25,
    "sanitation": 30,
    "environment": 8,
    "security": 5,
    "energy": 5,
    "urbanization": 8,
    "governance": 7
  },
  "reasoning": [
    {
      "area": "sanitation",
      "percentage": 30,
      "odsNumbers": [6],
      "justification": "ODS 6 — crítica, score 28, 18 pontos abaixo da média SC"
    }
  ],
  "basedOnRecommendations": 5,
  "allOdsGreen": false
}
```

**Response 200 — all ODS green (no recommendations):**

```json
{
  "ibgeCode": "4205407",
  "municipalityName": "Florianópolis",
  "totalAmount": null,
  "allocation": {
    "education": 13,
    "health": 13,
    "sanitation": 12,
    "environment": 12,
    "security": 12,
    "energy": 13,
    "urbanization": 12,
    "governance": 13
  },
  "reasoning": [],
  "basedOnRecommendations": 0,
  "allOdsGreen": true
}
```

**Response 404:** `{ "error": "Nenhum dado encontrado para o município 1234567" }`
**Response 400:** `{ "error": "ibgeCode deve ter exatamente 7 dígitos numéricos" }`
**Response 500:** `{ "error": "Erro interno ao calcular cenário recomendado" }`

**Note:** `totalAmount` is always `null` — the backend has no basis to recommend a spending
amount. The frontend will carry the current amount from the simulator state or use its default
(R$ 1.000.000).

---

## 3. Allocation Algorithm

### 3.1 ODS-to-simulator-area mapping

This canonical map must be defined in `shared/constants/ods_area_map.ts` (new file) and imported
by both the backend route and the frontend utility. It maps every ODS number to the **one**
simulator investment area that most directly addresses it:

```
ODS 1  → governance         (assistência social via gestão)
ODS 2  → governance         (food security — closest is governance/parcerias)
ODS 3  → health
ODS 4  → education
ODS 5  → governance
ODS 6  → sanitation
ODS 7  → energy
ODS 8  → urbanization       (economic development via infrastructure)
ODS 9  → urbanization
ODS 10 → governance
ODS 11 → urbanization
ODS 12 → environment
ODS 13 → environment
ODS 14 → sanitation         (water bodies — closest to sanitation/esgoto)
ODS 15 → environment
ODS 16 → governance
ODS 17 → governance
```

**Rationale for non-obvious choices:**

- ODS 1, 2, 5, 10, 17: no direct simulator area; `governance` is the catch-all for social and
  institutional programs
- ODS 8, 9: `urbanization` is chosen over `education` because the simulator's urbanization
  maps to ODS 9 and 11 as primary/secondary (matches the existing AREA_ODS_MAPPING)
- ODS 14: `sanitation` because water quality is driven by sewage treatment in Brazilian
  municipalities (confirmed by AREA_ODS_MAPPING: sanitation → secondary [14])

### 3.2 Weight computation

Inputs: `SmartRecommendation[]` already sorted by priority then score ascending.

```
Step 1 — Assign raw weight per recommendation:

  priority_weight:
    "critica" → 3
    "alta"    → 2
    "media"   → 1

  gap_factor:
    if gap is null                  → 1.0
    if |gap| > 20                   → 1.5
    if |gap| > 10                   → 1.25
    else                            → 1.0

  raw_weight[rec] = priority_weight * gap_factor

Step 2 — Accumulate weight per simulator area:

  For each recommendation:
    area = ODS_TO_AREA_MAP[rec.odsNumber]
    area_weight[area] += raw_weight[rec]

Step 3 — Normalize to 100%, integer values:

  total_weight = sum(area_weight.values)
  if total_weight == 0:
    → equal split (see edge case section)

  For each area (sorted by area_weight descending):
    percentage[area] = floor(area_weight[area] / total_weight * 100)

  remainder = 100 - sum(percentages)
  → Add remainder to the area with highest area_weight (ties: alphabetical)

Step 4 — Minimum floor:
  Any area that received 0% stays at 0%.
  No artificial minimum — sliders already allow 0% in the simulator.
```

### 3.3 Reasoning array

For each area with percentage > 0, produce one `reasoning` entry:

```
{
  area:          <InvestmentArea>,
  percentage:    <number>,
  odsNumbers:    [list of ODS numbers from recommendations that map to this area],
  justification: "<worst ODS in this area> — <priority>, score <N>, <gap context>"
}
```

The `justification` uses the recommendation with the highest raw_weight within the area.
Gap context: if gap is not null, append `"X pontos abaixo da média SC"` (using abs(gap)).

---

## 4. ADR

### ADR-12: Pure frontend navigation for pre-filled simulator

**Status:** Proposed

**Context:**
When the user clicks "Simular cenário recomendado", we need to transfer the computed allocation
from the recommendations view to the simulator form. Two approaches exist:
(A) Client-side navigation using URL query params or React Router state
(B) Backend endpoint returns allocation, frontend navigates to simulator reading it

**Decision:**
Use React Router `navigate` with `state` (option A). The allocation is computed either by the
new backend endpoint (option B) or inline on the client. The backend endpoint is preferred
because it keeps the algorithm in one authoritative place, can be cached, and is testable
independently of the UI.

The frontend sequence:

1. User clicks "Simular cenário recomendado" on `RecommendationPanel`
2. Frontend calls `GET /api/recommendations/:ibgeCode/scenario`
3. On success, calls `navigate('/simulator', { state: { scenarioAllocation, ibgeCode } })`
4. `SimulatorPage` reads `useLocation().state` on mount; if present, applies allocation to state
   and runs the simulation automatically

**Consequences:**

- No URL pollution — query params for 8 percentages are unwieldy
- State is lost on page refresh — acceptable; user can re-click the button
- The allocation algorithm is on the backend — single source of truth
- Adds one HTTP round-trip on button click — acceptable at < 100ms (cached recommendations)

**Alternatives rejected:**

- URL query params: `?education=25&health=30&...` — fragile, ugly, creates bookmarkable but
  confusing URLs
- React context / global store (Zustand): adds unnecessary cross-page coupling
- Inline computation on frontend only: duplicates algorithm, harder to test

---

### ADR-13: Canonical ODS-to-area map in shared constants

**Status:** Proposed

**Context:**
The mapping from ODS numbers to simulator investment areas needs to be consistent between:

- The backend scenario-generation algorithm
- The frontend (if we ever want to show "this area covers ODS X, Y, Z" in the UI)

**Decision:**
Create `shared/constants/ods_area_map.ts` exporting a `Record<number, InvestmentArea>`.
Both backend and frontend import from this single source.

**Consequences:**

- Adding a new area or changing a mapping is a one-line change in one file
- TypeScript enforces that every ODS 1–17 has an entry (via `satisfies` or exhaustive check)

**Alternatives rejected:**

- Duplicate the map in both layers: divergence risk, already happened with `AREA_ODS_MAP` in
  `SimulatorPage` vs `AREA_ODS_MAPPING` in `simulator_service.ts` (they cover the same domain
  in opposite directions but live in separate files)

---

## 5. Frontend Data Flow

```
RecommendationPanel (ibgeCode)
  └─ user clicks "Simular cenário recomendado"
       └─ calls GET /api/recommendations/:ibgeCode/scenario
            ├─ loading state: button shows spinner, disabled
            ├─ on error: toast "Não foi possível gerar o cenário. Tente novamente."
            └─ on success: navigate('/simulator', { state: { scenarioAllocation: allocation, ibgeCode } })

SimulatorPage
  └─ on mount: reads useLocation().state
       ├─ if state.scenarioAllocation exists:
       │    setAllocation(state.scenarioAllocation)
       │    setIbgeCode(state.ibgeCode)   ← if different from current default
       │    show banner: "Cenário pré-preenchido a partir das recomendações. Ajuste os sliders e simule."
       │    (does NOT auto-run simulation — user must click "Simular impacto" explicitly)
       └─ if no state: default behavior (equal split)
```

**Why not auto-run:** The user should review the allocation before spending compute. Auto-run
also triggers the `persistSimulation` fire-and-forget write, which should only happen on
explicit user intent.

---

## 6. Files to Create / Modify

### New files

| File                                                   | Responsibility                                                                                                             |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `shared/constants/ods_area_map.ts`                     | Canonical `ODS_TO_AREA_MAP: Record<number, InvestmentArea>`                                                                |
| `backend/services/recommendations/scenario_service.ts` | `computeRecommendedScenario(ibgeCode)` — calls `generateRecommendations`, applies algorithm, returns `RecommendedScenario` |
| `frontend/src/hooks/useRecommendedScenario.ts`         | React Query hook wrapping `GET /api/recommendations/:ibgeCode/scenario` with manual trigger (not auto-fetch)               |
| `frontend/src/types/api.ts` additions                  | `RecommendedScenario` interface (new export)                                                                               |

### Modified files

| File                                                              | Change                                                                                                           |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `backend/routes/recommendations.ts`                               | Add `GET /:ibgeCode/scenario` route calling `computeRecommendedScenario`                                         |
| `frontend/src/components/recommendations/RecommendationPanel.tsx` | Add "Simular cenário recomendado" button; import `useRecommendedScenario`; handle loading/error; call `navigate` |
| `frontend/src/pages/SimulatorPage.tsx`                            | Read `useLocation().state` on mount; apply pre-filled allocation; show dismissible info banner                   |

---

## 7. Interface Contracts

### `shared/constants/ods_area_map.ts`

```typescript
import type { InvestmentArea } from "../../backend/services/simulator/simulator_service.js";

export const ODS_TO_AREA_MAP: Record<number, InvestmentArea> = {
  1: "governance",
  2: "governance",
  3: "health",
  4: "education",
  5: "governance",
  6: "sanitation",
  7: "energy",
  8: "urbanization",
  9: "urbanization",
  10: "governance",
  11: "urbanization",
  12: "environment",
  13: "environment",
  14: "sanitation",
  15: "environment",
  16: "governance",
  17: "governance",
} as const;
```

Note: The `InvestmentArea` type is currently defined only in `backend/services/simulator/simulator_service.ts`
and duplicated in `frontend/src/types/api.ts`. This is pre-existing — do not refactor in this
feature. The shared map file should import from `frontend/src/types/api.ts` for the type to
avoid a circular dependency from frontend importing from backend.

### `backend/services/recommendations/scenario_service.ts`

```typescript
export interface ScenarioReasoning {
  area: InvestmentArea;
  percentage: number;
  odsNumbers: number[];
  justification: string;
}

export interface RecommendedScenario {
  ibgeCode: string;
  municipalityName: string | null;
  totalAmount: null;
  allocation: InvestmentAllocationRecord;
  reasoning: ScenarioReasoning[];
  basedOnRecommendations: number;
  allOdsGreen: boolean;
}

export async function computeRecommendedScenario(
  ibgeCode: string,
): Promise<RecommendedScenario | null>;
```

Public function only — all algorithm steps are private helpers in the same file.

### `frontend/src/types/api.ts` additions

```typescript
export interface ScenarioReasoning {
  area: InvestmentArea;
  percentage: number;
  odsNumbers: number[];
  justification: string;
}

export interface RecommendedScenario {
  ibgeCode: string;
  municipalityName: string | null;
  totalAmount: null;
  allocation: InvestmentAllocation;
  reasoning: ScenarioReasoning[];
  basedOnRecommendations: number;
  allOdsGreen: boolean;
}
```

### `frontend/src/hooks/useRecommendedScenario.ts`

```typescript
// Returns a mutation-style API, not an auto-fetch query,
// because the fetch is user-triggered (button click).
export function useRecommendedScenario(): {
  fetchScenario: (ibgeCode: string) => Promise<RecommendedScenario>;
  isPending: boolean;
};
```

This uses `useMutation` from React Query internally, not `useQuery`.

---

## 8. Edge Cases

| Scenario                                                           | Behavior                                                                                                                                                                                                         |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| All ODS green (no recommendations)                                 | Backend returns equal-split allocation, `allOdsGreen: true`. Frontend shows button text "Ver simulação com distribuição equilibrada" instead of "Simular cenário recomendado". No error — the endpoint succeeds. |
| All recommendations map to the same area                           | That area gets ~100%, others get 0%. Valid — the simulator accepts 0% on any area. The reasoning array has one entry with justification.                                                                         |
| Municipality has no ODS data at all                                | `generateRecommendations` returns `null`. The new endpoint returns 404. The button shows toast error.                                                                                                            |
| `gap` is null for all recommendations                              | `gap_factor` defaults to 1.0 for all; weighting is by priority only. Still produces a valid allocation.                                                                                                          |
| ibgeCode of the recommendation page differs from simulator default | `SimulatorPage` must apply the pre-filled `ibgeCode` as well as the `allocation` from router state. The municipality dropdown should update accordingly.                                                         |
| User navigates back from simulator to recommendations              | Router state is gone. The allocation in SimulatorPage resets to default. This is expected — no persistence needed.                                                                                               |
| Network error on scenario fetch                                    | Button shows error toast and re-enables. The existing recommendations view is unaffected.                                                                                                                        |

---

## 9. Implementation Sequence

1. `shared/constants/ods_area_map.ts` — no dependencies, unblock everything else
2. `backend/services/recommendations/scenario_service.ts` — depends on (1) and existing `generateRecommendations`
3. `backend/routes/recommendations.ts` — add the new route, depends on (2)
4. `frontend/src/types/api.ts` — add `RecommendedScenario` types
5. `frontend/src/hooks/useRecommendedScenario.ts` — depends on (4)
6. `frontend/src/pages/SimulatorPage.tsx` — read router state, show banner; depends on (4)
7. `frontend/src/components/recommendations/RecommendationPanel.tsx` — button + navigate; depends on (5) and (6)

Steps 1 and 4 can be done in parallel. Steps 2–3 are purely backend and parallel to steps 5–7.

---

## 10. Questions Requiring User Answer Before Implementation

None. The design is complete. Proceed to implementation.

---

## 11. Out of Scope (deferred)

- Persisting the scenario suggestion in the database (not required for Backlog Item 4)
- Allowing the user to customize the algorithm weights (future enhancement)
- "Apply recommendation amount" (backend has no basis for a recommendation amount — FPM value
  from SICONFI would be a natural source, but requires the data collection agent to be running)
