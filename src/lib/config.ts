import { prisma } from "@/lib/db";
import { listModels } from "@/lib/ollama";

export interface AppConfigData {
  defaultModel: string;
  codeModel: string;
  embeddingModel: string;
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
      },
      create: {
        defaultModel: first,
        codeModel: first,
        embeddingModel: "nomic-embed-text",
      },
    });
  }

  return {
    defaultModel: config.defaultModel,
    codeModel: config.codeModel,
    embeddingModel: config.embeddingModel,
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
    },
  });
  return {
    defaultModel: config.defaultModel,
    codeModel: config.codeModel,
    embeddingModel: config.embeddingModel,
  };
}
