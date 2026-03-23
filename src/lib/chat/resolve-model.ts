import { routePrompt } from "@/lib/router";
import { listModels, showModel } from "@/lib/ollama";

export interface ModelResolution {
  model: string;
  reason: string | null;
}

// Cache vision model lookup for 5 minutes
let visionModelCache: { model: string | null; expiry: number } = {
  model: null,
  expiry: 0,
};

async function findVisionModel(): Promise<string | null> {
  if (Date.now() < visionModelCache.expiry) return visionModelCache.model;

  try {
    const models = await listModels();
    for (const model of models) {
      try {
        const info = await showModel(model);
        if (info.capabilities.includes("vision")) {
          visionModelCache = { model, expiry: Date.now() + 5 * 60 * 1000 };
          return model;
        }
      } catch {
        // skip models that fail to show
      }
    }
  } catch {
    // listModels failed
  }

  visionModelCache = { model: null, expiry: Date.now() + 60 * 1000 };
  return null;
}

export async function resolveModel(
  conversationModel: string,
  userMessage: string,
  hasImages = false
): Promise<ModelResolution> {
  if (conversationModel !== "auto") {
    if (hasImages) {
      // Check if the explicit model supports vision
      try {
        const info = await showModel(conversationModel);
        if (!info.capabilities.includes("vision")) {
          const visionModel = await findVisionModel();
          if (visionModel) {
            return {
              model: visionModel,
              reason: `auto-routed to vision model (${conversationModel} lacks vision)`,
            };
          }
        }
      } catch {
        // fall through to use the selected model
      }
    }
    return { model: conversationModel, reason: null };
  }

  // Auto mode: prioritize vision model when images are attached
  if (hasImages) {
    const visionModel = await findVisionModel();
    if (visionModel) {
      return { model: visionModel, reason: "vision model (images attached)" };
    }
  }

  const routing = await routePrompt(userMessage);
  console.log(
    `[router] "${userMessage.slice(0, 80)}..." → ${routing.model} (${routing.reason})`
  );
  return { model: routing.model, reason: routing.reason };
}
