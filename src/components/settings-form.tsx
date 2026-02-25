"use client";

import { useEffect, useState } from "react";

interface Config {
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

const FIELDS = [
  {
    key: "defaultModel" as const,
    label: "Default Model",
    desc: "Used for general conversations",
  },
  {
    key: "codeModel" as const,
    label: "Code Model",
    desc: "Used when code is detected (Auto mode)",
  },
  {
    key: "embeddingModel" as const,
    label: "Embedding Model",
    desc: "Used for RAG document embeddings",
  },
];

export function SettingsForm() {
  const [models, setModels] = useState<string[]>([]);
  const [config, setConfig] = useState<Config | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/models").then((r) => r.json()),
      fetch("/api/config").then((r) => r.json()),
    ]).then(([modelList, cfg]) => {
      if (Array.isArray(modelList)) setModels(modelList);
      setConfig(cfg);
    });
  }, []);

  async function handleSave() {
    if (!config) return;
    setSaving(true);
    await fetch("/api/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (!config) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-zinc-400">Loading model settings...</p>
      </div>
    );
  }

  return (
    <section className="space-y-4 rounded-xl border border-zinc-200 p-5 dark:border-zinc-700">
      <h2 className="text-lg font-semibold">Model Settings</h2>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {FIELDS.map(({ key, label, desc }) => (
          <div key={key}>
            <label className="mb-1 block text-sm text-zinc-500">{label}</label>
            <select
              value={config[key]}
              onChange={(e) => setConfig({ ...config, [key]: e.target.value })}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800"
            >
              {models.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-zinc-400">{desc}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Memory capture is always-on; only the injection budget is configurable. */}
        <div className="rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
          Memory capture is automatic on every turn.
        </div>
        <div>
          <label className="mb-1 block text-sm text-zinc-500">
            Memory Token Budget
          </label>
          <input
            type="number"
            min={0}
            max={8000}
            value={config.memoryTokenBudget}
            onChange={(e) =>
              setConfig({ ...config, memoryTokenBudget: Number(e.target.value) })
            }
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800"
          />
          <p className="mt-1 text-xs text-zinc-400">
            Approx token estimate uses `content.length / 4`.
          </p>
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">Voice</h3>
            <p className="text-xs text-zinc-400">
              Optional self-hosted speech provider (OpenAI-compatible audio API).
            </p>
          </div>
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={config.voiceEnabled}
              onChange={(e) => setConfig({ ...config, voiceEnabled: e.target.checked })}
              className="h-4 w-4 rounded border-zinc-300"
            />
            Enable voice
          </label>
        </div>

        <p className="text-xs text-zinc-400">
          API key is read from the <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">VOICE_API_KEY</code> environment variable.
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm text-zinc-500">Voice API Base URL</label>
            <input
              type="text"
              value={config.voiceBaseUrl}
              onChange={(e) => setConfig({ ...config, voiceBaseUrl: e.target.value })}
              placeholder="http://localhost:8000/v1"
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-zinc-500">STT Model</label>
            <input
              type="text"
              value={config.voiceSttModel}
              onChange={(e) => setConfig({ ...config, voiceSttModel: e.target.value })}
              placeholder="Systran/faster-whisper-small"
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-zinc-500">TTS Model</label>
            <input
              type="text"
              value={config.voiceTtsModel}
              onChange={(e) => setConfig({ ...config, voiceTtsModel: e.target.value })}
              placeholder="speaches-ai/Kokoro-82M-v1.0-ONNX-fp16"
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-zinc-500">TTS Voice</label>
            <input
              type="text"
              value={config.voiceTtsVoice}
              onChange={(e) => setConfig({ ...config, voiceTtsVoice: e.target.value })}
              placeholder="af_heart"
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800"
            />
          </div>
        </div>

        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={config.voiceAutoSpeak}
            onChange={(e) => setConfig({ ...config, voiceAutoSpeak: e.target.checked })}
            className="h-4 w-4 rounded border-zinc-300"
          />
          Auto-speak assistant replies
        </label>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {saving ? "Saving..." : saved ? "Saved!" : "Save Settings"}
      </button>
    </section>
  );
}
