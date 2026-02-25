import { getAppConfig } from "@/lib/config";

export const VOICE_DEFAULTS = {
  baseUrl: "http://localhost:8000/v1",
  sttModel: "Systran/faster-whisper-small",
  ttsModel: "speaches-ai/Kokoro-82M-v1.0-ONNX-fp16",
  ttsVoice: "af_heart",
  ttsSpeed: 0.92,
} as const;

export interface VoiceRuntimeConfig {
  enabled: boolean;
  autoSpeak: boolean;
  baseUrl: string;
  apiKey: string;
  sttModel: string;
  ttsModel: string;
  ttsVoice: string;
  ttsSpeed: number;
}

function validateVoiceBaseUrl(url: string): string {
  const parsed = new URL(url);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error(`Invalid voice base URL protocol: ${parsed.protocol}`);
  }
  const hostname = parsed.hostname;
  if (
    hostname === "169.254.169.254" ||
    hostname.endsWith(".internal") ||
    hostname.startsWith("10.") ||
    hostname.startsWith("172.") ||
    hostname.startsWith("192.168.")
  ) {
    const allowList = ["localhost", "127.0.0.1", "0.0.0.0", "host.docker.internal"];
    if (!allowList.includes(hostname)) {
      throw new Error(`Voice base URL points to a disallowed private address: ${hostname}`);
    }
  }
  return url;
}

function parseTtsSpeed(raw: unknown): number {
  const numeric = typeof raw === "string" ? Number(raw) : typeof raw === "number" ? raw : NaN;
  if (!Number.isFinite(numeric)) return VOICE_DEFAULTS.ttsSpeed;
  return Math.min(4, Math.max(0.25, numeric));
}

export async function getVoiceRuntimeConfig(): Promise<VoiceRuntimeConfig> {
  const config = await getAppConfig();
  const rawUrl = config.voiceBaseUrl || process.env.VOICE_BASE_URL || VOICE_DEFAULTS.baseUrl;
  const baseUrl = validateVoiceBaseUrl(rawUrl);

  return {
    enabled: config.voiceEnabled,
    autoSpeak: config.voiceAutoSpeak,
    baseUrl,
    apiKey: process.env.VOICE_API_KEY || "local-not-empty",
    sttModel: config.voiceSttModel || process.env.VOICE_STT_MODEL || VOICE_DEFAULTS.sttModel,
    ttsModel: config.voiceTtsModel || process.env.VOICE_TTS_MODEL || VOICE_DEFAULTS.ttsModel,
    ttsVoice: config.voiceTtsVoice || process.env.VOICE_TTS_VOICE || VOICE_DEFAULTS.ttsVoice,
    ttsSpeed: parseTtsSpeed(process.env.VOICE_TTS_SPEED),
  };
}

export function withVoiceHeaders(apiKey: string): HeadersInit {
  return {
    Authorization: `Bearer ${apiKey}`,
  };
}
