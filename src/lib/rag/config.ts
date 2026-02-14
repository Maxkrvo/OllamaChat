import { prisma } from "@/lib/db";

export interface RagSettings {
  chunkSize: number;
  chunkOverlap: number;
  topK: number;
  similarityThreshold: number;
  embeddingModel: string;
  ragEnabled: boolean;
  watchedFolders: string[];
  supportedTypes: string[];
}

export async function getConfig(): Promise<RagSettings> {
  let config = await prisma.ragConfig.findUnique({
    where: { id: "default" },
  });
  if (!config) {
    config = await prisma.ragConfig.create({ data: { id: "default" } });
  }
  return {
    chunkSize: config.chunkSize,
    chunkOverlap: config.chunkOverlap,
    topK: config.topK,
    similarityThreshold: config.similarityThreshold,
    embeddingModel: config.embeddingModel,
    ragEnabled: config.ragEnabled,
    watchedFolders: JSON.parse(config.watchedFolders),
    supportedTypes: JSON.parse(config.supportedTypes),
  };
}

export async function updateConfig(
  updates: Partial<RagSettings>
): Promise<RagSettings> {
  const { watchedFolders, supportedTypes, ...rest } = updates;
  const data: Record<string, unknown> = Object.fromEntries(
    Object.entries(rest).filter(([, v]) => v !== undefined)
  );
  if (watchedFolders !== undefined) data.watchedFolders = JSON.stringify(watchedFolders);
  if (supportedTypes !== undefined) data.supportedTypes = JSON.stringify(supportedTypes);

  await prisma.ragConfig.upsert({
    where: { id: "default" },
    update: data,
    create: { id: "default", ...data },
  });
  return getConfig();
}
