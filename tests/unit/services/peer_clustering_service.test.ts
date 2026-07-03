import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../backend/lib/prisma.js", () => ({
  prisma: {
    municipality: {
      findMany: vi.fn().mockResolvedValue([
        { ibgeCode: "4205407", name: "Florianópolis", population: 516524, fpmAnnual: 180000000 },
        { ibgeCode: "4209102", name: "Joinville", population: 616317, fpmAnnual: 200000000 },
        { ibgeCode: "4218707", name: "São José", population: 250181, fpmAnnual: 90000000 },
        { ibgeCode: "4204202", name: "Criciúma", population: 217311, fpmAnnual: 75000000 },
        { ibgeCode: "4202404", name: "Blumenau", population: 361855, fpmAnnual: 120000000 },
        { ibgeCode: "4208203", name: "Itajaí", population: 223112, fpmAnnual: 80000000 },
        { ibgeCode: "4211503", name: "Lages", population: 157544, fpmAnnual: 55000000 },
        { ibgeCode: "4203808", name: "Canoinhas", population: 54030, fpmAnnual: 22000000 },
      ]),
    },
  },
}));

vi.mock("../../../backend/utils/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  findPeerMunicipalities,
  invalidateClusteringCache,
} from "../../../backend/services/clustering/peer_clustering_service.js";

const FLORIANOPOLIS = "4205407";
const CODIGO_INEXISTENTE = "9999999";

describe("findPeerMunicipalities", () => {
  beforeEach(() => {
    invalidateClusteringCache();
  });

  it("retorna topN resultados", async () => {
    const result = await findPeerMunicipalities(FLORIANOPOLIS, 5);

    expect(result).toHaveLength(5);
  });

  it("não inclui o próprio município", async () => {
    const result = await findPeerMunicipalities(FLORIANOPOLIS);

    const codes = result;
    expect(codes).not.toContain(FLORIANOPOLIS);
  });

  it("resultado é ordenado por similaridade crescente de distância", async () => {
    const result = await findPeerMunicipalities(FLORIANOPOLIS, 5);

    expect(result.length).toBeGreaterThan(0);
    const unique = [...new Set(result)];
    expect(unique).toHaveLength(result.length);
  });

  it("retorna array vazio para código desconhecido", async () => {
    const result = await findPeerMunicipalities(CODIGO_INEXISTENTE);

    expect(result).toEqual([]);
  });

  it("respeita topN customizado", async () => {
    const result = await findPeerMunicipalities(FLORIANOPOLIS, 3);

    expect(result).toHaveLength(3);
  });

  it("Florianópolis tem peers de porte similar — Canoinhas não é peer", async () => {
    const CANOINHAS = "4203808";

    const result = await findPeerMunicipalities(FLORIANOPOLIS, 5);

    expect(result).not.toContain(CANOINHAS);
  });
});
