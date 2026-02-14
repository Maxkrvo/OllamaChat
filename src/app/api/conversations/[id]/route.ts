import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const conversation = await prisma.conversation.findUnique({
    where: { id },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!conversation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(conversation);
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
  if (body.model !== undefined) data.model = body.model;
  if (body.systemPrompt !== undefined) data.systemPrompt = body.systemPrompt;
  const updated = await prisma.conversation.update({
    where: { id },
    data,
  });
  return NextResponse.json(updated);
}
