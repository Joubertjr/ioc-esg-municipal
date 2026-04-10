---
scope: global
applies_to: all
---

# Testes — Regras de Cobertura e Qualidade

> Aplicar ao escrever ou revisar qualquer teste no projeto.

## Regras

### Ferramentas

- **Vitest** para testes unitários e de integração (`backend/` e `shared/`)
- **Playwright** para testes end-to-end (`tests/e2e/`)
- Nenhuma outra ferramenta de teste é aprovada sem ADR

### Cobertura obrigatória

- Todo novo Service criado deve ter testes de integração cobrindo: caminho feliz, erro de API externa e dados inválidos
- Agents de coleta (IBGE, SICONFI, etc.) devem ter testes de integração contra o banco real
- Calculators de ODS Score devem ter testes unitários com fixtures de dados reais

### Testes de integração

- Testes de integração **não usam mocks do banco** — conectam ao PostgreSQL de teste real
- Banco de teste inicializado com `prisma migrate deploy` + seed mínimo antes de cada suite
- Variável de ambiente `DATABASE_URL_TEST` aponta para banco isolado (diferente do dev)
- Nunca usar `jest.mock` ou `vi.mock` para módulos Prisma — use factories ou fixtures reais

### Padrão AAA

- Toda função de teste segue Arrange → Act → Assert, nessa ordem
- `describe` agrupa por unidade/feature, `it` descreve o comportamento esperado em português
- Exemplo: `it('deve retornar score 0 quando município não tem dados de saneamento')`

### Testes E2E (Playwright)

- Cobrem os fluxos críticos: login, visualização de ODS do município, execução de simulação
- Rodam contra a stack Docker completa (`docker-compose.prod.yml`)
- Screenshots de falha salvas automaticamente em `docs/evidence/e2e-failures/`
- Não rodam em CI a cada push — apenas em PRs para main e releases

### O que não testar

- Configurações do Prisma, Express boilerplate, wrappers triviais
- Nunca testar implementação interna — testar comportamento observável
