# Estado do Projeto — IOC ESG Municipal
Atualizado: 2026-03-31 — Dashboard ODS operacional

## Status: 🟢 DASHBOARD + SCORE SERVICE + 2 COLETORES

## Concluido
- Setup completo (docs, types, Prisma, Docker, seeds, CI/CD)
- **Agente IBGE:** 6 indicadores → ODS 1, 8, 10, 11 (12 testes)
- **Agente SICONFI:** FPM + despesas por funcao → ODS 3, 4, 11, 16, 17 (14 testes)
- **ODS Score Service:** orquestra IBGE+SICONFI, score global ponderado (8 testes)
- **Dashboard Frontend:** 10 componentes React com dados ao vivo
  - GlobalScore: gauge SVG circular
  - OdsCard grid: 17 cards com cores UN
  - OdsDetailDrawer: painel lateral com indicadores
  - OdsRadarChart: Recharts radar 17 eixos
  - AppShell: header + combobox 295 municipios SC
  - React Query + skeleton loaders
- Rotas: GET /api/ods/:ibgeCode + POST /api/ods/compare
- 34 testes unitarios passando, zero erros TypeScript

## Resultados ao vivo
- Florianopolis (4205407): globalScore=73 (verde), 8/17 ODS
- Joinville (4204202): globalScore=70 (verde), 8/17 ODS
- Dashboard: http://localhost:5173 (com backend em :3000)

## Cobertura ODS atual (8/17)
| ODS | Nome | Fonte | Indicador |
|-----|------|-------|-----------|
| 1 | Pobreza | IBGE | % baixa renda |
| 3 | Saude | SICONFI | % despesa saude |
| 4 | Educacao | SICONFI | % despesa educacao |
| 8 | Trabalho | IBGE | Taxa ocupacao + PIB per capita |
| 10 | Desigualdade | IBGE | % baixa renda (proxy) |
| 11 | Cidades | IBGE+SICONFI | Equilibrio fiscal + urbanismo |
| 16 | Instituicoes | SICONFI | Equilibrio fiscal detalhado |
| 17 | Parcerias | SICONFI | Dependencia FPM |

## Proximo passo
1. Mais coletores: DATASUS (saude), INEP (IDEB), SNIS (saneamento)
2. Simulador de investimentos FPM
3. Comparador entre municipios (UI)
4. Auth + multi-tenancy

## Stack
- Backend: Node.js 18 + TypeScript strict + Express + Prisma + PostgreSQL + Redis
- Frontend: React 18 + Vite + Tailwind + Recharts + React Query
- Testes: Vitest (34 unit) + Playwright (0 e2e)
- Infra: Docker Compose + GitHub Actions

## Git
- Branch: main (4 features merged)
- 12 commits
