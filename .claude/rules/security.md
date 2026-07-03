---
scope: global
applies_to: all
---

# Segurança — Regras Inegociáveis

> Aplicar em todo o projeto: backend, frontend, infra e scripts. Violações bloqueiam deploy.

## Regras

### Credenciais e segredos

- **Nunca** commitar `.env`, chaves de API, tokens ou senhas em nenhum arquivo rastreado pelo git
- `.env` está no `.gitignore` — `.env.example` deve existir e ser mantido atualizado com todas as variáveis (sem valores reais)
- Segredos em produção via variáveis de ambiente no Docker/host — nunca hardcoded em código ou Dockerfile
- Executar `git secrets` ou equivalente no pre-commit hook para evitar vazamentos acidentais

### Dados pessoais (PII)

- **Nunca** logar dados individuais de pessoas — apenas dados agregados por município
- Campos sensíveis nos logs são substituídos por `[REDACTED]`
- API retorna apenas dados públicos consolidados — nenhum dado nominal de cidadãos

### Validação de entrada

- Validação Zod em **toda** rota antes de processar qualquer dado
- Schemas de validação ficam em `backend/routes/<recurso>/schema.ts` junto com a rota
- Nunca confiar em dados do cliente — validar tipo, formato e range mesmo para campos "internos"
- Sanitizar inputs que serão usados em queries (Prisma parameteriza automaticamente — não concatenar strings SQL)

### Autenticação e autorização

- JWT no header `Authorization: Bearer <token>` — nunca em query string ou cookie sem `httpOnly`
- Senhas com bcrypt, salt rounds **mínimo 12**
- Tokens JWT com expiração curta (access: 15min, refresh: 7d)
- Middleware de auth valida token em toda rota protegida — sem exceções por conveniência

### Rate limiting

- Rate limiting removido por decisão do operador (2026-07-02) — produto pré-lançamento sem domínio público
- Será reativado quando a plataforma tiver domínio público e exposição real a brute-force

### Headers de segurança

- `helmet()` ativo no Express para todos os ambientes
- CORS configurado com whitelist explícita de origens — nunca `origin: '*'` em produção
