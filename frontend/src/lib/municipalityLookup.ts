import { SC_MUNICIPALITIES } from "../../../shared/constants/municipalities-sc";

const nameMap = new Map(SC_MUNICIPALITIES.map((m) => [m.ibgeCode, m.name]));

/**
 * Resolves an IBGE code to the municipality name.
 * Falls back to the code itself if not found in the static list.
 */
export function getMunicipalityName(ibgeCode: string): string {
  return nameMap.get(ibgeCode) ?? ibgeCode;
}
