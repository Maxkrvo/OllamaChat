import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { memoryToResponse, stringifyTags } from "@/lib/memory";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const memory = await prisma.memoryItem.findUnique({ where: { id } });
    if (!memory) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(memoryToResponse(memory));
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const data: Record<string, unknown> = {};
    if (body.content !== undefined) data.content = String(body.content).trim();
    if (body.type !== undefined) data.type = String(body.type);
    if (body.scope !== undefined) data.scope = String(body.scope);
    if (body.status !== undefined) data.status = String(body.status);
    if (body.conversationId !== undefined) {
      data.conversationId = body.conversationId ? String(body.conversationId) : null;
    }
    if (body.sourceMessageId !== undefined) {
      data.sourceMessageId = body.sourceMessageId ? String(body.sourceMessageId) : null;
    }
    if (body.supersedesMemoryId !== undefined) {
      data.supersedesMemoryId = body.supersedesMemoryId
        ? String(body.supersedesMemoryId)
        : null;
    }
    if (body.tags !== undefined) {
      const tags = Array.isArray(body.tags)
        ? body.tags.map((tag: unknown) => String(tag))
        : [];
      data.tags = stringifyTags(tags);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const item = await tx.memoryItem.update({
        where: { id },
        data,
      });

      if (item.supersedesMemoryId) {
        await tx.memoryItem.updateMany({
          where: { id: item.supersedesMemoryId },
          data: { status: "archived" },
        });
      }

      return item;
    });

    return NextResponse.json(memoryToResponse(updated));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 400 }
    );
  }
}

