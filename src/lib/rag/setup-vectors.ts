import { createClient } from "@libsql/client";

export async function setupVectorColumn() {
  const client = createClient({ url: "file:dev.db" });

  // nomic-embed-text produces 768-dimensional vectors
  // libSQL native vector type — Prisma can't express this
  try {
    await client.execute(
      `ALTER TABLE Chunk ADD COLUMN embedding F32_BLOB(768)`
    );
    console.log("Added embedding column to Chunk table");
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("duplicate column")) {
      console.log("Embedding column already exists");
    } else {
      throw e;
    }
  }

  await client.execute(
    `CREATE INDEX IF NOT EXISTS idx_chunk_embedding ON Chunk(libsql_vector_idx(embedding))`
  );
  console.log("Vector index created");

  client.close();
}

// Run directly: npx tsx src/lib/rag/setup-vectors.ts
if (process.argv[1]?.endsWith("setup-vectors.ts")) {
  setupVectorColumn()
    .then(() => console.log("Vector setup complete"))
    .catch((e) => {
      console.error("Vector setup failed:", e);
      process.exit(1);
    });
}
