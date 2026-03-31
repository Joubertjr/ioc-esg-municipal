import axios from "axios";
import { API_CONFIGS } from "../shared/constants/apis.js";

async function validateApi(key: string): Promise<void> {
  const config = API_CONFIGS[key];
  if (!config) {
    console.log(`[SKIP] ${key}: configuração não encontrada`);
    return;
  }

  const testUrls: Record<string, string> = {
    ibge: `${config.baseUrl}/localidades/municipios/4204202`,
    siconfi: `${config.baseUrl}/entes?uf=SC`,
    pncp: `${config.baseUrl}/orgaos?pagina=1&tamanhoPagina=1`,
    inpe: config.baseUrl,
    datasus: config.baseUrl,
    inep: config.baseUrl,
    snis: config.baseUrl,
  };

  const url = testUrls[key] ?? config.baseUrl;

  try {
    const start = Date.now();
    const response = await axios.get(url, { timeout: config.timeoutMs });
    const elapsed = Date.now() - start;
    console.log(
      `[OK]   ${config.name.padEnd(10)} ${response.status} — ${elapsed}ms — ${url}`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`[FAIL] ${config.name.padEnd(10)} ${message} — ${url}`);
  }
}

async function main() {
  console.log("Validando conectividade com APIs governamentais...\n");

  const keys = Object.keys(API_CONFIGS);
  for (const key of keys) {
    await validateApi(key);
  }

  console.log("\nValidação concluída.");
}

main();
