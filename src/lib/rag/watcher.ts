import chokidar, { type FSWatcher } from "chokidar";
import { createHash } from "crypto";
import { readFile } from "fs/promises";
import { basename, extname } from "path";
import { getConfig } from "./config";
import { ingestDocument } from "./index";
import { deleteDocumentRaw } from "./vector-db";
import { prisma } from "@/lib/db";

let ragWatcher: FSWatcher | null = null;

export async function startWatcher() {
  if (ragWatcher) return;

  const config = await getConfig();
  if (config.watchedFolders.length === 0) {
    console.log("[rag-watcher] No watched folders configured");
    return;
  }

  const supportedExts = new Set(config.supportedTypes.map((t) => `.${t}`));

  const watcher = chokidar.watch(config.watchedFolders, {
    ignoreInitial: false,
    persistent: true,
    ignored: (path) => {
      const ext = extname(path).toLowerCase();
      // Allow directories (no extension) and supported file types
      return ext !== "" && !supportedExts.has(ext);
    },
  });

  watcher.on("add", (filepath) => handleFile(filepath));
  watcher.on("change", (filepath) => handleFile(filepath));
  watcher.on("unlink", (filepath) => handleDelete(filepath));

  ragWatcher = watcher;
  console.log(
    `[rag-watcher] Watching ${config.watchedFolders.length} folder(s)`
  );
}

export function stopWatcher() {
  if (ragWatcher) {
    ragWatcher.close();
    ragWatcher = null;
    console.log("[rag-watcher] Stopped");
  }
}

async function handleFile(filepath: string) {
  try {
    const content = await readFile(filepath);
    const hash = createHash("sha256").update(content).digest("hex");

    const existing = await prisma.document.findFirst({ where: { filepath } });
    if (existing?.hash === hash && existing.status === "indexed") return;
    if (existing) await deleteDocumentRaw(existing.id);

    console.log(`[rag-watcher] Indexing ${filepath}`);
    await ingestDocument({
      filepath,
      filename: basename(filepath),
    });
  } catch (err) {
    console.error(`[rag-watcher] Error indexing ${filepath}:`, err);
  }
}

async function handleDelete(filepath: string) {
  try {
    const doc = await prisma.document.findFirst({ where: { filepath } });
    if (doc) {
      await deleteDocumentRaw(doc.id);
      console.log(`[rag-watcher] Removed ${filepath}`);
    }
  } catch (err) {
    console.error(`[rag-watcher] Error removing ${filepath}:`, err);
  }
}
