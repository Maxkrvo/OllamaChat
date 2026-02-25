import { NextRequest, NextResponse } from "next/server";
import { getVoiceRuntimeConfig, withVoiceHeaders } from "@/lib/voice";

export async function POST(req: NextRequest) {
  try {
    const config = await getVoiceRuntimeConfig();

    if (!config.enabled) {
      return NextResponse.json({ error: "Voice is disabled" }, { status: 400 });
    }

    const input = await req.formData();
    const audio = input.get("audio");

    if (!(audio instanceof File)) {
      return NextResponse.json({ error: "Missing audio file" }, { status: 400 });
    }

    const formData = new FormData();
    formData.append("file", audio, audio.name || "recording.webm");
    formData.append("model", config.sttModel);

    const language = input.get("language");
    if (typeof language === "string" && language.trim()) {
      formData.append("language", language.trim());
    }

    const res = await fetch(`${config.baseUrl}/audio/transcriptions`, {
      method: "POST",
      headers: withVoiceHeaders(config.apiKey),
      body: formData,
    });

    if (!res.ok) {
      const detail = await res.text();
      return NextResponse.json(
        { error: `Transcription failed: ${detail || res.status}` },
        { status: 502 }
      );
    }

    const data = await res.json();
    const text = typeof data.text === "string" ? data.text : "";

    return NextResponse.json({ text });
  } catch (err) {
    console.error("POST /api/voice/transcribe error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
