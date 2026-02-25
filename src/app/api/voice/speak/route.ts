import { NextRequest, NextResponse } from "next/server";
import { getVoiceRuntimeConfig, withVoiceHeaders } from "@/lib/voice";

function parseRequestSpeed(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(4, Math.max(0.25, value));
}

export async function POST(req: NextRequest) {
  try {
    const config = await getVoiceRuntimeConfig();

    if (!config.enabled) {
      return NextResponse.json({ error: "Voice is disabled" }, { status: 400 });
    }

    const body = await req.json();
    const text = typeof body.text === "string" ? body.text.trim() : "";

    if (!text) {
      return NextResponse.json({ error: "Missing text" }, { status: 400 });
    }

    const model =
      typeof body.model === "string" && body.model.trim()
        ? body.model.trim()
        : config.ttsModel;
    const voice =
      typeof body.voice === "string" && body.voice.trim()
        ? body.voice.trim()
        : config.ttsVoice;
    const speed = parseRequestSpeed(body.speed, config.ttsSpeed);

    const res = await fetch(`${config.baseUrl}/audio/speech`, {
      method: "POST",
      headers: {
        ...withVoiceHeaders(config.apiKey),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        voice,
        speed,
        input: text,
        response_format: "mp3",
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      return NextResponse.json(
        { error: `Speech generation failed: ${detail || res.status}` },
        { status: 502 }
      );
    }

    const audio = await res.arrayBuffer();

    return new Response(audio, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("POST /api/voice/speak error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
