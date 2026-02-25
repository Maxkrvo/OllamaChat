import { NextResponse } from "next/server";
import { getVoiceRuntimeConfig, withVoiceHeaders } from "@/lib/voice";

export async function GET() {
  try {
    const config = await getVoiceRuntimeConfig();

    if (!config.enabled) {
      return NextResponse.json({
        enabled: false,
        healthy: false,
        reason: "Voice is disabled in settings",
      });
    }

    const res = await fetch(`${config.baseUrl}/models`, {
      headers: withVoiceHeaders(config.apiKey),
    });

    if (!res.ok) {
      return NextResponse.json(
        {
          enabled: true,
          healthy: false,
          reason: `Speech provider returned ${res.status}`,
        },
        { status: 502 }
      );
    }

    const data = await res.json().catch(() => ({ data: [] as unknown[] }));
    const modelCount = Array.isArray(data?.data) ? data.data.length : 0;

    if (modelCount === 0) {
      return NextResponse.json(
        {
          enabled: true,
          healthy: false,
          reason:
            "Speech provider is reachable but has zero models. Install STT/TTS models in Speaches first.",
          baseUrl: config.baseUrl,
          sttModel: config.sttModel,
          ttsModel: config.ttsModel,
          ttsVoice: config.ttsVoice,
          ttsSpeed: config.ttsSpeed,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      enabled: true,
      healthy: true,
      modelCount,
      baseUrl: config.baseUrl,
      sttModel: config.sttModel,
      ttsModel: config.ttsModel,
      ttsVoice: config.ttsVoice,
      ttsSpeed: config.ttsSpeed,
    });
  } catch (err) {
    console.error("GET /api/voice/health error:", err);
    return NextResponse.json(
      {
        enabled: false,
        healthy: false,
        reason: "Failed to contact speech provider",
      },
      { status: 500 }
    );
  }
}
