import { NextRequest, NextResponse } from "next/server";
import { getAppConfig, updateAppConfig } from "@/lib/config";

export async function GET() {
  try {
    const config = await getAppConfig();
    return NextResponse.json(config);
  } catch (err) {
    console.error("GET /api/config error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const config = await updateAppConfig(body);
    return NextResponse.json(config);
  } catch (err) {
    console.error("PUT /api/config error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
