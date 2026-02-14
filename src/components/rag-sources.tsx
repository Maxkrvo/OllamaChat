"use client";

import { useState } from "react";

export interface RagSource {
  filename: string;
  chunkIndex: number;
}

interface RagSourcesProps {
  sources: RagSource[];
}

export function RagSources({ sources }: RagSourcesProps) {
  const [expanded, setExpanded] = useState(false);

  if (sources.length === 0) return null;

  // Deduplicate by filename
  const uniqueFiles = [...new Set(sources.map((s) => s.filename))];

  return (
    <div className="mt-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
      >
        <svg
          className={`h-3 w-3 transition-transform ${expanded ? "rotate-90" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        {uniqueFiles.length} source{uniqueFiles.length !== 1 ? "s" : ""} used
      </button>
      {expanded && (
        <div className="mt-1.5 space-y-1 pl-4">
          {sources.map((s, i) => (
            <div key={i} className="text-xs text-zinc-400">
              {s.filename} <span className="text-zinc-300 dark:text-zinc-600">(chunk {s.chunkIndex + 1})</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
