import { parseUrl } from "@/lib/rag/parsers/url";

const MAX_CHARS = 3000;

export async function fetchUrl(url: string): Promise<string> {
  const chunks = await parseUrl(url, { chunkSize: 1000, chunkOverlap: 0 });
  const full = chunks.map((c) => c.content).join("\n\n");
  return full.length > MAX_CHARS ? full.slice(0, MAX_CHARS) + "…" : full;
}
