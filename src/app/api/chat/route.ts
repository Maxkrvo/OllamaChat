import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { streamChat } from "@/lib/ollama";

export async function POST(req: NextRequest) {
  const { conversationId, message } = await req.json();

  // Save user message
  await prisma.message.create({
    data: { conversationId, role: "user", content: message },
  });

  // Update conversation timestamp
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });

  // Get full history
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });

  if (!conversation) {
    return new Response("Conversation not found", { status: 404 });
  }

  const messages = conversation.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  // Stream from Ollama
  const ollamaRes = await streamChat(conversation.model, messages);

  if (!ollamaRes.ok || !ollamaRes.body) {
    return new Response("Failed to connect to Ollama", { status: 502 });
  }

  const reader = ollamaRes.body.getReader();
  const decoder = new TextDecoder();
  let fullContent = "";

  const stream = new ReadableStream({
    async start(controller) {
      try {
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
                // Save assistant message
                await prisma.message.create({
                  data: {
                    conversationId,
                    role: "assistant",
                    content: fullContent,
                  },
                });

                // Auto-title from first user message if still default
                if (conversation.title === "New Chat") {
                  const firstUserMsg = conversation.messages.find(
                    (m) => m.role === "user"
                  );
                  if (firstUserMsg) {
                    const title =
                      firstUserMsg.content.length > 50
                        ? firstUserMsg.content.slice(0, 50) + "..."
                        : firstUserMsg.content;
                    await prisma.conversation.update({
                      where: { id: conversationId },
                      data: { title },
                    });
                  }
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
}
