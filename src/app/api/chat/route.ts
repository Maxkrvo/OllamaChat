import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getAppConfig } from "@/lib/config";
import { streamChat } from "@/lib/ollama";
import {
  resolveModel,
  buildMessages,
  injectSystemPrompt,
  injectRagContext,
  injectGroundingPolicy,
} from "@/lib/chat";
import {
  autoCaptureMemoryFromTurn,
  injectMemoryContext,
  markMemoryItemsUsed,
  selectMemoryForPrompt,
} from "@/lib/memory";

export async function POST(req: NextRequest) {
  try {
    const { conversationId, message } = await req.json();
    const appConfig = await getAppConfig();

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });

    if (!conversation) {
      return new Response("Conversation not found", { status: 404 });
    }

    const { model: resolvedModel, reason: routingReason } = await resolveModel(
      conversation.model,
      message
    );

    const savedUserMessage = await prisma.message.create({
      data: { conversationId, role: "user", content: message },
    });
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    const messages = buildMessages(conversation.messages, message);
    injectSystemPrompt(messages, conversation.systemPrompt);

    // Injection order: system -> memory -> RAG -> history/user turn.
    const usedMemoryItems = conversation.memoryEnabled
      ? await selectMemoryForPrompt({
          conversationId,
          userMessage: message,
          tokenBudget: appConfig.memoryTokenBudget,
        })
      : [];
    injectMemoryContext(messages, usedMemoryItems);

    const { ragSources, grounding } = await injectRagContext(
      messages,
      message,
      conversation.ragEnabled
    );
    injectGroundingPolicy(messages, grounding, conversation.ragEnabled);

    const ollamaRes = await streamChat(resolvedModel, messages);

    if (!ollamaRes.ok || !ollamaRes.body) {
      return new Response("Failed to connect to Ollama", { status: 502 });
    }

    const reader = ollamaRes.body.getReader();
    const decoder = new TextDecoder();
    let fullContent = "";

    const stream = new ReadableStream({
      async start(controller) {
        try {
          controller.enqueue(
            new TextEncoder().encode(
              `data: ${JSON.stringify({
                routedModel: resolvedModel,
                routingReason,
                ragSources,
                grounding,
                usedMemoryItems,
              })}\n\n`
            )
          );

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split("\n").filter(Boolean);

            for (const line of lines) {
              try {
                const json = JSON.parse(line);
                if (json.message?.content) {
                  fullContent += json.message.content;
                  controller.enqueue(
                    new TextEncoder().encode(
                      `data: ${JSON.stringify({ content: json.message.content })}\n\n`
                    )
                  );
                }
                if (json.done) {
                  // Persist assistant output and the exact memory IDs used for this turn.
                  const savedAssistantMessage = await prisma.message.create({
                    data: {
                      conversationId,
                      role: "assistant",
                      content: fullContent,
                      model: resolvedModel,
                      groundingConfidence: grounding.confidence,
                      groundingReason: grounding.reason,
                      groundingAvgSimilarity: grounding.avgSimilarity,
                      groundingUsedChunkCount: grounding.usedChunkCount,
                      usedMemoryIds: usedMemoryItems.length
                        ? JSON.stringify(usedMemoryItems.map((item) => item.id))
                        : null,
                      citations: ragSources.length
                        ? {
                            create: dedupeCitations(ragSources).map((source) => ({
                              documentId: source.documentId,
                              filename: source.filename,
                              chunkIndex: source.chunkIndex,
                              score: source.score,
                              metadata: JSON.stringify(source.metadata),
                            })),
                          }
                        : undefined,
                    },
                  });

                  // Memory bookkeeping is non-critical — don't let failures kill the stream.
                  try {
                    if (usedMemoryItems.length) {
                      await markMemoryItemsUsed(usedMemoryItems.map((item) => item.id));
                    }
                    if (conversation.memoryEnabled) {
                      const capturedMemories = await autoCaptureMemoryFromTurn({
                        conversationId,
                        userMessage: message,
                        assistantMessage: fullContent,
                        userMessageId: savedUserMessage.id,
                        assistantMessageId: savedAssistantMessage.id,
                      });
                      if (capturedMemories.length > 0) {
                        controller.enqueue(
                          new TextEncoder().encode(
                            `data: ${JSON.stringify({ capturedMemories })}\n\n`
                          )
                        );
                      }
                    }
                  } catch (memErr) {
                    console.error("Memory bookkeeping error (non-fatal):", memErr);
                  }

                  if (conversation.title === "New Chat") {
                    const firstUserMsg = conversation.messages.find(
                      (m) => m.role === "user"
                    );
                    const titleSource = firstUserMsg?.content || message;
                    const title =
                      titleSource.length > 50
                        ? titleSource.slice(0, 50) + "..."
                        : titleSource;
                    await prisma.conversation.update({
                      where: { id: conversationId },
                      data: { title },
                    });
                  }

                  controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
                }
              } catch {
                // skip malformed JSON lines
              }
            }
          }
        } catch (err) {
          controller.error(err);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    console.error("Chat API error:", err);
    return new Response("Internal server error", { status: 500 });
  }
}

function dedupeCitations(
  ragSources: Array<{
    documentId: string;
    filename: string;
    chunkIndex: number;
    score: number;
    metadata: Record<string, unknown>;
  }>
) {
  const seen = new Set<string>();
  return ragSources.filter((source) => {
    const key = `${source.documentId}:${source.chunkIndex}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
