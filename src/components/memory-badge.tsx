"use client";

import { useEffect, useRef, useState } from "react";

interface MemoryBadgeProps {
  items: Array<{ id: string; content: string }>;
  onDelete: (memoryId: string) => void;
  onNavigate: () => void;
}

export function MemoryBadge({ items, onDelete, onNavigate }: MemoryBadgeProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  if (items.length === 0) return null;

  return (
    <div className="flex justify-center py-1" ref={ref}>
      <div className="relative">
        <button
          onClick={() => setOpen(!open)}
          className="inline-flex items-center gap-1.5 rounded-full bg-teal-100 px-3 py-1 text-xs font-medium text-teal-800 transition-colors hover:bg-teal-200 dark:bg-teal-900/40 dark:text-teal-300 dark:hover:bg-teal-800/60"
        >
          <svg
            className="h-3.5 w-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5.002 5.002 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
            />
          </svg>
          Memory updated
        </button>

        {open && (
          <div className="absolute left-1/2 top-full z-20 mt-2 w-72 -translate-x-1/2 rounded-xl border border-zinc-200 bg-white p-3 shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
            <p className="mb-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Saved to memory:
            </p>
            <div className="space-y-1">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="group/item flex items-start justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-700/50"
                >
                  <span className="text-sm text-zinc-700 dark:text-zinc-300">
                    {item.content}
                  </span>
                  <button
                    onClick={() => onDelete(item.id)}
                    className="mt-0.5 shrink-0 rounded p-0.5 text-zinc-300 transition-colors hover:text-red-500 dark:text-zinc-600 dark:hover:text-red-400"
                    aria-label="Remove memory"
                  >
                    <svg
                      className="h-3.5 w-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={onNavigate}
              className="mt-3 block w-full text-left text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              Manage all memories &rarr;
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
