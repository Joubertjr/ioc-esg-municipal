import type { OdsDefinition } from "../types/domain/ods.js";

/**
 * Os 17 Objetivos de Desenvolvimento Sustentável da ONU.
 * Pesos baseados em relevância para municípios brasileiros de pequeno/médio porte.
 */
export const ODS_DEFINITIONS: readonly OdsDefinition[] = [
  { number: 1, name: "Erradicação da Pobreza", shortName: "Pobreza", color: "#E5243B", weight: 1.0 },
  { number: 2, name: "Fome Zero e Agricultura Sustentável", shortName: "Fome Zero", color: "#DDA63A", weight: 0.8 },
  { number: 3, name: "Saúde e Bem-Estar", shortName: "Saúde", color: "#4C9F38", weight: 1.2 },
  { number: 4, name: "Educação de Qualidade", shortName: "Educação", color: "#C5192D", weight: 1.2 },
  { number: 5, name: "Igualdade de Gênero", shortName: "Gênero", color: "#FF3A21", weight: 0.6 },
  { number: 6, name: "Água Potável e Saneamento", shortName: "Saneamento", color: "#26BDE2", weight: 1.1 },
  { number: 7, name: "Energia Limpa e Acessível", shortName: "Energia", color: "#FCC30B", weight: 0.7 },
  { number: 8, name: "Trabalho Decente e Crescimento Econômico", shortName: "Trabalho", color: "#A21942", weight: 1.0 },
  { number: 9, name: "Indústria, Inovação e Infraestrutura", shortName: "Infraestrutura", color: "#FD6925", weight: 0.8 },
  { number: 10, name: "Redução das Desigualdades", shortName: "Desigualdade", color: "#DD1367", weight: 0.9 },
  { number: 11, name: "Cidades e Comunidades Sustentáveis", shortName: "Cidades", color: "#FD9D24", weight: 1.0 },
  { number: 12, name: "Consumo e Produção Responsáveis", shortName: "Consumo", color: "#BF8B2E", weight: 0.6 },
  { number: 13, name: "Ação Contra a Mudança Global do Clima", shortName: "Clima", color: "#3F7E44", weight: 0.8 },
  { number: 14, name: "Vida na Água", shortName: "Vida Aquática", color: "#0A97D9", weight: 0.5 },
  { number: 15, name: "Vida Terrestre", shortName: "Vida Terrestre", color: "#56C02B", weight: 0.7 },
  { number: 16, name: "Paz, Justiça e Instituições Eficazes", shortName: "Instituições", color: "#00689D", weight: 0.9 },
  { number: 17, name: "Parcerias e Meios de Implementação", shortName: "Parcerias", color: "#19486A", weight: 0.5 },
] as const;

export const ODS_COUNT = 17;

export function getOdsDefinition(number: number): OdsDefinition | undefined {
  return ODS_DEFINITIONS.find((ods) => ods.number === number);
}
