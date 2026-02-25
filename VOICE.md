# Voice Mode Setup Guide

OllamaChat supports optional push-to-talk voice input and text-to-speech assistant replies. Everything runs locally via [Speaches](https://github.com/speaches-ai/speaches), an OpenAI-compatible self-hosted speech API.

## Prerequisites

- Docker (Docker Desktop or CLI)
- A modern browser with microphone access (Chrome, Firefox, Safari)

## 1. Start Speaches

```bash
docker compose -f docker-compose.voice.yml up -d
```

Model weights are cached in a Docker volume (`speaches-cache`) so subsequent starts are fast. Verify it's running:

```bash
curl http://localhost:8000/health
```

## 2. Install models

Speaches downloads models on first use, but you can pre-load them:

```bash
# Speech-to-text (Whisper-based)
curl -X POST "http://localhost:8000/v1/models/Systran%2Ffaster-whisper-small"

# Text-to-speech (Kokoro)
curl -X POST "http://localhost:8000/v1/models/speaches-ai%2FKokoro-82M-v1.0-ONNX-fp16"
```

Confirm both are loaded with `curl http://localhost:8000/v1/models`.

## 3. Configure in the app

Open **Settings** and scroll to the **Voice** section:

| Setting | Default | Description |
|---|---|---|
| Voice Enabled | Off | Master toggle for voice features |
| Auto-speak | Off | Automatically read assistant replies aloud |
| Voice API Base URL | `http://localhost:8000/v1` | Speaches endpoint |
| STT Model | `Systran/faster-whisper-small` | Speech-to-text model |
| TTS Model | `speaches-ai/Kokoro-82M-v1.0-ONNX-fp16` | Text-to-speech model |
| TTS Voice | `af_heart` | Voice preset for Kokoro |
| TTS Speed | `0.92` | Speech rate (`0.25`-`4.0`). Try `0.9`-`0.95` to sound less robotic. |

Toggle **Voice Enabled** on and save. Voice controls appear in the chat header when the provider is reachable.

## 4. Using voice in chat

- **Push-to-talk**: Click **Mic** next to the send button. Speak, then click **Stop**. Transcription is appended to the input field.
- **Auto-speak**: Toggle **Voice On** in the chat header. Assistant replies are spoken aloud as they stream in. Markdown is stripped before synthesis.
- **Manual speak**: Each assistant message has a **Speak** button. Click **Stop** in the header to interrupt.

## Environment variable overrides

Optional — the settings page is the primary configuration method. Env vars act as initial defaults:

```bash
VOICE_API_KEY=local-not-empty                          # Auth header
VOICE_BASE_URL=http://localhost:8000/v1                # Speech API endpoint
VOICE_STT_MODEL=Systran/faster-whisper-small           # STT model
VOICE_TTS_MODEL=speaches-ai/Kokoro-82M-v1.0-ONNX-fp16 # TTS model
VOICE_TTS_VOICE=af_heart                               # Voice preset
VOICE_TTS_SPEED=0.92                                   # TTS speed (0.25-4.0)
```

## GPU acceleration

Uncomment the GPU section in `docker-compose.voice.yml` and switch to the GPU image (`ghcr.io/speaches-ai/speaches:latest` instead of `latest-cpu`), then restart the container.

## Alternative models

Any faster-whisper model works for STT. Smaller = faster, larger = more accurate:

| Model | Size |
|---|---|
| `Systran/faster-whisper-tiny` | ~75 MB |
| `Systran/faster-whisper-small` | ~500 MB (default) |
| `Systran/faster-whisper-medium` | ~1.5 GB |
| `Systran/faster-whisper-large-v3` | ~3 GB |

For TTS, all variants are the same Kokoro 82M model at different precision levels:

| Model | Precision | Notes |
|---|---|---|
| `speaches-ai/Kokoro-82M-v1.0-ONNX` | fp32 | Best quality, most memory |
| `speaches-ai/Kokoro-82M-v1.0-ONNX-fp16` | fp16 | Near-identical quality, half the memory (default) |
| `speaches-ai/Kokoro-82M-v1.0-ONNX-int8` | int8 | Smallest & fastest, possible subtle artifacts |

For TTS voices, run `curl http://localhost:8000/v1/audio/voices` to list available presets. Common ones: `af_heart` (female, default), `am_adam` (male), `am_michael` (male, deeper).

## Remote speech providers

Point the **Voice API Base URL** at any OpenAI-compatible speech API. The app blocks requests to private IP ranges (except localhost) to prevent SSRF — see `src/lib/voice.ts` to adjust.

## Troubleshooting

- **Voice controls don't appear**: Check Settings → Voice is enabled, and verify Speaches is running (`curl http://localhost:8000/health`).
- **Mic button disabled**: Health check failed — check that models are loaded (`curl http://localhost:8000/v1/models`).
- **No audio playback**: Check browser autoplay permissions and verify the TTS model is loaded.
- **Bad transcription**: Try a larger Whisper model. Ensure the STT model name matches exactly.
- **Container won't start**: Check if port 8000 is in use (`lsof -i :8000`) or check Docker logs (`docker logs ollamachat-speaches`).
