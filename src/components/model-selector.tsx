"use client";

import { useEffect, useState } from "react";

interface ModelInfo {
  name: string;
  supportsVision: boolean;
}

interface ModelSelectorProps {
  value: string;
  onChange: (model: string) => void;
}

export function ModelSelector({ value, onChange }: ModelSelectorProps) {
  const [models, setModels] = useState<ModelInfo[]>([]);

  useEffect(() => {
    fetch("/api/models")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const parsed: ModelInfo[] = data
            .map((m: string | ModelInfo) =>
              typeof m === "string" ? { name: m, supportsVision: false } : m
            )
            .filter((m: ModelInfo) => !/(embed|embedding)/i.test(m.name));
          setModels(parsed);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-xl border border-zinc-300/60 bg-white px-3 py-1.5 text-sm dark:border-zinc-700/60 dark:bg-zinc-800 dark:text-zinc-100"
    >
      <option value="auto">Auto</option>
      {models.map((m) => (
        <option key={m.name} value={m.name}>
          {m.name}{m.supportsVision ? " (vision)" : ""}
        </option>
      ))}
    </select>
  );
}
