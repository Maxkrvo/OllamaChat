import { retrieveContext } from "@/lib/rag";

export interface ChatMessage {
  role: string;
  content: string;
}

export interface RagSource {
  filename: string;
  chunkIndex: number;
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
): Promise<RagSource[]> {
  if (!ragEnabled) return [];

  try {
    const ragContext = await retrieveContext(userMessage);
    if (ragContext.chunks.length > 0) {
      messages.unshift({
        role: "system",
        content: ragContext.systemPromptAddition,
      });
      return ragContext.chunks.map((c) => ({
        filename: c.filename,
        chunkIndex: c.chunkIndex,
      }));
    }
  } catch (err) {
    console.error("RAG retrieval error (continuing without context):", err);
  }

  return [];
}
