"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface DocumentData {
  id: string;
  filename: string;
  sourceType: string;
  sourceUrl: string | null;
  fileSize: number | null;
  status: string;
  error: string | null;
  chunkCount: number;
  createdAt: string;
  lastCitedAt: string | null;
}

interface SearchResult {
  content: string;
  filename: string;
  score: number;
  chunkIndex: number;
}

export function KnowledgeBase() {
  const [documents, setDocuments] = useState<DocumentData[]>([]);
  const [urlInput, setUrlInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [healthError, setHealthError] = useState<string | null>(null);

  const loadDocuments = useCallback(async () => {
    const res = await fetch("/api/rag/documents");
    setDocuments(await res.json());
  }, []);

  useEffect(() => {
    loadDocuments();
    // Check RAG health on mount
    fetch("/api/rag/health")
      .then((r) => r.json())
      .then((data) => setHealthError(data.error ?? null))
      .catch(() => setHealthError("Cannot reach health check endpoint"));
  }, [loadDocuments]);

  // Poll while any document is processing
  const hasProcessing = documents.some((d) => d.status === "processing");
  useEffect(() => {
    if (!hasProcessing) return;
    const interval = setInterval(loadDocuments, 2000);
    return () => clearInterval(interval);
  }, [hasProcessing, loadDocuments]);

  async function uploadFiles(files: FileList | File[]) {
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);
        await fetch("/api/rag/documents", { method: "POST", body: formData });
      }
      await loadDocuments();
    } finally {
      setUploading(false);
    }
  }

  async function indexUrl() {
    if (!urlInput.trim()) return;
    setUploading(true);
    try {
      const res = await fetch("/api/rag/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: urlInput.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(`Failed to index URL: ${data.error || res.statusText}`);
      } else {
        setUrlInput("");
      }
      await loadDocuments();
    } finally {
      setUploading(false);
    }
  }

  async function deleteDoc(id: string) {
    // Optimistic: remove from UI immediately
    setDocuments((prev) => prev.filter((d) => d.id !== id));
    try {
      const res = await fetch(`/api/rag/documents/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(`Failed to delete: ${data.error || res.statusText}`);
        await loadDocuments(); // Restore on failure
      }
    } catch (err) {
      toast.error(`Failed to delete: ${err instanceof Error ? err.message : String(err)}`);
      await loadDocuments(); // Restore on failure
    }
  }

  async function reindexDoc(id: string) {
    try {
      const res = await fetch(`/api/rag/documents/${id}`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(`Failed to reindex: ${data.error || res.statusText}`);
      }
    } catch (err) {
      toast.error(`Failed to reindex: ${err instanceof Error ? err.message : String(err)}`);
    }
    await loadDocuments();
  }

  async function testSearch() {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await fetch("/api/rag/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery }),
      });
      const data = await res.json();
      setSearchResults(data.chunks || []);
    } finally {
      setSearching(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      uploadFiles(e.dataTransfer.files);
    }
  }

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      indexed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
      processing: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
      pending: "bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300",
      error: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
    };
    return (
      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${colors[status] || colors.pending}`}>
        {status}
      </span>
    );
  };

  function formatSize(bytes: number | null) {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  function formatTimestamp(value: string | null) {
    if (!value) return "Never";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <h1 className="text-2xl font-bold">Knowledge Base</h1>

      {healthError && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
          {healthError}
        </div>
      )}

      {/* Upload Area */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
          dragOver
            ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
            : "border-zinc-300 dark:border-zinc-600"
        }`}
      >
        <p className="text-zinc-500">
          {uploading ? "Uploading..." : "Drag and drop files here, or"}
        </p>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="mt-2 cursor-pointer rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Choose Files
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && uploadFiles(e.target.files)}
        />
      </div>

      {/* URL Input */}
      <div className="flex gap-2">
        <input
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && indexUrl()}
          placeholder="Paste a URL to index..."
          className="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-800"
        />
        <button
          onClick={indexUrl}
          disabled={!urlInput.trim() || uploading}
          className="cursor-pointer rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Index URL
        </button>
      </div>

      {/* Document Table */}
      <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-700">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-800">
            <tr>
              <th className="px-4 py-3 font-medium">Document</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Chunks</th>
              <th className="px-4 py-3 font-medium">Size</th>
              <th className="px-4 py-3 font-medium">Last Cited</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
            {documents.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-zinc-400">
                  No documents indexed yet. Upload files or paste a URL to get started.
                </td>
              </tr>
            )}
            {documents.map((doc) => (
              <tr key={doc.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                <td className="px-4 py-3">
                  <div className="font-medium">{doc.filename}</div>
                  {doc.sourceUrl && (
                    <div className="text-xs text-zinc-400 truncate max-w-[200px]">{doc.sourceUrl}</div>
                  )}
                </td>
                <td className="px-4 py-3 text-zinc-500">{doc.sourceType}</td>
                <td className="px-4 py-3">
                  {statusBadge(doc.status)}
                  {doc.error && (
                    <div className="mt-1 text-xs text-red-500 truncate max-w-[150px]" title={doc.error}>
                      {doc.error}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-zinc-500">{doc.chunkCount}</td>
                <td className="px-4 py-3 text-zinc-500">{formatSize(doc.fileSize)}</td>
                <td className="px-4 py-3 text-zinc-500">{formatTimestamp(doc.lastCitedAt)}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <button
                      onClick={() => reindexDoc(doc.id)}
                      className="cursor-pointer rounded px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30"
                      title="Reindex"
                    >
                      Reindex
                    </button>
                    <button
                      onClick={() => deleteDoc(doc.id)}
                      className="cursor-pointer rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30"
                      title="Delete"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Search Test */}
      <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
        <h2 className="mb-3 text-lg font-semibold">Test Search</h2>
        <div className="flex gap-2">
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && testSearch()}
            placeholder="Type a query to test retrieval..."
            className="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-800"
          />
          <button
            onClick={testSearch}
            disabled={!searchQuery.trim() || searching}
            className="cursor-pointer rounded-lg bg-zinc-700 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-600 disabled:opacity-50"
          >
            {searching ? "Searching..." : "Search"}
          </button>
        </div>
        {searchResults.length > 0 && (
          <div className="mt-4 space-y-3">
            {searchResults.map((r, i) => (
              <div key={i} className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs font-medium text-zinc-500">
                    {r.filename} (chunk {r.chunkIndex + 1})
                  </span>
                  <span className="text-xs text-zinc-400">
                    Score: {(r.score * 100).toFixed(1)}%
                  </span>
                </div>
                <p className="text-sm text-zinc-700 dark:text-zinc-300 line-clamp-4">
                  {r.content}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
