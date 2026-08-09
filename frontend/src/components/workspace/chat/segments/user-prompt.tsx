"use client";

import { CheckIcon, CopyIcon, PencilIcon, XIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/core/i18n/hooks";
import type { UserPromptSegment } from "@/core/messages/segments";
import { cn } from "@/lib/utils";

import { FilesCard } from "./files-card";

/**
 * UserPrompt — the user's message.
 * Transparent right-aligned text inside a slim border frame, with a
 * hover toolbar (copy / edit). Edit mode swaps the text for a textarea
 * with save/cancel; saving calls `onEditMessage` (optimistic local
 * update included) for upper layers to replay the turn.
 */
export function UserPrompt({
  prompt,
  threadId,
  messageId,
  onEditMessage,
  className,
}: {
  prompt: UserPromptSegment;
  threadId: string;
  messageId?: string;
  onEditMessage?: (messageId: string, replacementText: string) => void;
  className?: string;
}) {
  const { t } = useI18n();
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [editedText, setEditedText] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (copyTimer.current) clearTimeout(copyTimer.current);
  }, []);

  const displayText = editedText ?? prompt.content;

  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(displayText);
    setCopied(true);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(false), 1500);
  }, [displayText]);

  const startEditing = useCallback(() => {
    setEditText(displayText);
    setEditing(true);
  }, [displayText]);

  const saveEdit = useCallback(() => {
    const replacement = editText.trim();
    if (!replacement) return;
    setEditedText(replacement);
    setEditing(false);
    if (messageId) onEditMessage?.(messageId, replacement);
  }, [editText, messageId, onEditMessage]);

  const cancelEdit = useCallback(() => {
    setEditing(false);
    setEditText("");
  }, []);

  return (
    <div className={cn("ml-auto flex w-full max-w-[85%] flex-col gap-1.5", className)}>
      {prompt.files.length > 0 && (
        <div className="flex justify-end">
          <FilesCard files={prompt.files} threadId={threadId} />
        </div>
      )}

      {editing ? (
        <div className="flex w-full flex-col gap-2">
          <textarea
            value={editText}
            onChange={(event) => setEditText(event.target.value)}
            rows={Math.max(3, editText.split("\n").length)}
            autoFocus
            className="border-border/60 bg-muted/40 focus:border-primary/50 text-foreground min-h-20 w-full resize-y rounded-xl border px-3.5 py-2.5 text-sm leading-relaxed outline-none transition-colors"
            aria-label="编辑消息"
          />
          <div className="flex justify-end gap-1.5">
            <button
              type="button"
              onClick={cancelEdit}
              className="text-muted-foreground hover:text-foreground hover:bg-muted/60 flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs transition-colors"
            >
              <XIcon className="size-3.5" />
              {t.common.cancel}
            </button>
            <button
              type="button"
              onClick={saveEdit}
              disabled={!editText.trim()}
              className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1 rounded-lg px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50"
            >
              <CheckIcon className="size-3.5" />
              {t.common.save}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-end gap-1">
          <article
            className="text-foreground rounded-2xl px-3.5 py-2.5 text-right whitespace-pre-wrap leading-relaxed"
            style={{
              background:
                "linear-gradient(135deg, hsl(var(--primary)/0.12), hsl(var(--primary)/0.06))",
            }}
          >
            {displayText}
          </article>
          <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover/conversation-message:opacity-100">
            <Button
              size="icon-sm"
              type="button"
              variant="ghost"
              aria-label={copied ? "已复制" : "复制"}
              title={copied ? "已复制" : "复制"}
              onClick={handleCopy}
            >
              {copied ? (
                <CheckIcon className="text-emerald-500 size-3" />
              ) : (
                <CopyIcon className="text-muted-foreground size-3" />
              )}
            </Button>
            <Button
              size="icon-sm"
              type="button"
              variant="ghost"
              aria-label="编辑消息"
              title="编辑消息"
              onClick={startEditing}
            >
              <PencilIcon className="text-muted-foreground size-3" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
