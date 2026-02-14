import { getAppConfig } from "@/lib/config";

export type RoutingResult = {
  model: string;
  reason: string;
};

const CODE_PATTERNS = [
  /\b(code|coding|program|programming|implement|function|class|method|variable|algorithm)\b/i,
  /\b(javascript|typescript|python|rust|golang|java|c\+\+|html|css|sql|react|nextjs|node)\b/i,
  /\b(bug|debug|refactor|compile|runtime|syntax|error|exception|stack\s*trace|lint)\b/i,
  /```/,
  /=>/,
  /\b(import|export|const|let|var|def|fn|func|async|await)\b/,
  /\.(ts|js|py|rs|go|java|cpp|tsx|jsx)\b/,
];

export async function routePrompt(prompt: string): Promise<RoutingResult> {
  const config = await getAppConfig();

  const codeScore = CODE_PATTERNS.reduce(
    (score, pattern) => score + (pattern.test(prompt) ? 1 : 0),
    0
  );

  if (codeScore >= 1) {
    return { model: config.codeModel, reason: "code detected" };
  }

  return { model: config.defaultModel, reason: "default" };
}
