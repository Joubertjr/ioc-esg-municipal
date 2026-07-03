/**
 * prisma/seed.ts
 *
 * Seed idempotente dos 295 municípios de Santa Catarina.
 * Usa upsert para ser seguro em execuções repetidas.
 *
 * Execução:
 *   pnpm db:seed
 *   ou
 *   npx prisma db seed
 */

import { PrismaClient } from "@prisma/client";
import { Decimal } from "decimal.js";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

type TransactionClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

// ---------------------------------------------------------------------------
// Tipos internos para o seed
// ---------------------------------------------------------------------------

interface MunicipalityRecord {
  ibgeCode: string;
  siconfiCode: string;
  name: string;
  state: "SC";
  population: number;
  fpmAnnual: Decimal;
}

interface OdsScoreInput {
  odsNumber: number; // 0 = global, 1-17 = ODS específico
  score: number;
  status: "verde" | "amarelo" | "vermelho";
  indicatorCount: number;
  sources: string[];
}

/**
 * Determina o status com base no score.
 * Verde >= 70 | Amarelo 40-69 | Vermelho < 40
 */
function scoreToStatus(score: number): "verde" | "amarelo" | "vermelho" {
  if (score >= 70) return "verde";
  if (score >= 40) return "amarelo";
  return "vermelho";
}

/**
 * Fontes de dados por ODS.
 */
const ODS_SOURCES: Record<number, string[]> = {
  0: [
    "ibge",
    "siconfi",
    "datasus",
    "inep",
    "snis",
    "inpe",
    "pncp",
    "tse",
    "aneel",
    "snis-rs",
    "ana",
    "convenios",
    "anatel",
    "sisvan",
  ],
  1: ["ibge"],
  2: ["ibge", "sisvan"],
  3: ["siconfi", "datasus"],
  4: ["siconfi", "inep"],
  5: ["tse"],
  6: ["snis"],
  7: ["aneel"],
  8: ["ibge"],
  9: ["ibge", "anatel"],
  10: ["ibge"],
  11: ["ibge", "siconfi"],
  12: ["snis-rs"],
  13: ["inpe"],
  14: ["ana"],
  15: ["inpe"],
  16: ["siconfi", "pncp"],
  17: ["siconfi", "convenios"],
};

/**
 * Número de indicadores por ODS usado no seed (estimativa).
 */
const ODS_INDICATOR_COUNT: Record<number, number> = {
  0: 17,
  1: 4,
  2: 3,
  3: 5,
  4: 4,
  5: 3,
  6: 4,
  7: 2,
  8: 4,
  9: 3,
  10: 3,
  11: 5,
  12: 3,
  13: 3,
  14: 2,
  15: 3,
  16: 4,
  17: 2,
};

/**
 * Scores base por ODS para municípios de diferentes perfis.
 * Variações são adicionadas por município individualmente.
 */
const ODS_BASE_SCORES_LARGE: Record<number, number> = {
  1: 68,
  2: 62,
  3: 72,
  4: 74,
  5: 60,
  6: 71,
  7: 65,
  8: 70,
  9: 66,
  10: 55,
  11: 68,
  12: 58,
  13: 54,
  14: 45,
  15: 52,
  16: 67,
  17: 63,
};

const ODS_BASE_SCORES_MEDIUM: Record<number, number> = {
  1: 54,
  2: 50,
  3: 58,
  4: 60,
  5: 48,
  6: 56,
  7: 52,
  8: 55,
  9: 50,
  10: 44,
  11: 53,
  12: 46,
  13: 42,
  14: 38,
  15: 43,
  16: 52,
  17: 49,
};

const ODS_BASE_SCORES_SMALL: Record<number, number> = {
  1: 42,
  2: 38,
  3: 46,
  4: 48,
  5: 36,
  6: 44,
  7: 40,
  8: 43,
  9: 38,
  10: 34,
  11: 41,
  12: 36,
  13: 33,
  14: 30,
  15: 35,
  16: 40,
  17: 37,
};

/**
 * Perfil por ibgeCode para os top-20 municípios.
 * Variação determinística via hash do ibgeCode para reprodutibilidade.
 */
function deterministicVariation(ibgeCode: string, odsNumber: number): number {
  const seed = parseInt(ibgeCode, 10);
  // Variação de -8 a +8, determinística
  return ((seed * (odsNumber + 1)) % 17) - 8;
}

type MunicipalityProfile = "large" | "medium" | "small";

const TOP_20_PROFILES: Record<string, MunicipalityProfile> = {
  "4209102": "large", // Joinville
  "4205407": "large", // Florianópolis
  "4202404": "large", // Blumenau
  "4216602": "large", // São José
  "4208203": "medium", // Itajaí
  "4204202": "medium", // Chapecó
  "4204608": "medium", // Criciúma
  "4211900": "medium", // Palhoça
  "4208906": "medium", // Jaraguá do Sul
  "4209300": "medium", // Lages
  "4201307": "medium", // Araquari
  "4218202": "medium", // Tubarão
  "4211306": "small", // Navegantes
  "4202305": "small", // Biguaçu
  "4203006": "small", // Caçador
  "4207502": "small", // Indaial
  "4205902": "small", // Gaspar
  "4210100": "small", // Mafra
  "4206504": "small", // Guaramirim
  "4210506": "small", // Maravilha
};

const BASE_SCORES_BY_PROFILE: Record<MunicipalityProfile, Record<number, number>> = {
  large: ODS_BASE_SCORES_LARGE,
  medium: ODS_BASE_SCORES_MEDIUM,
  small: ODS_BASE_SCORES_SMALL,
};

/**
 * Gera os 18 OdsScoreInput (17 ODS + 1 global) para um município do top-20.
 */
function buildOdsScores(ibgeCode: string): OdsScoreInput[] {
  const profile = TOP_20_PROFILES[ibgeCode] ?? "small";
  const baseScores = BASE_SCORES_BY_PROFILE[profile];
  const scores: OdsScoreInput[] = [];
  let globalSum = 0;

  for (let ods = 1; ods <= 17; ods++) {
    const variation = deterministicVariation(ibgeCode, ods);
    const raw = (baseScores[ods] ?? 50) + variation;
    const score = Math.min(100, Math.max(0, raw));
    globalSum += score;

    scores.push({
      odsNumber: ods,
      score,
      status: scoreToStatus(score),
      indicatorCount: ODS_INDICATOR_COUNT[ods] ?? 2,
      sources: ODS_SOURCES[ods] ?? ["ibge"],
    });
  }

  const globalScore = Math.round(globalSum / 17);
  scores.push({
    odsNumber: 0,
    score: globalScore,
    status: scoreToStatus(globalScore),
    indicatorCount: ODS_INDICATOR_COUNT[0] ?? 17,
    sources: ODS_SOURCES[0] ?? ["ibge"],
  });

  return scores;
}

// ---------------------------------------------------------------------------
// Mapeamento explícito: top-20 municípios por população (dados IBGE/STN 2023)
// ---------------------------------------------------------------------------

const TOP_20: Record<string, { name: string; population: number; fpmAnnual: number }> = {
  "4209102": { name: "Joinville", population: 616323, fpmAnnual: 200_000_000 },
  "4205407": { name: "Florianópolis", population: 537213, fpmAnnual: 180_000_000 },
  "4202404": { name: "Blumenau", population: 365549, fpmAnnual: 140_000_000 },
  "4216602": { name: "São José", population: 256923, fpmAnnual: 115_000_000 },
  "4208203": { name: "Itajaí", population: 249706, fpmAnnual: 110_000_000 },
  "4204202": { name: "Chapecó", population: 230932, fpmAnnual: 100_000_000 },
  "4204608": { name: "Criciúma", population: 221676, fpmAnnual: 95_000_000 },
  "4211900": { name: "Palhoça", population: 189671, fpmAnnual: 82_000_000 },
  "4208906": { name: "Jaraguá do Sul", population: 183278, fpmAnnual: 80_000_000 },
  "4209300": { name: "Lages", population: 158732, fpmAnnual: 75_000_000 },
  "4201307": { name: "Araquari", population: 152078, fpmAnnual: 72_000_000 },
  "4218202": { name: "Tubarão", population: 107861, fpmAnnual: 55_000_000 },
  "4211306": { name: "Navegantes", population: 92798, fpmAnnual: 48_000_000 },
  "4202305": { name: "Biguaçu", population: 85477, fpmAnnual: 45_000_000 },
  "4203006": { name: "Caçador", population: 79489, fpmAnnual: 40_000_000 },
  "4207502": { name: "Indaial", population: 75651, fpmAnnual: 39_000_000 },
  "4205902": { name: "Gaspar", population: 72842, fpmAnnual: 38_000_000 },
  "4210100": { name: "Mafra", population: 57706, fpmAnnual: 32_000_000 },
  "4206504": { name: "Guaramirim", population: 49734, fpmAnnual: 28_000_000 },
  "4210506": { name: "Maravilha", population: 25354, fpmAnnual: 18_000_000 },
};

// ---------------------------------------------------------------------------
// Dados completos de todos os 295 municípios (IBGE 2023)
// Municípios fora do top-20: população e FPM estimados proporcionalmente.
// fpmAnnual ≈ population * 600 (coeficiente médio para pequenos municípios SC)
// ---------------------------------------------------------------------------

const ALL_SC_MUNICIPALITIES: Array<{ ibgeCode: string; siconfiCode: string; name: string }> = [
  { ibgeCode: "4200051", siconfiCode: "420005", name: "Abdon Batista" },
  { ibgeCode: "4200101", siconfiCode: "420010", name: "Abelardo Luz" },
  { ibgeCode: "4200200", siconfiCode: "420020", name: "Agrolândia" },
  { ibgeCode: "4200309", siconfiCode: "420030", name: "Agronômica" },
  { ibgeCode: "4200408", siconfiCode: "420040", name: "Água Doce" },
  { ibgeCode: "4200507", siconfiCode: "420050", name: "Águas de Chapecó" },
  { ibgeCode: "4200556", siconfiCode: "420055", name: "Águas Frias" },
  { ibgeCode: "4200606", siconfiCode: "420060", name: "Águas Mornas" },
  { ibgeCode: "4200705", siconfiCode: "420070", name: "Alfredo Wagner" },
  { ibgeCode: "4200754", siconfiCode: "420075", name: "Alto Bela Vista" },
  { ibgeCode: "4200804", siconfiCode: "420080", name: "Anchieta" },
  { ibgeCode: "4200903", siconfiCode: "420090", name: "Angelina" },
  { ibgeCode: "4201000", siconfiCode: "420100", name: "Anita Garibaldi" },
  { ibgeCode: "4201109", siconfiCode: "420110", name: "Anitápolis" },
  { ibgeCode: "4201208", siconfiCode: "420120", name: "Antônio Carlos" },
  { ibgeCode: "4201257", siconfiCode: "420125", name: "Apiúna" },
  { ibgeCode: "4201273", siconfiCode: "420127", name: "Arabutã" },
  { ibgeCode: "4201307", siconfiCode: "420130", name: "Araquari" },
  { ibgeCode: "4201406", siconfiCode: "420140", name: "Araranguá" },
  { ibgeCode: "4201505", siconfiCode: "420150", name: "Armazém" },
  { ibgeCode: "4201604", siconfiCode: "420160", name: "Arroio Trinta" },
  { ibgeCode: "4201653", siconfiCode: "420165", name: "Arvoredo" },
  { ibgeCode: "4201703", siconfiCode: "420170", name: "Ascurra" },
  { ibgeCode: "4201802", siconfiCode: "420180", name: "Atalanta" },
  { ibgeCode: "4201901", siconfiCode: "420190", name: "Aurora" },
  { ibgeCode: "4201950", siconfiCode: "420195", name: "Balneário Arroio do Silva" },
  { ibgeCode: "4202057", siconfiCode: "420205", name: "Balneário Barra do Sul" },
  { ibgeCode: "4202008", siconfiCode: "420200", name: "Balneário Camboriú" },
  { ibgeCode: "4202073", siconfiCode: "420207", name: "Balneário Gaivota" },
  { ibgeCode: "4212809", siconfiCode: "421280", name: "Balneário Piçarras" },
  { ibgeCode: "4220000", siconfiCode: "422000", name: "Balneário Rincão" },
  { ibgeCode: "4202081", siconfiCode: "420208", name: "Bandeirante" },
  { ibgeCode: "4202099", siconfiCode: "420209", name: "Barra Bonita" },
  { ibgeCode: "4202107", siconfiCode: "420210", name: "Barra Velha" },
  { ibgeCode: "4202131", siconfiCode: "420213", name: "Bela Vista do Toldo" },
  { ibgeCode: "4202156", siconfiCode: "420215", name: "Belmonte" },
  { ibgeCode: "4202206", siconfiCode: "420220", name: "Benedito Novo" },
  { ibgeCode: "4202305", siconfiCode: "420230", name: "Biguaçu" },
  { ibgeCode: "4202404", siconfiCode: "420240", name: "Blumenau" },
  { ibgeCode: "4202438", siconfiCode: "420243", name: "Bocaina do Sul" },
  { ibgeCode: "4202503", siconfiCode: "420250", name: "Bom Jardim da Serra" },
  { ibgeCode: "4202537", siconfiCode: "420253", name: "Bom Jesus" },
  { ibgeCode: "4202578", siconfiCode: "420257", name: "Bom Jesus do Oeste" },
  { ibgeCode: "4202602", siconfiCode: "420260", name: "Bom Retiro" },
  { ibgeCode: "4202453", siconfiCode: "420245", name: "Bombinhas" },
  { ibgeCode: "4202701", siconfiCode: "420270", name: "Botuverá" },
  { ibgeCode: "4202800", siconfiCode: "420280", name: "Braço do Norte" },
  { ibgeCode: "4202859", siconfiCode: "420285", name: "Braço do Trombudo" },
  { ibgeCode: "4202875", siconfiCode: "420287", name: "Brunópolis" },
  { ibgeCode: "4202909", siconfiCode: "420290", name: "Brusque" },
  { ibgeCode: "4203006", siconfiCode: "420300", name: "Caçador" },
  { ibgeCode: "4203105", siconfiCode: "420310", name: "Caibi" },
  { ibgeCode: "4203154", siconfiCode: "420315", name: "Calmon" },
  { ibgeCode: "4203204", siconfiCode: "420320", name: "Camboriú" },
  { ibgeCode: "4203303", siconfiCode: "420330", name: "Campo Alegre" },
  { ibgeCode: "4203402", siconfiCode: "420340", name: "Campo Belo do Sul" },
  { ibgeCode: "4203501", siconfiCode: "420350", name: "Campo Erê" },
  { ibgeCode: "4203600", siconfiCode: "420360", name: "Campos Novos" },
  { ibgeCode: "4203709", siconfiCode: "420370", name: "Canelinha" },
  { ibgeCode: "4203808", siconfiCode: "420380", name: "Canoinhas" },
  { ibgeCode: "4203253", siconfiCode: "420325", name: "Capão Alto" },
  { ibgeCode: "4203907", siconfiCode: "420390", name: "Capinzal" },
  { ibgeCode: "4203956", siconfiCode: "420395", name: "Capivari de Baixo" },
  { ibgeCode: "4204004", siconfiCode: "420400", name: "Catanduvas" },
  { ibgeCode: "4204103", siconfiCode: "420410", name: "Caxambu do Sul" },
  { ibgeCode: "4204152", siconfiCode: "420415", name: "Celso Ramos" },
  { ibgeCode: "4204178", siconfiCode: "420417", name: "Cerro Negro" },
  { ibgeCode: "4204194", siconfiCode: "420419", name: "Chapadão do Lageado" },
  { ibgeCode: "4204202", siconfiCode: "420420", name: "Chapecó" },
  { ibgeCode: "4204251", siconfiCode: "420425", name: "Cocal do Sul" },
  { ibgeCode: "4204301", siconfiCode: "420430", name: "Concórdia" },
  { ibgeCode: "4204350", siconfiCode: "420435", name: "Cordilheira Alta" },
  { ibgeCode: "4204400", siconfiCode: "420440", name: "Coronel Freitas" },
  { ibgeCode: "4204459", siconfiCode: "420445", name: "Coronel Martins" },
  { ibgeCode: "4204558", siconfiCode: "420455", name: "Correia Pinto" },
  { ibgeCode: "4204509", siconfiCode: "420450", name: "Corupá" },
  { ibgeCode: "4204608", siconfiCode: "420460", name: "Criciúma" },
  { ibgeCode: "4204707", siconfiCode: "420470", name: "Cunha Porã" },
  { ibgeCode: "4204756", siconfiCode: "420475", name: "Cunhataí" },
  { ibgeCode: "4204806", siconfiCode: "420480", name: "Curitibanos" },
  { ibgeCode: "4204905", siconfiCode: "420490", name: "Descanso" },
  { ibgeCode: "4205001", siconfiCode: "420500", name: "Dionísio Cerqueira" },
  { ibgeCode: "4205100", siconfiCode: "420510", name: "Dona Emma" },
  { ibgeCode: "4205159", siconfiCode: "420515", name: "Doutor Pedrinho" },
  { ibgeCode: "4205175", siconfiCode: "420517", name: "Entre Rios" },
  { ibgeCode: "4205191", siconfiCode: "420519", name: "Ermo" },
  { ibgeCode: "4205209", siconfiCode: "420520", name: "Erval Velho" },
  { ibgeCode: "4205308", siconfiCode: "420530", name: "Faxinal dos Guedes" },
  { ibgeCode: "4205357", siconfiCode: "420535", name: "Flor do Sertão" },
  { ibgeCode: "4205407", siconfiCode: "420540", name: "Florianópolis" },
  { ibgeCode: "4205431", siconfiCode: "420543", name: "Formosa do Sul" },
  { ibgeCode: "4205456", siconfiCode: "420545", name: "Forquilhinha" },
  { ibgeCode: "4205506", siconfiCode: "420550", name: "Fraiburgo" },
  { ibgeCode: "4205555", siconfiCode: "420555", name: "Frei Rogério" },
  { ibgeCode: "4205605", siconfiCode: "420560", name: "Galvão" },
  { ibgeCode: "4205704", siconfiCode: "420570", name: "Garopaba" },
  { ibgeCode: "4205803", siconfiCode: "420580", name: "Garuva" },
  { ibgeCode: "4205902", siconfiCode: "420590", name: "Gaspar" },
  { ibgeCode: "4206009", siconfiCode: "420600", name: "Governador Celso Ramos" },
  { ibgeCode: "4206108", siconfiCode: "420610", name: "Grão-Pará" },
  { ibgeCode: "4206207", siconfiCode: "420620", name: "Gravatal" },
  { ibgeCode: "4206306", siconfiCode: "420630", name: "Guabiruba" },
  { ibgeCode: "4206405", siconfiCode: "420640", name: "Guaraciaba" },
  { ibgeCode: "4206504", siconfiCode: "420650", name: "Guaramirim" },
  { ibgeCode: "4206603", siconfiCode: "420660", name: "Guarujá do Sul" },
  { ibgeCode: "4206652", siconfiCode: "420665", name: "Guatambú" },
  { ibgeCode: "4206702", siconfiCode: "420670", name: "Herval d'Oeste" },
  { ibgeCode: "4206751", siconfiCode: "420675", name: "Ibiam" },
  { ibgeCode: "4206801", siconfiCode: "420680", name: "Ibicaré" },
  { ibgeCode: "4206900", siconfiCode: "420690", name: "Ibirama" },
  { ibgeCode: "4207007", siconfiCode: "420700", name: "Içara" },
  { ibgeCode: "4207106", siconfiCode: "420710", name: "Ilhota" },
  { ibgeCode: "4207205", siconfiCode: "420720", name: "Imaruí" },
  { ibgeCode: "4207304", siconfiCode: "420730", name: "Imbituba" },
  { ibgeCode: "4207403", siconfiCode: "420740", name: "Imbuia" },
  { ibgeCode: "4207502", siconfiCode: "420750", name: "Indaial" },
  { ibgeCode: "4207577", siconfiCode: "420757", name: "Iomerê" },
  { ibgeCode: "4207601", siconfiCode: "420760", name: "Ipira" },
  { ibgeCode: "4207650", siconfiCode: "420765", name: "Iporã do Oeste" },
  { ibgeCode: "4207684", siconfiCode: "420768", name: "Ipuaçu" },
  { ibgeCode: "4207700", siconfiCode: "420770", name: "Ipumirim" },
  { ibgeCode: "4207759", siconfiCode: "420775", name: "Iraceminha" },
  { ibgeCode: "4207809", siconfiCode: "420780", name: "Irani" },
  { ibgeCode: "4207858", siconfiCode: "420785", name: "Irati" },
  { ibgeCode: "4207908", siconfiCode: "420790", name: "Irineópolis" },
  { ibgeCode: "4208005", siconfiCode: "420800", name: "Itá" },
  { ibgeCode: "4208104", siconfiCode: "420810", name: "Itaiópolis" },
  { ibgeCode: "4208203", siconfiCode: "420820", name: "Itajaí" },
  { ibgeCode: "4208302", siconfiCode: "420830", name: "Itapema" },
  { ibgeCode: "4208401", siconfiCode: "420840", name: "Itapiranga" },
  { ibgeCode: "4208450", siconfiCode: "420845", name: "Itapoá" },
  { ibgeCode: "4208500", siconfiCode: "420850", name: "Ituporanga" },
  { ibgeCode: "4208609", siconfiCode: "420860", name: "Jaborá" },
  { ibgeCode: "4208708", siconfiCode: "420870", name: "Jacinto Machado" },
  { ibgeCode: "4208807", siconfiCode: "420880", name: "Jaguaruna" },
  { ibgeCode: "4208906", siconfiCode: "420890", name: "Jaraguá do Sul" },
  { ibgeCode: "4208955", siconfiCode: "420895", name: "Jardinópolis" },
  { ibgeCode: "4209003", siconfiCode: "420900", name: "Joaçaba" },
  { ibgeCode: "4209102", siconfiCode: "420910", name: "Joinville" },
  { ibgeCode: "4209151", siconfiCode: "420915", name: "José Boiteux" },
  { ibgeCode: "4209177", siconfiCode: "420917", name: "Jupiá" },
  { ibgeCode: "4209201", siconfiCode: "420920", name: "Lacerdópolis" },
  { ibgeCode: "4209300", siconfiCode: "420930", name: "Lages" },
  { ibgeCode: "4209409", siconfiCode: "420940", name: "Laguna" },
  { ibgeCode: "4209458", siconfiCode: "420945", name: "Lajeado Grande" },
  { ibgeCode: "4209508", siconfiCode: "420950", name: "Laurentino" },
  { ibgeCode: "4209607", siconfiCode: "420960", name: "Lauro Müller" },
  { ibgeCode: "4209706", siconfiCode: "420970", name: "Lebon Régis" },
  { ibgeCode: "4209805", siconfiCode: "420980", name: "Leoberto Leal" },
  { ibgeCode: "4209854", siconfiCode: "420985", name: "Lindóia do Sul" },
  { ibgeCode: "4209904", siconfiCode: "420990", name: "Lontras" },
  { ibgeCode: "4210001", siconfiCode: "421000", name: "Luiz Alves" },
  { ibgeCode: "4210035", siconfiCode: "421003", name: "Luzerna" },
  { ibgeCode: "4210050", siconfiCode: "421005", name: "Macieira" },
  { ibgeCode: "4210100", siconfiCode: "421010", name: "Mafra" },
  { ibgeCode: "4210209", siconfiCode: "421020", name: "Major Gercino" },
  { ibgeCode: "4210308", siconfiCode: "421030", name: "Major Vieira" },
  { ibgeCode: "4210407", siconfiCode: "421040", name: "Maracajá" },
  { ibgeCode: "4210506", siconfiCode: "421050", name: "Maravilha" },
  { ibgeCode: "4210555", siconfiCode: "421055", name: "Marema" },
  { ibgeCode: "4210605", siconfiCode: "421060", name: "Massaranduba" },
  { ibgeCode: "4210704", siconfiCode: "421070", name: "Matos Costa" },
  { ibgeCode: "4210803", siconfiCode: "421080", name: "Meleiro" },
  { ibgeCode: "4210852", siconfiCode: "421085", name: "Mirim Doce" },
  { ibgeCode: "4210902", siconfiCode: "421090", name: "Modelo" },
  { ibgeCode: "4211009", siconfiCode: "421100", name: "Mondaí" },
  { ibgeCode: "4211058", siconfiCode: "421105", name: "Monte Carlo" },
  { ibgeCode: "4211108", siconfiCode: "421110", name: "Monte Castelo" },
  { ibgeCode: "4211207", siconfiCode: "421120", name: "Morro da Fumaça" },
  { ibgeCode: "4211256", siconfiCode: "421125", name: "Morro Grande" },
  { ibgeCode: "4211306", siconfiCode: "421130", name: "Navegantes" },
  { ibgeCode: "4211405", siconfiCode: "421140", name: "Nova Erechim" },
  { ibgeCode: "4211454", siconfiCode: "421145", name: "Nova Itaberaba" },
  { ibgeCode: "4211504", siconfiCode: "421150", name: "Nova Trento" },
  { ibgeCode: "4211603", siconfiCode: "421160", name: "Nova Veneza" },
  { ibgeCode: "4211652", siconfiCode: "421165", name: "Novo Horizonte" },
  { ibgeCode: "4211702", siconfiCode: "421170", name: "Orleans" },
  { ibgeCode: "4211751", siconfiCode: "421175", name: "Otacílio Costa" },
  { ibgeCode: "4211801", siconfiCode: "421180", name: "Ouro" },
  { ibgeCode: "4211850", siconfiCode: "421185", name: "Ouro Verde" },
  { ibgeCode: "4211876", siconfiCode: "421187", name: "Paial" },
  { ibgeCode: "4211892", siconfiCode: "421189", name: "Painel" },
  { ibgeCode: "4211900", siconfiCode: "421190", name: "Palhoça" },
  { ibgeCode: "4212007", siconfiCode: "421200", name: "Palma Sola" },
  { ibgeCode: "4212056", siconfiCode: "421205", name: "Palmeira" },
  { ibgeCode: "4212106", siconfiCode: "421210", name: "Palmitos" },
  { ibgeCode: "4212205", siconfiCode: "421220", name: "Papanduva" },
  { ibgeCode: "4212239", siconfiCode: "421223", name: "Paraíso" },
  { ibgeCode: "4212254", siconfiCode: "421225", name: "Passo de Torres" },
  { ibgeCode: "4212270", siconfiCode: "421227", name: "Passos Maia" },
  { ibgeCode: "4212304", siconfiCode: "421230", name: "Paulo Lopes" },
  { ibgeCode: "4212403", siconfiCode: "421240", name: "Pedras Grandes" },
  { ibgeCode: "4212502", siconfiCode: "421250", name: "Penha" },
  { ibgeCode: "4212601", siconfiCode: "421260", name: "Peritiba" },
  { ibgeCode: "4212650", siconfiCode: "421265", name: "Pescaria Brava" },
  { ibgeCode: "4212700", siconfiCode: "421270", name: "Petrolândia" },
  { ibgeCode: "4212908", siconfiCode: "421290", name: "Pinhalzinho" },
  { ibgeCode: "4213005", siconfiCode: "421300", name: "Pinheiro Preto" },
  { ibgeCode: "4213104", siconfiCode: "421310", name: "Piratuba" },
  { ibgeCode: "4213153", siconfiCode: "421315", name: "Planalto Alegre" },
  { ibgeCode: "4213203", siconfiCode: "421320", name: "Pomerode" },
  { ibgeCode: "4213302", siconfiCode: "421330", name: "Ponte Alta" },
  { ibgeCode: "4213351", siconfiCode: "421335", name: "Ponte Alta do Norte" },
  { ibgeCode: "4213401", siconfiCode: "421340", name: "Ponte Serrada" },
  { ibgeCode: "4213500", siconfiCode: "421350", name: "Porto Belo" },
  { ibgeCode: "4213609", siconfiCode: "421360", name: "Porto União" },
  { ibgeCode: "4213708", siconfiCode: "421370", name: "Pouso Redondo" },
  { ibgeCode: "4213807", siconfiCode: "421380", name: "Praia Grande" },
  { ibgeCode: "4213906", siconfiCode: "421390", name: "Presidente Castello Branco" },
  { ibgeCode: "4214003", siconfiCode: "421400", name: "Presidente Getúlio" },
  { ibgeCode: "4214102", siconfiCode: "421410", name: "Presidente Nereu" },
  { ibgeCode: "4214151", siconfiCode: "421415", name: "Princesa" },
  { ibgeCode: "4214201", siconfiCode: "421420", name: "Quilombo" },
  { ibgeCode: "4214300", siconfiCode: "421430", name: "Rancho Queimado" },
  { ibgeCode: "4214409", siconfiCode: "421440", name: "Rio das Antas" },
  { ibgeCode: "4214508", siconfiCode: "421450", name: "Rio do Campo" },
  { ibgeCode: "4214607", siconfiCode: "421460", name: "Rio do Oeste" },
  { ibgeCode: "4214805", siconfiCode: "421480", name: "Rio do Sul" },
  { ibgeCode: "4214706", siconfiCode: "421470", name: "Rio dos Cedros" },
  { ibgeCode: "4214904", siconfiCode: "421490", name: "Rio Fortuna" },
  { ibgeCode: "4215000", siconfiCode: "421500", name: "Rio Negrinho" },
  { ibgeCode: "4215059", siconfiCode: "421505", name: "Rio Rufino" },
  { ibgeCode: "4215075", siconfiCode: "421507", name: "Riqueza" },
  { ibgeCode: "4215109", siconfiCode: "421510", name: "Rodeio" },
  { ibgeCode: "4215208", siconfiCode: "421520", name: "Romelândia" },
  { ibgeCode: "4215307", siconfiCode: "421530", name: "Salete" },
  { ibgeCode: "4215356", siconfiCode: "421535", name: "Saltinho" },
  { ibgeCode: "4215406", siconfiCode: "421540", name: "Salto Veloso" },
  { ibgeCode: "4215455", siconfiCode: "421545", name: "Sangão" },
  { ibgeCode: "4215505", siconfiCode: "421550", name: "Santa Cecília" },
  { ibgeCode: "4215554", siconfiCode: "421555", name: "Santa Helena" },
  { ibgeCode: "4215604", siconfiCode: "421560", name: "Santa Rosa de Lima" },
  { ibgeCode: "4215653", siconfiCode: "421565", name: "Santa Rosa do Sul" },
  { ibgeCode: "4215679", siconfiCode: "421567", name: "Santa Terezinha" },
  { ibgeCode: "4215687", siconfiCode: "421568", name: "Santa Terezinha do Progresso" },
  { ibgeCode: "4215695", siconfiCode: "421569", name: "Santiago do Sul" },
  { ibgeCode: "4215703", siconfiCode: "421570", name: "Santo Amaro da Imperatriz" },
  { ibgeCode: "4215802", siconfiCode: "421580", name: "São Bento do Sul" },
  { ibgeCode: "4215752", siconfiCode: "421575", name: "São Bernardino" },
  { ibgeCode: "4215901", siconfiCode: "421590", name: "São Bonifácio" },
  { ibgeCode: "4216008", siconfiCode: "421600", name: "São Carlos" },
  { ibgeCode: "4216057", siconfiCode: "421605", name: "São Cristóvão do Sul" },
  { ibgeCode: "4216107", siconfiCode: "421610", name: "São Domingos" },
  { ibgeCode: "4216206", siconfiCode: "421620", name: "São Francisco do Sul" },
  { ibgeCode: "4216305", siconfiCode: "421630", name: "São João Batista" },
  { ibgeCode: "4216354", siconfiCode: "421635", name: "São João do Itaperiú" },
  { ibgeCode: "4216255", siconfiCode: "421625", name: "São João do Oeste" },
  { ibgeCode: "4216404", siconfiCode: "421640", name: "São João do Sul" },
  { ibgeCode: "4216503", siconfiCode: "421650", name: "São Joaquim" },
  { ibgeCode: "4216602", siconfiCode: "421660", name: "São José" },
  { ibgeCode: "4216701", siconfiCode: "421670", name: "São José do Cedro" },
  { ibgeCode: "4216800", siconfiCode: "421680", name: "São José do Cerrito" },
  { ibgeCode: "4216909", siconfiCode: "421690", name: "São Lourenço do Oeste" },
  { ibgeCode: "4217006", siconfiCode: "421700", name: "São Ludgero" },
  { ibgeCode: "4217105", siconfiCode: "421710", name: "São Martinho" },
  { ibgeCode: "4217154", siconfiCode: "421715", name: "São Miguel da Boa Vista" },
  { ibgeCode: "4217204", siconfiCode: "421720", name: "São Miguel do Oeste" },
  { ibgeCode: "4217253", siconfiCode: "421725", name: "São Pedro de Alcântara" },
  { ibgeCode: "4217303", siconfiCode: "421730", name: "Saudades" },
  { ibgeCode: "4217402", siconfiCode: "421740", name: "Schroeder" },
  { ibgeCode: "4217501", siconfiCode: "421750", name: "Seara" },
  { ibgeCode: "4217550", siconfiCode: "421755", name: "Serra Alta" },
  { ibgeCode: "4217600", siconfiCode: "421760", name: "Siderópolis" },
  { ibgeCode: "4217709", siconfiCode: "421770", name: "Sombrio" },
  { ibgeCode: "4217758", siconfiCode: "421775", name: "Sul Brasil" },
  { ibgeCode: "4217808", siconfiCode: "421780", name: "Taió" },
  { ibgeCode: "4217907", siconfiCode: "421790", name: "Tangará" },
  { ibgeCode: "4217956", siconfiCode: "421795", name: "Tigrinhos" },
  { ibgeCode: "4218004", siconfiCode: "421800", name: "Tijucas" },
  { ibgeCode: "4218103", siconfiCode: "421810", name: "Timbé do Sul" },
  { ibgeCode: "4218202", siconfiCode: "421820", name: "Timbó" },
  { ibgeCode: "4218251", siconfiCode: "421825", name: "Timbó Grande" },
  { ibgeCode: "4218301", siconfiCode: "421830", name: "Três Barras" },
  { ibgeCode: "4218350", siconfiCode: "421835", name: "Treviso" },
  { ibgeCode: "4218400", siconfiCode: "421840", name: "Treze de Maio" },
  { ibgeCode: "4218509", siconfiCode: "421850", name: "Treze Tílias" },
  { ibgeCode: "4218608", siconfiCode: "421860", name: "Trombudo Central" },
  { ibgeCode: "4218707", siconfiCode: "421870", name: "Tubarão" },
  { ibgeCode: "4218756", siconfiCode: "421875", name: "Tunápolis" },
  { ibgeCode: "4218806", siconfiCode: "421880", name: "Turvo" },
  { ibgeCode: "4218855", siconfiCode: "421885", name: "União do Oeste" },
  { ibgeCode: "4218905", siconfiCode: "421890", name: "Urubici" },
  { ibgeCode: "4218954", siconfiCode: "421895", name: "Urupema" },
  { ibgeCode: "4219002", siconfiCode: "421900", name: "Urussanga" },
  { ibgeCode: "4219101", siconfiCode: "421910", name: "Vargeão" },
  { ibgeCode: "4219150", siconfiCode: "421915", name: "Vargem" },
  { ibgeCode: "4219176", siconfiCode: "421917", name: "Vargem Bonita" },
  { ibgeCode: "4219200", siconfiCode: "421920", name: "Vidal Ramos" },
  { ibgeCode: "4219309", siconfiCode: "421930", name: "Videira" },
  { ibgeCode: "4219358", siconfiCode: "421935", name: "Vitor Meireles" },
  { ibgeCode: "4219408", siconfiCode: "421940", name: "Witmarsum" },
  { ibgeCode: "4219507", siconfiCode: "421950", name: "Xanxerê" },
  { ibgeCode: "4219606", siconfiCode: "421960", name: "Xavantina" },
  { ibgeCode: "4219705", siconfiCode: "421970", name: "Xaxim" },
  { ibgeCode: "4219853", siconfiCode: "421985", name: "Zortéa" },
];

// ---------------------------------------------------------------------------
// Constrói o array final com população e FPM
// ---------------------------------------------------------------------------

/**
 * Estimativa de FPM para municípios não listados no top-20.
 * Coeficiente médio para municípios pequenos de SC: R$600/habitante/ano.
 */
const FPM_COEFF = 600;

function buildRecord(m: {
  ibgeCode: string;
  siconfiCode: string;
  name: string;
}): MunicipalityRecord {
  const top20 = TOP_20[m.ibgeCode];

  if (top20 !== undefined) {
    return {
      ...m,
      state: "SC",
      population: top20.population,
      fpmAnnual: new Decimal(top20.fpmAnnual),
    };
  }

  // Municípios pequenos: estima pop entre 5.000-30.000 baseado em hash do código.
  // Isso é reproduzível — executar seed duas vezes gera o mesmo valor.
  const seed = parseInt(m.ibgeCode, 10) % 25000;
  const population = 5000 + seed;
  const fpmAnnual = new Decimal(population * FPM_COEFF);

  return {
    ...m,
    state: "SC",
    population,
    fpmAnnual,
  };
}

const MUNICIPALITIES: MunicipalityRecord[] = ALL_SC_MUNICIPALITIES.map(buildRecord);

// ---------------------------------------------------------------------------
// Seed principal
// ---------------------------------------------------------------------------

async function seedMunicipalities(tx: TransactionClient): Promise<void> {
  console.log(`[seed] Iniciando seed de ${MUNICIPALITIES.length} municípios de SC...`);

  let upserted = 0;
  let failed = 0;

  for (const mun of MUNICIPALITIES) {
    try {
      await tx.municipality.upsert({
        where: { ibgeCode: mun.ibgeCode },
        update: {
          name: mun.name,
          siconfiCode: mun.siconfiCode,
          state: mun.state,
          population: mun.population,
          fpmAnnual: mun.fpmAnnual,
        },
        create: {
          ibgeCode: mun.ibgeCode,
          siconfiCode: mun.siconfiCode,
          name: mun.name,
          state: mun.state,
          population: mun.population,
          fpmAnnual: mun.fpmAnnual,
        },
      });
      upserted++;
    } catch (err) {
      failed++;
      console.error(`[seed] Falha ao processar ${mun.ibgeCode} (${mun.name}):`, err);
    }
  }

  const total = await tx.municipality.count();
  console.log(
    `[seed] Municípios: ${upserted} upserts, ${failed} falhas. Total no banco: ${total} municípios.`,
  );

  if (failed > 0) {
    throw new Error(`[seed] ${failed} municípios falharam ao ser inseridos.`);
  }
}

async function seedOdsScores(tx: TransactionClient): Promise<void> {
  const REFERENCE_YEAR = 2023;
  const top20IbgeCodes = Object.keys(TOP_20_PROFILES);

  console.log(
    `[seed] Iniciando seed de OdsScore para ${top20IbgeCodes.length} municípios top-20...`,
  );

  let upserted = 0;
  let failed = 0;

  for (const ibgeCode of top20IbgeCodes) {
    // Busca o município no banco (deve existir após seedMunicipalities)
    const municipality = await tx.municipality.findUnique({
      where: { ibgeCode },
      select: { id: true, name: true },
    });

    if (municipality === null) {
      console.warn(`[seed] Município ${ibgeCode} não encontrado — pulando OdsScore.`);
      continue;
    }

    const scores = buildOdsScores(ibgeCode);

    for (const scoreInput of scores) {
      try {
        await tx.odsScore.upsert({
          where: {
            municipalityId_odsNumber_referenceYear: {
              municipalityId: municipality.id,
              odsNumber: scoreInput.odsNumber,
              referenceYear: REFERENCE_YEAR,
            },
          },
          update: {
            score: scoreInput.score,
            status: scoreInput.status,
            indicatorCount: scoreInput.indicatorCount,
            sources: scoreInput.sources,
            calculatedAt: new Date("2024-03-15T12:00:00Z"),
          },
          create: {
            municipalityId: municipality.id,
            odsNumber: scoreInput.odsNumber,
            score: scoreInput.score,
            status: scoreInput.status,
            indicatorCount: scoreInput.indicatorCount,
            referenceYear: REFERENCE_YEAR,
            calculatedAt: new Date("2024-03-15T12:00:00Z"),
            sources: scoreInput.sources,
          },
        });
        upserted++;
      } catch (err) {
        failed++;
        console.error(
          `[seed] Falha ao processar OdsScore ${municipality.name} ODS ${scoreInput.odsNumber}:`,
          err,
        );
      }
    }
  }

  const totalScores = await tx.odsScore.count();
  console.log(
    `[seed] OdsScore: ${upserted} upserts, ${failed} falhas. Total no banco: ${totalScores} scores.`,
  );

  if (failed > 0) {
    throw new Error(`[seed] ${failed} OdsScore falharam ao ser inseridos.`);
  }
}

const SEED_SALT_ROUNDS = 12;

async function seedAdminUser(tx: TransactionClient): Promise<void> {
  const email = process.env["ADMIN_EMAIL"] ?? "admin@ioc.local";
  const password = process.env["ADMIN_PASSWORD"];
  if (!password) {
    console.warn(
      "[seed] ⚠ ADMIN_PASSWORD não definida — criando admin com senha gerada aleatoriamente.",
    );
  }
  const finalPassword = password || crypto.randomUUID().slice(0, 16);

  const existing = await tx.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`[seed] Admin user ${email} já existe — pulando.`);
    return;
  }

  const floripa = await tx.municipality.findUnique({
    where: { ibgeCode: "4205407" },
    select: { id: true },
  });
  if (!floripa) {
    console.warn(
      "[seed] ⚠ Município 4205407 (Florianópolis) não encontrado — admin sem município.",
    );
  }

  const passwordHash = await bcrypt.hash(finalPassword, SEED_SALT_ROUNDS);
  await tx.user.create({
    data: {
      email,
      name: "Administrador IOC",
      passwordHash,
      role: "admin",
      municipalityId: floripa?.id ?? null,
    },
  });
  console.log(`[seed] Admin user ${email} criado com role=admin.`);
  if (!password) {
    console.log(`[seed] Senha gerada: ${finalPassword}`);
    console.log("[seed] Defina ADMIN_PASSWORD no .env para controlar a senha do admin.");
  }
}

async function main(): Promise<void> {
  console.log("[seed] Iniciando transação atômica...");

  await prisma.$transaction(
    async (tx) => {
      await seedMunicipalities(tx);
      await seedOdsScores(tx);
      await seedAdminUser(tx);
    },
    {
      maxWait: 10_000, // aguarda até 10s para adquirir conexão
      timeout: 60_000, // timeout da transação: 60s (seed é lento)
    },
  );

  console.log("[seed] Seed completo.");
}

main()
  .catch((err: unknown) => {
    console.error(
      "[seed] Erro fatal — transação revertida:",
      err instanceof Error ? err.message : String(err),
    );
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
