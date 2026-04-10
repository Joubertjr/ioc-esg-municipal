/**
 * scripts/seed-knowledge-graph.ts
 *
 * Seed do Knowledge Graph ESG.
 *
 *   Fase 1 — 17 entidades ODS com embedding semântico (multilingual-e5-small).
 *   Fase 2 — relacionamentos SINERGIA / TRADE_OFF (54 pares × 2 = 108 arestas).
 *
 * Idempotente: faz upsert nas entidades (preservando embedding quando possível),
 * recalcula embeddings apenas se ausentes, e deleta+recria edges ODS–ODS.
 *
 * Referências de weights/confidence:
 *   - Nilsson 2016 (Nature 534:320-322) — 7-point scale (-3..+3)
 *   - Pradhan 2017 (Earth's Future 5:1169-1179) — correlação Spearman em 227 países
 *   - IGES SDG Interlinkages Tool (2020)
 *   - Weitz 2018 (Sustainability Science 13:531-548) — cross-impact matrix
 *   - Moallemi 2022 (One Earth 5:410-422) — systems dynamics em 17 ODS
 *   - Kroll 2019 (Palgrave Comms 5:140) — empirical correlations SDG Index
 *   - Warchold 2022 (Sustainability 14:6) — country groupings sensitivity
 */

import { PrismaClient, Prisma } from "@prisma/client";
import { ODS_DEFINITIONS } from "../shared/constants/ods.js";
import { embedPassage, setEmbedder } from "../backend/services/graph/embeddings_service.js";

// ─── Tipos internos ────────────────────────────────────────────────────────────

interface RelationshipProps {
  weight: number;
  confidence: number;
  source: string;
  notes?: string;
}

interface EdgeDefinition {
  from: number;
  to: number;
  type: "SINERGIA" | "TRADE_OFF";
  props: RelationshipProps;
}

// ─── Matriz autoritativa SDG Interlinkages ─────────────────────────────────────
// Cada par gera duas arestas (A→B e B→A) com o mesmo weight.

const EDGE_PAIRS: EdgeDefinition[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // SINERGIAS — Pradhan 2017 (14 pares núcleo)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    from: 1,
    to: 3,
    type: "SINERGIA",
    props: { weight: 0.78, confidence: 0.9, source: "Pradhan 2017" },
  },
  {
    from: 1,
    to: 4,
    type: "SINERGIA",
    props: { weight: 0.77, confidence: 0.9, source: "Pradhan 2017" },
  },
  {
    from: 1,
    to: 5,
    type: "SINERGIA",
    props: { weight: 0.76, confidence: 0.88, source: "Pradhan 2017" },
  },
  {
    from: 1,
    to: 6,
    type: "SINERGIA",
    props: { weight: 0.75, confidence: 0.85, source: "Pradhan 2017" },
  },
  {
    from: 1,
    to: 8,
    type: "SINERGIA",
    props: { weight: 0.7, confidence: 0.85, source: "Pradhan 2017" },
  },
  {
    from: 1,
    to: 10,
    type: "SINERGIA",
    props: { weight: 0.75, confidence: 0.88, source: "Pradhan 2017" },
  },
  {
    from: 3,
    to: 4,
    type: "SINERGIA",
    props: { weight: 0.74, confidence: 0.9, source: "Pradhan 2017" },
  },
  {
    from: 3,
    to: 5,
    type: "SINERGIA",
    props: { weight: 0.73, confidence: 0.85, source: "Pradhan 2017" },
  },
  {
    from: 3,
    to: 6,
    type: "SINERGIA",
    props: { weight: 0.72, confidence: 0.9, source: "Pradhan 2017" },
  },
  {
    from: 4,
    to: 8,
    type: "SINERGIA",
    props: { weight: 0.71, confidence: 0.88, source: "Pradhan 2017" },
  },
  {
    from: 7,
    to: 9,
    type: "SINERGIA",
    props: { weight: 1.0, confidence: 0.95, source: "Nilsson 2016", notes: "Indivisible +3" },
  },
  {
    from: 7,
    to: 3,
    type: "SINERGIA",
    props: { weight: 0.67, confidence: 0.8, source: "Nilsson 2016", notes: "Reinforcing +2" },
  },
  {
    from: 7,
    to: 4,
    type: "SINERGIA",
    props: { weight: 0.33, confidence: 0.75, source: "Nilsson 2016", notes: "Enabling +1" },
  },
  {
    from: 13,
    to: 15,
    type: "SINERGIA",
    props: { weight: 0.95, confidence: 0.92, source: "Pradhan 2017" },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TRADE-OFFS — Pradhan/Nilsson/Weitz (10 pares núcleo)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    from: 3,
    to: 12,
    type: "TRADE_OFF",
    props: {
      weight: -0.53,
      confidence: 0.85,
      source: "Pradhan 2017, Nilsson 2016",
      notes: "Nilsson -2",
    },
  },
  {
    from: 12,
    to: 1,
    type: "TRADE_OFF",
    props: { weight: -0.45, confidence: 0.8, source: "Pradhan 2017" },
  },
  {
    from: 12,
    to: 2,
    type: "TRADE_OFF",
    props: { weight: -0.45, confidence: 0.8, source: "Pradhan 2017" },
  },
  {
    from: 12,
    to: 6,
    type: "TRADE_OFF",
    props: { weight: -0.4, confidence: 0.78, source: "Pradhan 2017" },
  },
  {
    from: 12,
    to: 7,
    type: "TRADE_OFF",
    props: { weight: -0.4, confidence: 0.8, source: "Pradhan 2017" },
  },
  {
    from: 15,
    to: 1,
    type: "TRADE_OFF",
    props: { weight: -0.42, confidence: 0.78, source: "Pradhan 2017" },
  },
  {
    from: 15,
    to: 2,
    type: "TRADE_OFF",
    props: { weight: -0.5, confidence: 0.82, source: "Pradhan 2017" },
  },
  {
    from: 15,
    to: 8,
    type: "TRADE_OFF",
    props: { weight: -0.38, confidence: 0.75, source: "Pradhan 2017" },
  },
  {
    from: 2,
    to: 15,
    type: "TRADE_OFF",
    props: { weight: -0.45, confidence: 0.8, source: "Pradhan 2017" },
  },
  {
    from: 9,
    to: 13,
    type: "TRADE_OFF",
    props: { weight: -0.35, confidence: 0.72, source: "Weitz 2018" },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPANSÃO MOALLEMI 2022 — ODS 11 (Cidades), 13 (Clima), 14 (Oceanos), 16 (Paz)
  // ═══════════════════════════════════════════════════════════════════════════

  // ── ODS 11 Cidades: sinergias ────────────────────────────────────────────
  {
    from: 11,
    to: 3,
    type: "SINERGIA",
    props: {
      weight: 0.65,
      confidence: 0.85,
      source: "Moallemi 2022",
      notes: "Urban health benefits",
    },
  },
  {
    from: 11,
    to: 6,
    type: "SINERGIA",
    props: { weight: 0.78, confidence: 0.88, source: "Kroll 2019" },
  },
  {
    from: 11,
    to: 9,
    type: "SINERGIA",
    props: { weight: 0.82, confidence: 0.9, source: "Pradhan 2017" },
  },
  {
    from: 11,
    to: 13,
    type: "SINERGIA",
    props: { weight: 0.6, confidence: 0.82, source: "Moallemi 2022", notes: "Low-carbon cities" },
  },
  {
    from: 11,
    to: 7,
    type: "SINERGIA",
    props: { weight: 0.7, confidence: 0.85, source: "Moallemi 2022" },
  },

  // ── ODS 11: trade-offs ──────────────────────────────────────────────────
  {
    from: 11,
    to: 15,
    type: "TRADE_OFF",
    props: {
      weight: -0.48,
      confidence: 0.8,
      source: "Moallemi 2022",
      notes: "Urban sprawl pressures terrestrial biodiversity",
    },
  },
  {
    from: 11,
    to: 12,
    type: "TRADE_OFF",
    props: {
      weight: -0.38,
      confidence: 0.75,
      source: "Warchold 2022",
      notes: "Urban consumption footprint",
    },
  },

  // ── ODS 13 Clima: sinergias ──────────────────────────────────────────────
  {
    from: 13,
    to: 7,
    type: "SINERGIA",
    props: {
      weight: 0.85,
      confidence: 0.92,
      source: "Nilsson 2016",
      notes: "Clean energy ↔ climate action (Reinforcing +2)",
    },
  },
  {
    from: 13,
    to: 14,
    type: "SINERGIA",
    props: { weight: 0.72, confidence: 0.88, source: "Moallemi 2022", notes: "Ocean CO₂ sink" },
  },
  {
    from: 13,
    to: 12,
    type: "SINERGIA",
    props: { weight: 0.58, confidence: 0.8, source: "Pradhan 2017" },
  },
  // (11↔13 já coberto em ODS 11 sinergias acima — grafo bidirecional)

  // ── ODS 13: trade-offs ─────────────────────────────────────────────────
  {
    from: 13,
    to: 1,
    type: "TRADE_OFF",
    props: {
      weight: -0.42,
      confidence: 0.78,
      source: "Pradhan 2017",
      notes: "Rising costs of climate mitigation impact the poor",
    },
  },
  {
    from: 13,
    to: 2,
    type: "TRADE_OFF",
    props: {
      weight: -0.4,
      confidence: 0.75,
      source: "Moallemi 2022",
      notes: "Biofuels vs food production",
    },
  },
  {
    from: 13,
    to: 8,
    type: "TRADE_OFF",
    props: {
      weight: -0.35,
      confidence: 0.72,
      source: "Weitz 2018",
      notes: "Short-term jobs in fossil industries",
    },
  },

  // ── ODS 14 Oceanos: sinergias ────────────────────────────────────────────
  // (13↔14 já coberto em ODS 13 sinergias — grafo bidirecional)
  {
    from: 14,
    to: 15,
    type: "SINERGIA",
    props: { weight: 0.68, confidence: 0.82, source: "Kroll 2019" },
  },
  {
    from: 14,
    to: 2,
    type: "SINERGIA",
    props: {
      weight: 0.55,
      confidence: 0.78,
      source: "Moallemi 2022",
      notes: "Sustainable fisheries",
    },
  },
  {
    from: 14,
    to: 6,
    type: "SINERGIA",
    props: { weight: 0.6, confidence: 0.8, source: "Kroll 2019" },
  },

  // ── ODS 14: trade-offs ──────────────────────────────────────────────────
  {
    from: 14,
    to: 8,
    type: "TRADE_OFF",
    props: {
      weight: -0.38,
      confidence: 0.75,
      source: "Moallemi 2022",
      notes: "Overfishing jobs vs marine conservation",
    },
  },
  {
    from: 14,
    to: 12,
    type: "TRADE_OFF",
    props: {
      weight: -0.42,
      confidence: 0.78,
      source: "Pradhan 2017",
      notes: "Plastic consumption vs ocean health",
    },
  },

  // ── ODS 16 Paz & Instituições: sinergias ─────────────────────────────────
  {
    from: 16,
    to: 10,
    type: "SINERGIA",
    props: { weight: 0.82, confidence: 0.9, source: "Pradhan 2017" },
  },
  {
    from: 16,
    to: 5,
    type: "SINERGIA",
    props: { weight: 0.75, confidence: 0.88, source: "Kroll 2019" },
  },
  {
    from: 16,
    to: 1,
    type: "SINERGIA",
    props: { weight: 0.72, confidence: 0.85, source: "Pradhan 2017" },
  },
  {
    from: 16,
    to: 4,
    type: "SINERGIA",
    props: { weight: 0.7, confidence: 0.85, source: "Moallemi 2022" },
  },
  {
    from: 16,
    to: 17,
    type: "SINERGIA",
    props: {
      weight: 0.88,
      confidence: 0.92,
      source: "Nilsson 2016",
      notes: "Institutions enable partnerships",
    },
  },

  // ── ODS 17 Parcerias: sinergia foundational ──────────────────────────────
  {
    from: 17,
    to: 9,
    type: "SINERGIA",
    props: { weight: 0.65, confidence: 0.82, source: "Pradhan 2017" },
  },
  {
    from: 17,
    to: 13,
    type: "SINERGIA",
    props: { weight: 0.68, confidence: 0.85, source: "Moallemi 2022" },
  },

  // ── Sinergias adicionais ODS 10 (desigualdade) — Kroll 2019 ──────────────
  {
    from: 10,
    to: 5,
    type: "SINERGIA",
    props: { weight: 0.78, confidence: 0.88, source: "Kroll 2019" },
  },
  {
    from: 10,
    to: 8,
    type: "SINERGIA",
    props: { weight: 0.72, confidence: 0.85, source: "Pradhan 2017" },
  },
  {
    from: 10,
    to: 4,
    type: "SINERGIA",
    props: { weight: 0.7, confidence: 0.85, source: "Kroll 2019" },
  },
];

// Data conservadora cobrindo as publicações base
const VALID_FROM = new Date("2024-01-01T00:00:00Z");

// Descrições ricas para embedding — incorpora conceitos-chave que queries de
// usuário tendem a usar (domínios, métricas, políticas públicas, contexto BR).
// A qualidade destes textos é o principal driver da recall semântica do grafo.
const ODS_DESCRIPTIONS: Record<number, string> = {
  1: "Erradicação da pobreza e pobreza extrema. Renda básica, transferência de renda, bolsa família, inclusão produtiva, vulnerabilidade social, cadastro único CadÚnico, beneficiários. Foco municipal: programas sociais de baixa renda, IDH, percentual da população abaixo da linha de pobreza.",
  2: "Fome zero e agricultura sustentável. Segurança alimentar, nutrição infantil, agricultura familiar, produção de alimentos, merenda escolar, combate à desnutrição, PNAE, PAA. Foco municipal: insegurança alimentar, obesidade, abastecimento, feira do produtor.",
  3: "Saúde e bem-estar. Mortalidade infantil, mortalidade materna, cobertura de atenção primária, vacinação, SUS, UBS, ESF, doenças crônicas, saúde mental, expectativa de vida. Foco municipal: cobertura ESF, leitos, gasto per capita em saúde, indicadores DATASUS.",
  4: "Educação de qualidade. IDEB, evasão escolar, alfabetização, ensino fundamental, ensino médio, creches, educação infantil, FUNDEB, formação de professores. Foco municipal: rede municipal, cobertura creche 0-3, notas IDEB anos iniciais/finais.",
  5: "Igualdade de gênero. Empoderamento feminino, violência doméstica, Lei Maria da Penha, participação política feminina, feminicídio, creches como política de gênero, salário igual, licença maternidade.",
  6: "Água potável e saneamento básico. Abastecimento de água, coleta de esgoto, tratamento de efluentes, SNIS, índice de perdas, CONAMA, ETE, ETA. Foco municipal: cobertura de água encanada, cobertura de esgoto tratado, qualidade da água.",
  7: "Energia limpa e acessível. Energia renovável, solar fotovoltaica, eólica, biomassa, eficiência energética, matriz energética limpa, distribuição de energia, acesso universal à eletricidade.",
  8: "Trabalho decente e crescimento econômico. Emprego formal, CLT, empreendedorismo, PIB municipal, arranjos produtivos locais, CAGED, carteira assinada, desemprego, MEI, economia solidária.",
  9: "Indústria, inovação e infraestrutura. Infraestrutura viária, indústria local, parques tecnológicos, inovação, PD&I, conectividade, internet banda larga, 4G/5G, logística, polos industriais.",
  10: "Redução das desigualdades. Índice de Gini, desigualdade de renda, inclusão social, renda dos 40% mais pobres, políticas afirmativas, mobilidade social, desigualdade regional.",
  11: "Cidades e comunidades sustentáveis. Mobilidade urbana, transporte público, habitação popular, áreas verdes urbanas, plano diretor, uso do solo, favelas, regularização fundiária, resíduos sólidos urbanos, poluição do ar.",
  12: "Consumo e produção responsáveis. Economia circular, reciclagem, resíduos sólidos, compostagem, coleta seletiva, logística reversa, desperdício de alimentos, consumo consciente, compras públicas sustentáveis.",
  13: "Ação contra a mudança do clima. Mitigação climática, adaptação, emissões de GEE, inventário de carbono, plano municipal de clima, eventos extremos, resiliência, defesa civil, enchentes, secas.",
  14: "Vida na água. Ecossistemas marinhos, pesca sustentável, áreas de proteção marinha, mangue, estuários, praias, poluição costeira, plástico nos oceanos. Mais relevante para municípios costeiros.",
  15: "Vida terrestre. Biodiversidade, Mata Atlântica, Cerrado, Caatinga, desmatamento, reflorestamento, unidades de conservação, APP, reserva legal, fiscalização ambiental, recuperação de nascentes.",
  16: "Paz, justiça e instituições eficazes. Transparência pública, acesso à informação, LAI, corrupção, violência urbana, homicídios, segurança pública, TCE, controle social, orçamento participativo, conselhos municipais.",
  17: "Parcerias e meios de implementação. Cooperação internacional, consórcios intermunicipais, parcerias público-privadas, captação de recursos, assistência técnica, cooperação federativa, emendas parlamentares.",
};

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  // Permite pular embeddings via env (útil em CI/smoke tests sem baixar modelo).
  const skipEmbeddings = process.env["SKIP_EMBEDDINGS"] === "1";

  if (skipEmbeddings) {
    console.log("⚠ SKIP_EMBEDDINGS=1 → seed sem embeddings (determinístico zero).");
    // Injeta um embedder mock: retorna vetor zero de 384 dimensões.
    setEmbedder(async (): Promise<number[]> => new Array<number>(384).fill(0));
  }

  const prisma = new PrismaClient({
    log: process.env["NODE_ENV"] === "development" ? ["error", "warn"] : ["error"],
  });

  const startTime = Date.now();

  try {
    // ── Fase 1: Seed das 17 entidades ODS com embedding ─────────────────────
    console.log("Fase 1 — Seeding 17 ODS entities with embeddings...");

    let entitiesUpserted = 0;

    for (const ods of ODS_DEFINITIONS) {
      // Texto de entrada para o embedding: nome canônico + descrição rica.
      const description = ODS_DESCRIPTIONS[ods.number] ?? ods.name;
      const textForEmbedding = `ODS ${ods.number}: ${ods.name}. ${description}`;

      // Checa se já existe entity com embedding válido — reusa se sim.
      const existing = await prisma.entity.findUnique({
        where: { type_externalId: { type: "ods", externalId: String(ods.number) } },
        select: { props: true },
      });

      let embedding: number[];
      const existingEmbedding =
        existing !== null &&
        typeof existing.props === "object" &&
        existing.props !== null &&
        !Array.isArray(existing.props) &&
        "embedding" in existing.props &&
        Array.isArray((existing.props as Record<string, unknown>).embedding)
          ? ((existing.props as Record<string, unknown>).embedding as number[])
          : null;

      if (existingEmbedding !== null && existingEmbedding.length === 384 && !skipEmbeddings) {
        embedding = existingEmbedding;
        console.log(`  ↻ ODS ${ods.number}: reusing cached embedding`);
      } else {
        const embedStart = Date.now();
        embedding = await embedPassage(textForEmbedding);
        console.log(
          `  ✎ ODS ${ods.number}: embedded ${textForEmbedding.slice(0, 40)}... (${Date.now() - embedStart}ms, dim=${embedding.length})`,
        );
      }

      const props = {
        number: ods.number,
        name: ods.name,
        shortName: ods.shortName,
        description,
        color: ods.color,
        weight: ods.weight,
        embedding,
      };

      await prisma.entity.upsert({
        where: { type_externalId: { type: "ods", externalId: String(ods.number) } },
        create: { type: "ods", externalId: String(ods.number), props },
        update: { props },
      });
      entitiesUpserted++;
    }

    console.log(`✓ Seeded ${entitiesUpserted} ODS entities`);

    // ── Fase 2: Seed dos relacionamentos ODS–ODS ──────────────────────────────
    console.log("Fase 2 — Seeding ODS relationships...");

    const odsEntities = await prisma.entity.findMany({
      where: { type: "ods" },
      select: { id: true, externalId: true },
    });

    const odsIdByNumber = new Map<number, string>();
    for (const entity of odsEntities) {
      if (entity.externalId !== null) {
        odsIdByNumber.set(Number(entity.externalId), entity.id);
      }
    }

    const deletedCount = await deleteOdsRelationships(prisma, odsIdByNumber);
    if (deletedCount > 0) {
      console.log(`  → Removed ${deletedCount} existing ODS relationships`);
    }

    const edgeData = buildEdgeData(EDGE_PAIRS, odsIdByNumber);

    if (edgeData.length > 0) {
      await prisma.relationship.createMany({ data: edgeData });
    }

    const relationshipsCreated = edgeData.length;
    console.log(
      `✓ Seeded ${relationshipsCreated} ODS relationships (${EDGE_PAIRS.length} pairs × 2)`,
    );

    // ── Fase 3: Resumo final ──────────────────────────────────────────────────
    const [totalEntities, totalRelationships] = await Promise.all([
      prisma.entity.count({ where: { type: "ods" } }),
      prisma.relationship.count({
        where: { type: { in: ["SINERGIA", "TRADE_OFF"] } },
      }),
    ]);

    const elapsed = Date.now() - startTime;

    console.log("");
    console.log("─────────────────────────────────────────");
    console.log("Knowledge Graph ESG — seed concluído");
    console.log(`  ODS entities  : ${totalEntities} (com embeddings)`);
    console.log(`  Relationships : ${totalRelationships} (SINERGIA + TRADE_OFF)`);
    console.log(`  Pares únicos  : ${EDGE_PAIRS.length}`);
    console.log(`  Tempo total   : ${elapsed}ms`);
    console.log("─────────────────────────────────────────");
  } finally {
    await prisma.$disconnect();
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function deleteOdsRelationships(
  prisma: PrismaClient,
  odsIdByNumber: Map<number, string>,
): Promise<number> {
  const odsIds = Array.from(odsIdByNumber.values());
  if (odsIds.length === 0) return 0;

  const result = await prisma.relationship.deleteMany({
    where: {
      type: { in: ["SINERGIA", "TRADE_OFF"] },
      fromId: { in: odsIds },
      toId: { in: odsIds },
    },
  });

  return result.count;
}

function buildEdgeData(
  pairs: EdgeDefinition[],
  odsIdByNumber: Map<number, string>,
): Array<{
  type: string;
  fromId: string;
  toId: string;
  props: Prisma.InputJsonValue;
  validFrom: Date;
  validUntil: null;
}> {
  const rows: ReturnType<typeof buildEdgeData> = [];

  for (const edge of pairs) {
    const fromId = odsIdByNumber.get(edge.from);
    const toId = odsIdByNumber.get(edge.to);

    if (fromId === undefined || toId === undefined) {
      console.warn(`  WARN: ODS ${edge.from} ou ${edge.to} não encontrado — aresta ignorada`);
      continue;
    }

    const props = edge.props as unknown as Prisma.InputJsonValue;

    rows.push({
      type: edge.type,
      fromId,
      toId,
      props,
      validFrom: VALID_FROM,
      validUntil: null,
    });

    rows.push({
      type: edge.type,
      fromId: toId,
      toId: fromId,
      props,
      validFrom: VALID_FROM,
      validUntil: null,
    });
  }

  return rows;
}

// ─── Entry point ──────────────────────────────────────────────────────────────

main().catch((err: unknown) => {
  console.error("Erro no seed do Knowledge Graph:", err);
  process.exit(1);
});
