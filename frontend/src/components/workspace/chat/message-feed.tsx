"use client";

import type { BaseStream } from "@langchain/langgraph-sdk";
import { ChevronDownIcon, ChevronUpIcon, Loader2Icon } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";

import {
  Conversation,
  ConversationContent,
} from "@/components/ai-elements/conversation";
import {
  useStickToBottomContext,
} from "use-stick-to-bottom";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/core/i18n/hooks";
import {
  extractContentFromMessage,
  extractPresentFilesFromMessage,
  groupMessages,
  hasContent,
  hasPresentFiles,
  isHiddenFromUIMessage,
} from "@/core/messages/utils";
import type { Subtask } from "@/core/tasks";
import { useUpdateSubtask } from "@/core/tasks/context";
import type { AgentThreadState } from "@/core/threads";
import { cn } from "@/lib/utils";

import { ArtifactFileList } from "../artifacts/artifact-file-list";
import { MarkdownContent } from "../messages/markdown-content";
import { MessageListSkeleton } from "../messages/skeleton";
import { SubtaskCard } from "../messages/subtask-card";

import { FlywheelSpinner } from "./segments/flywheel-spinner";
import { MessageItem } from "./message-item";

export const MESSAGE_FEED_DEFAULT_PADDING_BOTTOM = 160;
export const MESSAGE_FEED_FOLLOWUPS_EXTRA_PADDING_BOTTOM = 80;

const LOAD_MORE_HISTORY_THROTTLE_MS = 1200;

/**
 * MessageFeed — the new chat message container (Layer 0).
 *
 * The scroll container is owned by the underlying `use-stick-to-bottom`
 * library (via `Conversation`); auto-follow to new content is handled by
 * the library, and the floating "scroll to bottom" button reads
 * `isAtBottom` from the library context so it only ever reflects the
 * *real* scroll position.
 */
export function MessageFeed({
  className,
  threadId,
  thread,
  paddingBottom = MESSAGE_FEED_DEFAULT_PADDING_BOTTOM,
  hasMoreHistory,
  loadMoreHistory,
  isHistoryLoading,
  onEditMessage,
}: {
  className?: string;
  threadId: string;
  thread: BaseStream<AgentThreadState>;
  paddingBottom?: number;
  hasMoreHistory?: boolean;
  loadMoreHistory?: () => void;
  isHistoryLoading?: boolean;
  /** Called when the user edits a human message and saves it. */
  onEditMessage?: (messageId: string, replacementText: string) => void;
}) {
  const { t } = useI18n();
  const updateSubtask = useUpdateSubtask();

  const messages = thread.messages.filter((msg) => !isHiddenFromUIMessage(msg));

  // Only the last visible message is actively streaming — every earlier
  // message is history and must render in its final (done) state.
  const streamingMessageId = thread.isLoading
    ? messages[messages.length - 1]?.id
    : undefined;

  if (thread.isThreadLoading && messages.length === 0) {
    return <MessageListSkeleton />;
  }

  return (
    <Conversation className={cn("relative flex size-full flex-col", className)}>
      <ConversationContent className="mx-auto w-full max-w-(--container-width-md) gap-5 pt-6">
        <LoadMoreHistoryIndicator
          isLoading={isHistoryLoading}
          hasMore={hasMoreHistory}
          loadMore={loadMoreHistory}
        />
        {groupMessages(
          messages,
          (group) => {
            if (group.type === "human") {
              return group.messages.map((msg) => (
                <MessageItem
                  key={`${group.id}/${msg.id}`}
                  threadId={threadId}
                  message={msg}
                  contextMessages={group.messages}
                  isLoading={
                    msg.id != null && msg.id === streamingMessageId
                  }
                  onEditMessage={onEditMessage}
                />
              ));
            }
            if (group.type === "assistant") {
              // Only render AI messages as primary content. Orphan tool
              // messages that were pushed into this group by the fallback
              // in groupMessages are skipped — their results are surfaced
              // inside ToolActivity cards via findToolCallResult.
              return group.messages
                .filter((msg) => msg.type === "ai")
                .map((msg) => (
                  <MessageItem
                    key={`${group.id}/${msg.id}`}
                    threadId={threadId}
                    message={msg}
                    contextMessages={group.messages}
                    isLoading={
                      msg.id != null && msg.id === streamingMessageId
                    }
                    onEditMessage={onEditMessage}
                  />
                ));
            }
            if (group.type === "assistant:processing") {
              // Intermediate AI messages — reasoning blocks and tool
              // activity — rendered via the same segment model as final
              // answers. Tool-result messages are skipped here because
              // their content is surfaced inside the ToolActivity card
              // via findToolCallResult(contextMessages).
              return group.messages
                .filter((msg) => msg.type === "ai")
                .map((msg) => (
                  <MessageItem
                    key={`${group.id}/${msg.id}`}
                    threadId={threadId}
                    message={msg}
                    contextMessages={group.messages}
                    isLoading={
                      msg.id != null && msg.id === streamingMessageId
                    }
                    onEditMessage={onEditMessage}
                  />
                ));
            }
            if (group.type === "assistant:clarification") {
              const message = group.messages[0];
              if (message && hasContent(message)) {
                return (
                  <div key={group.id} className="w-full">
                    <MarkdownContent
                      content={extractContentFromMessage(message)}
                      isLoading={thread.isLoading}
                    />
                  </div>
                );
              }
              return null;
            }
            if (group.type === "assistant:present-files") {
              const files: string[] = [];
              for (const message of group.messages) {
                if (hasPresentFiles(message)) {
                  files.push(...extractPresentFilesFromMessage(message));
                }
              }
              return (
                <div className="w-full" key={group.id}>
                  {group.messages[0] && hasContent(group.messages[0]) && (
                    <MarkdownContent
                      content={extractContentFromMessage(group.messages[0])}
                      isLoading={thread.isLoading}
                      className="mb-4"
                    />
                  )}
                  <ArtifactFileList files={files} threadId={threadId} />
                </div>
              );
            }
            if (group.type === "assistant:subagent") {
              const tasks = new Set<Subtask>();
              for (const message of group.messages) {
                if (message.type === "ai") {
                  for (const toolCall of message.tool_calls ?? []) {
                    if (toolCall.name === "task") {
                      const task: Subtask = {
                        id: toolCall.id!,
                        subagent_type: toolCall.args.subagent_type,
                        description: toolCall.args.description,
                        prompt: toolCall.args.prompt,
                        status: "in_progress",
                      };
                      updateSubtask(task);
                      tasks.add(task);
                    }
                  }
                }
              }
              const results: React.ReactNode[] = [];
              for (const message of group.messages) {
                if (message.type === "ai") {
                  const taskIds = message.tool_calls
                    ?.filter((toolCall) => toolCall.name === "task")
                    .map((toolCall) => toolCall.id);
                  for (const taskId of taskIds ?? []) {
                    results.push(
                      <SubtaskCard
                        key={"task-group-" + taskId}
                        taskId={taskId!}
                        isLoading={thread.isLoading}
                      />,
                    );
                  }
                }
              }
              return (
                <div
                  key={"subtask-group-" + group.id}
                  className="relative z-1 flex flex-col gap-2"
                >
                  {results}
                </div>
              );
            }
            return null;
          },
          { isCurrentTurnLoading: thread.isLoading },
        )}
        {thread.isLoading && (
          <div className="my-4 flex items-center gap-2 text-muted-foreground text-sm">
            <FlywheelSpinner />
          </div>
        )}
        <div style={{ height: `${paddingBottom}px` }} />
      </ConversationContent>

      {/* Floating "scroll to bottom" button — a direct child of
          Conversation (StickToBottom) so it stays pinned to the visible
          viewport instead of riding with the scroll content. It reads
          isAtBottom from the library context, which reflects the real
          scroll container (our own onScroll would never fire because the
          actual scrolling element is internal to the library). */}
      <ScrollToBottomButton />
    </Conversation>
  );
}

/** Floating "back to bottom" button driven by the stick-to-bottom lib. */
function ScrollToBottomButton() {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext();
  if (isAtBottom) return null;
  return (
    <div className="pointer-events-none absolute bottom-32 left-0 right-0 flex justify-center">
      <button
        type="button"
        aria-label="回到底部"
        title="回到底部"
        onClick={() => {
          void scrollToBottom({ animation: "smooth" });
        }}
        className={cn(
          "pointer-events-auto z-20 flex h-9 w-9 items-center justify-center rounded-full border shadow-md backdrop-blur",
          "bg-background/90 hover:bg-background border-border/70 text-muted-foreground hover:text-foreground",
          "transition-all duration-200 hover:-translate-y-0.5",
        )}
      >
        <ChevronDownIcon className="size-4" />
      </button>
    </div>
  );
}

function LoadMoreHistoryIndicator({
  isLoading,
  hasMore,
  loadMore,
}: {
  isLoading?: boolean;
  hasMore?: boolean;
  loadMore?: () => void;
}) {
  const { t } = useI18n();
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastLoadRef = useRef(0);

  const throttledLoadMore = useCallback(() => {
    if (!hasMore || isLoading) return;
    const now = Date.now();
    const remaining =
      LOAD_MORE_HISTORY_THROTTLE_MS - (now - lastLoadRef.current);
    if (remaining <= 0) {
      lastLoadRef.current = now;
      loadMore?.();
      return;
    }
    if (timeoutRef.current) return;
    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null;
      if (!hasMore || isLoading) return;
      lastLoadRef.current = Date.now();
      loadMore?.();
    }, remaining);
  }, [hasMore, isLoading, loadMore]);

  useEffect(() => {
    const element = sentinelRef.current;
    if (!element || !hasMore) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) throttledLoadMore();
      },
      { rootMargin: "120px 0px 0px 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [hasMore, throttledLoadMore]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  if (!hasMore && !isLoading) return null;

  return (
    <div ref={sentinelRef} className="flex w-full justify-center">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-muted-foreground hover:text-foreground rounded-full px-3"
        disabled={(isLoading ?? false) || !hasMore}
        onClick={throttledLoadMore}
      >
        {isLoading ? (
          <>
            <Loader2Icon className="mr-2 size-4 animate-spin" />
            {t.common.loading}
          </>
        ) : (
          <>
            <ChevronUpIcon className="mr-2 size-4" />
            {t.common.loadMore}
          </>
        )}
      </Button>
    </div>
  );
}
