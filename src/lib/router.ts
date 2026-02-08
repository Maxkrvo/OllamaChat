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

const REASONING_PATTERNS = [
  /\b(analyze|analyse|analysis|evaluate|compare|contrast|assess|critique)\b/i,
  /\b(reason|reasoning|logic|logical|proof|prove|theorem|hypothesis)\b/i,
  /\b(explain\s+(in\s+detail|thoroughly|deeply)|step[\s-]by[\s-]step|break\s+down)\b/i,
  /\b(math|calculus|equation|formula|derive|derivation|integral|differential)\b/i,
  /\b(essay|paper|report|thesis|dissertation|write\s+(a\s+)?(detailed|comprehensive|thorough))\b/i,
  /\b(strategy|strategic|plan\s+for|design\s+a\s+system|architect)\b/i,
];

export function routePrompt(prompt: string): RoutingResult {
  const codeScore = CODE_PATTERNS.reduce(
    (score, pattern) => score + (pattern.test(prompt) ? 1 : 0),
    0
  );

  const reasoningScore = REASONING_PATTERNS.reduce(
    (score, pattern) => score + (pattern.test(prompt) ? 1 : 0),
    0
  );

  // Code specialist: 2+ code signals
  if (codeScore >= 2) {
    return { model: "qwen2.5-coder:14b", reason: "code detected" };
  }

  // Heavy reasoning: 2+ reasoning signals, or long prompt with 1+ signal
  if (reasoningScore >= 2 || (reasoningScore >= 1 && prompt.length > 500)) {
    return { model: "qwen2.5:32b", reason: "complex reasoning" };
  }

  // Code specialist: even 1 code signal
  if (codeScore === 1) {
    return { model: "qwen2.5-coder:14b", reason: "code detected" };
  }

  // Default: fast all-rounder
  return { model: "qwen2.5:14b", reason: "default" };
}
