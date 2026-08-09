import type { Message } from "@langchain/langgraph-sdk";
import {
  CheckIcon,
  FileIcon,
  Loader2Icon,
  PencilIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
  XIcon,
} from "lucide-react";
import {
  memo,
  useCallback,
  useMemo,
  useState,
  type AnchorHTMLAttributes,
  type ImgHTMLAttributes,
} from "react";

import { Loader } from "@/components/ai-elements/loader";
import {
  Message as AIElementMessage,
  MessageContent as AIElementMessageContent,
  MessageToolbar,
} from "@/components/ai-elements/message";
import {
  Reasoning,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import { Task, TaskTrigger } from "@/components/ai-elements/task";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  deleteFeedback,
  upsertFeedback,
  type FeedbackData,
} from "@/core/api/feedback";
import { useAuthenticatedArtifactObjectUrl } from "@/core/artifacts/authenticated-url";
import { isArtifactPath, resolveArtifactURL } from "@/core/artifacts/utils";
import { useI18n } from "@/core/i18n/hooks";
import type { HumanInputResponse } from "@/core/messages/human-input";
import {
  extractContentFromMessage,
  extractReasoningContentFromMessage,
  parseUploadedFiles,
  stripInternalContent,
  stripUploadedFilesTag,
  tryExtractInlineHumanInputForm,
  type FileInMessage,
} from "@/core/messages/utils";
import { SafeReasoningContent } from "@/core/streamdown/components";
import { cn } from "@/lib/utils";

import { CopyButton } from "../copy-button";
import {
  type HumanInputSubmitResult,
  HumanInputCard,
} from "./human-input-card";
import { Tooltip } from "../tooltip";

import { MarkdownContent } from "./markdown-content";

function FeedbackButtons({
  threadId,
  runId,
  initialFeedback,
}: {
  threadId: string;
  runId: string;
  initialFeedback: FeedbackData | null;
}) {
  const [feedback, setFeedback] = useState<FeedbackData | null>(
    initialFeedback,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleClick = useCallback(
    async (rating: number) => {
      if (isSubmitting) return;
      setIsSubmitting(true);
      try {
        if (feedback?.rating === rating) {
          await deleteFeedback(threadId, runId);
          setFeedback(null);
        } else {
          const result = await upsertFeedback(threadId, runId, rating);
          setFeedback(result);
        }
      } catch {
        // Revert on error — feedback state unchanged on catch
      } finally {
        setIsSubmitting(false);
      }
    },
    [threadId, runId, feedback, isSubmitting],
  );

  return (
    <div className="flex gap-1">
      <button
        type="button"
        className={cn(
          "text-muted-foreground hover:text-foreground rounded-md p-1 transition-colors",
          feedback?.rating === 1 && "text-foreground",
        )}
        onClick={() => handleClick(1)}
        disabled={isSubmitting}
      >
        <ThumbsUpIcon
          className={cn("size-4", feedback?.rating === 1 && "fill-current")}
        />
      </button>
      <button
        type="button"
        className={cn(
          "text-muted-foreground hover:text-foreground rounded-md p-1 transition-colors",
          feedback?.rating === -1 && "text-foreground",
        )}
        onClick={() => handleClick(-1)}
        disabled={isSubmitting}
      >
        <ThumbsDownIcon
          className={cn("size-4", feedback?.rating === -1 && "fill-current")}
        />
      </button>
    </div>
  );
}

export function MessageListItem({
  className,
  threadId,
  message,
  isLoading,
  feedback,
  runId,
  onEditMessage,
  onClarifySubmit,
}: {
  className?: string;
  message: Message;
  isLoading?: boolean;
  threadId: string;
  feedback?: FeedbackData | null;
  runId?: string;
  /**
   * Optional callback invoked when the user saves an edited user message.
   * The UI optimistically updates the local bubble; upper layers (e.g. a
   * thread stream) can hook this to replay / regenerate the turn.
   */
  onEditMessage?: (messageId: string, replacementText: string) => void;
  /**
   * Optional callback invoked when the user submits a structured
   * clarification request that the assistant emitted as inline markdown
   * (rendered through `HumanInputCard`). Upper layers can pipe the
   * response back into the chat stream.
   */
  onClarifySubmit?: (
    response: HumanInputResponse,
  ) => HumanInputSubmitResult | Promise<HumanInputSubmitResult>;
}) {
  const isHuman = message.type === "human";
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [editedText, setEditedText] = useState<string | null>(null);

  const startEditing = useCallback(() => {
    const current =
      editedText ??
      extractContentFromMessage(message) ??
      extractReasoningContentFromMessage(message) ??
      "";
    setEditText(current);
    setEditing(true);
  }, [message, editedText]);

  const saveEdit = useCallback(() => {
    const replacement = editText.trim();
    if (!replacement) return;
    setEditedText(replacement);
    setEditing(false);
    if (message.id) {
      onEditMessage?.(message.id, replacement);
    }
  }, [editText, message.id, onEditMessage]);

  const cancelEdit = useCallback(() => {
    setEditing(false);
    setEditText("");
  }, []);

  return (
    <AIElementMessage
      className={cn("group/conversation-message relative w-full", className)}
      from={isHuman ? "user" : "assistant"}
    >
      <MessageContent
        className={isHuman ? "w-fit" : "w-full"}
        message={message}
        isLoading={isLoading}
        threadId={threadId}
        editing={editing}
        editText={editText}
        editedText={editedText}
        onEditTextChange={setEditText}
        onSaveEdit={saveEdit}
        onCancelEdit={cancelEdit}
        onStartEdit={startEditing}
        onClarifySubmit={onClarifySubmit}
      />
      {!isLoading && (
        <MessageToolbar
          className={cn(
            isHuman ? "-bottom-9 justify-end" : "-bottom-8",
            "absolute right-0 left-0 z-20",
          )}
        >
          <div className="flex gap-1">
            <CopyButton
              clipboardData={
                editedText ??
                extractContentFromMessage(message) ??
                extractReasoningContentFromMessage(message) ??
                ""
              }
            />
            {isHuman && (
              <Tooltip content="编辑消息">
                <Button
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                  onClick={startEditing}
                  disabled={editing || isLoading}
                >
                  <PencilIcon size={12} />
                </Button>
              </Tooltip>
            )}
            {feedback !== undefined && runId && threadId && (
              <FeedbackButtons
                threadId={threadId}
                runId={runId}
                initialFeedback={feedback}
              />
            )}
          </div>
        </MessageToolbar>
      )}
    </AIElementMessage>
  );
}

/**
 * Custom image component that handles artifact URLs
 */
function MessageImage({
  src,
  alt,
  threadId,
  maxWidth = "90%",
  ...props
}: React.ImgHTMLAttributes<HTMLImageElement> & {
  threadId: string;
  maxWidth?: string;
}) {
  const artifactUrl =
    typeof src === "string" && isArtifactPath(src)
      ? resolveArtifactURL(src, threadId)
      : typeof src === "string"
        ? src
        : null;
  const displayUrl = useAuthenticatedArtifactObjectUrl(artifactUrl);
  if (!src) return null;

  const imgClassName = cn("overflow-hidden rounded-lg", `max-w-[${maxWidth}]`);

  if (typeof src !== "string") {
    return <img className={imgClassName} src={src} alt={alt} {...props} />;
  }

  if (!displayUrl) return null;

  return (
    <a href={displayUrl} target="_blank" rel="noopener noreferrer">
      <img className={imgClassName} src={displayUrl} alt={alt} {...props} />
    </a>
  );
}

function MessageArtifactLink({
  href,
  threadId,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & {
  threadId: string;
}) {
  const url = href && isArtifactPath(href) ? resolveArtifactURL(href, threadId) : href;
  const displayUrl = useAuthenticatedArtifactObjectUrl(url);

  return (
    <a
      {...props}
      href={displayUrl}
      target="_blank"
      rel="noopener noreferrer"
    />
  );
}

function MessageContent_({
  className,
  message,
  isLoading = false,
  threadId,
  editing = false,
  editText = "",
  editedText = null,
  onEditTextChange,
  onSaveEdit,
  onCancelEdit,
  onStartEdit,
  onClarifySubmit,
}: {
  className?: string;
  message: Message;
  isLoading?: boolean;
  threadId: string;
  editing?: boolean;
  editText?: string;
  editedText?: string | null;
  onEditTextChange?: (value: string) => void;
  onSaveEdit?: () => void;
  onCancelEdit?: () => void;
  onStartEdit?: () => void;
  onClarifySubmit?: (
    response: HumanInputResponse,
  ) => HumanInputSubmitResult | Promise<HumanInputSubmitResult>;
}) {
  const isHuman = message.type === "human";
  const components = useMemo(
    () => ({
      img: (props: ImgHTMLAttributes<HTMLImageElement>) => (
        <MessageImage {...props} threadId={threadId} maxWidth="90%" />
      ),
      a: ({ href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) => {
        if (href && isArtifactPath(href)) {
          return (
            <MessageArtifactLink
              {...props}
              href={href}
              threadId={threadId}
            />
          );
        }
        return <a {...props} href={href} />;
      },
    }),
    [threadId],
  );

  const rawContent = extractContentFromMessage(message);
  const reasoningContent = extractReasoningContentFromMessage(message);

  const files = useMemo(() => {
    const files = message.additional_kwargs?.files;
    if (!Array.isArray(files) || files.length === 0) {
      if (rawContent.includes("<uploaded_files>")) {
        // If the content contains the <uploaded_files> tag, we return the parsed files from the content for backward compatibility.
        return parseUploadedFiles(rawContent);
      }
      return null;
    }
    return files as FileInMessage[];
  }, [message.additional_kwargs?.files, rawContent]);

  const contentToDisplay = useMemo(() => {
    if (isHuman) {
      return rawContent ? stripUploadedFilesTag(rawContent) : "";
    }
    return stripInternalContent(rawContent ?? "");
  }, [rawContent, isHuman]);

  const filesList =
    files && files.length > 0 ? (
      <RichFilesList files={files} threadId={threadId} />
    ) : null;

  // Uploading state: mock AI message shown while files upload
  if (message.additional_kwargs?.element === "task") {
    return (
      <AIElementMessageContent className={className}>
        <Task defaultOpen={false}>
          <TaskTrigger title="">
            <div className="text-muted-foreground flex w-full cursor-default items-center gap-2 text-sm select-none">
              <Loader className="size-4" />
              <span>{contentToDisplay}</span>
            </div>
          </TaskTrigger>
        </Task>
      </AIElementMessageContent>
    );
  }

  // Reasoning-only AI message (no main response content yet)
  if (!isHuman && reasoningContent && !rawContent) {
    return (
      <AIElementMessageContent className={className}>
        <Reasoning isStreaming={isLoading}>
          <ReasoningTrigger />
          <SafeReasoningContent>
            {stripInternalContent(reasoningContent)}
          </SafeReasoningContent>
        </Reasoning>
      </AIElementMessageContent>
    );
  }

  if (isHuman) {
    // Composer input is plain text, not authored Markdown. Parsing it as
    // Markdown mangles pasted code/logs (indented lines become code blocks,
    // "$...$" spans become math) and lets pathological input crash the page,
    // so render it verbatim.
    const displayText = editedText ?? contentToDisplay;

    // Edit mode: textarea + save/cancel actions inside a bordered frame.
    if (editing) {
      return (
        <div
          className={cn(
            "ml-auto flex w-full max-w-[85%] flex-col gap-2",
            className,
          )}
        >
          <textarea
            value={editText}
            onChange={(event) => onEditTextChange?.(event.target.value)}
            rows={Math.max(3, editText.split("\n").length)}
            autoFocus
            className="border-border/60 bg-background/60 focus:border-primary/50 text-foreground min-h-20 w-full resize-y rounded-lg border px-3 py-2 text-sm leading-relaxed outline-none transition-colors"
            aria-label="编辑消息"
          />
          <div className="flex justify-end gap-1.5">
            <button
              type="button"
              onClick={onCancelEdit}
              className="text-muted-foreground hover:text-foreground hover:bg-muted/60 flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors"
            >
              <XIcon className="size-3.5" />
              取消
            </button>
            <button
              type="button"
              onClick={onSaveEdit}
              disabled={!editText.trim()}
              className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50"
            >
              <CheckIcon className="size-3.5" />
              保存
            </button>
          </div>
        </div>
      );
    }

    const humanText = displayText ? (
      <AIElementMessageContent className="w-fit">
        {/* Bordered frame around the user's message. */}
        <div className="border-border/70 bg-background/50 text-foreground break-words rounded-lg border px-3 py-2 whitespace-pre-wrap">
          {displayText}
        </div>
      </AIElementMessageContent>
    ) : null;
    return (
      <div className={cn("ml-auto flex flex-col gap-2", className)}>
        {filesList}
        {humanText}
      </div>
    );
  }

  // If the assistant reply is a structured clarification rendered as plain
  // markdown (numbered `**field (required)** — options: …` items plus
  // "Please reply with a value for each field"), surface it through the
  // interactive HumanInputCard component instead of an unreadable wall
  // of prose.
  const inlineHumanInput = !isHuman && contentToDisplay
    ? tryExtractInlineHumanInputForm(contentToDisplay)
    : null;
  const proseContent = inlineHumanInput ? "" : contentToDisplay;

  return (
    <AIElementMessageContent className={className}>
      {filesList}
      {reasoningContent && (
        <Reasoning isStreaming={isLoading}>
          <ReasoningTrigger />
          <SafeReasoningContent>
            {stripInternalContent(reasoningContent)}
          </SafeReasoningContent>
        </Reasoning>
      )}
      {inlineHumanInput && (
        <HumanInputCard
          request={inlineHumanInput}
          onSubmit={onClarifySubmit}
        />
      )}
      {proseContent && (
        <MarkdownContent
          content={proseContent}
          isLoading={isLoading}
          className="streamdown-tight my-1"
          components={components}
        />
      )}
    </AIElementMessageContent>
  );
}

/**
 * Get file extension and check helpers
 */
const getFileExt = (filename: string) =>
  filename.split(".").pop()?.toLowerCase() ?? "";

const FILE_TYPE_MAP: Record<string, string> = {
  json: "JSON",
  csv: "CSV",
  txt: "TXT",
  md: "Markdown",
  py: "Python",
  js: "JavaScript",
  ts: "TypeScript",
  tsx: "TSX",
  jsx: "JSX",
  html: "HTML",
  css: "CSS",
  xml: "XML",
  yaml: "YAML",
  yml: "YAML",
  pdf: "PDF",
  png: "PNG",
  jpg: "JPG",
  jpeg: "JPEG",
  gif: "GIF",
  svg: "SVG",
  zip: "ZIP",
  tar: "TAR",
  gz: "GZ",
};

const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"];

function getFileTypeLabel(filename: string): string {
  const ext = getFileExt(filename);
  return FILE_TYPE_MAP[ext] ?? (ext.toUpperCase() || "FILE");
}

function isImageFile(filename: string): boolean {
  return IMAGE_EXTENSIONS.includes(getFileExt(filename));
}

/**
 * Format bytes to human-readable size string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return "—";
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

/**
 * List of files from additional_kwargs.files (with optional upload status)
 */
function RichFilesList({
  files,
  threadId,
}: {
  files: FileInMessage[];
  threadId: string;
}) {
  if (files.length === 0) return null;
  return (
    <div className="mb-2 flex flex-wrap justify-end gap-2">
      {files.map((file, index) => (
        <RichFileCard
          key={`${file.filename}-${index}`}
          file={file}
          threadId={threadId}
        />
      ))}
    </div>
  );
}

/**
 * Single file card that handles FileInMessage (supports uploading state)
 */
function RichFileCard({
  file,
  threadId,
}: {
  file: FileInMessage;
  threadId: string;
}) {
  const { t } = useI18n();
  const isUploading = file.status === "uploading";
  const isImage = isImageFile(file.filename);
  const fileUrl = file.path ? resolveArtifactURL(file.path, threadId) : null;
  const displayFileUrl = useAuthenticatedArtifactObjectUrl(fileUrl);

  if (isUploading) {
    return (
      <div className="bg-background border-border/40 flex max-w-50 min-w-30 flex-col gap-1 rounded-lg border p-3 opacity-60 shadow-sm">
        <div className="flex items-start gap-2">
          <Loader2Icon className="text-muted-foreground mt-0.5 size-4 shrink-0 animate-spin" />
          <span
            className="text-foreground truncate text-sm font-medium"
            title={file.filename}
          >
            {file.filename}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <Badge
            variant="secondary"
            className="rounded px-1.5 py-0.5 text-[10px] font-normal"
          >
            {getFileTypeLabel(file.filename)}
          </Badge>
          <span className="text-muted-foreground text-[10px]">
            {t.uploads.uploading}
          </span>
        </div>
      </div>
    );
  }

  if (!file.path) return null;

  if (isImage) {
    if (!displayFileUrl) return null;
    return (
      <a
        href={displayFileUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="group border-border/40 relative block overflow-hidden rounded-lg border"
      >
        <img
          src={displayFileUrl}
          alt={file.filename}
          className="h-32 w-auto max-w-60 object-cover transition-transform group-hover:scale-105"
        />
      </a>
    );
  }

  return (
    <div className="bg-background hover:bg-muted/40 hover:border-border/70 border-border/40 flex max-w-50 min-w-30 flex-col gap-1 rounded-lg border p-3 shadow-sm transition-colors">
      <div className="flex items-start gap-2">
        <FileIcon className="text-violet-500 mt-0.5 size-4 shrink-0" />
        <span
          className="text-foreground truncate text-sm font-medium"
          title={file.filename}
        >
          {file.filename}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <Badge
          variant="secondary"
          className="rounded px-1.5 py-0.5 text-[10px] font-normal"
        >
          {getFileTypeLabel(file.filename)}
        </Badge>
        <span className="text-muted-foreground text-[10px]">
          {formatBytes(file.size)}
        </span>
      </div>
    </div>
  );
}

const MessageContent = memo(MessageContent_);
