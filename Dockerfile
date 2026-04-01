# =============================================================================
# IOC ESG Municipal — Backend Dockerfile (multi-stage)
# =============================================================================
# Stage 1: base com dependências comuns
# Stage 2: builder — compila TypeScript
# Stage 3: production — imagem final mínima, non-root
# =============================================================================

# ── Stage 1: base ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS base

# Instala pnpm via corepack (versão fixada no package.json)
RUN corepack enable && corepack prepare pnpm@8.15.0 --activate

WORKDIR /app

# Copia apenas manifests para maximizar cache de layer
COPY package.json pnpm-lock.yaml ./

# ── Stage 2: deps — instala dependências de produção ──────────────────────────
FROM base AS deps

RUN pnpm install --frozen-lockfile --prod

# ── Stage 3: builder — compila TypeScript ─────────────────────────────────────
FROM base AS builder

# Instala TODAS as deps (dev incluídas) para compilar
RUN pnpm install --frozen-lockfile

# Copia código-fonte
COPY tsconfig.json ./
COPY backend/ ./backend/
COPY shared/ ./shared/
COPY prisma/ ./prisma/

# Gera o Prisma Client antes do build TypeScript
RUN pnpm prisma generate

# Compila TypeScript → dist/
RUN pnpm build:backend

# ── Stage 4: production ────────────────────────────────────────────────────────
FROM node:20-alpine AS production

# Instala apenas o necessário: pnpm e dumb-init (PID 1 correto para Node)
RUN apk add --no-cache dumb-init && \
    corepack enable && corepack prepare pnpm@8.15.0 --activate

WORKDIR /app

# Cria usuário não-root
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid  1001 --ingroup nodejs nodeuser

# Copia artefatos do builder
COPY --from=builder --chown=nodeuser:nodejs /app/dist ./dist
COPY --from=builder --chown=nodeuser:nodejs /app/prisma ./prisma

# Copia node_modules de produção (sem devDeps)
COPY --from=deps --chown=nodeuser:nodejs /app/node_modules ./node_modules

# Copia package.json para `node` resolver o "main"
COPY --chown=nodeuser:nodejs package.json ./

# Gera Prisma Client no contexto de produção
RUN pnpm prisma generate

USER nodeuser

EXPOSE 3000

# Health check nativo — usa o endpoint /health do Express
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

# dumb-init garante que sinais (SIGTERM) sejam repassados ao Node
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/backend/index.js"]
