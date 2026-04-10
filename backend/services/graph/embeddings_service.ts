/**
 * backend/services/graph/embeddings_service.ts
 *
 * Serviço de embeddings semânticos para o Knowledge Graph ESG.
 *
 * Modelo: Xenova/multilingual-e5-small (384-dim, ONNX, multilingual)
 *   - Escolhido por: cobertura PT-BR robusta, tamanho compacto (~120MB),
 *     qualidade forte no MTEB, zero dependência externa (roda local via ONNX).
 *
 * Inspiração: HippoRAG (Gutiérrez et al., NeurIPS 2024) — embeddings dos nós
 * do grafo são usados como "seeds semânticos" para o Personalized PageRank.
 *
 * Lazy-loading: a pipeline só é baixada/inicializada na primeira chamada.
 * Em testes, pode-se injetar um embedder alternativo via `setEmbedder`.
 */

import { logger } from "../../utils/logger.js";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type EmbedFn = (text: string) => Promise<number[]>;

/** Dimensão do modelo padrão (multilingual-e5-small). */
export const EMBEDDING_DIM = 384;

// ─── Estado do módulo ─────────────────────────────────────────────────────────

let cachedEmbedder: EmbedFn | null = null;
let loadingPromise: Promise<EmbedFn> | null = null;

// ─── API pública ──────────────────────────────────────────────────────────────

/**
 * Injeta um embedder customizado. Útil para testes (mock determinístico) e
 * para trocar o backend sem recompilar (ex.: Voyage AI via API).
 */
export function setEmbedder(fn: EmbedFn | null): void {
  cachedEmbedder = fn;
  loadingPromise = null;
}

/**
 * Carrega lazy-load a pipeline de embeddings. Idempotente: múltiplos callers
 * concorrentes compartilham a mesma Promise.
 */
export async function getEmbedder(): Promise<EmbedFn> {
  if (cachedEmbedder !== null) return cachedEmbedder;
  if (loadingPromise !== null) return loadingPromise;

  loadingPromise = (async () => {
    logger.info("[embeddings] loading model Xenova/multilingual-e5-small");
    const start = Date.now();

    // Import dinâmico para evitar custo de parsing no boot do processo.
    // @huggingface/transformers lazy-carrega o runtime ONNX na primeira chamada.
    const transformers = await import("@huggingface/transformers");
    const pipeline = transformers.pipeline;

    const extractor = await pipeline("feature-extraction", "Xenova/multilingual-e5-small", {
      // Em produção devemos usar a versão quantizada (menor) por padrão.
      dtype: "q8",
    });

    logger.info("[embeddings] model loaded", { elapsedMs: Date.now() - start });

    const embedFn: EmbedFn = async (text: string): Promise<number[]> => {
      // e5 models requerem prefixo "query: " ou "passage: ".
      // Aqui usamos "passage: " para conteúdo catalogado (entities).
      // Para queries livres use `embedQuery`.
      const input =
        text.startsWith("query: ") || text.startsWith("passage: ") ? text : `passage: ${text}`;

      const output = (await extractor(input, {
        pooling: "mean",
        normalize: true,
      })) as { data: Float32Array };

      return Array.from(output.data);
    };

    cachedEmbedder = embedFn;
    return embedFn;
  })();

  return loadingPromise;
}

/**
 * Embed de uma passagem (conteúdo catalogado, ex.: nome/descrição de ODS).
 * Usa prefixo "passage: " conforme convenção do modelo e5.
 */
export async function embedPassage(text: string): Promise<number[]> {
  const embedder = await getEmbedder();
  return embedder(`passage: ${text}`);
}

/**
 * Embed de uma query de usuário (texto em linguagem natural buscando
 * entidades relevantes). Usa prefixo "query: ".
 */
export async function embedQuery(text: string): Promise<number[]> {
  const embedder = await getEmbedder();
  return embedder(`query: ${text}`);
}

// ─── Similaridade ─────────────────────────────────────────────────────────────

/**
 * Similaridade de cosseno entre dois vetores. Assume que os vetores já estão
 * normalizados (e5 com normalize=true) — nesse caso cosine = dot product.
 *
 * Se os vetores NÃO estiverem normalizados, calcula a forma completa.
 */
export function cosineSimilarity(a: readonly number[], b: readonly number[]): number {
  if (a.length !== b.length) {
    throw new Error(`cosineSimilarity: dimensões incompatíveis (${a.length} vs ${b.length})`);
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    dot += x * y;
    normA += x * x;
    normB += y * y;
  }

  if (normA === 0 || normB === 0) return 0;

  // Caso comum (e5 normalized): normA ~= normB ~= 1 → retorna dot.
  // Caso geral: divisão pelas normas.
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return dot / denom;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extrai um embedding armazenado nos props de uma Entity.
 * Retorna null se ausente ou malformado.
 */
export function extractEmbedding(props: unknown): number[] | null {
  if (typeof props !== "object" || props === null || Array.isArray(props)) return null;

  const emb = (props as Record<string, unknown>)["embedding"];
  if (!Array.isArray(emb)) return null;
  if (emb.length === 0) return null;

  // Garante que todos os valores são numéricos
  for (const v of emb) {
    if (typeof v !== "number" || !Number.isFinite(v)) return null;
  }

  return emb as number[];
}
