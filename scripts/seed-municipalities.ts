import { PrismaClient } from "@prisma/client";
import { SC_MUNICIPALITIES } from "../shared/constants/municipalities-sc.js";

const prisma = new PrismaClient();

async function main() {
  console.log(`Seeding ${SC_MUNICIPALITIES.length} municípios de SC...`);

  for (const mun of SC_MUNICIPALITIES) {
    await prisma.municipality.upsert({
      where: { ibgeCode: mun.ibgeCode },
      update: { name: mun.name },
      create: {
        ibgeCode: mun.ibgeCode,
        siconfiCode: mun.siconfiCode,
        name: mun.name,
        state: "SC",
        population: mun.population ?? null,
      },
    });
  }

  const count = await prisma.municipality.count();
  console.log(`Seed concluído: ${count} municípios no banco.`);
}

main()
  .catch((e) => {
    console.error("Erro no seed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
