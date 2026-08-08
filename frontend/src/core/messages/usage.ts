import type { Message } from "@langchain/langgraph-sdk";

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

/**
 * Extract usage_metadata from an AI message if present.
 * The field is added by the backend (PR #1218) but not typed in the SDK.
 */
export function getUsageMetadata(message: Message): TokenUsage | null {
  if (message.type !== "ai") {
    return null;
  }
  const usage = (message as Record<string, unknown>).usage_metadata as
    | { input_tokens?: number; output_tokens?: number; total_tokens?: number }
    | undefined;
  if (!usage) {
    return null;
  }
  return {
    inputTokens: usage.input_tokens ?? 0,
    outputTokens: usage.output_tokens ?? 0,
    totalTokens: usage.total_tokens ?? 0,
  };
}

/**
 * Accumulate token usage across all AI messages in a thread.
 */
export function accumulateUsage(messages: Message[]): TokenUsage | null {
  const cumulative: TokenUsage = {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
  };
  let hasUsage = false;
  for (const message of messages) {
    const usage = getUsageMetadata(message);
    if (usage) {
      hasUsage = true;
      cumulative.inputTokens += usage.inputTokens;
      cumulative.outputTokens += usage.outputTokens;
      cumulative.totalTokens += usage.totalTokens;
    }
  }
  return hasUsage ? cumulative : null;
}

/**
 * Validate a raw `{input,output,total}_tokens` object into {@link TokenUsage}.
 *
 * Every key must be a finite, non-negative number or the whole snapshot is
 * rejected as `undefined`. Used by sub-agent usage surfaces (live task events
 * and terminal ToolMessage metadata) that receive untyped payloads.
 */
export function normalizeTokenUsage(value: unknown): TokenUsage | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  const inputTokens = nonNegativeNumber(record.input_tokens);
  const outputTokens = nonNegativeNumber(record.output_tokens);
  const totalTokens = nonNegativeNumber(record.total_tokens);
  if (
    inputTokens === undefined ||
    outputTokens === undefined ||
    totalTokens === undefined
  ) {
    return undefined;
  }
  return { inputTokens, outputTokens, totalTokens };
}

function nonNegativeNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : undefined;
}

export function hasNonZeroUsage(
  usage: TokenUsage | null | undefined,
): usage is TokenUsage {
  return (
    usage !== null &&
    usage !== undefined &&
    (usage.inputTokens > 0 || usage.outputTokens > 0 || usage.totalTokens > 0)
  );
}

export function addUsage(base: TokenUsage, delta: TokenUsage): TokenUsage {
  return {
    inputTokens: base.inputTokens + delta.inputTokens,
    outputTokens: base.outputTokens + delta.outputTokens,
    totalTokens: base.totalTokens + delta.totalTokens,
  };
}

export function selectHeaderTokenUsage({
  backendUsage,
  messages,
  pendingMessages = [],
}: {
  backendUsage?: TokenUsage | null;
  messages: Message[];
  pendingMessages?: Message[];
}): TokenUsage | null {
  if (hasNonZeroUsage(backendUsage)) {
    const pendingUsage = accumulateUsage(pendingMessages);
    return pendingUsage ? addUsage(backendUsage, pendingUsage) : backendUsage;
  }
  return accumulateUsage(messages);
}

/**
 * Format a token count for display: 1234 -> "1,234", 12345 -> "12.3K"
 */
export function formatTokenCount(count: number): string {
  if (count < 10_000) {
    return count.toLocaleString();
  }
  return `${(count / 1000).toFixed(1)}K`;
}
