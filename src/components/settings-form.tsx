"use client";

import { useEffect, useState } from "react";

interface Config {
  defaultModel: string;
  codeModel: string;
  embeddingModel: string;
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

      <button
        onClick={handleSave}
        disabled={saving}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {saving ? "Saving..." : saved ? "Saved!" : "Save Models"}
      </button>
    </section>
  );
}
