/**
 * Streaming sentence splitter for chunked TTS.
 * Buffers incoming text tokens and emits complete sentences with pause hints.
 *
 * Designed for token-by-token streaming where punctuation and following
 * whitespace may arrive in separate chunks.
 */

const ABBREVIATIONS = new Set([
  "mr", "mrs", "ms", "dr", "prof", "sr", "jr", "st",
  "e.g", "i.e", "vs", "etc", "approx", "dept", "est",
  "vol", "ref", "fig", "no",
]);

/** Pause duration hint after a TTS chunk. */
export type PauseType = "short" | "medium" | "long";

/** Millisecond durations for each pause type. */
export const PAUSE_MS: Record<PauseType, number> = {
  short: 300,
  medium: 550,
  long: 850,
};

export interface SpeechChunk {
  text: string;
  pause: PauseType;
}

/** Min buffer length before a comma triggers a split. */
const COMMA_SPLIT_THRESHOLD = 60;

export class SentenceSplitter {
  private buffer = "";
  private pendingSplit = false;
  private pendingPause: PauseType = "medium";
  private consecutiveNewlines = 0;

  /**
   * Feed a text chunk (e.g. a single SSE token).
   * Returns an array of speech chunks detected so far (may be empty).
   */
  push(chunk: string): SpeechChunk[] {
    const chunks: SpeechChunk[] = [];

    for (const char of chunk) {
      // Track consecutive newlines for paragraph detection
      if (char === "\n") {
        this.consecutiveNewlines++;
      } else if (!/\s/.test(char)) {
        this.consecutiveNewlines = 0;
      }

      if (this.pendingSplit) {
        if (/\s/.test(char)) {
          const candidate = this.buffer.trim();
          if (candidate && !this.isAbbreviation(candidate)) {
            chunks.push({ text: candidate, pause: this.pendingPause });
            this.buffer = "";
          }
          this.buffer += char;
          this.pendingSplit = false;
          continue;
        }
        this.pendingSplit = false;
      }

      // Newlines act as immediate split points (headings, bullet points, paragraphs)
      if (char === "\n") {
        const candidate = this.buffer.trim();
        if (candidate) {
          const pause: PauseType = this.consecutiveNewlines >= 2 ? "long" : "medium";
          chunks.push({ text: candidate, pause });
          this.buffer = "";
        }
        this.pendingSplit = false;
        continue;
      }

      this.buffer += char;

      if (char === "." || char === "!" || char === "?") {
        this.pendingSplit = true;
        this.pendingPause = "long";
      } else if (char === ":" || char === ";") {
        this.pendingSplit = true;
        this.pendingPause = "medium";
      } else if (char === "," && this.buffer.trim().length >= COMMA_SPLIT_THRESHOLD) {
        // Split on commas only for long clauses
        this.pendingSplit = true;
        this.pendingPause = "short";
      }
    }

    return chunks;
  }

  /**
   * Flush any remaining buffered text as a final chunk.
   * Call this when the stream ends.
   */
  flush(): SpeechChunk | null {
    this.pendingSplit = false;
    const remaining = this.buffer.trim();
    this.buffer = "";
    this.consecutiveNewlines = 0;
    return remaining.length > 0 ? { text: remaining, pause: "long" } : null;
  }

  /** Reset the splitter state. */
  reset() {
    this.buffer = "";
    this.pendingSplit = false;
    this.pendingPause = "medium";
    this.consecutiveNewlines = 0;
  }

  private isAbbreviation(sentence: string): boolean {
    const lastWord = sentence.split(/\s+/).pop()?.replace(/[.]+$/, "").toLowerCase() ?? "";
    return ABBREVIATIONS.has(lastWord);
  }
}

/** Strip markdown formatting for cleaner TTS output. */
export function stripMarkdownForSpeech(content: string) {
  return content
    .replace(/```[\s\S]*?```/g, " Code block omitted. ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/^[-*+]\s+/gm, "")
    .replace(/^\d+\.\s+/gm, "")
    .replace(/---+/g, " ")
    .replace(/\*{3,}/g, " ")
    .replace(/\|[^\n]*\|/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
