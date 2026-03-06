"use client";

interface AgentToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}

export function AgentToggle({ enabled, onChange }: AgentToggleProps) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      title={
        enabled
          ? "Agent tools enabled — click to disable"
          : "Agent tools disabled — click to enable"
      }
      className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-medium transition-colors ${
        enabled
          ? "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300"
          : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
      }`}
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
          d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"
        />
      </svg>
      Agent
    </button>
  );
}
