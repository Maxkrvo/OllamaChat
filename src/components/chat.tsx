"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Message, type GroundingInfo, type MessageCitation, type UsedMemory } from "./message";
import { Sidebar } from "./sidebar";
import { ModelSelector } from "./model-selector";
import { ThemeToggle } from "./theme-toggle";
import { RagToggle } from "./rag-toggle";
import { RagSettings } from "./rag-settings";
import { KnowledgeBase } from "./knowledge-base";
import { SettingsForm } from "./settings-form";
import { MemoryToggle } from "./memory-toggle";
import { MemoryCenter } from "./memory-center";
import { MemoryBadge } from "./memory-badge";

interface MessageData {
  id: string;
  role: "user" | "assistant";
  content: string;
  model?: string | null;
  citations?: MessageCitation[];
  grounding?: GroundingInfo;
  usedMemories?: UsedMemory[];
}

interface ConversationData {
  id: string;
  title: string;
  model: string;
  updatedAt: string;
}

interface ApiConversationMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  model?: string | null;
  groundingConfidence?: "high" | "medium" | "low" | null;
  groundingReason?: string | null;
  groundingAvgSimilarity?: number | null;
  groundingUsedChunkCount?: number | null;
  citations?: MessageCitation[];
  usedMemoryItems?: UsedMemory[];
}

type View = "chat" | "settings" | "knowledge" | "memory";

export function Chat() {
  const [conversations, setConversations] = useState<ConversationData[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageData[]>([]);
  const [input, setInput] = useState("");
  const [model, setModel] = useState("auto");
  const [ragEnabled, setRagEnabled] = useState(true);
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [streaming, setStreaming] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [view, setView] = useState<View>("chat");
  const [systemPrompt, setSystemPrompt] = useState<string>("");
  const [systemPromptOpen, setSystemPromptOpen] = useState(false);
  const [capturedMemories, setCapturedMemories] = useState<
    Record<string, Array<{ id: string; content: string }>>
  >({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const systemPromptTimer = useRef<ReturnType<typeof setTimeout>>(null);
  const lastAssistantIdRef = useRef<string | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadConversations = useCallback(async () => {
    const res = await fetch("/api/conversations");
    const data = await res.json();
    setConversations(data);
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (streaming) return;
    if (!activeId) {
      setMessages([]);
      setCapturedMemories({});
      return;
    }

    fetch(`/api/conversations/${activeId}`)
      .then((r) => r.json())
      .then((data) => {
        const mappedMessages: MessageData[] = (data.messages || []).map(
          (message: ApiConversationMessage) => {
            const grounding = message.groundingConfidence
              ? {
                  confidence: message.groundingConfidence,
                  reason: message.groundingReason || "No grounding reason provided.",
                  avgSimilarity: message.groundingAvgSimilarity ?? null,
                  usedChunkCount: message.groundingUsedChunkCount ?? 0,
                }
              : undefined;

            const citations = message.citations?.length ? message.citations : undefined;
            const usedMemories = message.usedMemoryItems?.length
              ? message.usedMemoryItems
              : undefined;

            return {
              id: message.id,
              role: message.role,
              content: message.content,
              model: message.model,
              citations,
              grounding,
              usedMemories,
            };
          }
        );

        setMessages(mappedMessages);
        setModel(data.model);
        setRagEnabled(data.ragEnabled ?? true);
        setMemoryEnabled(data.memoryEnabled ?? true);
        setSystemPrompt(data.systemPrompt ?? "");
        setSystemPromptOpen(!!data.systemPrompt);
      });
  }, [activeId, streaming]);

  async function createConversation() {
    const res = await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, ragEnabled }),
    });
    const conv = await res.json();
    setActiveId(conv.id);
    setMessages([]);
    await loadConversations();
    textareaRef.current?.focus();
  }

  async function deleteConversation(id: string) {
    await fetch(`/api/conversations/${id}`, { method: "DELETE" });
    if (activeId === id) {
      setActiveId(null);
      setMessages([]);
    }
    await loadConversations();
  }

  async function sendMessage() {
    if (!input.trim() || streaming) return;

    let convId = activeId;
    if (!convId) {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, ragEnabled }),
      });
      const conv = await res.json();
      convId = conv.id;
      setActiveId(convId);
    }

    const userMessage: MessageData = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: input.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setStreaming(true);

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    const assistantMessage: MessageData = {
      id: `temp-${Date.now()}-assistant`,
      role: "assistant",
      content: "",
    };
    lastAssistantIdRef.current = assistantMessage.id;
    setMessages((prev) => [...prev, assistantMessage]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: convId,
          message: userMessage.content,
        }),
      });

      if (!res.ok || !res.body) throw new Error("Stream failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n").filter(Boolean);

        for (const line of lines) {
          if (line === "data: [DONE]") continue;
          if (!line.startsWith("data: ")) continue;

          try {
            const json = JSON.parse(line.slice(6));

            // First SSE event carries routing/grounding/source metadata for the assistant turn.
            if (
              "grounding" in json ||
              "routedModel" in json ||
              "ragSources" in json ||
              "usedMemoryItems" in json
            ) {
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.role === "assistant") {
                  const citations: MessageCitation[] | undefined = json.ragSources?.length
                    ? json.ragSources.map((s: { filename: string; chunkIndex: number; score?: number }) => ({
                        filename: s.filename,
                        chunkIndex: s.chunkIndex,
                        score: s.score ?? 0,
                      }))
                    : undefined;

                  const usedMemories: UsedMemory[] | undefined = json.usedMemoryItems?.length
                    ? json.usedMemoryItems
                    : undefined;

                  updated[updated.length - 1] = {
                    ...last,
                    model: json.routedModel ?? null,
                    citations,
                    grounding: json.grounding ?? last.grounding,
                    usedMemories,
                  };
                }
                return updated;
              });
            }

            if (json.capturedMemories && lastAssistantIdRef.current) {
              const msgId = lastAssistantIdRef.current;
              setCapturedMemories((cm) => ({
                ...cm,
                [msgId]: json.capturedMemories,
              }));
            }

            if (json.content) {
              // Subsequent SSE events stream incremental assistant tokens.
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.role === "assistant") {
                  updated[updated.length - 1] = {
                    ...last,
                    content: last.content + json.content,
                  };
                }
                return updated;
              });
            }
          } catch {
            // skip malformed events
          }
        }
      }
    } catch (err) {
      console.error("Stream error:", err);
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last?.role === "assistant" && !last.content) {
          updated[updated.length - 1] = {
            ...last,
            content: "Failed to get response. Is Ollama running?",
          };
        }
        return updated;
      });
    } finally {
      setStreaming(false);
      await loadConversations();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    const ta = e.target;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
  }

  function handleSystemPromptChange(value: string) {
    setSystemPrompt(value);
    if (systemPromptTimer.current) clearTimeout(systemPromptTimer.current);
    systemPromptTimer.current = setTimeout(() => {
      if (activeId) {
        fetch(`/api/conversations/${activeId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ systemPrompt: value || null }),
        });
      }
    }, 500);
  }

  return (
    <div className="flex h-screen bg-white text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100">
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed left-3 top-2 z-50 flex h-10 w-10 items-center justify-center rounded-lg bg-white/80 text-zinc-600 shadow-sm ring-1 ring-zinc-200/60 hover:bg-white dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-700/60 md:hidden"
        aria-label="Toggle sidebar"
      >
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <div
        className={`${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } fixed inset-y-0 left-0 z-40 transition-transform md:relative md:translate-x-0`}
      >
        <Sidebar
          conversations={conversations}
          activeId={activeId}
          activeView={view}
          onSelect={(id) => {
            setActiveId(id);
            setView("chat");
            setSidebarOpen(false);
          }}
          onNew={() => {
            createConversation();
            setView("chat");
          }}
          onDelete={deleteConversation}
          onNavigate={(v) => {
            setView(v);
            setSidebarOpen(false);
          }}
        />
      </div>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex flex-1 flex-col">
        {view === "chat" ? (
          <>
            <header className="flex h-14 items-center justify-between bg-white/95 px-4 backdrop-blur dark:bg-zinc-900/90">
              <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                {activeId ? "Chat" : "New chat"}
              </span>
              <div className="flex items-center gap-2">
              <ModelSelector value={model} onChange={setModel} />
              <RagToggle
                enabled={ragEnabled}
                onChange={(enabled) => {
                  setRagEnabled(enabled);
                  if (activeId) {
                    fetch(`/api/conversations/${activeId}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ ragEnabled: enabled }),
                    });
                  }
                }}
              />
              <MemoryToggle
                enabled={memoryEnabled}
                onChange={(enabled) => {
                  setMemoryEnabled(enabled);
                  if (activeId) {
                    fetch(`/api/conversations/${activeId}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ memoryEnabled: enabled }),
                    });
                  }
                }}
              />
              <ThemeToggle />
              </div>
            </header>

            {activeId && (
              <div className="border-b border-zinc-200/60 dark:border-zinc-700/60">
                <button
                  onClick={() => setSystemPromptOpen(!systemPromptOpen)}
                  className="flex w-full items-center gap-2 px-4 py-2 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                >
                  <svg
                    className={`h-3 w-3 transition-transform ${systemPromptOpen ? "rotate-90" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                  System Prompt
                  {systemPrompt && !systemPromptOpen && (
                    <span className="truncate text-zinc-400">&mdash; {systemPrompt.slice(0, 60)}</span>
                  )}
                </button>
                {systemPromptOpen && (
                  <div className="px-4 pb-3">
                    <textarea
                      value={systemPrompt}
                      onChange={(e) => handleSystemPromptChange(e.target.value)}
                      placeholder="e.g. You are a helpful coding assistant that always explains your reasoning..."
                      rows={3}
                      className="w-full resize-none rounded-lg border border-zinc-300/60 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-zinc-600/60 dark:bg-zinc-800"
                    />
                  </div>
                )}
              </div>
            )}

            <div className="relative min-h-0 flex-1">
              <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center">
                <Image
                  src="/logoTransparentSmall.webp"
                  alt=""
                  width={500}
                  height={500}
                  className="h-[58%] max-h-[460px] w-auto opacity-[0.055] dark:opacity-[0.08]"
                />
              </div>
              <div className="relative z-10 h-full overflow-y-auto px-4 py-6">
                {messages.length === 0 && (
                  <div className="flex h-full items-center justify-center">
                    <div className="text-center text-zinc-400">
                      <p className="text-lg font-medium">How can I help?</p>
                      <p className="mt-1 text-sm">
                        Send a message to begin chatting{model !== "auto" ? ` with ${model}` : ""}
                      </p>
                    </div>
                  </div>
                )}
                <div className="mx-auto max-w-4xl space-y-6">
                  {messages.map((msg, i) => (
                    <div key={msg.id || i}>
                      <Message
                        role={msg.role}
                        content={msg.content}
                        model={msg.model}
                        citations={msg.citations}
                        grounding={msg.grounding}
                        usedMemories={msg.usedMemories}
                      />
                      {msg.role === "assistant" &&
                        capturedMemories[msg.id]?.length > 0 && (
                          <MemoryBadge
                            items={capturedMemories[msg.id]}
                            onDelete={(memoryId) => {
                              fetch(`/api/memory/${memoryId}`, {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ status: "archived" }),
                              });
                              setCapturedMemories((prev) => ({
                                ...prev,
                                [msg.id]: prev[msg.id].filter((m) => m.id !== memoryId),
                              }));
                            }}
                            onNavigate={() => setView("memory")}
                          />
                        )}
                    </div>
                  ))}
                  {streaming && messages[messages.length - 1]?.content === "" && (
                    <div className="flex justify-start pl-10">
                      <div className="rounded-xl border border-zinc-200/60 bg-white px-4 py-3 dark:border-zinc-700/60 dark:bg-zinc-800">
                        <div className="flex gap-1">
                          <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-400 [animation-delay:0ms]" />
                          <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-400 [animation-delay:150ms]" />
                          <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-400 [animation-delay:300ms]" />
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </div>
            </div>

            <div className="bg-white/95 px-4 py-3 backdrop-blur dark:bg-zinc-900/85">
              <div className="mx-auto flex max-w-4xl items-end gap-2 rounded-3xl border border-zinc-300/50 bg-white px-3 py-2 shadow-sm dark:border-zinc-600/50 dark:bg-zinc-800">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={handleInput}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message..."
                  rows={1}
                  className="flex-1 resize-none bg-transparent px-2 py-2 text-sm focus:outline-none"
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || streaming}
                  className="rounded-2xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                >
                  Send
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            <header className="flex h-14 items-center justify-between border-b border-zinc-200 px-4 dark:border-zinc-700">
              <span className="text-sm font-semibold">
                {view === "settings"
                  ? "Settings"
                  : view === "knowledge"
                    ? "Knowledge Base"
                    : "Memory"}
              </span>
              <ThemeToggle />
            </header>
            <div className="flex-1 overflow-y-auto">
              {view === "settings" ? (
                <div className="mx-auto max-w-4xl space-y-6 p-6">
                  <h1 className="text-2xl font-bold">Settings</h1>
                  <SettingsForm />
                  <RagSettings />
                </div>
              ) : view === "knowledge" ? (
                <KnowledgeBase />
              ) : (
                <MemoryCenter />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
