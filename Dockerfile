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

RUN for i in 1 2 3; do \
      corepack enable && corepack prepare pnpm@8.15.0 --activate && break || \
      { echo "corepack attempt $i failed, retrying..."; sleep 5; }; \
    done

WORKDIR /app

COPY package.json pnpm-lock.yaml .npmrc ./

# ── Stage 2: deps — instala dependências de produção (backend) ────────────────
FROM base AS deps

ENV HUSKY=0
RUN --mount=type=cache,target=/root/.local/share/pnpm/store/v3 \
    ok=0; for i in 1 2 3 4 5; do \
      pnpm install --frozen-lockfile --prod --ignore-scripts && ok=1 && break || \
      { echo "pnpm install attempt $i failed, retrying in 15s..."; sleep 15; }; \
    done; [ "$ok" = "1" ] || { echo "FATAL: all install attempts failed"; exit 1; }

# ── Stage 3: builder — compila TypeScript (backend) ───────────────────────────
FROM base AS builder

ENV HUSKY=0
RUN --mount=type=cache,target=/root/.local/share/pnpm/store/v3 \
    ok=0; for i in 1 2 3 4 5; do \
      pnpm install --frozen-lockfile && ok=1 && break || \
      { echo "pnpm install attempt $i failed, retrying in 15s..."; sleep 15; }; \
    done; [ "$ok" = "1" ] || { echo "FATAL: all install attempts failed"; exit 1; } && \
    test -x node_modules/.bin/tsc || { echo "FATAL: tsc not found after install"; exit 1; }

COPY tsconfig.json ./
COPY backend/ ./backend/
COPY shared/ ./shared/
COPY prisma/ ./prisma/

RUN for i in 1 2 3; do \
      pnpm prisma generate && break || \
      { echo "prisma generate attempt $i failed, retrying..."; sleep 5; }; \
    done

RUN pnpm exec tsc

# ── Stage 4: fe-builder — build do frontend com Vite ──────────────────────────
FROM node:20-alpine AS fe-builder

RUN for i in 1 2 3; do \
      corepack enable && corepack prepare pnpm@8.15.0 --activate && break || \
      { echo "corepack attempt $i failed, retrying..."; sleep 5; }; \
    done

WORKDIR /app

COPY package.json pnpm-lock.yaml .npmrc ./

ENV HUSKY=0
RUN --mount=type=cache,target=/root/.local/share/pnpm/store/v3 \
    ok=0; for i in 1 2 3 4 5; do \
      pnpm install --frozen-lockfile && ok=1 && break || \
      { echo "pnpm install (root) attempt $i failed, retrying in 15s..."; sleep 15; }; \
    done; [ "$ok" = "1" ] || { echo "FATAL: root install failed"; exit 1; }

COPY frontend/package.json frontend/pnpm-lock.yaml ./frontend/
RUN --mount=type=cache,target=/root/.local/share/pnpm/store/v3 \
    ok=0; for i in 1 2 3 4 5; do \
      cd /app/frontend && pnpm install --frozen-lockfile && ok=1 && break || \
      { echo "pnpm install (frontend) attempt $i failed, retrying in 15s..."; sleep 15; }; \
    done; [ "$ok" = "1" ] || { echo "FATAL: frontend install failed"; exit 1; }

COPY shared/ ./shared/
COPY frontend/ ./frontend/

RUN cd frontend && pnpm exec tsc && pnpm exec vite build

# ── Stage 5: production ────────────────────────────────────────────────────────
FROM node:20-alpine AS production

ENV NODE_ENV=production

RUN for i in 1 2 3; do \
      apk add --no-cache dumb-init netcat-openbsd openssl && break || \
      { echo "apk add attempt $i failed, retrying..."; sleep 5; }; \
    done

WORKDIR /app

RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid  1001 --ingroup nodejs nodeuser

COPY --from=builder --chown=nodeuser:nodejs /app/dist ./dist
COPY --from=builder --chown=nodeuser:nodejs /app/prisma ./prisma

COPY --from=deps --chown=nodeuser:nodejs /app/node_modules ./node_modules

COPY --chown=nodeuser:nodejs package.json pnpm-lock.yaml ./

RUN for i in 1 2 3; do \
      npm install prisma@5.22.0 --no-save --ignore-scripts && break || \
      { echo "prisma install attempt $i failed, retrying..."; sleep 5; }; \
    done

RUN for i in 1 2 3; do \
      npx prisma generate && break || \
      { echo "prisma generate (prod) attempt $i failed, retrying..."; sleep 5; }; \
    done && \
    chown -R nodeuser:nodejs /app/node_modules

COPY --from=builder --chown=nodeuser:nodejs /app/shared/data ./dist/shared/data
COPY --from=builder --chown=nodeuser:nodejs /app/shared/data ./shared/data

COPY --from=fe-builder --chown=nodeuser:nodejs /app/frontend/dist ./frontend/dist

COPY entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh && chown nodeuser:nodejs ./entrypoint.sh

USER nodeuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

ENTRYPOINT ["dumb-init", "--", "/app/entrypoint.sh"]
CMD ["node", "dist/backend/index.js"]
