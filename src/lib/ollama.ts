const OLLAMA_BASE = process.env.OLLAMA_BASE_URL || "http://localhost:11434";

export async function listModels(): Promise<string[]> {
  const res = await fetch(`${OLLAMA_BASE}/api/tags`);
  if (!res.ok) throw new Error("Failed to fetch models from Ollama");
  const data = await res.json();
  return data.models.map((m: { name: string }) => m.name);
}

export function streamChat(
  model: string,
  messages: { role: string; content: string }[]
) {
  return fetch(`${OLLAMA_BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, stream: true }),
  });
}
