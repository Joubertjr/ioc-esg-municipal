# Estado do Projeto — IOC ESG Municipal
Atualizado: 31/03/2026 — Sessão de inicialização

## Status: 🟡 SETUP INICIAL

## Concluído
- Documentação completa de especificação (docs/especificacao/)
- CLAUDE.md com stack, domínio, APIs, convenções e gotchas
- 14 agentes especializados configurados
- 12 skills customizadas incluindo /new-agent e /new-ods
- 6 hooks automáticos (segurança, formatação, backup)
- GitHub Actions CI/CD + automação 24/7
- package.json e docker-compose.yml prontos

## Aguardando
- Execução de /setup para criar estrutura de diretórios e Prisma schema
- Aprovação do plano de arquitetura

## Próximo passo imediato
Execute /setup no Claude Code e aguarde aprovação do plano.
Após aprovação: pnpm docker:up → pnpm db:migrate → pnpm db:seed → /new-agent ibge

## Stack definida
- Backend: Node.js 18 + TypeScript strict + Express + Prisma + PostgreSQL + Redis + Bull
- Frontend: React 18 + TypeScript + Vite + Tailwind + Shadcn/ui + Recharts
- Testes: Vitest + Playwright
- Infra: Docker Compose + GitHub Actions
