/**
 * backend/lib/prisma.ts
 *
 * Singleton do PrismaClient — garante uma única instância (e um único connection pool)
 * por processo Node.js. Em desenvolvimento, preserva a instância entre hot reloads.
 */

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

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
