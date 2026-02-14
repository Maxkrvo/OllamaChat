const OLLAMA_BASE = process.env.OLLAMA_BASE_URL || "http://localhost:11434";

/** Check if Ollama is reachable and the embedding model is available. */
export async function checkEmbeddingModel(
  model = "nomic-embed-text"
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/tags`);
    if (!res.ok) return { ok: false, error: "Ollama is not reachable" };
    const data = await res.json();
    const models: string[] = data.models?.map((m: { name: string }) => m.name) ?? [];
    const found = models.some((n) => n === model || n.startsWith(`${model}:`));
    if (!found) {
      return { ok: false, error: `Embedding model "${model}" not found. Run: ollama pull ${model}` };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Cannot connect to Ollama at " + OLLAMA_BASE };
  }
}

export async function embedText(
  text: string,
  model = "nomic-embed-text"
): Promise<number[]> {
  const res = await fetch(`${OLLAMA_BASE}/api/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, input: text }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`Embedding failed: ${res.statusText}`);
  const data = await res.json();
  return data.embeddings[0];
}

export async function embedBatch(
  texts: string[],
  model = "nomic-embed-text"
): Promise<number[][]> {
  if (texts.length === 0) return [];
  const res = await fetch(`${OLLAMA_BASE}/api/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, input: texts }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`Batch embedding failed: ${res.statusText}`);
  const data = await res.json();
  return data.embeddings;
}
