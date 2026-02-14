import { readFile } from "fs/promises";
import { extname } from "path";
import { chunkCode, type ChunkResult } from "../chunker";

const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  ".ts": "typescript",
  ".tsx": "typescript",
  ".js": "javascript",
  ".jsx": "javascript",
  ".py": "python",
  ".go": "go",
  ".rs": "rust",
  ".java": "java",
  ".cpp": "cpp",
  ".c": "c",
  ".html": "html",
  ".css": "css",
  ".json": "json",
  ".yaml": "yaml",
  ".yml": "yaml",
  ".toml": "toml",
};

export function detectLanguage(filepath: string): string {
  return EXTENSION_TO_LANGUAGE[extname(filepath)] || "text";
}

export async function parseCode(
  filepath: string,
  opts: { chunkSize: number; chunkOverlap: number }
): Promise<ChunkResult[]> {
  const content = await readFile(filepath, "utf-8");
  const language = detectLanguage(filepath);
  return chunkCode(content, language, opts);
}
