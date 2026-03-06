import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getAppConfig } from "@/lib/config";
import { streamChat, chatOnce } from "@/lib/ollama";
import type { OllamaMessage } from "@/lib/ollama";
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
import { TOOLS, executeTool } from "@/lib/tools";
import type { ToolStep } from "@/lib/tools/types";

const MAX_AGENT_ROUNDS = 5;

export async function POST(req: NextRequest) {
  try {
    const { conversationId, message, model: requestModel } = await req.json();
    const appConfig = await getAppConfig();

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });

    if (!conversation) {
      return new Response("Conversation not found", { status: 404 });
    }

    const { model: resolvedModel, reason: routingReason } = await resolveModel(
      requestModel || conversation.model,
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

    function emit(controller: ReadableStreamDefaultController, data: unknown) {
      controller.enqueue(
        new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`)
      );
    }

    const allToolSteps: ToolStep[] = [];

    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Emit initial metadata immediately so the client can render model/RAG info
          emit(controller, {
            routedModel: resolvedModel,
            routingReason,
            ragSources,
            grounding,
            usedMemoryItems,
          });

          // --- Agentic loop ---
          let agentMessages: OllamaMessage[] = messages.map((m) => ({
            role: m.role,
            content: m.content,
          }));

          if (conversation.agentEnabled) {
            try {
              let round = 0;
              while (round < MAX_AGENT_ROUNDS) {
                round++;

                const assistantMsg = await chatOnce(
                  resolvedModel,
                  agentMessages,
                  TOOLS
                );

                // No tool calls — model is ready to answer directly
                if (
                  !assistantMsg.tool_calls ||
                  assistantMsg.tool_calls.length === 0
                ) {
                  break;
                }

                // Append the assistant tool-call message to history
                agentMessages.push(assistantMsg);

                // Execute each tool call sequentially
                for (const toolCall of assistantMsg.tool_calls) {
                  const { name, arguments: args } = toolCall.function;

                  emit(controller, { toolCall: { name, args } });

                  const step = await executeTool(name, args);
                  allToolSteps.push(step);

                  emit(controller, {
                    toolResult: {
                      name: step.toolName,
                      result: step.result,
                      durationMs: step.durationMs,
                      error: step.error ?? false,
                    },
                  });

                  // Append tool result to history
                  agentMessages.push({
                    role: "tool",
                    content: step.result,
                  });
                }
              }
            } catch (agentErr) {
              // Model may not support tools — fall back to original messages
              console.warn(
                "Agent loop error (falling back to standard chat):",
                agentErr
              );
              agentMessages = messages.map((m) => ({
                role: m.role,
                content: m.content,
              }));
            }
          }

          // --- Final streaming answer ---
          const ollamaRes = await streamChat(resolvedModel, agentMessages);

          if (!ollamaRes.ok || !ollamaRes.body) {
            const errBody = ollamaRes.body
              ? await ollamaRes.text().catch(() => "")
              : "";
            controller.error(
              new Error(`Ollama stream failed ${ollamaRes.status}: ${errBody}`)
            );
            return;
          }

          const reader = ollamaRes.body.getReader();
          const decoder = new TextDecoder();
          let fullContent = "";
          let rawContent = "";
          let thinking = false;
          let thinkingSent = false;

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split("\n").filter(Boolean);

            for (const line of lines) {
              try {
                const json = JSON.parse(line);
                if (json.message?.content) {
                  const token = json.message.content;
                  rawContent += token;

                  // Buffer tokens while inside a think block and emit a
                  // `thinking` status so the client can show an indicator.
                  if (!thinking && rawContent.includes("<think>")) {
                    thinking = true;
                    if (!thinkingSent) {
                      emit(controller, { thinking: true });
                      thinkingSent = true;
                    }
                  }

                  if (thinking) {
                    if (rawContent.includes("</think>")) {
                      thinking = false;
                      const after = rawContent.split("</think>").pop()!;
                      rawContent = after;
                      if (after) {
                        fullContent += after;
                        emit(controller, { content: after, thinking: false });
                      } else {
                        emit(controller, { thinking: false });
                      }
                    }
                    continue;
                  }

                  fullContent += token;
                  emit(controller, { content: token });
                }
                if (json.done) {
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
                      toolSteps: allToolSteps.length
                        ? JSON.stringify(allToolSteps)
                        : null,
                      citations: ragSources.length
                        ? {
                            create: dedupeCitations(ragSources).map(
                              (source) => ({
                                documentId: source.documentId,
                                filename: source.filename,
                                chunkIndex: source.chunkIndex,
                                score: source.score,
                                metadata: JSON.stringify(source.metadata),
                              })
                            ),
                          }
                        : undefined,
                    },
                  });

                  // Memory bookkeeping is non-critical — don't let failures kill the stream.
                  try {
                    if (usedMemoryItems.length) {
                      await markMemoryItemsUsed(
                        usedMemoryItems.map((item) => item.id)
                      );
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

                  controller.enqueue(
                    new TextEncoder().encode("data: [DONE]\n\n")
                  );
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
