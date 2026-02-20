import { prisma } from "@/lib/db";

export type MemoryType = "preference" | "fact" | "decision";
export type MemoryScope = "global" | "conversation";

export interface UsedMemoryItem {
  id: string;
  type: MemoryType;
  content: string;
}

interface SelectMemoryOptions {
  conversationId: string;
  userMessage: string;
  tokenBudget?: number;
}

interface ScoredMemory extends UsedMemoryItem {
  estTokens: number;
  score: number;
}

const DEFAULT_MEMORY_TOKEN_BUDGET = 2000;

export async function selectMemoryForPrompt(
  options: SelectMemoryOptions
): Promise<UsedMemoryItem[]> {
  const tokenBudget = options.tokenBudget ?? DEFAULT_MEMORY_TOKEN_BUDGET;
  if (tokenBudget <= 0) return [];

  const candidates = await prisma.memoryItem.findMany({
    where: {
      status: "active",
      OR: [
        { scope: "global" },
        { scope: "conversation", conversationId: options.conversationId },
      ],
    },
    select: {
      id: true,
      type: true,
      content: true,
      lastUsedAt: true,
      useCount: true,
      supersedesMemoryId: true,
      updatedAt: true,
    },
  });

  if (candidates.length === 0) return [];

  // Respect supersede relationships so stale memory does not keep getting injected.
  const supersededIds = new Set(
    candidates.map((c) => c.supersedesMemoryId).filter((value): value is string => Boolean(value))
  );
  const queryTerms = tokenize(options.userMessage);

  const ranked: ScoredMemory[] = candidates
    .filter((item) => !supersededIds.has(item.id))
    .map((item) => {
      const lexicalScore = lexicalOverlapScore(queryTerms, tokenize(item.content));
      const recencyScore = recencyWeight(item.lastUsedAt ?? item.updatedAt);
      const frequencyScore = Math.min(item.useCount, 20) / 20;
      const score = lexicalScore * 0.7 + recencyScore * 0.2 + frequencyScore * 0.1;

      return {
        id: item.id,
        type: item.type as MemoryType,
        content: item.content,
        estTokens: estimateTokens(item.content),
        score,
      };
    })
    .sort((a, b) => b.score - a.score);

  // Reserve tokens for the injection header ("User memory (curated ...)\n")
  const HEADER_OVERHEAD_TOKENS = 25;
  // Each item adds "N. [type] " prefix (~5 tokens)
  const PER_ITEM_OVERHEAD_TOKENS = 5;

  const selected: UsedMemoryItem[] = [];
  let usedTokens = HEADER_OVERHEAD_TOKENS;

  for (const item of ranked) {
    const itemCost = item.estTokens + PER_ITEM_OVERHEAD_TOKENS;
    if (itemCost > tokenBudget) continue;
    if (usedTokens + itemCost > tokenBudget) continue;
    selected.push({ id: item.id, type: item.type, content: item.content });
    usedTokens += itemCost;
  }

  return selected;
}

export function injectMemoryContext(messages: { role: string; content: string }[], memoryItems: UsedMemoryItem[]): void {
  if (memoryItems.length === 0) return;

  const lines = memoryItems.map((item, index) => `${index + 1}. [${item.type}] ${item.content}`);
  messages.unshift({
    role: "system",
    content:
      "User memory (curated preferences/facts/decisions). Use when relevant and do not contradict newer user instructions:\n" +
      lines.join("\n"),
  });
}

export async function markMemoryItemsUsed(memoryIds: string[]): Promise<void> {
  if (!memoryIds.length) return;
  const now = new Date();

  await Promise.all(
    memoryIds.map((id) =>
      prisma.memoryItem.update({
        where: { id },
        data: {
          useCount: { increment: 1 },
          lastUsedAt: now,
        },
      })
    )
  );
}

interface AutoCaptureInput {
  conversationId: string;
  userMessage: string;
  assistantMessage: string;
  userMessageId?: string;
  assistantMessageId?: string;
}

interface MemoryCandidate {
  type: MemoryType;
  scope: MemoryScope;
  content: string;
  sourceMessageId?: string;
}

export async function autoCaptureMemoryFromTurn(input: AutoCaptureInput): Promise<Array<{ id: string; content: string }>> {
  // Keep auto-capture conservative per turn to reduce noisy memory growth.
  const candidates = extractMemoryCandidates(input).slice(0, 3);
  if (candidates.length === 0) return [];

  const existing = await prisma.memoryItem.findMany({
    where: {
      status: "active",
      OR: [
        { scope: "global" },
        { scope: "conversation", conversationId: input.conversationId },
      ],
    },
    select: {
      type: true,
      scope: true,
      content: true,
      conversationId: true,
    },
  });

  const existingKeys = new Set(
    existing.map((item) =>
      buildMemoryKey(
        item.type as MemoryType,
        item.scope as MemoryScope,
        item.scope === "conversation" ? item.conversationId : null,
        item.content
      )
    )
  );

  const deduped: MemoryCandidate[] = [];
  const seen = new Set<string>();

  for (const candidate of candidates) {
    // Deduplicate both against DB and within this turn.
    const key = buildMemoryKey(
      candidate.type,
      candidate.scope,
      candidate.scope === "conversation" ? input.conversationId : null,
      candidate.content
    );
    if (seen.has(key)) continue;
    if (existingKeys.has(key)) continue;
    seen.add(key);
    deduped.push(candidate);
  }

  if (deduped.length === 0) return [];

  const created = await prisma.$transaction(
    deduped.map((candidate) =>
      prisma.memoryItem.create({
        data: {
          type: candidate.type,
          scope: candidate.scope,
          content: candidate.content,
          conversationId:
            candidate.scope === "conversation" ? input.conversationId : null,
          sourceMessageId: candidate.sourceMessageId ?? null,
          tags: stringifyTags(["auto"]),
          status: "active",
        },
      })
    )
  );

  return created.map((item) => ({ id: item.id, content: item.content }));
}

export interface MemoryItemRow {
  id: string;
  type: string;
  content: string;
  scope: string;
  conversationId: string | null;
  sourceMessageId: string | null;
  status: string;
  supersedesMemoryId: string | null;
  tags: string;
  lastUsedAt: Date | null;
  useCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export function memoryToResponse(item: MemoryItemRow) {
  return {
    ...item,
    tags: parseTags(item.tags),
  };
}

export function parseTags(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((entry) => String(entry).trim()).filter(Boolean);
  } catch {
    return [];
  }
}

export function stringifyTags(tags: string[]): string {
  return JSON.stringify(tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean));
}

export function parseUsedMemoryIds(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((entry) => String(entry)).filter(Boolean);
  } catch {
    return [];
  }
}

function tokenize(input: string): Set<string> {
  return new Set(
    input
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((token) => token.length > 2)
  );
}

function lexicalOverlapScore(queryTerms: Set<string>, itemTerms: Set<string>): number {
  if (queryTerms.size === 0 || itemTerms.size === 0) return 0;
  let overlap = 0;
  for (const term of queryTerms) {
    if (itemTerms.has(term)) overlap += 1;
  }
  return overlap / queryTerms.size;
}

function recencyWeight(timestamp: Date): number {
  const ageMs = Date.now() - timestamp.getTime();
  const ageDays = Math.max(0, ageMs / (1000 * 60 * 60 * 24));
  return Math.exp(-ageDays / 30);
}

function estimateTokens(content: string): number {
  return Math.max(1, Math.ceil(content.length / 4));
}

function extractMemoryCandidates(input: AutoCaptureInput): MemoryCandidate[] {
  const userSentences = splitSentences(input.userMessage);
  const candidates: MemoryCandidate[] = [];

  // Only extract from user messages — assistant phrasing ("let's", "we'll") is too noisy.
  for (const sentence of userSentences) {
    const preference = classifyPreference(sentence);
    if (preference) {
      candidates.push({
        type: "preference",
        scope: "global",
        content: preference,
        sourceMessageId: input.userMessageId,
      });
      continue;
    }

    const fact = classifyFact(sentence);
    if (fact) {
      candidates.push({
        type: "fact",
        scope: "conversation",
        content: fact,
        sourceMessageId: input.userMessageId,
      });
      continue;
    }

    const decision = classifyDecision(sentence);
    if (decision) {
      candidates.push({
        type: "decision",
        scope: "conversation",
        content: decision,
        sourceMessageId: input.userMessageId,
      });
    }
  }

  return candidates;
}

function splitSentences(input: string): string[] {
  return input
    .split(/[\n.!?]+/g)
    .map((sentence) => sentence.trim())
    .map((sentence) => sentence.replace(/\s+/g, " "))
    .filter((sentence) => {
      const wordCount = sentence.split(/\s+/).length;
      return sentence.length >= 15 && sentence.length <= 200 && wordCount >= 4;
    });
}

function classifyPreference(sentence: string): string | null {
  // Require explicit preference language — short imperatives like "please fix" are excluded.
  if (
    /^(i (always|never|prefer|like to|want to|don't want|hate)|always use|never use|avoid using|use .+ (instead|format|style)|be (concise|brief|verbose|detailed)|respond (in|with)|format .+ as)\b/i.test(
      sentence
    )
  ) {
    return sentence;
  }
  return null;
}

function classifyFact(sentence: string): string | null {
  // Require durable facts about the user/project — not transient references like "my variable".
  if (
    /^(i am a|i'm a|i work|my (name|team|company|project|stack|setup|environment)|i use .+ for|we use .+ for|our (project|team|stack|codebase|repo)|the project (is|uses))\b/i.test(
      sentence
    )
  ) {
    return sentence;
  }
  return null;
}

function classifyDecision(sentence: string): string | null {
  // Only match explicit user-stated decisions with enough context.
  if (
    /^(i('ve| have) decided|we('ve| have) decided|let's go with|going with|i('ve| have) chosen|we('ve| have) chosen|decision:|decided to use)\b/i.test(
      sentence
    )
  ) {
    return sentence;
  }
  return null;
}

function buildMemoryKey(
  type: MemoryType,
  scope: MemoryScope,
  conversationId: string | null,
  content: string
) {
  return `${type}|${scope}|${conversationId ?? ""}|${normalizeContent(content)}`;
}

function normalizeContent(content: string): string {
  return content
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
