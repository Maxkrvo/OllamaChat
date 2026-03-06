import type { OllamaTool } from "@/lib/tools/definitions";

const OLLAMA_BASE = process.env.OLLAMA_BASE_URL || "http://localhost:11434";

export interface OllamaMessage {
  role: string;
  content: string;
  tool_calls?: Array<{
    function: { name: string; arguments: Record<string, unknown> };
  }>;
}

export async function listModels(): Promise<string[]> {
  const res = await fetch(`${OLLAMA_BASE}/api/tags`);
  if (!res.ok) throw new Error("Failed to fetch models from Ollama");
  const data = await res.json();
  return data.models.map((m: { name: string }) => m.name);
}

export function streamChat(
  model: string,
  messages: { role: string; content: string }[],
  tools?: OllamaTool[]
) {
  return fetch(`${OLLAMA_BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      ...(tools && tools.length > 0 ? { tools } : {}),
    }),
  });
}

export async function chatOnce(
  model: string,
  messages: OllamaMessage[],
  tools?: OllamaTool[]
): Promise<OllamaMessage> {
  const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
      ...(tools && tools.length > 0 ? { tools } : {}),
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Ollama returned ${res.status} ${res.statusText}: ${body}`);
  }

  const data = await res.json();
  return data.message as OllamaMessage;
}
