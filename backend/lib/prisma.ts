/**
 * backend/lib/prisma.ts
 *
 * Singleton do PrismaClient — garante uma única instância (e um único connection pool)
 * por processo Node.js. Em desenvolvimento, preserva a instância entre hot reloads.
 */

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

// Pool size configurado via query param na DATABASE_URL:
//   postgresql://user:pass@host:5432/db?connection_limit=10&pool_timeout=20
// Prisma default = num_cpus * 2 + 1. Em produção recomenda-se limitar a 10
// para não esgotar as 100 conexões default do PostgreSQL.
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env["NODE_ENV"] === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env["NODE_ENV"] !== "production") {
  globalForPrisma.prisma = prisma;
}
