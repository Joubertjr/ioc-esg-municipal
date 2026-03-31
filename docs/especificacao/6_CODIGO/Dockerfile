# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copiar package.json e package-lock.json
COPY package*.json ./

# Instalar dependências
RUN npm ci

# Copiar código fonte
COPY . .

# Build
RUN npm run build

# Runtime stage
FROM node:18-alpine

WORKDIR /app

# Instalar apenas dependências de produção
COPY package*.json ./
RUN npm ci --only=production

# Copiar arquivos compilados do builder
COPY --from=builder /app/dist ./dist

# Criar diretório de uploads
RUN mkdir -p uploads

# Expor porta
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Comando de inicialização
CMD ["node", "dist/index.js"]
