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
