import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createClient } from "@libsql/client";

async function main() {
  const limit = Number(process.env.EVAL_EXPORT_LIMIT || 50);
  const dbUrl = process.env.EVAL_DB_URL || "file:dev.db";
  const outPath = resolve(process.cwd(), "evals/datasets/grounding.draft.jsonl");
  const existingPath = resolve(process.cwd(), "evals/datasets/grounding.jsonl");

  const existingQueries = await loadExistingQueries(existingPath);
  const client = createClient({ url: dbUrl });

  const rows = await client.execute({
    sql: `
      SELECT
        m."id" as messageId,
        m."conversationId" as conversationId,
        m."createdAt" as createdAt,
        m."groundingReason" as groundingReason,
        (
          SELECT u."content"
          FROM "Message" u
          WHERE u."conversationId" = m."conversationId"
            AND u."role" = 'user'
            AND u."createdAt" <= m."createdAt"
          ORDER BY u."createdAt" DESC
          LIMIT 1
        ) as userQuery
      FROM "Message" m
      WHERE m."role" = 'assistant'
        AND m."groundingConfidence" = 'low'
      ORDER BY m."createdAt" DESC
      LIMIT ?
    `,
    args: [limit],
  });

  const candidates = [];
  let idx = 1;
  for (const row of rows.rows) {
    const query = String(row.userQuery || "").trim();
    if (!query) continue;

    const normalized = query.toLowerCase();
    if (existingQueries.has(normalized)) continue;

    const citationsRes = await client.execute({
      sql: `
        SELECT "filename"
        FROM "MessageCitation"
        WHERE "messageId" = ?
        ORDER BY "score" DESC
      `,
      args: [String(row.messageId)],
    });

    const expectedSources = [
      ...new Set(citationsRes.rows.map((citation) => String(citation.filename))),
    ];

    const createdAt = String(row.createdAt || "").replace(/[^0-9]/g, "").slice(0, 14);
    const id = `draft-${createdAt || "case"}-${String(idx).padStart(3, "0")}`;
    idx += 1;

    candidates.push({
      id,
      query,
      expected_sources: expectedSources,
      expect_confidence: "low",
      note: String(row.groundingReason || "Auto-exported from low-confidence assistant turn"),
    });

    existingQueries.add(normalized);
  }

  await mkdir(resolve(process.cwd(), "evals/datasets"), { recursive: true });
  const body = candidates.map((candidate) => JSON.stringify(candidate)).join("\n");
  await writeFile(outPath, body + (body ? "\n" : ""), "utf-8");

  console.log(`Exported ${candidates.length} draft grounding case(s) to ${outPath}`);
  if (candidates.length === 0) {
    console.log("No new low-confidence candidates were found.");
  }

  client.close();
}

async function loadExistingQueries(path) {
  try {
    const raw = await readFile(path, "utf-8");
    const set = new Set();
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const parsed = JSON.parse(trimmed);
      if (typeof parsed.query === "string") {
        set.add(parsed.query.toLowerCase());
      }
    }
    return set;
  } catch {
    return new Set();
  }
}

main().catch((error) => {
  console.error("Export grounding candidates failed:", error);
  process.exit(1);
});
