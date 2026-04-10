---
id: ADR-001
title: Stack Tecnológica
date: 2026-03-31
status: active
affects: [backend, frontend, infra, db, cache]
domain: infra
supersedes: null
superseded_by: null
decisors: [joubert, claude-code]
---

# ADR-001: Stack Tecnológica

**Status:** Aceito
**Data:** 2026-03-31
**Decisores:** Joubert + Claude Code

## Contexto

IOC ESG Municipal precisa de uma stack que suporte:

- Coleta de dados de 7 APIs governamentais com retry e cache
- Cálculo de scores ESG 0-100 para 17 ODS
- Simulação de cenários de investimento público
- Dashboard interativo para prefeitos
- Escala de 295 (SC) a 5.570 municípios (Brasil)

## Decisão

### Backend

- **Runtime:** Node.js 18 + TypeScript strict
- **Framework:** Express
- **ORM:** Prisma (type-safe, migrations automáticas)
- **Banco:** PostgreSQL 15 (relacional, JSON support, ACID)
- **Cache:** Redis 7 (TTL por API, rate limiting)
- **Filas:** Bull (coleta agendada, processamento async)
- **Validação:** Zod (não Joi — melhor inferência de tipos)
- **Financeiro:** Decimal.js (precisão arbitrária para FPM)

### Frontend

- **Framework:** React 18 + TypeScript
- **Build:** Vite 5
- **CSS:** Tailwind CSS 3 + Shadcn/ui
- **Charts:** Recharts
- **State:** React Query (server) + Zustand (client)

### Infra

- **Dev:** Docker Compose (PostgreSQL + Redis + Adminer)
- **Prod:** Docker multi-stage (deps → builder → fe-builder → production) — ver CLAUDE.md
- **CI/CD:** GitHub Actions
- **Testes:** Vitest + Playwright

## Alternativas Consideradas

| Alternativa    | Motivo da rejeição                                                  |
| -------------- | ------------------------------------------------------------------- |
| Python/FastAPI | Time tem mais experiência em Node/TS; ecossistema React reusa types |
| MongoDB        | Dados financeiros requerem ACID + relações fortes                   |
| Joi            | Zod tem inferência de tipos superior com TypeScript                 |
| Next.js        | Overhead desnecessário — API separada + SPA é mais simples para B2G |

## Consequências

- TypeScript strict em todo o código (zero `any`)
- Prisma como única interface com o banco
- Redis obrigatório para toda chamada de API externa
- Decimal.js para todos os valores financeiros
