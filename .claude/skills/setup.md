---
name: setup
description: Setup inicial completo do projeto IOC ESG Municipal. Execute UMA ÚNICA VEZ no início do projeto. Cria estrutura de pastas, configura TypeScript, Prisma, seeds, Docker e GitHub Actions.
allowed-tools: Read, Write, Edit, Bash(git *), Bash(pnpm *), Bash(npx *), Bash(mkdir *), Bash(touch *), Bash(chmod +x *), Task
model: claude-opus-4-6
effort: high
---

# Skill: Setup — IOC ESG Municipal

**Execute apenas uma vez. Verifique antes:**
```bash
ls backend/agents 2>/dev/null && echo "JÁ INICIALIZADO — não execute novamente" && exit 0
```

## ETAPA 1 — Git inicial
```bash
git init
git add CLAUDE.md .gitignore
git commit -m "chore: repositório IOC ESG Municipal inicializado"
```

## ETAPA 2 — Estrutura de diretórios
```bash
mkdir -p backend/{agents/{ibge,siconfi,datasus,inep,snis,inpe,pncp},services/{ods,simulator,reports,benchmarks,auth},models,routes,middleware,utils}
mkdir -p frontend/{pages/{dashboard,simulator,reports,monitoring,auth},components/{ods,charts,ui,layout},hooks,lib}
mkdir -p shared/{types/{ods,agents,domain},constants,utils}
mkdir -p tests/{unit/{agents,services,components},integration/{apis,db},e2e}
mkdir -p docs/{especificacao,plans,decisions,sessions}
mkdir -p scripts
mkdir -p .claude/{hooks,logs,backups}
```

## ETAPA 3 — TypeScript config (tsconfig.json)
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUnusedLocals": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "./dist",
    "baseUrl": ".",
    "paths": { "@/*": ["./*"] }
  },
  "include": ["backend/**/*", "shared/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

## ETAPA 4 — Prisma Schema (prisma/schema.prisma)

```prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "postgresql"; url = env("DATABASE_URL") }

model Municipality {
  id           String   @id @default(cuid())
  ibgeCode     String   @unique  // 7 dígitos
  siconfiCode  String   @unique  // 6 dígitos (sem verificador)
  name         String
  state        String   @default("SC")
  population   Int?
  fpmAnnual    Decimal? @db.Decimal(15,2)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  deletedAt    DateTime?

  indicators   OdsIndicator[]
  simulations  Simulation[]
  @@index([state])
  @@index([deletedAt])
}

model OdsIndicator {
  id             String      @id @default(cuid())
  municipalityId String
  odsNumber      Int         // 1-17
  indicatorName  String
  value          Decimal?    @db.Decimal(12,4)
  score          Int?        // 0-100, null = sem dados
  status         String?     // verde|amarelo|vermelho
  source         String
  referenceYear  Int
  referenceDate  DateTime
  dataAvailable  Boolean     @default(true)
  createdAt      DateTime    @default(now())

  municipality   Municipality @relation(fields: [municipalityId], references: [id])
  @@index([municipalityId, odsNumber])
  @@index([referenceDate])
}

model Simulation {
  id               String    @id @default(cuid())
  municipalityId   String
  scenarioName     String
  investmentAmount Decimal   @db.Decimal(15,2)
  investmentType   String    // education|health|sanitation|security|environment
  targetOds        Int[]
  projectedImpact  Json
  status           String    @default("pending")
  createdAt        DateTime  @default(now())
  completedAt      DateTime?

  municipality     Municipality @relation(fields: [municipalityId], references: [id])
}

model User {
  id             String   @id @default(cuid())
  email          String   @unique
  passwordHash   String
  role           String   // admin|prefeito|secretario|viewer
  municipalityId String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
}
```

## ETAPA 5 — Constants do domínio

Crie `shared/constants/ods.ts` com array dos 17 ODS (número, nome, ícone, cor, peso no score global).
Crie `shared/constants/apis.ts` com BASE_URL, TTL cache e rate limit de cada API.
Crie `shared/constants/municipalities-sc.ts` com os 295 municípios de SC (ibgeCode, siconfiCode, name, population).

## ETAPA 6 — Scripts utilitários
- `scripts/seed-municipalities.ts` — popula banco com 295 municípios de SC
- `scripts/validate-apis.ts` — testa conectividade com todas as APIs

## ETAPA 7 — Instalar dependências
```bash
pnpm install
pnpm prisma generate
```

## ETAPA 8 — Commit inicial
```bash
git add -A
git commit -m "chore: estrutura inicial IOC ESG Municipal

- Backend: Express + Prisma + Redis + Bull
- Frontend: React + Vite + Tailwind + Shadcn/ui
- Shared: types e constants (17 ODS, 295 municípios SC)
- Docker: PostgreSQL + Redis + Adminer
- Prisma: Municipality, OdsIndicator, Simulation, User"
```

## Relatório final
Informe:
- Estrutura criada
- Próximos passos: `pnpm docker:up` → `pnpm db:migrate` → `pnpm db:seed` → `/new-agent ibge`
- ADR salvo em `docs/decisions/ADR-001-stack-tecnologica.md`
