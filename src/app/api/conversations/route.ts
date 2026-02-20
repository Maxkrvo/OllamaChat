import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAppConfig } from "@/lib/config";

export async function GET() {
  try {
    const conversations = await prisma.conversation.findMany({
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        model: true,
        updatedAt: true,
        memoryEnabled: true,
      },
    });
    return NextResponse.json(conversations);
  } catch (err) {
    console.error("GET /api/conversations error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const config = await getAppConfig();
    let model = body.model;
    if (!model) {
      model = config.defaultModel;
    }
    const conversation = await prisma.conversation.create({
      data: {
        model,
        ragEnabled: body.ragEnabled ?? true,
        memoryEnabled: true,
      },
    });
    return NextResponse.json(conversation);
  } catch (err) {
    console.error("POST /api/conversations error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
