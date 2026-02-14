import { createClient } from "@libsql/client";
import { randomUUID } from "crypto";

const client = createClient({ url: "file:dev.db" });

export interface ChunkInput {
  documentId: string;
  content: string;
  tokenCount: number;
  chunkIndex: number;
  metadata: string | null;
}

/** Create chunk rows and set their embeddings in a single batch. */
export async function createChunksWithEmbeddings(
  chunks: ChunkInput[],
  embeddings: number[][]
) {
  const statements = chunks.flatMap((chunk, i) => {
    const id = randomUUID();
    return [
      {
        sql: `INSERT INTO Chunk (id, documentId, content, tokenCount, chunkIndex, metadata, createdAt) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
        args: [id, chunk.documentId, chunk.content, chunk.tokenCount, chunk.chunkIndex, chunk.metadata] as (string | number | null)[],
      },
      {
        sql: `UPDATE Chunk SET embedding = vector32(?) WHERE id = ?`,
        args: [JSON.stringify(embeddings[i]), id] as [string, string],
      },
    ];
  });
  await client.batch(statements);
}

export async function searchSimilarChunks(
  queryEmbedding: number[],
  topK: number,
  threshold: number
): Promise<Array<{ chunkId: string; distance: number }>> {
  const result = await client.execute({
    sql: `
      SELECT c.id as chunkId, vector_distance_cos(c.embedding, vector32(?)) as distance
      FROM Chunk c
      WHERE c.embedding IS NOT NULL
      ORDER BY distance ASC
      LIMIT ?
    `,
    args: [JSON.stringify(queryEmbedding), topK],
  });

  const maxDistance = 1 - threshold;
  return result.rows
    .filter((row) => Number(row.distance) <= maxDistance)
    .map((row) => ({
      chunkId: String(row.chunkId),
      distance: Number(row.distance),
    }));
}

export async function deleteDocumentRaw(documentId: string) {
  await client.batch([
    { sql: `UPDATE Chunk SET embedding = NULL WHERE documentId = ?`, args: [documentId] },
    { sql: `DELETE FROM Chunk WHERE documentId = ?`, args: [documentId] },
    { sql: `DELETE FROM Document WHERE id = ?`, args: [documentId] },
  ]);
}
