"use client";

import type { Message } from "@langchain/langgraph-sdk";
import { memo, useMemo } from "react";

import { tryExtractInlineHumanInputForm } from "@/core/messages/utils";
import { parseMessageSegments, parseUserPrompt } from "@/core/messages/segments";
import { cn } from "@/lib/utils";

import { ProseContent } from "./segments/prose-content";
import { ReasoningBlock } from "./segments/reasoning-block";
import { ToolActivity } from "./segments/tool-activity";
import { FilesCard } from "./segments/files-card";
import { UserPrompt } from "./segments/user-prompt";
import { HumanInputCard } from "../messages/human-input-card";

interface MessageItemProps {
  message: Message;
  contextMessages: Message[];
  threadId: string;
  isLoading?: boolean;
  /** Called when the user edits + saves a human message. */
  onEditMessage?: (messageId: string, replacementText: string) => void;
  className?: string;
}

/**
 * MessageItem — the single-message shell (Layer 1).
 *
 * Human messages render as a {@link UserPrompt}; assistant messages are
 * decomposed by {@link parseMessageSegments} into ordered blocks
 * (reasoning → tool activity → prose → files), each delegated to a small
 * segment component.
 */
export const MessageItem = memo(
  function MessageItem({
    message,
    contextMessages,
    threadId,
    isLoading = false,
    onEditMessage,
    className,
  }: MessageItemProps) {
    const isHuman = message.type === "human";

    if (isHuman) {
      const prompt = parseUserPrompt(message);
      return (
        <div
          className={cn("group/conversation-message flex w-full", className)}
        >
          <UserPrompt
            prompt={prompt}
            threadId={threadId}
            messageId={message.id}
            onEditMessage={onEditMessage}
          />
        </div>
      );
    }

    // Memoize segment parsing — during SSE streaming, the parent re-renders
    // on every token. Without this, parseMessageSegments re-parses every
    // message in the list each tick (O(n²) with contextMessages scanning
    // for tool results), which freezes the UI on long conversations.
    const segments = useMemo(
      () => parseMessageSegments(message, contextMessages),
      [message, contextMessages],
    );

    return (
      <div className={cn("group/conversation-message flex w-full", className)}>
        <div className="flex w-full flex-col gap-3.5">
          {segments.map((segment, index) => {
            switch (segment.kind) {
              case "reasoning":
                return (
                  <ReasoningBlock
                    key={`reasoning-${index}`}
                    content={segment.content}
                    isStreaming={isLoading}
                  />
                );
              case "tool_activity":
                return (
                  <ToolActivity
                    key={`tools-${index}`}
                    steps={segment.steps}
                    isLoading={isLoading}
                  />
                );
              case "prose": {
                // If the assistant wrote a structured clarification as
                // plain markdown instead of calling ask_clarification,
                // render it as an interactive form card.
                const inlineForm = tryExtractInlineHumanInputForm(
                  segment.content,
                );
                if (inlineForm) {
                  return (
                    <HumanInputCard
                      key={`form-${index}`}
                      request={inlineForm}
                    />
                  );
                }
                return (
                  <ProseContent
                    key={`prose-${index}`}
                    content={segment.content}
                    isLoading={isLoading}
                  />
                );
              }
              case "files":
                return (
                  <FilesCard
                    key={`files-${index}`}
                    files={segment.files}
                    threadId={threadId}
                  />
                );
            }
          })}
        </div>
      </div>
    );
  },
);
