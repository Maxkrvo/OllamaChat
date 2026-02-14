import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

async function main() {
  const baseUrl = process.env.EVAL_BASE_URL || "http://localhost:3000";
  const strict = process.env.EVAL_STRICT === "1";
  const datasetPath = resolve(process.cwd(), "evals/datasets/grounding.jsonl");
  const raw = await readFile(datasetPath, "utf-8");

  const cases = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));

  console.log("Grounding eval");
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Dataset: ${datasetPath}`);
  console.log(`Cases loaded: ${cases.length}`);

  const reachable = await canReachServer(baseUrl);
  if (!reachable) {
    const message =
      `Skipped live grounding eval: cannot reach ${baseUrl}. ` +
      "Start the app (`pnpm dev`) or set EVAL_BASE_URL. " +
      "Set EVAL_STRICT=1 to fail instead of skipping.";
    if (strict) {
      throw new Error(message);
    }
    console.log(message);
    return;
  }

  let matchedConfidence = 0;
  let citationPrecisionSum = 0;
  const results = [];

  for (const item of cases) {
    const predicted = await evaluateCase(baseUrl, item);
    if (predicted.confidence === item.expect_confidence) {
      matchedConfidence += 1;
    }
    citationPrecisionSum += predicted.citationPrecision;
    results.push({
      id: item.id,
      query: item.query,
      expectedConfidence: item.expect_confidence,
      predictedConfidence: predicted.confidence,
      expectedSources: item.expected_sources,
      predictedSources: predicted.predictedSources,
      citationPrecision: predicted.citationPrecision,
      topScore: predicted.topScore,
    });
  }

  const confidenceAccuracy = cases.length
    ? Number((matchedConfidence / cases.length).toFixed(3))
    : 0;
  const avgCitationPrecision = cases.length
    ? Number((citationPrecisionSum / cases.length).toFixed(3))
    : 0;

  console.log("Summary:");
  console.log(`- confidence accuracy: ${(confidenceAccuracy * 100).toFixed(1)}%`);
  console.log(`- avg citation precision: ${(avgCitationPrecision * 100).toFixed(1)}%`);

  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    datasetPath,
    caseCount: cases.length,
    metrics: {
      confidenceAccuracy,
      avgCitationPrecision,
    },
    results,
  };

  const reportsDir = resolve(process.cwd(), "evals/reports");
  await mkdir(reportsDir, { recursive: true });
  const reportPath = resolve(reportsDir, "grounding-baseline.json");
  await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n", "utf-8");
  console.log(`Report written: ${reportPath}`);
}

async function canReachServer(baseUrl) {
  try {
    const res = await fetch(`${baseUrl}/api/rag/health`);
    return res.ok;
  } catch {
    return false;
  }
}

async function evaluateCase(baseUrl, item) {
  const res = await fetch(`${baseUrl}/api/rag/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: item.query }),
  });

  if (!res.ok) {
    throw new Error(`Search request failed (${res.status}): ${await res.text()}`);
  }

  const payload = await res.json();
  const chunks = Array.isArray(payload?.chunks) ? payload.chunks : [];
  const predictedSources = [...new Set(chunks.map((chunk) => chunk.filename))];
  const topScore = chunks.length ? Number(chunks[0].score || 0) : 0;
  const confidence = scoreToConfidence(topScore, chunks.length);

  const expected = new Set(item.expected_sources);
  const matched = predictedSources.filter((source) => expected.has(source)).length;
  const citationPrecision = predictedSources.length
    ? Number((matched / predictedSources.length).toFixed(3))
    : expected.size === 0
      ? 1
      : 0;

  return {
    confidence,
    predictedSources,
    citationPrecision,
    topScore,
  };
}

function scoreToConfidence(score, count) {
  if (!count) return "low";
  if (score >= 0.86 && count >= 2) return "high";
  if (score >= 0.72) return "medium";
  return "low";
}

main().catch((error) => {
  console.error("Grounding eval runner failed:", error);
  process.exit(1);
});
