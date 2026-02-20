import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { memoryToResponse, stringifyTags } from "@/lib/memory";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const scope = searchParams.get("scope");
    const type = searchParams.get("type");
    const status = searchParams.get("status");
    const conversationId = searchParams.get("conversationId");
    const q = searchParams.get("q");
    const tag = searchParams.get("tag");

    const items = await prisma.memoryItem.findMany({
      where: {
        ...(scope ? { scope } : {}),
        ...(type ? { type } : {}),
        ...(status ? { status } : {}),
        ...(conversationId ? { conversationId } : {}),
        ...(q
          ? {
              content: {
                contains: q,
              },
            }
          : {}),
        ...(tag
          ? {
              tags: {
                contains: `"${tag.toLowerCase()}"`,
              },
            }
          : {}),
      },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json(items.map(memoryToResponse));
  } catch (err) {
    console.error("GET /api/memory error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "active";
    const { count } = await prisma.memoryItem.updateMany({
      where: { status },
      data: { status: "archived" },
    });
    return NextResponse.json({ archived: count });
  } catch (err) {
    console.error("DELETE /api/memory error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const content = String(body.content || "").trim();
    const type = String(body.type || "fact");
    const scope = String(body.scope || "global");
    const status = String(body.status || "active");
    const tags = Array.isArray(body.tags)
      ? body.tags.map((tag: unknown) => String(tag))
      : [];

    if (!content) {
      return NextResponse.json({ error: "content is required" }, { status: 400 });
    }

    if (!["preference", "fact", "decision"].includes(type)) {
      return NextResponse.json({ error: "invalid type" }, { status: 400 });
    }

    if (!["global", "conversation"].includes(scope)) {
      return NextResponse.json({ error: "invalid scope" }, { status: 400 });
    }

    if (!["active", "archived"].includes(status)) {
      return NextResponse.json({ error: "invalid status" }, { status: 400 });
    }

    if (scope === "conversation" && !body.conversationId) {
      return NextResponse.json(
        { error: "conversationId required for conversation scope" },
        { status: 400 }
      );
    }

    const created = await prisma.$transaction(async (tx) => {
      const item = await tx.memoryItem.create({
        data: {
          content,
          type,
          scope,
          status,
          conversationId: scope === "conversation" ? String(body.conversationId) : null,
          sourceMessageId: body.sourceMessageId ? String(body.sourceMessageId) : null,
          supersedesMemoryId: body.supersedesMemoryId
            ? String(body.supersedesMemoryId)
            : null,
          tags: stringifyTags(tags),
        },
      });

      if (item.supersedesMemoryId) {
        await tx.memoryItem.updateMany({
          where: { id: item.supersedesMemoryId },
          data: { status: "archived" },
        });
      }

      return item;
    });

    return NextResponse.json(memoryToResponse(created), { status: 201 });
  } catch (err) {
    console.error("POST /api/memory error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
