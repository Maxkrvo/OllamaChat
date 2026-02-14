import { retrieveContext } from "@/lib/rag";

export interface ChatMessage {
  role: string;
  content: string;
}

export interface RagSource {
  documentId: string;
  filename: string;
  chunkIndex: number;
  score: number;
  metadata: Record<string, unknown>;
}

export type GroundingConfidence = "high" | "medium" | "low";

export interface GroundingInfo {
  confidence: GroundingConfidence;
  avgSimilarity: number | null;
  usedChunkCount: number;
  reason: string;
}

export interface RagInjectionResult {
  ragSources: RagSource[];
  grounding: GroundingInfo;
}

/** Build the message array from conversation history + new user message. */
export function buildMessages(
  history: { role: string; content: string }[],
  userMessage: string
): ChatMessage[] {
  return [
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: userMessage },
  ];
}

/** Prepend a system prompt to the message array (mutates in place). */
export function injectSystemPrompt(
  messages: ChatMessage[],
  systemPrompt: string | null | undefined
): void {
  if (systemPrompt) {
    messages.unshift({ role: "system", content: systemPrompt });
  }
}

/** Retrieve RAG context and prepend it as a system message. Returns sources for metadata. */
export async function injectRagContext(
  messages: ChatMessage[],
  userMessage: string,
  ragEnabled: boolean
): Promise<RagInjectionResult> {
  if (!ragEnabled) {
    return noSources("RAG is disabled for this conversation.");
  }

  try {
    const ragContext = await retrieveContext(userMessage);
    if (ragContext.chunks.length > 0) {
      messages.unshift({
        role: "system",
        content: ragContext.systemPromptAddition,
      });
      const ragSources = ragContext.chunks.map((c) => ({
        documentId: c.documentId,
        filename: c.filename,
        chunkIndex: c.chunkIndex,
        score: c.score,
        metadata: c.metadata,
      }));
      return { ragSources, grounding: buildGrounding(ragSources) };
    }
    return noSources("No relevant knowledge base sources were retrieved.");
  } catch (err) {
    console.error("RAG retrieval error (continuing without context):", err);
    return noSources("RAG retrieval failed, response generated without knowledge base context.");
  }
}

/** Inject policy guardrails when grounding is weak while RAG is enabled. */
export function injectGroundingPolicy(
  messages: ChatMessage[],
  grounding: GroundingInfo,
  ragEnabled: boolean
): void {
  if (!ragEnabled) return;
  if (grounding.confidence !== "low") return;

  messages.unshift({
    role: "system",
    content:
      "Grounding confidence is low or no relevant knowledge-base evidence was retrieved. " +
      "Do not present uncertain claims as facts. " +
      "If the answer depends on missing evidence, explicitly say you do not know from the current knowledge base and ask for a source or clarification.",
  });
}

function noSources(reason: string): RagInjectionResult {
  return {
    ragSources: [],
    grounding: { confidence: "low", avgSimilarity: null, usedChunkCount: 0, reason },
  };
}

function buildGrounding(ragSources: RagSource[]): GroundingInfo {
  if (ragSources.length === 0) {
    return { confidence: "low", avgSimilarity: null, usedChunkCount: 0, reason: "No source evidence available." };
  }

  const avgRaw =
    ragSources.reduce((acc, source) => acc + source.score, 0) / ragSources.length;
  const avgSimilarity = Number(avgRaw.toFixed(3));

  if (avgSimilarity >= 0.86 && ragSources.length >= 2) {
    return {
      confidence: "high",
      avgSimilarity,
      usedChunkCount: ragSources.length,
      reason: "Multiple highly similar chunks support this answer.",
    };
  }

  if (avgSimilarity >= 0.72) {
    return {
      confidence: "medium",
      avgSimilarity,
      usedChunkCount: ragSources.length,
      reason: "Retrieved context is relevant but not strongly convergent.",
    };
  }

  return {
    confidence: "low",
    avgSimilarity,
    usedChunkCount: ragSources.length,
    reason: "Retrieved context has weak similarity to the query.",
  };
}
