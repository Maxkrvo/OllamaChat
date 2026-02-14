import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { streamChat } from "@/lib/ollama";
import { routePrompt } from "@/lib/router";

export async function POST(req: NextRequest) {
  try {
    const { conversationId, message } = await req.json();

    // Verify conversation exists and get history
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });

    if (!conversation) {
      return new Response("Conversation not found", { status: 404 });
    }

    // Resolve model: use router for "auto", otherwise use conversation.model
    let resolvedModel = conversation.model;
    let routingReason: string | null = null;

    if (conversation.model === "auto") {
      const routing = await routePrompt(message);
      resolvedModel = routing.model;
      routingReason = routing.reason;
      console.log(
        `[router] "${message.slice(0, 80)}..." → ${resolvedModel} (${routingReason})`
      );
    }

    // Save user message
    await prisma.message.create({
      data: { conversationId, role: "user", content: message },
    });

    // Update conversation timestamp
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    const messages = [
      ...conversation.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      { role: "user", content: message },
    ];

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
          // Send routed model info as first event
          controller.enqueue(
            new TextEncoder().encode(
              `data: ${JSON.stringify({ routedModel: resolvedModel, routingReason })}\n\n`
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
                  // Save assistant message with the model that handled it
                  await prisma.message.create({
                    data: {
                      conversationId,
                      role: "assistant",
                      content: fullContent,
                      model: resolvedModel,
                    },
                  });

                  // Auto-title from first user message if still default
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
