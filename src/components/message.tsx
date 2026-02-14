import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { RagSources, type RagSource } from "./rag-sources";

interface MessageProps {
  role: "user" | "assistant";
  content: string;
  model?: string | null;
  ragSources?: RagSource[];
}

export function Message({ role, content, model, ragSources }: MessageProps) {
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
          <div className="flex items-center gap-2 mt-1">
            {model && (
              <span className="text-xs text-zinc-400">{model}</span>
            )}
            {ragSources && ragSources.length > 0 && (
              <RagSources sources={ragSources} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
