# =============================================================================
# IOC ESG Municipal — Dockerfile (multi-stage, backend + frontend)
# =============================================================================
# Stage 1: base         — Node + pnpm
# Stage 2: deps         — backend prod deps only
# Stage 3: builder      — compila TypeScript (backend)
# Stage 4: fe-builder   — instala deps frontend e roda vite build
# Stage 5: production   — imagem final mínima, non-root
# =============================================================================

# ── Stage 1: base ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS base

# Instala pnpm via corepack (versão fixada no package.json)
# Retry 3x: corepack baixa pnpm de github.com, rede do Docker Desktop é flaky.
RUN for i in 1 2 3; do \
      corepack enable && corepack prepare pnpm@8.15.0 --activate && break || \
      { echo "corepack attempt $i failed, retrying..."; sleep 5; }; \
    done

WORKDIR /app

# Copia apenas manifests para maximizar cache de layer
COPY package.json pnpm-lock.yaml ./

# ── Stage 2: deps — instala dependências de produção (backend) ────────────────
FROM base AS deps

# --ignore-scripts: evita rodar `prepare` (husky) que só existe em dev.
# HUSKY=0: belt-and-suspenders para o caso de outro script tentar invocá-lo.
ENV HUSKY=0
# Retry 3x: pnpm install baixa pacotes do registry + binários (prisma, etc).
RUN for i in 1 2 3; do \
      pnpm install --frozen-lockfile --prod --ignore-scripts && break || \
      { echo "pnpm install attempt $i failed, retrying..."; sleep 5; }; \
    done

# ── Stage 3: builder — compila TypeScript (backend) ───────────────────────────
FROM base AS builder

# Instala TODAS as deps (dev incluídas) para compilar.
# --ignore-scripts evita husky/prepare. HUSKY=0 é belt-and-suspenders.
ENV HUSKY=0
RUN for i in 1 2 3; do \
      pnpm install --frozen-lockfile --ignore-scripts && break || \
      { echo "pnpm install attempt $i failed, retrying..."; sleep 5; }; \
    done

# Copia código-fonte
COPY tsconfig.json ./
COPY backend/ ./backend/
COPY shared/ ./shared/
COPY prisma/ ./prisma/

# Gera o Prisma Client antes do build TypeScript
# Retry 3x: baixa engine binário de binaries.prisma.sh, conhecido por ser flaky.
RUN for i in 1 2 3; do \
      pnpm prisma generate && break || \
      { echo "prisma generate attempt $i failed, retrying..."; sleep 5; }; \
    done

# Compila TypeScript → dist/
RUN pnpm exec tsc

# ── Stage 4: fe-builder — build do frontend com Vite ──────────────────────────
# Usa a raiz do projeto como WORKDIR para que o TypeScript encontre zod/decimal.js
# (importados por shared/types/) nos node_modules do root, igual ao ambiente local.
FROM node:20-alpine AS fe-builder

RUN for i in 1 2 3; do \
      corepack enable && corepack prepare pnpm@8.15.0 --activate && break || \
      { echo "corepack attempt $i failed, retrying..."; sleep 5; }; \
    done

WORKDIR /app

# Copia manifests do root (para instalar zod, decimal.js, etc. que shared/ precisa)
COPY package.json pnpm-lock.yaml ./

# Instala deps do root (apenas as que o TSC precisa para type-check de shared/).
# --ignore-scripts evita husky/prepare que requer .git não presente na imagem.
ENV HUSKY=0
RUN for i in 1 2 3; do \
      pnpm install --frozen-lockfile --ignore-scripts && break || \
      { echo "pnpm install (root) attempt $i failed, retrying..."; sleep 5; }; \
    done

# Copia manifests do frontend e instala suas deps
COPY frontend/package.json frontend/pnpm-lock.yaml ./frontend/
RUN for i in 1 2 3; do \
      cd frontend && pnpm install --frozen-lockfile && break || \
      { echo "pnpm install (frontend) attempt $i failed, retrying..."; sleep 5; }; \
    done

# Copia shared/ e frontend/
COPY shared/ ./shared/
COPY frontend/ ./frontend/

# Compila frontend → frontend/dist/
RUN cd frontend && pnpm build

# ── Stage 5: production ────────────────────────────────────────────────────────
FROM node:20-alpine AS production

# Hardcode NODE_ENV=production na imagem — garante que Express nunca expõe
# stack traces, mesmo que a variável não seja passada no runtime
ENV NODE_ENV=production

# Instala dependências de sistema: dumb-init (PID 1), netcat (healthcheck DB),
# openssl (requerido pelo Prisma engine em Alpine para migrate/generate)
RUN for i in 1 2 3; do \
      apk add --no-cache dumb-init netcat-openbsd openssl && break || \
      { echo "apk add attempt $i failed, retrying..."; sleep 5; }; \
    done

WORKDIR /app

# Cria usuário não-root
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid  1001 --ingroup nodejs nodeuser

# Copia artefatos do builder (backend)
COPY --from=builder --chown=nodeuser:nodejs /app/dist ./dist
COPY --from=builder --chown=nodeuser:nodejs /app/prisma ./prisma

# Copia node_modules de produção (sem devDeps)
COPY --from=deps --chown=nodeuser:nodejs /app/node_modules ./node_modules

# Copia package.json e pnpm-lock.yaml para `node` resolver o "main"
COPY --chown=nodeuser:nodejs package.json pnpm-lock.yaml ./

# Instala prisma CLI (necessário para migrate deploy no entrypoint)
# O --prod do stage deps exclui binários CLI; reinstala apenas o prisma
# Usa npm diretamente (Node built-in) — pnpm exige corepack + rede em runtime
RUN for i in 1 2 3; do \
      npm install prisma@5.22.0 --save --ignore-scripts && break || \
      { echo "prisma install attempt $i failed, retrying..."; sleep 5; }; \
    done

# Gera Prisma Client no contexto de produção e corrige ownership dos artefatos
RUN for i in 1 2 3; do \
      npx prisma generate && break || \
      { echo "prisma generate (prod) attempt $i failed, retrying..."; sleep 5; }; \
    done && \
    chown -R nodeuser:nodejs /app/node_modules

# Copia arquivos JSON de shared/data — lidos em runtime pelos coletores
# Os imports compilados resolvem para dist/shared/data/ (relativo ao JS em dist/backend/)
COPY --from=builder --chown=nodeuser:nodejs /app/shared/data ./dist/shared/data
# Também copia para shared/data/ (usado por módulos que fazem fs.readFile)
COPY --from=builder --chown=nodeuser:nodejs /app/shared/data ./shared/data

# Copia dist do frontend — servido pelo Express em /app/frontend/dist
COPY --from=fe-builder --chown=nodeuser:nodejs /app/frontend/dist ./frontend/dist

# Copia entrypoint e garante permissão de execução (antes do USER switch)
COPY entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh && chown nodeuser:nodejs ./entrypoint.sh

USER nodeuser

EXPOSE 3000

# Health check nativo — usa o endpoint /health do Express
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

# dumb-init passa sinais ao shell; o shell exec-a o Node (PID final = Node)
ENTRYPOINT ["dumb-init", "--", "/app/entrypoint.sh"]
CMD ["node", "dist/backend/index.js"]
