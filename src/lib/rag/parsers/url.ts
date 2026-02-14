import * as cheerio from "cheerio";
import { chunkText, type ChunkResult } from "../chunker";

export async function parseUrl(
  url: string,
  opts: { chunkSize: number; chunkOverlap: number }
): Promise<ChunkResult[]> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; OllamaChat/1.0; +http://localhost)",
      Accept: "text/html,application/xhtml+xml,*/*",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  const html = await res.text();

  const $ = cheerio.load(html);

  // Remove non-content elements
  $("script, style, nav, footer, header, aside, iframe, noscript").remove();

  // Extract main content (prefer article/main, fallback to body)
  const main = $("article, main, [role='main']").first();
  const text = (main.length ? main : $("body")).text();

  // Clean up whitespace
  const cleaned = text.replace(/\s+/g, " ").trim();

  return chunkText(cleaned, opts);
}
