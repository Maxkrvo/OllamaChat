import { NextResponse } from "next/server";
import { listModels, showModel } from "@/lib/ollama";

export interface ModelInfo {
  name: string;
  supportsVision: boolean;
}

// Cache model capabilities for 5 minutes
let capabilitiesCache: { data: ModelInfo[]; expiry: number } = {
  data: [],
  expiry: 0,
};

export async function GET() {
  try {
    if (Date.now() < capabilitiesCache.expiry && capabilitiesCache.data.length > 0) {
      return NextResponse.json(capabilitiesCache.data);
    }

    const models = await listModels();
    const modelInfos: ModelInfo[] = await Promise.all(
      models.map(async (name) => {
        try {
          const info = await showModel(name);
          return { name, supportsVision: info.capabilities.includes("vision") };
        } catch {
          return { name, supportsVision: false };
        }
      })
    );

    capabilitiesCache = { data: modelInfos, expiry: Date.now() + 5 * 60 * 1000 };
    return NextResponse.json(modelInfos);
  } catch {
    return NextResponse.json(
      { error: "Failed to connect to Ollama" },
      { status: 502 }
    );
  }
}
