"use client";

import { useCallback, useEffect, useState } from "react";
import { FolderPicker } from "./folder-picker";

interface RagConfig {
  chunkSize: number;
  chunkOverlap: number;
  topK: number;
  similarityThreshold: number;
  embeddingModel: string;
  ragEnabled: boolean;
  watchedFolders: string[];
  supportedTypes: string[];
}

const ALL_FILE_TYPES = [
  "md", "txt", "pdf", "ts", "js", "py", "go", "rs",
  "java", "cpp", "c", "html", "css", "json", "yaml", "toml",
];

export function RagSettings() {
  const [config, setConfig] = useState<RagConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const loadConfig = useCallback(async () => {
    const res = await fetch("/api/rag/config");
    setConfig(await res.json());
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  async function saveConfig() {
    if (!config) return;
    setSaving(true);
    try {
      const res = await fetch("/api/rag/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      setConfig(await res.json());
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  function addFolder(path: string) {
    if (!path || !config) return;
    if (config.watchedFolders.includes(path)) return;
    setConfig({
      ...config,
      watchedFolders: [...config.watchedFolders, path],
    });
  }

  function removeFolder(index: number) {
    if (!config) return;
    setConfig({
      ...config,
      watchedFolders: config.watchedFolders.filter((_, i) => i !== index),
    });
  }

  function toggleFileType(type: string) {
    if (!config) return;
    const types = config.supportedTypes.includes(type)
      ? config.supportedTypes.filter((t) => t !== type)
      : [...config.supportedTypes, type];
    setConfig({ ...config, supportedTypes: types });
  }

  if (!config) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-zinc-400">Loading settings...</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between rounded-xl border border-zinc-200 p-5 dark:border-zinc-700">
        <label className="flex cursor-pointer items-center gap-2">
          <span className="text-sm text-zinc-500">RAG Enabled</span>
          <button
            role="switch"
            aria-checked={config.ragEnabled}
            onClick={() => setConfig({ ...config, ragEnabled: !config.ragEnabled })}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              config.ragEnabled ? "bg-blue-600" : "bg-zinc-300 dark:bg-zinc-600"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                config.ragEnabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </label>
      </div>

      {/* Pipeline Parameters */}
      <section className="space-y-4 rounded-xl border border-zinc-200 p-5 dark:border-zinc-700">
        <h2 className="text-lg font-semibold">Pipeline Parameters</h2>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <label className="mb-1 block text-sm text-zinc-500">Chunk Size (tokens)</label>
            <input
              type="number"
              min={100}
              max={2000}
              value={config.chunkSize}
              onChange={(e) => setConfig({ ...config, chunkSize: Number(e.target.value) })}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-zinc-500">Chunk Overlap (tokens)</label>
            <input
              type="number"
              min={0}
              max={500}
              value={config.chunkOverlap}
              onChange={(e) => setConfig({ ...config, chunkOverlap: Number(e.target.value) })}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-zinc-500">Top-K Results</label>
            <input
              type="number"
              min={1}
              max={20}
              value={config.topK}
              onChange={(e) => setConfig({ ...config, topK: Number(e.target.value) })}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-zinc-500">Similarity Threshold</label>
            <input
              type="number"
              min={0}
              max={1}
              step={0.05}
              value={config.similarityThreshold}
              onChange={(e) => setConfig({ ...config, similarityThreshold: Number(e.target.value) })}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800"
            />
          </div>
        </div>
      </section>

      {/* Watched Folders */}
      <section className="space-y-4 rounded-xl border border-zinc-200 p-5 dark:border-zinc-700">
        <h2 className="text-lg font-semibold">Watched Folders</h2>
        <p className="text-sm text-zinc-500">
          Files in these folders will be automatically indexed.
        </p>

        {config.watchedFolders.length > 0 && (
          <div className="space-y-2">
            {config.watchedFolders.map((folder, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2 text-sm dark:bg-zinc-800"
              >
                <span className="font-mono text-xs">{folder}</span>
                <button
                  onClick={() => removeFolder(i)}
                  className="text-red-500 hover:text-red-700"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={() => setPickerOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-zinc-700 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-600"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
          </svg>
          Browse Folder
        </button>

        <FolderPicker
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          onSelect={(path) => addFolder(path)}
        />
      </section>

      {/* Supported File Types */}
      <section className="space-y-4 rounded-xl border border-zinc-200 p-5 dark:border-zinc-700">
        <h2 className="text-lg font-semibold">Supported File Types</h2>
        <div className="flex flex-wrap gap-2">
          {ALL_FILE_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => toggleFileType(type)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                config.supportedTypes.includes(type)
                  ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300"
                  : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
              }`}
            >
              .{type}
            </button>
          ))}
        </div>
      </section>

      {/* Save */}
      <button
        onClick={saveConfig}
        disabled={saving}
        className="w-full rounded-xl bg-blue-600 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {saving ? "Saving..." : saved ? "Saved!" : "Save Settings"}
      </button>
    </>
  );
}
