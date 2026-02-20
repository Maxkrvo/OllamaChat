import { prisma } from "@/lib/db";
import { listModels } from "@/lib/ollama";

export interface AppConfigData {
  defaultModel: string;
  codeModel: string;
  embeddingModel: string;
  memoryTokenBudget: number;
}

export async function getAppConfig(): Promise<AppConfigData> {
  let config = await prisma.appConfig.findUnique({
    where: { id: "singleton" },
  });

  if (!config || !config.defaultModel) {
    const models = await listModels().catch(() => [] as string[]);
    const first = models[0] || "";

    config = await prisma.appConfig.upsert({
      where: { id: "singleton" },
      update: {
        defaultModel: config?.defaultModel || first,
        codeModel: config?.codeModel || first,
        embeddingModel: config?.embeddingModel || "nomic-embed-text",
        memoryTokenBudget: config?.memoryTokenBudget ?? 2000,
      },
      create: {
        defaultModel: first,
        codeModel: first,
        embeddingModel: "nomic-embed-text",
        memoryTokenBudget: 2000,
      },
    });
  }

  return {
    defaultModel: config.defaultModel,
    codeModel: config.codeModel,
    embeddingModel: config.embeddingModel,
    memoryTokenBudget: config.memoryTokenBudget,
  };
}

export async function updateAppConfig(
  data: Partial<AppConfigData>
): Promise<AppConfigData> {
  const config = await prisma.appConfig.upsert({
    where: { id: "singleton" },
    update: data,
    create: {
      defaultModel: data.defaultModel || "",
      codeModel: data.codeModel || "",
      embeddingModel: data.embeddingModel || "",
      memoryTokenBudget: data.memoryTokenBudget ?? 2000,
    },
  });
  return {
    defaultModel: config.defaultModel,
    codeModel: config.codeModel,
    embeddingModel: config.embeddingModel,
    memoryTokenBudget: config.memoryTokenBudget,
  };
}
