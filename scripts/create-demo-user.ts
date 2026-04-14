/**
 * scripts/create-demo-user.ts
 *
 * Cria usuário admin demo para login no dev environment.
 * Idempotente: se já existe, não faz nada.
 *
 * Uso:
 *   DATABASE_URL="postgresql://ioc:ioc_dev_2026@localhost:5432/ioc_esg?schema=public" \
 *   pnpm tsx scripts/create-demo-user.ts
 */

import bcrypt from "bcryptjs";
import { prisma } from "../backend/lib/prisma.js";

async function main(): Promise<void> {
  const email = process.env["ADMIN_EMAIL"] ?? "admin@ioc.local";
  const password = process.env["ADMIN_PASSWORD"];
  if (!password) {
    console.error(
      "ADMIN_PASSWORD é obrigatória. Uso: ADMIN_PASSWORD=xxx pnpm tsx scripts/create-demo-user.ts",
    );
    process.exit(1);
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Usuário ${email} já existe. ID=${existing.id}`);
    await prisma.$disconnect();
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name: "Admin IOC",
      role: "admin",
    },
  });

  console.log("───────────────────────────────────────");
  console.log("Usuário demo criado:");
  console.log(`  email:    ${user.email}`);
  console.log(`  password: ${password}`);
  console.log(`  role:     ${user.role}`);
  console.log(`  id:       ${user.id}`);
  console.log("───────────────────────────────────────");

  await prisma.$disconnect();
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
