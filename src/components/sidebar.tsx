"use client";

interface Conversation {
  id: string;
  title: string;
  model: string;
  updatedAt: string;
}

type View = "chat" | "settings" | "knowledge" | "memory";

interface SidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  activeView: View;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onNavigate: (view: View) => void;
}

export function Sidebar({
  conversations,
  activeId,
  activeView,
  onSelect,
  onNew,
  onDelete,
  onNavigate,
}: SidebarProps) {
  return (
    <aside className="flex h-full w-72 flex-col border-r border-zinc-300/45 bg-zinc-200 dark:border-zinc-700/50 dark:bg-zinc-900">
      <div className="flex h-14 items-center gap-2 px-4">
        <button
          onClick={onNew}
          className="w-full rounded-xl bg-white px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:bg-zinc-800 dark:hover:bg-zinc-700"
        >
          + New Chat
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-2">
        {conversations.map((c) => (
          <div
            key={c.id}
            className={`group mb-1 flex cursor-pointer items-center rounded-xl px-3 py-2 text-sm ${
              c.id === activeId
                ? "bg-white shadow-sm ring-1 ring-zinc-200/60 dark:bg-zinc-800 dark:ring-zinc-600/60"
                : "hover:bg-zinc-200/70 dark:hover:bg-zinc-800"
            }`}
            onClick={() => onSelect(c.id)}
          >
            <span className="flex-1 truncate">{c.title}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(c.id);
              }}
              className="ml-2 rounded p-1 text-zinc-400 opacity-0 hover:text-red-500 group-hover:opacity-100"
              aria-label="Delete conversation"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        ))}
      </nav>

      {/* Navigation Links */}
      <div className="p-2">
        <button
          onClick={() => onNavigate("knowledge")}
          className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm ${
            activeView === "knowledge"
              ? "bg-white text-zinc-900 ring-1 ring-zinc-200/60 dark:bg-zinc-800 dark:text-zinc-100 dark:ring-zinc-600/60"
              : "text-zinc-700 hover:bg-zinc-200/70 dark:text-zinc-400 dark:hover:bg-zinc-800"
          }`}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
          Knowledge Base
        </button>
        <button
          onClick={() => onNavigate("memory")}
          className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm ${
            activeView === "memory"
              ? "bg-white text-zinc-900 ring-1 ring-zinc-200/60 dark:bg-zinc-800 dark:text-zinc-100 dark:ring-zinc-600/60"
              : "text-zinc-700 hover:bg-zinc-200/70 dark:text-zinc-400 dark:hover:bg-zinc-800"
          }`}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 7v10m-6-10v10m-5-8h16M4 17h16M6 3h12a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V5a2 2 0 012-2z" />
          </svg>
          Memory
        </button>
        <button
          onClick={() => onNavigate("settings")}
          className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm ${
            activeView === "settings"
              ? "bg-white text-zinc-900 ring-1 ring-zinc-200/60 dark:bg-zinc-800 dark:text-zinc-100 dark:ring-zinc-600/60"
              : "text-zinc-700 hover:bg-zinc-200/70 dark:text-zinc-400 dark:hover:bg-zinc-800"
          }`}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Settings
        </button>
      </div>
    </aside>
  );
}
