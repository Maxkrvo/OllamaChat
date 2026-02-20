"use client";

interface MemoryToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}

export function MemoryToggle({ enabled, onChange }: MemoryToggleProps) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      title={enabled ? "Memory enabled for this conversation" : "Memory disabled for this conversation"}
      className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-medium transition-colors ${
        enabled
          ? "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300"
          : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
      }`}
    >
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 2a7 7 0 00-7 7c0 1.5.5 2.9 1.3 4A5 5 0 008 17v1a2 2 0 002 2h4a2 2 0 002-2v-1a5 5 0 001.7-4A7 7 0 0012 2zm-1 18h2m-3-7h4" />
      </svg>
      Memory
    </button>
  );
}
