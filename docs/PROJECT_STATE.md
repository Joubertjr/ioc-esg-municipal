# Estado do Projeto — IOC ESG Municipal
Atualizado: 2026-03-31 — Setup inicial concluído

## Status: 🟢 SETUP CONCLUÍDO

## Concluído
- Documentação completa de especificação (docs/especificacao/)
- CLAUDE.md com stack, domínio, APIs, convenções e gotchas
- 14 agentes especializados + 12 skills + 6 hooks configurados
- GitHub Actions CI/CD + automação 24/7
- Estrutura de diretórios completa (backend, frontend, shared, tests, scripts)
- TypeScript strict configurado (tsconfig.json, zero erros)
- Prisma schema: Municipality, OdsIndicator, Simulation, User
- Docker Compose: PostgreSQL 15 + Redis 7 + Adminer
- package.json raiz (pnpm) + frontend (Vite + React + Tailwind)
- 295 municípios de SC importados do IBGE (dados reais)
- 17 ODS com definições, cores e pesos
- 7 APIs governamentais configuradas (URLs, TTL, rate limits)
- Types do domínio: Municipality, OdsIndicator, Simulation
- Backend: Express com /health endpoint
- Frontend: React + Vite + Tailwind scaffolding
- ADR-001: Stack tecnológica documentada
- Dependências instaladas (pnpm install + prisma generate)

## Aguardando
- Docker rodando para pnpm docker:up
- Migrations: pnpm db:migrate
- Seed: pnpm db:seed (295 municípios)
- Primeiro coletor: /new-agent ibge

## Próximo passo imediato
1. pnpm docker:up (PostgreSQL + Redis + Adminer)
2. pnpm db:migrate (criar tabelas)
3. pnpm db:seed (popular 295 municípios)
4. pnpm dev (verificar backend:3000 + frontend:5173)
5. /new-agent ibge (primeiro coletor — população, renda, desemprego)

## Stack
- Backend: Node.js 18 + TypeScript strict + Express + Prisma + PostgreSQL + Redis + Bull
- Frontend: React 18 + TypeScript + Vite + Tailwind + Shadcn/ui + Recharts
- Testes: Vitest + Playwright
- Infra: Docker Compose + GitHub Actions
