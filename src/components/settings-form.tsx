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

interface SettingsFormProps {
  onClose: () => void;
}

export function SettingsForm({ onClose }: SettingsFormProps) {
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
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <p className="text-zinc-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 items-start justify-center overflow-y-auto px-4 py-10">
      <div className="w-full max-w-lg space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Model Settings</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            aria-label="Close settings"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {FIELDS.map(({ key, label, desc }) => (
          <div key={key}>
            <label className="mb-1 block text-sm font-medium">{label}</label>
            <p className="mb-2 text-xs text-zinc-500">{desc}</p>
            <select
              value={config[key]}
              onChange={(e) => setConfig({ ...config, [key]: e.target.value })}
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            >
              {models.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        ))}

        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Saving..." : saved ? "Saved!" : "Save"}
        </button>
      </div>
    </div>
  );
}
