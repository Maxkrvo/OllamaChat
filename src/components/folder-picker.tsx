"use client";

import { useCallback, useEffect, useState } from "react";

interface FolderPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (path: string) => void;
}

interface BrowseResult {
  current: string;
  parent: string | null;
  directories: Array<{ name: string; path: string }>;
}

export function FolderPicker({ open, onClose, onSelect }: FolderPickerProps) {
  const [data, setData] = useState<BrowseResult | null>(null);
  const [loading, setLoading] = useState(false);

  const browse = useCallback(async (path?: string) => {
    setLoading(true);
    try {
      const params = path ? `?path=${encodeURIComponent(path)}` : "";
      const res = await fetch(`/api/rag/browse${params}`);
      if (res.ok) {
        setData(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) browse();
  }, [open, browse]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-xl bg-white shadow-2xl dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
          <h3 className="text-sm font-semibold">Select Folder</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Current path */}
        {data && (
          <div className="border-b border-zinc-200 px-4 py-2 dark:border-zinc-700">
            <p className="truncate font-mono text-xs text-zinc-500">{data.current}</p>
          </div>
        )}

        {/* Directory list */}
        <div className="max-h-80 overflow-y-auto">
          {loading && (
            <div className="px-4 py-8 text-center text-sm text-zinc-400">Loading...</div>
          )}

          {!loading && data && (
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {/* Go up */}
              {data.parent && (
                <button
                  onClick={() => browse(data.parent!)}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
                >
                  <svg className="h-4 w-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                  <span className="text-zinc-500">..</span>
                </button>
              )}

              {data.directories.length === 0 && (
                <div className="px-4 py-6 text-center text-sm text-zinc-400">
                  No subdirectories
                </div>
              )}

              {data.directories.map((dir) => (
                <button
                  key={dir.path}
                  onClick={() => browse(dir.path)}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
                >
                  <svg className="h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                  </svg>
                  <span>{dir.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer — select current folder */}
        <div className="border-t border-zinc-200 px-4 py-3 dark:border-zinc-700">
          <button
            onClick={() => {
              if (data) {
                onSelect(data.current);
                onClose();
              }
            }}
            disabled={!data}
            className="w-full rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Select This Folder
          </button>
        </div>
      </div>
    </div>
  );
}
