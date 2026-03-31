# Estado do Projeto — IOC ESG Municipal
Atualizado: 2026-03-31 — Agentes IBGE + SICONFI concluídos

## Status: 🟢 2 COLETORES OPERACIONAIS

## Concluído
- Setup completo (docs, types, Prisma, Docker, seeds, CI/CD)
- **Agente IBGE:** 6 indicadores → ODS 1, 8, 10, 11 (12 testes)
- **Agente SICONFI:** FPM + despesas por função → ODS 3, 4, 11, 16, 17 (14 testes)
- Infraestrutura compartilhada: cache Redis, HTTP retry, logger Winston, validação Zod
- 26 testes unitários passando, zero erros TypeScript

## Cobertura ODS atual
| ODS | Nome | Fonte | Indicador |
|-----|------|-------|-----------|
| 1 | Pobreza | IBGE | % baixa renda |
| 3 | Saúde | SICONFI | % despesa saúde |
| 4 | Educação | SICONFI | % despesa educação |
| 8 | Trabalho | IBGE | Taxa ocupação + PIB per capita |
| 10 | Desigualdade | IBGE | % baixa renda (proxy) |
| 11 | Cidades | IBGE+SICONFI | Equilíbrio fiscal + urbanismo |
| 16 | Instituições | SICONFI | Equilíbrio fiscal detalhado |
| 17 | Parcerias | SICONFI | Dependência FPM |

## Gotchas descobertos
- IBGE 60048 = "% pop com renda ≤ 1/2 SM" (percentual, NÃO R$)
- IBGE 60036 = "% pop ocupada" (NÃO taxa de desocupação)
- IBGE usa localidade 6 dígitos, não 7
- SICONFI: cod_ibge no RREO aceita 7 dígitos diretamente
- SICONFI: RREO período 6 = último bimestre = acumulado anual
- SICONFI: FPM usar "TOTAL (ÚLTIMOS 12 MESES)" do Anexo 03
- SICONFI: coluna "PREVISÃO ATUALIZADA" inclui ano no nome (ex: "2024")
- SICONFI: dados do ano corrente incompletos até março seguinte
- Redis cache retém dados com schema antigo — limpar ao mudar campos

## Próximo passo imediato
1. /new-agent datasus (indicadores de saúde — ODS 3 complementar)
2. /new-agent inep (IDEB — ODS 4 complementar)
3. /new-ods 1 (calculator completo para ODS 1 — Pobreza)
4. Dashboard frontend com scores ODS

## Stack
- Backend: Node.js 18 + TypeScript strict + Express + Prisma + PostgreSQL + Redis
- Frontend: React 18 + Vite + Tailwind + Shadcn/ui (scaffolding)
- Testes: Vitest (26 unit) + Playwright (0 e2e)
- Infra: Docker Compose + GitHub Actions

## Git
- Branch: main (feature/agent-ibge + feature/agent-siconfi merged)
- 7 commits no main
