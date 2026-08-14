import type { AIMessage, Message } from "@langchain/langgraph-sdk";
import { describe, expect, test } from "vitest";

import {
  parseAssistantSegments,
  parseMessageSegments,
} from "@/core/messages/segments";

type AIMessageLike = Partial<Omit<AIMessage, "type">> & { id: string };

function aiMessage(partial: AIMessageLike): Message {
  return { type: "ai", ...partial } as unknown as Message;
}

function toolResult(id: string, content: string): Message {
  return {
    type: "tool",
    id: `result-${id}`,
    tool_call_id: id,
    content,
  } as unknown as Message;
}

describe("parseMessageSegments — execution-order interleaving", () => {
  test("string content renders prose BEFORE its tool calls", () => {
    const message = aiMessage({
      id: "m1",
      content: "我先看一下文件结构",
      tool_calls: [
        { id: "call-1", name: "read_file", args: { file_path: "a.ts" } },
      ],
    });

    const segments = parseMessageSegments(message);
    const kinds = segments.map((s) => s.kind);

    expect(kinds).toEqual(["prose", "tool_activity"]);
  });

  test("block content keeps the model's text/tool interleaving", () => {
    const message = aiMessage({
      id: "m2",
      content: [
        { type: "text", text: "第一步" },
        { type: "tool_call", id: "tc-1", name: "bash", args: { command: "ls" } },
        { type: "text", text: "第二步" },
        { type: "tool_call", id: "tc-2", name: "grep", args: { pattern: "x" } },
      ] as unknown as Message["content"],
    });

    const segments = parseMessageSegments(message);
    const kinds = segments.map((s) => s.kind);

    expect(kinds).toEqual(["prose", "tool_activity", "prose", "tool_activity"]);
    expect(segments[0]).toMatchObject({ kind: "prose", content: "第一步" });
    expect(segments[2]).toMatchObject({ kind: "prose", content: "第二步" });
  });

  test("tool_use blocks (Anthropic style) resolve calls and interleave", () => {
    const message = aiMessage({
      id: "m3",
      content: [
        { type: "text", text: "查一下" },
        { type: "tool_use", id: "tu-1", name: "web_search", input: { query: "q" } },
      ] as unknown as Message["content"],
    });

    const segments = parseMessageSegments(message, [
      toolResult("tu-1", JSON.stringify({ results: [] })),
    ]);

    expect(segments.map((s) => s.kind)).toEqual(["prose", "tool_activity"]);
    const steps = segments[1]?.kind === "tool_activity" ? segments[1].steps : [];
    expect(steps[0]).toMatchObject({
      id: "tu-1",
      name: "web_search",
      result: { results: [] },
    });
  });

  test("tool_calls not present as content blocks render after the text", () => {
    const message = aiMessage({
      id: "m4",
      content: [{ type: "text", text: "正文" }] as unknown as Message["content"],
      tool_calls: [
        { id: "call-9", name: "bash", args: { command: "pwd" } },
      ],
    });

    const segments = parseMessageSegments(message);
    expect(segments.map((s) => s.kind)).toEqual(["prose", "tool_activity"]);
  });

  test("consecutive tool calls merge into one activity block", () => {
    const message = aiMessage({
      id: "m5",
      content: [
        { type: "tool_call", id: "t1", name: "read_file", args: { file_path: "x" } },
        { type: "tool_call", id: "t2", name: "write_file", args: { file_path: "y" } },
      ] as unknown as Message["content"],
    });

    const segments = parseMessageSegments(message);
    expect(segments).toHaveLength(1);
    expect(segments[0]?.kind).toBe("tool_activity");
    if (segments[0]?.kind === "tool_activity") {
      expect(segments[0].steps.map((s) => s.id)).toEqual(["t1", "t2"]);
    }
  });

  test("reasoning comes first, deferred tools are skipped", () => {
    const message = aiMessage({
      id: "m6",
      content: "正文",
      additional_kwargs: {
        reasoning_content: "思考过程",
      },
      tool_calls: [
        { id: "task-1", name: "task", args: { prompt: "sub" } },
        { id: "call-2", name: "bash", args: { command: "ls" } },
      ],
    });

    const segments = parseMessageSegments(message);
    const kinds = segments.map((s) => s.kind);

    expect(kinds).toEqual(["reasoning", "prose", "tool_activity"]);
    if (segments[2]?.kind === "tool_activity") {
      expect(segments[2].steps.map((s) => s.name)).toEqual(["bash"]);
    }
  });
});

describe("parseAssistantSegments — cross-message ToolGroup aggregation", () => {
  test("tool calls adjacent across messages merge into one group per prose gap", () => {
    const ai1 = aiMessage({
      id: "a1",
      content: "我先看一下结构",
      tool_calls: [
        { id: "t1", name: "read_file", args: { file_path: "x.ts" } },
      ],
    });
    // tools-only follow-up message — same prose gap as ai1's calls
    const ai2 = aiMessage({
      id: "a2",
      content: "",
      tool_calls: [{ id: "t2", name: "bash", args: { command: "ls" } }],
    });
    const ai3 = aiMessage({
      id: "a3",
      content: "找到了。现在写入结果",
      tool_calls: [
        { id: "t3", name: "write_file", args: { file_path: "y.ts" } },
      ],
    });

    const segments = parseAssistantSegments([ai1, ai2, ai3]);
    const kinds = segments.map((s) => s.kind);

    // One group between the two prose chunks, another after the last one.
    expect(kinds).toEqual(["prose", "tool_activity", "prose", "tool_activity"]);
    if (segments[1]?.kind === "tool_activity") {
      expect(segments[1].steps.map((s) => s.id)).toEqual(["t1", "t2"]);
    }
    if (segments[3]?.kind === "tool_activity") {
      expect(segments[3].steps.map((s) => s.id)).toEqual(["t3"]);
    }
  });

  test("non-ai messages in the group are ignored", () => {
    const ai1 = aiMessage({
      id: "a1",
      content: "正文",
      tool_calls: [{ id: "t1", name: "bash", args: { command: "ls" } }],
    });
    const toolMsg = {
      type: "tool",
      id: "r1",
      tool_call_id: "t1",
      content: "ok",
    } as unknown as Message;

    const segments = parseAssistantSegments([ai1, toolMsg]);
    expect(segments.map((s) => s.kind)).toEqual(["prose", "tool_activity"]);
  });
});
