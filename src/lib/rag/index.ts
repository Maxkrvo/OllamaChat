import { createHash } from "crypto";
import { createReadStream } from "fs";
import { stat } from "fs/promises";
import { basename } from "path";
import { prisma } from "@/lib/db";
import { getConfig } from "./config";
import { checkEmbeddingModel, embedText, embedBatch } from "./embeddings";
import { detectSourceType, parseSource } from "./parsers";
import {
  createChunksWithEmbeddings,
  deleteDocumentRaw,
  searchSimilarChunks,
} from "./vector-db";

export interface IngestSource {
  filepath?: string;
  url?: string;
  content?: string;
  filename: string;
  sourceType?: string;
}

export interface RetrievedChunk {
  content: string;
  documentId: string;
  filename: string;
  score: number;
  chunkIndex: number;
  metadata: Record<string, unknown>;
}

export interface RetrievedContext {
  chunks: RetrievedChunk[];
  systemPromptAddition: string;
}

/** Create a document record (status: "processing") and return its ID. */
export async function createDocumentRecord(source: IngestSource): Promise<string> {
  const sourceType =
    (source.sourceType as "markdown" | "text" | "pdf" | "code" | "url") ||
    (source.url ? "url" : detectSourceType(source.filepath || source.filename));

  let hash: string;
  let fileSize: number | undefined;

  if (source.filepath) {
    const h = createHash("sha256");
    await new Promise<void>((resolve, reject) => {
      createReadStream(source.filepath!).on("data", (d) => h.update(d)).on("end", resolve).on("error", reject);
    });
    hash = h.digest("hex");
    fileSize = (await stat(source.filepath)).size;
  } else if (source.url) {
    hash = createHash("sha256").update(source.url).digest("hex");
  } else if (source.content) {
    hash = createHash("sha256").update(source.content).digest("hex");
  } else {
    throw new Error("Must provide filepath, url, or content");
  }

  const existing = await prisma.document.findFirst({ where: { hash } });
  if (existing && existing.status === "indexed") {
    return existing.id;
  }

  const doc = await prisma.document.create({
    data: {
      filename: source.filename || basename(source.filepath || "unknown"),
      filepath: source.filepath,
      sourceUrl: source.url,
      sourceType,
      fileSize,
      hash,
      status: "processing",
    },
  });

  return doc.id;
}

// Sequential queue — process one document at a time to avoid OOM
let queue = Promise.resolve();

export function enqueueProcessing(docId: string, source: IngestSource) {
  queue = queue.then(() => processDocument(docId, source)).catch((err) =>
    console.error(`Background processing failed for ${docId}:`, err)
  );
}

/** Process a document: parse, chunk, embed, store vectors. */
async function processDocument(docId: string, source: IngestSource): Promise<void> {
  try {
    const config = await getConfig();

    const modelCheck = await checkEmbeddingModel(config.embeddingModel);
    if (!modelCheck.ok) {
      throw new Error(modelCheck.error);
    }

    const doc = await prisma.document.findUniqueOrThrow({ where: { id: docId } });

    const chunks = await parseSource(
      source,
      doc.sourceType as "markdown" | "text" | "pdf" | "code" | "url",
      { chunkSize: config.chunkSize, chunkOverlap: config.chunkOverlap }
    );

    if (chunks.length === 0) {
      throw new Error("No content could be extracted from this source");
    }

    const contents = chunks.map((c) => c.content);
    const embeddings = await embedBatch(contents, config.embeddingModel);

    await createChunksWithEmbeddings(
      chunks.map((chunk) => ({
        documentId: docId,
        content: chunk.content,
        tokenCount: chunk.tokenCount,
        chunkIndex: chunk.chunkIndex,
        metadata: JSON.stringify(chunk.metadata),
      })),
      embeddings
    );

    await prisma.document.update({
      where: { id: docId },
      data: { status: "indexed", chunkCount: chunks.length },
    });
  } catch (error) {
    console.error(`Ingestion failed for ${docId}:`, error);
    try {
      await prisma.document.update({
        where: { id: docId },
        data: {
          status: "error",
          error: error instanceof Error ? error.message : String(error),
        },
      });
    } catch {
      // Document may have been deleted while processing
    }
  }
}

/** Convenience: create + process in one call (blocking). */
export async function ingestDocument(source: IngestSource): Promise<string> {
  const docId = await createDocumentRecord(source);
  await processDocument(docId, source);
  return docId;
}

export async function deleteDocument(documentId: string): Promise<void> {
  // Must delete through libSQL client — Prisma's SQLite adapter
  // doesn't have the libsql_vector_idx extension, so any row
  // deletion touching the vector index fails.
  await deleteDocumentRaw(documentId);
}

export async function reindexDocument(documentId: string): Promise<void> {
  const doc = await prisma.document.findUniqueOrThrow({
    where: { id: documentId },
  });

  // Delete via libSQL client (Prisma can't handle vector index)
  await deleteDocumentRaw(documentId);

  // Re-ingest from original source
  await ingestDocument({
    filepath: doc.filepath || undefined,
    url: doc.sourceUrl || undefined,
    filename: doc.filename,
    sourceType: doc.sourceType,
  });
}

export async function retrieveContext(
  query: string
): Promise<RetrievedContext> {
  const config = await getConfig();

  if (!config.ragEnabled) {
    return { chunks: [], systemPromptAddition: "" };
  }

  // Embed the query
  const queryEmbedding = await embedText(query, config.embeddingModel);

  // Search for similar chunks
  const results = await searchSimilarChunks(
    queryEmbedding,
    config.topK,
    config.similarityThreshold
  );

  if (results.length === 0) {
    return { chunks: [], systemPromptAddition: "" };
  }

  // Fetch chunk content and document info
  const chunks: RetrievedChunk[] = await Promise.all(
    results.map(async (result) => {
      const chunk = await prisma.chunk.findUniqueOrThrow({
        where: { id: result.chunkId },
        include: { document: { select: { filename: true, id: true } } },
      });
      return {
        content: chunk.content,
        documentId: chunk.document.id,
        filename: chunk.document.filename,
        score: 1 - result.distance, // convert distance to similarity
        chunkIndex: chunk.chunkIndex,
        metadata: chunk.metadata ? JSON.parse(chunk.metadata) : {},
      };
    })
  );

  // Format system prompt addition
  const contextBlocks = chunks
    .map(
      (c) =>
        `Source: ${c.filename} (chunk ${c.chunkIndex + 1})\n${c.content}`
    )
    .join("\n\n---\n\n");

  const systemPromptAddition = `You have access to the following relevant context from the user's knowledge base. Use this information to inform your response when relevant, and cite the source document when you use information from it.

---
${contextBlocks}
---`;

  return { chunks, systemPromptAddition };
}

export { getConfig, updateConfig } from "./config";
