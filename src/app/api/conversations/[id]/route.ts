import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseUsedMemoryIds } from "@/lib/memory";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const conversation = await prisma.conversation.findUnique({
    where: { id },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        include: {
          citations: {
            orderBy: { score: "desc" },
          },
        },
      },
    },
  });
  if (!conversation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Hydrate stored usedMemoryIds into full memory records for UI display.
  const usedMemoryIds = new Set(
    conversation.messages.flatMap((message) => parseUsedMemoryIds(message.usedMemoryIds))
  );
  const usedMemoryItems = usedMemoryIds.size
    ? await prisma.memoryItem.findMany({
        where: { id: { in: [...usedMemoryIds] } },
        select: { id: true, type: true, content: true },
      })
    : [];
  const memoryById = new Map(usedMemoryItems.map((item) => [item.id, item]));

  return NextResponse.json({
    ...conversation,
    messages: conversation.messages.map((message) => ({
      ...message,
      usedMemoryItems: parseUsedMemoryIds(message.usedMemoryIds)
        .map((memoryId) => memoryById.get(memoryId))
        .filter(Boolean),
    })),
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.conversation.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (body.ragEnabled !== undefined) data.ragEnabled = body.ragEnabled;
  if (body.memoryEnabled !== undefined) data.memoryEnabled = body.memoryEnabled;
  if (body.model !== undefined) data.model = body.model;
  if (body.systemPrompt !== undefined) data.systemPrompt = body.systemPrompt;
  const updated = await prisma.conversation.update({
    where: { id },
    data,
  });
  return NextResponse.json(updated);
}
