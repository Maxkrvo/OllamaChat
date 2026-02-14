import { readFile } from "fs/promises";
import { PDFParse } from "pdf-parse";
import { chunkText, type ChunkResult } from "../chunker";

export async function parsePdf(
  filepath: string,
  opts: { chunkSize: number; chunkOverlap: number }
): Promise<ChunkResult[]> {
  const buffer = await readFile(filepath);
  const parser = new PDFParse({ data: new Uint8Array(buffer), verbosity: 0 });
  const result = await parser.getText();
  return chunkText(result.text, opts);
}
