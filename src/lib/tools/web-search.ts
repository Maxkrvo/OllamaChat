import * as cheerio from "cheerio";

// DDG wraps all result hrefs in a redirect: /l/?uddg=<percent-encoded-url>&...
// Decode it so the model gets a real URL it can pass to fetch_url.
function extractRealUrl(href: string | undefined): string {
  if (!href) return "";
  try {
    // Absolute redirect URL
    const parsed = new URL(href, "https://html.duckduckgo.com");
    const uddg = parsed.searchParams.get("uddg");
    if (uddg) return decodeURIComponent(uddg);
    // Fallback: return href as-is if no redirect param
    return href.startsWith("http") ? href : "";
  } catch {
    return "";
  }
}

export async function webSearch(query: string): Promise<string> {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

  const res = await fetch(url, {
    headers: {
      // Realistic browser UA — helps avoid bot detection
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,*/*;q=0.9",
      "Accept-Language": "en-US,en;q=0.9",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    throw new Error(`DuckDuckGo returned ${res.status} ${res.statusText}`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);

  // Detect CAPTCHA page (no real results, challenge text present)
  if ($(".challenge-form, #challenge-form").length > 0 || $(".result").length === 0 && html.includes("CAPTCHA")) {
    throw new Error("DuckDuckGo returned a CAPTCHA — search unavailable temporarily");
  }

  const results: string[] = [];

  $(".result").each((_i, el) => {
    if (results.length >= 6) return false;

    // Skip ads: DDG marks them with .result--ad
    if ($(el).hasClass("result--ad")) return;

    const title = $(el).find(".result__title").text().trim();
    const snippet = $(el).find(".result__snippet").text().trim();

    // Real href is on the <a> wrapping .result__title, not on a.result__url
    const titleHref = $(el).find(".result__title a").attr("href");
    const realUrl = extractRealUrl(titleHref);

    // Skip results with no title or no usable URL
    if (!title || !realUrl) return;

    results.push(`Title: ${title}\nURL: ${realUrl}\nSummary: ${snippet}`);
  });

  if (results.length === 0) {
    return "No results found for that query.";
  }

  return results.join("\n\n");
}
