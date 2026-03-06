export type ToolName = "web_search" | "fetch_url";

export interface OllamaToolFunction {
  name: ToolName;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, { type: string; description: string }>;
    required: string[];
  };
}

export interface OllamaTool {
  type: "function";
  function: OllamaToolFunction;
}

export const TOOLS: OllamaTool[] = [
  {
    type: "function",
    function: {
      name: "web_search",
      description:
        "Search the web using DuckDuckGo. Use this when you need current information, recent news, facts, or anything not in your training data.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The search query to run.",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "fetch_url",
      description:
        "Fetch and read the text content of a URL. Use this to read web pages, articles, or documentation when you have a specific URL.",
      parameters: {
        type: "object",
        properties: {
          url: {
            type: "string",
            description: "The full URL (including https://) to fetch.",
          },
        },
        required: ["url"],
      },
    },
  },
];
