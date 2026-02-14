import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { streamChat } from "@/lib/ollama";
import {
  resolveModel,
  buildMessages,
  injectSystemPrompt,
  injectRagContext,
} from "@/lib/chat";

export async function POST(req: NextRequest) {
  try {
    const { conversationId, message } = await req.json();

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });

    if (!conversation) {
      return new Response("Conversation not found", { status: 404 });
    }

    // Resolve model
    const { model: resolvedModel, reason: routingReason } = await resolveModel(
      conversation.model,
      message
    );

    // Save user message + update timestamp
    await prisma.message.create({
      data: { conversationId, role: "user", content: message },
    });
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    // Build message array with context injections
    const messages = buildMessages(conversation.messages, message);
    injectSystemPrompt(messages, conversation.systemPrompt);
    const ragSources = await injectRagContext(
      messages,
      message,
      conversation.ragEnabled
    );

    // Stream from Ollama
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
              `data: ${JSON.stringify({ routedModel: resolvedModel, routingReason, ragSources })}\n\n`
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
                  await prisma.message.create({
                    data: {
                      conversationId,
                      role: "assistant",
                      content: fullContent,
                      model: resolvedModel,
                    },
                  });

                  // Auto-title from first user message
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
