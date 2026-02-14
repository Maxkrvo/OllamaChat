import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { deleteDocument, reindexDocument } from "@/lib/rag";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const doc = await prisma.document.findUnique({
    where: { id },
    include: {
      chunks: {
        orderBy: { chunkIndex: "asc" },
        select: {
          id: true,
          chunkIndex: true,
          content: true,
          tokenCount: true,
          metadata: true,
        },
      },
    },
  });
  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(doc);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await deleteDocument(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/rag/documents/[id] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

// POST = reindex
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  reindexDocument(id).catch(() => {});
  return NextResponse.json({ ok: true });
}
