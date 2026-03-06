"use client";

import { useState } from "react";
import type { ToolStep } from "@/lib/tools/types";

interface ToolStepsProps {
  steps: ToolStep[];
}

export function ToolSteps({ steps }: ToolStepsProps) {
  const [expanded, setExpanded] = useState(false);
  const [openSteps, setOpenSteps] = useState<Set<number>>(new Set());

  if (steps.length === 0) return null;

  function toggleStep(i: number) {
    setOpenSteps((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

  return (
    <div className="mt-2">
      <button
        onClick={() => setExpanded((v) => !v)}
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
        {steps.length} tool step{steps.length !== 1 ? "s" : ""}
      </button>

      {expanded && (
        <div className="mt-1.5 space-y-1.5 pl-4">
          {steps.map((step, i) => (
            <div key={i}>
              <button
                onClick={() => toggleStep(i)}
                className={`flex items-center gap-1 text-xs ${
                  step.error
                    ? "text-amber-500 dark:text-amber-400"
                    : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                }`}
              >
                <svg
                  className={`h-3 w-3 transition-transform ${openSteps.has(i) ? "rotate-90" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
                <span className="font-mono">{step.toolName}</span>
                <span className="text-zinc-300 dark:text-zinc-600">
                  ({step.durationMs}ms{step.error ? ", error" : ""})
                </span>
              </button>

              {openSteps.has(i) && (
                <div className="mt-1 space-y-1 pl-4">
                  <div className="text-xs text-zinc-500">
                    <span className="font-semibold">Args:</span>{" "}
                    <code className="text-[11px]">{JSON.stringify(step.args)}</code>
                  </div>
                  <div className="text-xs text-zinc-500">
                    <span className="font-semibold">Result:</span>
                    <pre className="mt-0.5 max-h-32 overflow-y-auto whitespace-pre-wrap break-words rounded bg-zinc-100 p-1.5 text-[11px] dark:bg-zinc-900">
                      {step.result}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
