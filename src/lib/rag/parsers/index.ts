import { extname } from "path";
import type { ChunkResult } from "../chunker";
import { parseMarkdown, parseMarkdownContent } from "./markdown";
import { parsePdf } from "./pdf";
import { parseCode } from "./code";
import { parseUrl } from "./url";

interface ParseOpts {
  chunkSize: number;
  chunkOverlap: number;
}

type SourceType = "markdown" | "text" | "pdf" | "code" | "url";

const MARKDOWN_EXTS = new Set([".md", ".mdx", ".markdown"]);
const TEXT_EXTS = new Set([".txt", ".text"]);
const PDF_EXTS = new Set([".pdf"]);

export function detectSourceType(filepath: string): SourceType {
  const ext = extname(filepath).toLowerCase();
  if (MARKDOWN_EXTS.has(ext)) return "markdown";
  if (TEXT_EXTS.has(ext)) return "text";
  if (PDF_EXTS.has(ext)) return "pdf";
  return "code";
}

export async function parseSource(
  source: { filepath?: string; url?: string; content?: string },
  sourceType: SourceType,
  opts: ParseOpts
): Promise<ChunkResult[]> {
  if (source.url) {
    return parseUrl(source.url, opts);
  }

  if (source.content) {
    return parseMarkdownContent(source.content, opts);
  }

  if (!source.filepath) {
    throw new Error("Must provide filepath, url, or content");
  }

  switch (sourceType) {
    case "markdown":
    case "text":
      return parseMarkdown(source.filepath, opts);
    case "pdf":
      return parsePdf(source.filepath, opts);
    case "code":
      return parseCode(source.filepath, opts);
    default:
      return parseMarkdown(source.filepath, opts);
  }
}
