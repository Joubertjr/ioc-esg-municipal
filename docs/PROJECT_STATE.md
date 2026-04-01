# Estado do Projeto — IOC ESG Municipal
Atualizado: 2026-03-31 — DATASUS Previne Brasil integrado

## Status: 🟢 DASHBOARD + SCORE SERVICE + 3 COLETORES

## Concluido
- Setup completo (docs, types, Prisma, Docker, seeds, CI/CD)
- **Agente IBGE:** 6 indicadores → ODS 1, 8, 10, 11 (12 testes)
- **Agente SICONFI:** FPM + despesas por funcao → ODS 3, 4, 11, 16, 17 (14 testes)
- **Agente DATASUS:** 6 indicadores Previne Brasil → ODS 3 (11 testes)
  - API DEMAS: apidadosabertos.saude.gov.br
  - Indicadores: pre-natal, diabetes, hipertensao, crescimento infantil,
    cancer colo uterino, saude bucal + media geral
  - Fallback quadrimestral: Q atual → Q anterior → ano anterior Q3
  - Validacao Zod da resposta (wrapper sisab_indicador_desempenho)
- **ODS Score Service:** orquestra IBGE+SICONFI+DATASUS, score global ponderado (10 testes)
- **Dashboard Frontend:** 10 componentes React com dados ao vivo
  - GlobalScore: gauge SVG circular
  - OdsCard grid: 17 cards com cores UN
  - OdsDetailDrawer: painel lateral com indicadores
  - OdsRadarChart: Recharts radar 17 eixos
  - AppShell: header + combobox 295 municipios SC
  - React Query + skeleton loaders
- Rotas: GET /api/ods/:ibgeCode + POST /api/ods/compare + GET /api/agents/datasus/:ibgeCode
- 47 testes unitarios passando, zero erros TypeScript

## Resultados ao vivo
- Florianopolis (4205407): globalScore=74 (verde), 8/17 ODS
  - ODS 3: score 81 (7 indicadores SICONFI+DATASUS combinados)
- Dashboard: http://localhost:5173 (com backend em :3000)

## Cobertura ODS atual (8/17)
| ODS | Nome | Fonte | Indicadores |
|-----|------|-------|-------------|
| 1 | Pobreza | IBGE | % baixa renda |
| 3 | Saude | SICONFI+DATASUS | % despesa saude + 6 Previne Brasil |
| 4 | Educacao | SICONFI | % despesa educacao |
| 8 | Trabalho | IBGE | Taxa ocupacao + PIB per capita |
| 10 | Desigualdade | IBGE | % baixa renda (proxy) |
| 11 | Cidades | IBGE+SICONFI | Equilibrio fiscal + urbanismo |
| 16 | Instituicoes | SICONFI | Equilibrio fiscal detalhado |
| 17 | Parcerias | SICONFI | Dependencia FPM |

## Proximo passo
1. Mais coletores: INEP (IDEB → ODS 4), SNIS (saneamento → ODS 6)
2. Simulador de investimentos FPM
3. Comparador entre municipios (UI)
4. Auth + multi-tenancy

## Stack
- Backend: Node.js 18 + TypeScript strict + Express + Prisma + PostgreSQL + Redis
- Frontend: React 18 + Vite + Tailwind + Recharts + React Query
- Testes: Vitest (47 unit) + Playwright (0 e2e)
- Infra: Docker Compose + GitHub Actions

## Git
- Branch: main (5 features merged)
- Ultimo merge: feature/agent-datasus
