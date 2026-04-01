# Estado do Projeto — IOC ESG Municipal
Atualizado: 2026-04-01 — INEP (IDEB) + SNIS (Saneamento) integrados

## Status: DASHBOARD + SCORE SERVICE + 5 COLETORES — 9/17 ODS cobertos

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
- **Agente INEP:** IDEB 2023 → ODS 4 (12 testes)
  - 2 indicadores: IDEB anos iniciais + IDEB anos finais do ensino fundamental
  - ODS 4 agora combina SICONFI + INEP (3 indicadores total: despesa educacao + 2 IDEB)
- **Agente SNIS:** Saneamento 2022 → ODS 6 (15 testes)
  - 4 indicadores: indice atendimento agua, indice coleta esgoto,
    indice tratamento esgoto, indice perda distribuicao
  - Dados chegam com ~18 meses de atraso — ano de referencia sempre informado
- **ODS Score Service:** orquestra IBGE+SICONFI+DATASUS+INEP+SNIS,
  score global ponderado (13 testes)
  - Promise.all em 5 coletores em paralelo
- **Dashboard Frontend:** 10 componentes React com dados ao vivo
  - GlobalScore: gauge SVG circular
  - OdsCard grid: 17 cards com cores UN
  - OdsDetailDrawer: painel lateral com indicadores
  - OdsRadarChart: Recharts radar 17 eixos
  - AppShell: header + combobox 295 municipios SC
  - React Query + skeleton loaders
- Rotas: GET /api/ods/:ibgeCode + POST /api/ods/compare
  + GET /api/agents/{ibge,siconfi,datasus,inep,snis}/:ibgeCode
  + POST /api/agents/{ibge,siconfi}/batch
- 77 testes unitarios passando, zero erros TypeScript

## Resultados ao vivo
- Florianopolis (4205407): globalScore=74 (verde), 9/17 ODS
  - ODS 3: score 81 (7 indicadores SICONFI+DATASUS combinados)
  - ODS 4: score atualizado com SICONFI + IDEB anos iniciais + IDEB anos finais
  - ODS 6: score calculado com 4 indicadores SNIS (ref. 2022)
- Dashboard: http://localhost:5173 (com backend em :3000)

## Cobertura ODS atual (9/17)
| ODS | Nome | Fonte | Indicadores |
|-----|------|-------|-------------|
| 1 | Pobreza | IBGE | % baixa renda |
| 3 | Saude | SICONFI+DATASUS | % despesa saude + 6 Previne Brasil |
| 4 | Educacao | SICONFI+INEP | % despesa educacao + IDEB iniciais + IDEB finais |
| 6 | Saneamento | SNIS | Agua + esgoto + tratamento + perdas (ref. 2022) |
| 8 | Trabalho | IBGE | Taxa ocupacao + PIB per capita |
| 10 | Desigualdade | IBGE | % baixa renda (proxy) |
| 11 | Cidades | IBGE+SICONFI | Equilibrio fiscal + urbanismo |
| 16 | Instituicoes | SICONFI | Equilibrio fiscal detalhado |
| 17 | Parcerias | SICONFI | Dependencia FPM |

## Proximos passos
1. INPE (TerraBrasilis → ODS 13/15: florestas e desmatamento)
2. PNCP (Licitacoes → ODS 16: transparencia em compras publicas)
3. Simulador de investimentos FPM
4. Comparador entre municipios (UI)
5. Auth + multi-tenancy
6. Schema Prisma para persistencia de scores historicos

## Stack
- Backend: Node.js 18 + TypeScript strict + Express + Prisma + PostgreSQL + Redis
- Frontend: React 18 + Vite + Tailwind + Recharts + React Query
- Testes: Vitest (77 unit) + Playwright (0 e2e)
- Infra: Docker Compose + GitHub Actions

## Git
- Branch: main (7 features merged)
- Ultimo merge: feature/agents-inep-snis
