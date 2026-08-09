import type { Message } from "@langchain/langgraph-sdk";

import {
  extractContentFromMessage,
  extractReasoningContentFromMessage,
  findToolCallResult,
  stripInternalContent,
  type FileInMessage,
} from "./utils";

/**
 * Segment model — the new rendering contract for chat messages.
 *
 * An assistant message is decomposed into an ordered list of segments
 * (reasoning → tool activity → prose → files), each rendered by a small
 * dedicated block component. This mirrors the KStock/WorkBuddy "turn"
 * model and lets streaming progressively reveal each part independently
 * (thinking first, then tool calls, then the final answer).
 *
 * A human message is rendered as a single {@link UserPromptSegment}.
 */

export type ToolActivityStep = {
  id: string;
  name: string;
  args: Record<string, unknown>;
  result?: string | Record<string, unknown>;
};

export type MessageSegment =
  | { kind: "reasoning"; content: string }
  | {
      kind: "tool_activity";
      steps: ToolActivityStep[];
      /** Optional reasoning that accompanies the tool calls. */
      reasoning?: string;
    }
  | { kind: "prose"; content: string }
  | { kind: "files"; files: FileInMessage[] };

/** Segment for a human (user) message. */
export type UserPromptSegment = {
  kind: "user";
  content: string;
  files: FileInMessage[];
};

/** Tools whose results are surfaced elsewhere (subagent cards, artifacts). */
const DEFERRED_TOOLS = new Set(["task", "present_files"]);

function parseToolSteps(
  message: Message,
  contextMessages: Message[],
): ToolActivityStep[] {
  const steps: ToolActivityStep[] = [];
  const toolCalls = (message as { tool_calls?: unknown }).tool_calls as
    | Array<{
        id?: string;
        name: string;
        args: Record<string, unknown>;
      }>
    | undefined;
  for (const toolCall of toolCalls ?? []) {
    if (DEFERRED_TOOLS.has(toolCall.name)) continue;
    const step: ToolActivityStep = {
      id: toolCall.id ?? `${toolCall.name}-${steps.length}`,
      name: toolCall.name,
      args: toolCall.args,
    };
    if (toolCall.id) {
      const raw = findToolCallResult(toolCall.id, contextMessages);
      if (raw) {
        try {
          step.result = JSON.parse(raw);
        } catch {
          step.result = raw;
        }
      }
    }
    steps.push(step);
  }
  return steps;
}

/**
 * Decompose an assistant message into ordered renderable segments.
 *
 * @param message            the AI message to render
 * @param contextMessages    sibling messages used to resolve tool results
 */
export function parseMessageSegments(
  message: Message,
  contextMessages: Message[] = [],
): MessageSegment[] {
  const segments: MessageSegment[] = [];

  const reasoning = extractReasoningContentFromMessage(message);
  if (reasoning) {
    const cleaned = stripInternalContent(reasoning);
    if (cleaned) segments.push({ kind: "reasoning", content: cleaned });
  }

  const toolSteps = parseToolSteps(message, contextMessages);
  if (toolSteps.length > 0) {
    segments.push({ kind: "tool_activity", steps: toolSteps });
  }

  const rawProse = extractContentFromMessage(message);
  if (rawProse) {
    segments.push({ kind: "prose", content: rawProse });
  }

  const files = message.additional_kwargs?.files as FileInMessage[] | undefined;
  if (Array.isArray(files) && files.length > 0) {
    segments.push({ kind: "files", files });
  }

  return segments;
}

/**
 * Decompose a human message into a single user-prompt segment.
 */
export function parseUserPrompt(message: Message): UserPromptSegment {
  const content =
    extractContentFromMessage(message) ??
    extractReasoningContentFromMessage(message) ??
    "";
  const files = (message.additional_kwargs?.files as
    | FileInMessage[]
    | undefined) ?? [];
  return { kind: "user", content, files };
}
