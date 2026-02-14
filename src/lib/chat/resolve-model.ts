import { routePrompt } from "@/lib/router";

export interface ModelResolution {
  model: string;
  reason: string | null;
}

export async function resolveModel(
  conversationModel: string,
  userMessage: string
): Promise<ModelResolution> {
  if (conversationModel !== "auto") {
    return { model: conversationModel, reason: null };
  }

  const routing = await routePrompt(userMessage);
  console.log(
    `[router] "${userMessage.slice(0, 80)}..." → ${routing.model} (${routing.reason})`
  );
  return { model: routing.model, reason: routing.reason };
}
