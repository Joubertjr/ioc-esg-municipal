# Estado do Projeto — IOC ESG Municipal
Atualizado: 2026-03-31 — Agente IBGE concluído

## Status: 🟢 AGENT-IBGE CONCLUÍDO

## Concluído
- Documentação completa de especificação (docs/especificacao/)
- CLAUDE.md com stack, domínio, APIs, convenções e gotchas
- 14 agentes especializados + 12 skills + 6 hooks configurados
- GitHub Actions CI/CD + automação 24/7
- Estrutura de diretórios completa (backend, frontend, shared, tests, scripts)
- TypeScript strict configurado (tsconfig.json, zero erros)
- Prisma schema: Municipality, OdsIndicator, Simulation, User
- Docker Compose: PostgreSQL 15 + Redis 7 + Adminer (rodando)
- package.json raiz (pnpm) + frontend (Vite + React + Tailwind)
- 295 municípios de SC importados do IBGE (dados reais, seeded no DB)
- 17 ODS com definições, cores e pesos
- 7 APIs governamentais configuradas (URLs, TTL, rate limits)
- Types do domínio: Municipality, OdsIndicator, Simulation
- Backend: Express com /health + /api/agents/ibge endpoints
- Frontend: React + Vite + Tailwind scaffolding
- ADR-001: Stack tecnológica documentada
- Migration inicial + seed 295 municípios SC
- **Agente IBGE completo:**
  - IbgeCollector: 6 indicadores (pop, PIB, baixa renda, ocupação, receitas, despesas)
  - Validação Zod em toda resposta de API
  - Cache Redis 24h com graceful degradation
  - HTTP client com retry exponencial (1s, 2s, 4s)
  - ODS mapper: scores 0-100 para ODS 1, 8, 10, 11
  - Rotas: GET /api/agents/ibge/:ibgeCode + POST batch (max 50)
  - 12 testes unitários passando
  - Testado ao vivo: Florianópolis + Joinville OK

## Gotchas descobertos
- IBGE indicador 60048 = "% população com renda ≤ 1/2 SM" (percentual, NÃO valor R$)
- IBGE indicador 60036 = "% população ocupada" (NÃO taxa de desocupação)
- IBGE usa localidade com 6 dígitos (siconfiCode), não 7
- Redis cache pode reter dados com schema antigo — limpar ao mudar campos
- tsx (esbuild) não tem cache de módulos, mas Redis sim

## Próximo passo imediato
1. /new-agent siconfi (FPM, receitas/despesas detalhadas)
2. /new-agent datasus (indicadores de saúde)
3. /new-ods 1 (calculator completo para ODS 1 — Pobreza)
4. Dashboard frontend com scores ODS

## Stack
- Backend: Node.js 18 + TypeScript strict + Express + Prisma + PostgreSQL + Redis + Bull
- Frontend: React 18 + TypeScript + Vite + Tailwind + Shadcn/ui + Recharts
- Testes: Vitest + Playwright
- Infra: Docker Compose + GitHub Actions

## Git
- Branch: main (feature/agent-ibge merged)
- 4 commits: init → estrutura → migration+seed → agent-ibge
