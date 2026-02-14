import { NextResponse } from "next/server";
import { getConfig } from "@/lib/rag";
import { checkEmbeddingModel } from "@/lib/rag/embeddings";

export async function GET() {
  const config = await getConfig();
  const modelCheck = await checkEmbeddingModel(config.embeddingModel);
  return NextResponse.json({
    ollama: modelCheck.ok,
    embeddingModel: config.embeddingModel,
    error: modelCheck.error ?? null,
  });
}
