---
scope: global
applies_to: all
---

# Docker — Regras de Build e Deploy

> Aplicar antes de declarar qualquer feature como concluída e ao modificar Dockerfile ou compose files.

## Regras

### Validação obrigatória antes de "concluído"

- Toda feature que altera `backend/`, `shared/types/`, `prisma/` ou rotas **exige** `docker build` com sucesso antes de ser marcada como concluída
- Comando de validação rápida: `docker build -t ioc-esg-municipal:$(git rev-parse --short HEAD) . && echo "prod build OK"`
- "Funciona no `pnpm dev`" não é evidência suficiente — produção usa imagem multi-stage

### Dockerfile multi-stage (obrigatório)

- Estágios: `deps` → `builder` → `fe-builder` → `production`
- Estágio `production` usa imagem base mínima (ex: `node:18-alpine`)
- Nunca copiar `node_modules` de dev para produção — instalar apenas `--omit=dev`
- Nunca incluir `.env`, chaves ou segredos na imagem

### Hooks e scripts de build

- Desabilitar husky no builder: `ENV HUSKY=0` no Dockerfile e `npm install --ignore-scripts`
- Pré-commit hooks não devem rodar dentro do container de build
- Scripts de seed e migration **não** rodam automaticamente no build — apenas no entrypoint de startup

### Comandos RUN com rede

- Adicionar retry em comandos `RUN` que fazem download (ex: `apt-get`, `npm install`) quando possível
- Usar `--mount=type=cache` para cache de layers do npm/pnpm quando suportado
- Timeout explícito para `npm install` em ambientes de CI lentos

### Dois ambientes — nunca confundir

- **Dev local:** `docker-compose.yml` sobe apenas Postgres + Redis + Adminer; app roda no host via `pnpm dev`
- **Produção:** `docker-compose.prod.yml` sobe a stack completa incluindo imagem multi-stage + nginx
- Nunca usar `docker-compose.yml` (dev) para validar comportamento de produção

### Health checks

- Todo serviço em `docker-compose.prod.yml` deve ter `healthcheck` configurado
- API: `GET /health` retorna 200 quando Postgres e Redis estão acessíveis
- Nginx: health check via TCP na porta 80
