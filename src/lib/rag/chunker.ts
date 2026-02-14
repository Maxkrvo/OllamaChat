export interface ChunkResult {
  content: string;
  tokenCount: number;
  chunkIndex: number;
  metadata: Record<string, unknown>;
}

interface ChunkOpts {
  chunkSize: number;
  chunkOverlap: number;
}

/** Rough token count: ~0.75 words per token */
function estimateTokens(text: string): number {
  return Math.ceil(text.split(/\s+/).filter(Boolean).length / 0.75);
}

/** Split text into chunks by token window with overlap */
export function chunkText(
  content: string,
  opts: ChunkOpts
): ChunkResult[] {
  const words = content.split(/\s+/).filter(Boolean);
  const wordsPerChunk = Math.floor(opts.chunkSize * 0.75);
  const overlapWords = Math.floor(opts.chunkOverlap * 0.75);
  const chunks: ChunkResult[] = [];

  let start = 0;
  let index = 0;
  while (start < words.length) {
    const end = Math.min(start + wordsPerChunk, words.length);
    const chunkContent = words.slice(start, end).join(" ");
    chunks.push({
      content: chunkContent,
      tokenCount: estimateTokens(chunkContent),
      chunkIndex: index,
      metadata: {},
    });
    if (end === words.length) break; // last chunk
    start = end - overlapWords;
    index++;
  }

  return chunks;
}

/** Split markdown by headings, then by size */
export function chunkMarkdown(
  content: string,
  opts: ChunkOpts
): ChunkResult[] {
  const lines = content.split("\n");
  const sections: Array<{ heading: string; content: string }> = [];
  let currentHeading = "";
  let currentLines: string[] = [];

  for (const line of lines) {
    if (/^#{1,6}\s/.test(line)) {
      if (currentLines.length > 0) {
        sections.push({
          heading: currentHeading,
          content: currentLines.join("\n"),
        });
      }
      currentHeading = line.replace(/^#+\s*/, "").trim();
      currentLines = [line];
    } else {
      currentLines.push(line);
    }
  }
  if (currentLines.length > 0) {
    sections.push({
      heading: currentHeading,
      content: currentLines.join("\n"),
    });
  }

  const chunks: ChunkResult[] = [];
  let index = 0;

  for (const section of sections) {
    const sectionTokens = estimateTokens(section.content);
    if (sectionTokens <= opts.chunkSize) {
      chunks.push({
        content: section.content,
        tokenCount: sectionTokens,
        chunkIndex: index++,
        metadata: { heading: section.heading },
      });
    } else {
      // Section too large — sub-chunk it
      const subChunks = chunkText(section.content, opts);
      for (const sub of subChunks) {
        chunks.push({
          ...sub,
          chunkIndex: index++,
          metadata: { ...sub.metadata, heading: section.heading },
        });
      }
    }
  }

  return chunks;
}

/** Split code by top-level blocks (functions, classes, etc.) */
export function chunkCode(
  content: string,
  language: string,
  opts: ChunkOpts
): ChunkResult[] {
  const lines = content.split("\n");
  const blocks: Array<{
    content: string;
    startLine: number;
    endLine: number;
  }> = [];

  // Heuristic: split on lines that start at column 0 with a keyword or are blank-line separated
  const blockStarters =
    /^(?:export\s+)?(?:function|class|interface|type|const|let|var|def|fn|pub|impl|struct|enum|async\s+function|module|package)\s/;

  let currentLines: string[] = [];
  let blockStart = 1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (
      currentLines.length > 0 &&
      blockStarters.test(line) &&
      // Only split if previous line is blank or closing brace
      (i === 0 || lines[i - 1].trim() === "" || lines[i - 1].trim() === "}")
    ) {
      blocks.push({
        content: currentLines.join("\n"),
        startLine: blockStart,
        endLine: i,
      });
      currentLines = [line];
      blockStart = i + 1;
    } else {
      currentLines.push(line);
    }
  }
  if (currentLines.length > 0) {
    blocks.push({
      content: currentLines.join("\n"),
      startLine: blockStart,
      endLine: lines.length,
    });
  }

  // Now chunk blocks that are too large
  const chunks: ChunkResult[] = [];
  let index = 0;

  for (const block of blocks) {
    const tokens = estimateTokens(block.content);
    if (tokens <= opts.chunkSize) {
      chunks.push({
        content: block.content,
        tokenCount: tokens,
        chunkIndex: index++,
        metadata: {
          language,
          startLine: block.startLine,
          endLine: block.endLine,
        },
      });
    } else {
      const subChunks = chunkText(block.content, opts);
      for (const sub of subChunks) {
        chunks.push({
          ...sub,
          chunkIndex: index++,
          metadata: {
            ...sub.metadata,
            language,
            startLine: block.startLine,
            endLine: block.endLine,
          },
        });
      }
    }
  }

  return chunks;
}
