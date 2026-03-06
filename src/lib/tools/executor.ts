import { webSearch } from "./web-search";
import { fetchUrl } from "./url-fetch";
import type { ToolName } from "./definitions";
import type { ToolStep } from "./types";

export type { ToolStep };

const TOOL_TIMEOUT_MS = 15_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Tool timed out after ${ms}ms`)), ms)
    ),
  ]);
}

export async function executeTool(
  name: string,
  args: Record<string, unknown>
): Promise<ToolStep> {
  const start = Date.now();

  try {
    let result: string;

    switch (name as ToolName) {
      case "web_search": {
        const query = String(args.query ?? "");
        if (!query) throw new Error("web_search requires a non-empty query");
        result = await withTimeout(webSearch(query), TOOL_TIMEOUT_MS);
        break;
      }
      case "fetch_url": {
        const url = String(args.url ?? "");
        if (!url) throw new Error("fetch_url requires a url");
        result = await withTimeout(fetchUrl(url), TOOL_TIMEOUT_MS);
        break;
      }
      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return { toolName: name, args, result, durationMs: Date.now() - start };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return {
      toolName: name,
      args,
      result: `Error: ${errorMessage}`,
      durationMs: Date.now() - start,
      error: true,
    };
  }
}
