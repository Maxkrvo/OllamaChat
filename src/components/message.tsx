"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { RagSources } from "./rag-sources";

export interface MessageCitation {
  id?: string;
  documentId?: string;
  filename: string;
  chunkIndex: number;
  score: number;
}

export interface GroundingInfo {
  confidence: "high" | "medium" | "low";
  avgSimilarity: number | null;
  usedChunkCount: number;
  reason: string;
}

export interface UsedMemory {
  id: string;
  type: "preference" | "fact" | "decision";
  content: string;
}

interface MessageProps {
  role: "user" | "assistant";
  content: string;
  model?: string | null;
  citations?: MessageCitation[];
  grounding?: GroundingInfo;
  usedMemories?: UsedMemory[];
  onSpeak?: () => void;
}

export function Message({
  role,
  content,
  model,
  citations,
  grounding,
  usedMemories,
  onSpeak,
}: MessageProps) {
  const isUser = role === "user";
  const [memoryExpanded, setMemoryExpanded] = useState(false);

  return (
    <div className={`flex w-full gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-semibold text-white">
          AI
        </div>
      )}
      <div className={`${isUser ? "max-w-[75%]" : "w-full max-w-3xl"}`}>
        <div
          className={`px-4 py-3 ${
            isUser
              ? "rounded-3xl bg-blue-600 text-white dark:bg-blue-600"
              : "rounded-xl border border-zinc-200/60 bg-white text-zinc-900 shadow-sm dark:border-zinc-700/60 dark:bg-zinc-800 dark:text-zinc-100"
          }`}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{content}</p>
          ) : (
            <div className="prose max-w-none overflow-x-auto text-sm">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight]}
              >
                {content}
              </ReactMarkdown>
            </div>
          )}
        </div>
        {!isUser && (
          <div className="mt-2 pl-1">
            <div className="flex flex-wrap items-center gap-2">
              {model && <span className="text-xs text-zinc-400">{model}</span>}
              {onSpeak && content && (
                <button
                  onClick={onSpeak}
                  className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                  title="Read aloud"
                >
                  Speak
                </button>
              )}
              {grounding && (
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                    grounding.confidence === "high"
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                      : grounding.confidence === "medium"
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                        : "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200"
                  }`}
                  title={grounding.reason}
                >
                  {grounding.confidence} confidence (exp)
                </span>
              )}
              {grounding?.avgSimilarity !== null && grounding?.avgSimilarity !== undefined && (
                <span className="text-xs text-zinc-400">
                  sim {grounding.avgSimilarity.toFixed(2)}
                </span>
              )}
            </div>

            {citations && citations.length > 0 && <RagSources sources={citations} />}

            {usedMemories && usedMemories.length > 0 && (
              <div className="mt-1">
                <button
                  onClick={() => setMemoryExpanded((v) => !v)}
                  className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                >
                  <svg
                    className={`h-3 w-3 transition-transform ${memoryExpanded ? "rotate-90" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                  {usedMemories.length} memory item{usedMemories.length !== 1 ? "s" : ""} used
                </button>
                {memoryExpanded && (
                  <div className="mt-1 space-y-1 pl-4">
                    {usedMemories.map((memory) => (
                      <div key={memory.id} className="text-xs text-zinc-400">
                        [{memory.type}] {memory.content}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
