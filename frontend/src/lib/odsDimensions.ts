export interface OdsDimension {
  name: string;
  description: string;
  odsNumbers: number[];
  color: string;
}

export const ODS_DIMENSIONS: OdsDimension[] = [
  {
    name: "Social",
    description: "Pessoas",
    odsNumbers: [1, 2, 3, 4, 5],
    color: "#e11d48",
  },
  {
    name: "Econômico",
    description: "Prosperidade",
    odsNumbers: [8, 9, 10, 11, 12],
    color: "#d97706",
  },
  {
    name: "Ambiental",
    description: "Planeta",
    odsNumbers: [6, 7, 13, 14, 15],
    color: "#16a34a",
  },
  {
    name: "Institucional",
    description: "Paz e Justiça",
    odsNumbers: [16],
    color: "#2563eb",
  },
  {
    name: "Parcerias",
    description: "Cooperação",
    odsNumbers: [17],
    color: "#7c3aed",
  },
];
