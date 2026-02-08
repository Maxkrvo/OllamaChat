import { NextResponse } from "next/server";
import { listModels } from "@/lib/ollama";

export async function GET() {
  try {
    const models = await listModels();
    return NextResponse.json(models);
  } catch {
    return NextResponse.json(
      { error: "Failed to connect to Ollama" },
      { status: 502 }
    );
  }
}
