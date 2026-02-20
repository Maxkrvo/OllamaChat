"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

interface MemoryItem {
  id: string;
  type: "preference" | "fact" | "decision";
  content: string;
  scope: "global" | "conversation";
  conversationId: string | null;
  status: "active" | "archived";
  tags: string[];
  useCount: number;
  updatedAt: string;
}

export function MemoryCenter() {
  const [items, setItems] = useState<MemoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [newMemoryText, setNewMemoryText] = useState("");
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ status: "active" });
      if (debouncedQuery.trim()) params.set("q", debouncedQuery.trim());
      const res = await fetch(`/api/memory?${params.toString()}`);
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load memories");
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery]);

  useEffect(() => {
    load();
  }, [load]);

  async function addMemory() {
    if (!newMemoryText.trim()) return;
    const res = await fetch("/api/memory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "fact",
        scope: "global",
        content: newMemoryText.trim(),
        tags: ["manual"],
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error || "Failed to add memory");
      return;
    }
    setNewMemoryText("");
    await load();
    toast.success("Memory added");
  }

  async function deleteMemory(id: string) {
    const res = await fetch(`/api/memory/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "archived" }),
    });
    if (!res.ok) {
      toast.error("Failed to archive memory");
      return;
    }
    setItems((prev) => prev.filter((item) => item.id !== id));
  }

  async function promoteToGlobal(id: string) {
    const res = await fetch(`/api/memory/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope: "global", conversationId: null }),
    });
    if (!res.ok) {
      toast.error("Failed to promote memory");
      return;
    }
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, scope: "global", conversationId: null } : item
      )
    );
    toast.success("Memory promoted to global");
  }

  async function clearAll() {
    const res = await fetch("/api/memory?status=active", { method: "DELETE" });
    if (!res.ok) {
      toast.error("Failed to clear memories");
      return;
    }
    setItems([]);
    setConfirmClearAll(false);
    toast.success("All memories cleared");
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div>
        <h1 className="text-2xl font-bold">Memory</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Things the assistant has learned about you and your preferences.
          These are used to personalize responses.
        </p>
      </div>

      <div className="mt-6">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search memories..."
          className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-800"
        />
      </div>

      <div className="mt-4 flex gap-2">
        <input
          value={newMemoryText}
          onChange={(e) => setNewMemoryText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addMemory()}
          placeholder="Add a memory..."
          className="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-800"
        />
        <button
          onClick={addMemory}
          disabled={!newMemoryText.trim()}
          className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Add
        </button>
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-700">
        {loading ? (
          <div className="p-6 text-center text-sm text-zinc-500">Loading...</div>
        ) : items.length === 0 ? (
          <div className="p-6 text-center text-sm text-zinc-500">
            {debouncedQuery ? "No memories match your search." : "No memories yet. Memories are automatically saved from your conversations."}
          </div>
        ) : (
          <div className="divide-y divide-zinc-200 dark:divide-zinc-700">
            {items.map((item) => (
              <div
                key={item.id}
                className="group flex items-center justify-between px-4 py-3"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm text-zinc-800 dark:text-zinc-200">
                    {item.content}
                  </span>
                  {item.scope === "conversation" && (
                    <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400">
                      conv
                    </span>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  {item.scope === "conversation" && (
                    <button
                      onClick={() => promoteToGlobal(item.id)}
                      className="rounded p-1 text-zinc-300 hover:text-blue-500 dark:text-zinc-600 dark:hover:text-blue-400"
                      aria-label="Promote to global"
                      title="Promote to global scope"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                      </svg>
                    </button>
                  )}
                  <button
                    onClick={() => deleteMemory(item.id)}
                    className="rounded p-1 text-zinc-300 hover:text-red-500 dark:text-zinc-600 dark:hover:text-red-400"
                    aria-label="Delete memory"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {items.length > 0 && (
        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs text-zinc-400">
            {items.length} {items.length === 1 ? "memory" : "memories"}
          </span>
          {confirmClearAll ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-red-500">Clear all memories?</span>
              <button
                onClick={clearAll}
                className="rounded border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/30"
              >
                Confirm
              </button>
              <button
                onClick={() => setConfirmClearAll(false)}
                className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-50 dark:border-zinc-600 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmClearAll(true)}
              className="text-xs text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300"
            >
              Clear all memories
            </button>
          )}
        </div>
      )}
    </div>
  );
}
