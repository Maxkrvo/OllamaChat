# OllamaChat

<p align="center">
  <img src="public/logoTransparentSmall.webp" alt="OllamaChat Logo" width="256" />
</p>

A self-hosted ChatGPT-style web app that runs on your machine using [Ollama](https://ollama.ai/). No cloud APIs, no API keys your data stays local.

## Features

- **Chat interface**: streaming responses, markdown with syntax highlighting, conversation history
- **Smart model routing**: "Auto" mode detects code patterns and routes to your configured code model automatically
- **Configurable models**: set your default, code, and embedding models from the in-app settings panel — works with whatever you have installed
- **Dark mode**: mobile-responsive, conversation management

<details>
<summary><strong>Knowledge Base</strong></summary>

Upload documents or paste URLs to build a searchable knowledge base. When RAG is enabled for a conversation, relevant chunks are automatically retrieved and injected into the prompt context.

- **Upload files**: drag-and-drop or file picker (supports `.md`, `.txt`, `.pdf`, `.ts`, `.js`, `.py`, `.go`, `.rs`, `.java`, `.cpp`, `.c`, `.html`, `.css`, `.json`, `.yaml`, `.toml`)
- **Index URLs**: paste any URL to scrape and index its content
- **Document management**: view status, chunk count, file size; reindex or delete documents
- **Test search**: run queries against your indexed documents to verify retrieval quality

</details>

<details>
<summary><strong>Settings</strong></summary>

Configure the RAG pipeline parameters from the settings page.

- **RAG toggle**: enable or disable RAG globally
- **Chunk size / overlap**: control how documents are split into chunks (100–2000 tokens, 0–500 overlap)
- **Top-K results**: number of chunks retrieved per query (1–20)
- **Similarity threshold**: minimum cosine similarity score for retrieved chunks (0–1)
- **Embedding model**: select which Ollama model generates embeddings (default: `nomic-embed-text`)
- **Watched folders**: add local directories for automatic file indexing via file watcher
- **Supported file types**: toggle which file extensions are indexed

</details>

## Setup

### 1. Install Ollama

```bash
brew install ollama   # or download from ollama.ai
ollama serve          # or open the desktop app
```

### 2. Pull any models you want

```bash
ollama pull gemma2:9b          # lightweight general model
ollama pull qwen3:14b          # larger general model
ollama pull qwen3-coder:30b    # coding specialist
ollama pull nomic-embed-text   # embeddings for RAG
```

Any model from [ollama.ai/library](https://ollama.ai/library) works. Pull it and it appears in the app.

### 3. Run

```bash
pnpm install
pnpm prisma db push
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). The SQLite database is created automatically.

### 4. Configure models

Click the gear icon in the header to open settings. Choose which of your installed models to use for:

- **Default Model** — general conversations
- **Code Model** — used by Auto mode when code is detected in your prompt
- **Embedding Model** — used for RAG document embeddings

On first run, the app auto-detects your installed models and picks defaults.

## Customizing

- **Routing logic**: edit `src/lib/router.ts` to change which patterns trigger the code model.
- **System prompt**: modify `src/app/api/chat/route.ts` to prepend instructions to every conversation.
- **Remote Ollama**: set `OLLAMA_BASE_URL` in `.env` to point at a GPU server running Ollama.

## Stack

Next.js 16 · React 19 · Tailwind v4 · TypeScript · Prisma v7 + SQLite · Ollama API
