import { prisma } from "@/lib/db";
import { listModels } from "@/lib/ollama";
import { VOICE_DEFAULTS } from "@/lib/voice";

export interface AppConfigData {
  defaultModel: string;
  codeModel: string;
  embeddingModel: string;
  memoryTokenBudget: number;
  voiceEnabled: boolean;
  voiceAutoSpeak: boolean;
  voiceBaseUrl: string;
  voiceSttModel: string;
  voiceTtsModel: string;
  voiceTtsVoice: string;
}

function toConfigData(config: {
  defaultModel: string;
  codeModel: string;
  embeddingModel: string;
  memoryTokenBudget: number;
  voiceEnabled: boolean;
  voiceAutoSpeak: boolean;
  voiceBaseUrl: string;
  voiceSttModel: string;
  voiceTtsModel: string;
  voiceTtsVoice: string;
}): AppConfigData {
  return {
    defaultModel: config.defaultModel,
    codeModel: config.codeModel,
    embeddingModel: config.embeddingModel,
    memoryTokenBudget: config.memoryTokenBudget,
    voiceEnabled: config.voiceEnabled,
    voiceAutoSpeak: config.voiceAutoSpeak,
    voiceBaseUrl: config.voiceBaseUrl,
    voiceSttModel: config.voiceSttModel,
    voiceTtsModel: config.voiceTtsModel,
    voiceTtsVoice: config.voiceTtsVoice,
  };
}

export async function getAppConfig(): Promise<AppConfigData> {
  let config = await prisma.appConfig.findUnique({
    where: { id: "singleton" },
  });

  if (!config || !config.defaultModel) {
    const models = await listModels().catch(() => [] as string[]);
    const first = models[0] || "";

    const data = {
      defaultModel: config?.defaultModel || first,
      codeModel: config?.codeModel || first,
      embeddingModel: config?.embeddingModel || "nomic-embed-text",
      memoryTokenBudget: config?.memoryTokenBudget ?? 2000,
      voiceEnabled: config?.voiceEnabled ?? false,
      voiceAutoSpeak: config?.voiceAutoSpeak ?? false,
      voiceBaseUrl:
        config?.voiceBaseUrl || process.env.VOICE_BASE_URL || VOICE_DEFAULTS.baseUrl,
      voiceSttModel:
        config?.voiceSttModel || process.env.VOICE_STT_MODEL || VOICE_DEFAULTS.sttModel,
      voiceTtsModel:
        config?.voiceTtsModel || process.env.VOICE_TTS_MODEL || VOICE_DEFAULTS.ttsModel,
      voiceTtsVoice:
        config?.voiceTtsVoice || process.env.VOICE_TTS_VOICE || VOICE_DEFAULTS.ttsVoice,
    };

    config = await prisma.appConfig.upsert({
      where: { id: "singleton" },
      update: data,
      create: data,
    });
  }

  return toConfigData(config);
}

export async function updateAppConfig(
  data: Partial<AppConfigData>
): Promise<AppConfigData> {
  const existing = await getAppConfig();
  const merged = { ...existing, ...data };
  const config = await prisma.appConfig.upsert({
    where: { id: "singleton" },
    update: data,
    create: merged,
  });
  return toConfigData(config);
}
