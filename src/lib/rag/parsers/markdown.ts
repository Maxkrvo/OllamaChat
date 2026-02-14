import { readFile } from "fs/promises";
import { chunkMarkdown, type ChunkResult } from "../chunker";

export async function parseMarkdown(
  filepath: string,
  opts: { chunkSize: number; chunkOverlap: number }
): Promise<ChunkResult[]> {
  const content = await readFile(filepath, "utf-8");
  return chunkMarkdown(content, opts);
}

export function parseMarkdownContent(
  content: string,
  opts: { chunkSize: number; chunkOverlap: number }
): ChunkResult[] {
  return chunkMarkdown(content, opts);
}
