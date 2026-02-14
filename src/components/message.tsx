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

interface MessageProps {
  role: "user" | "assistant";
  content: string;
  model?: string | null;
  citations?: MessageCitation[];
  grounding?: GroundingInfo;
}

export function Message({
  role,
  content,
  model,
  citations,
  grounding,
}: MessageProps) {
  const isUser = role === "user";

  return (
    <div className={`flex gap-2 ${isUser ? "justify-end" : "justify-start"}`}>
      <div className="max-w-[80%]">
        <div
          className={`rounded-2xl px-4 py-3 ${
            isUser
              ? "bg-blue-600 text-white"
              : "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
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
          <div className="mt-1">
            <div className="flex items-center gap-2">
              {model && (
                <span className="text-xs text-zinc-400">{model}</span>
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
            {citations && citations.length > 0 && (
              <RagSources sources={citations} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
