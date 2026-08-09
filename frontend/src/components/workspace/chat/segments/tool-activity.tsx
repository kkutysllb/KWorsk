"use client";

import {
  AlertCircleIcon,
  CheckIcon,
  ChevronRightIcon,
  Loader2Icon,
  WrenchIcon,
} from "lucide-react";
import { useMemo, useState } from "react";

import type { ToolActivityStep } from "@/core/messages/segments";
import { cn } from "@/lib/utils";

function toolIcon(name: string) {
  if (name === "web_search" || name === "image_search") return "search";
  if (name === "web_fetch" || name === "web_request") return "globe";
  if (name === "bash" || name === "python") return "terminal";
  if (name === "read_file" || name === "write_file") return "file";
  return "wrench";
}

function iconGlyph(kind: string): React.ReactNode {
  switch (kind) {
    case "search":
      return (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
      );
    case "globe":
      return (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
          <path d="M2 12h20" />
        </svg>
      );
    case "terminal":
      return (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="4 17 10 11 4 5" />
          <line x1="12" x2="20" y1="19" y2="19" />
        </svg>
      );
    case "file":
      return (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
          <path d="M14 2v4a2 2 0 0 0 2 2h4" />
        </svg>
      );
    default:
      return <WrenchIcon className="size-3.5" />;
  }
}

/**
 * ToolActivity — collapsible summary of this turn's tool calls.
 * One visible summary row (status + step count) followed by per-tool
 * cards, mirroring the KStock "tool activity" pattern.
 */
export function ToolActivity({
  steps,
  isLoading = false,
  className,
}: {
  steps: ToolActivityStep[];
  isLoading?: boolean;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const status = useMemo(() => {
    if (isLoading) return "running" as const;
    if (steps.some((s) => s.result === undefined)) return "running" as const;
    return "done" as const;
  }, [steps, isLoading]);

  if (steps.length === 0) return null;

  const statusLabel =
    status === "running" ? "处理中" : `已完成 ${steps.length} 个步骤`;

  return (
    <div className={cn("min-w-0 overflow-hidden", className)}>
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
        className={cn(
          "flex w-full items-center gap-2 border-0 bg-transparent px-2.5 py-2 text-left text-xs transition-colors",
          "hover:bg-muted/30",
          status === "running" ? "text-blue-500" : "text-muted-foreground",
        )}
      >
        {status === "running" ? (
          <Loader2Icon className="size-3.5 animate-spin" />
        ) : (
          <CheckIcon className="size-3.5 text-emerald-500" />
        )}
        <span className="flex-1">{statusLabel}</span>
        <ChevronRightIcon
          className={cn(
            "size-3.5 transition-transform duration-150",
            expanded && "rotate-90",
          )}
        />
      </button>
      <div className="mx-2.5 h-px bg-border/50" />
      {expanded && (
        <div className="space-y-1.5 px-1 pt-1.5">
          {steps.map((step) => (
            <ToolCard key={step.id} step={step} />
          ))}
        </div>
      )}
    </div>
  );
}

function ToolCard({
  step,
}: {
  step: ToolActivityStep;
}) {
  const [expanded, setExpanded] = useState(false);
  const kind = toolIcon(step.name);
  const hasArgs = Object.keys(step.args ?? {}).length > 0;
  const hasResult = step.result != null;
  const expandable = hasArgs || hasResult;

  return (
    <div className="overflow-hidden rounded-lg border border-border/50 bg-muted/20">
      <button
        type="button"
        aria-expanded={expanded}
        disabled={!expandable}
        onClick={() => expandable && setExpanded((value) => !value)}
        className={cn(
          "flex w-full items-center gap-2 border-none bg-transparent px-2.5 py-1.5 text-left text-xs transition-colors",
          expandable && "hover:bg-muted/30",
          !expandable && "cursor-default",
        )}
      >
        <span className="text-violet-500">{iconGlyph(kind)}</span>
        <span className="font-mono text-emerald-600 dark:text-emerald-400">
          {step.name}
        </span>
        {expandable && (
          <ChevronRightIcon
            className={cn(
              "text-muted-foreground ml-auto size-3 transition-transform duration-150",
              expanded && "rotate-90",
            )}
          />
        )}
      </button>
      {expanded && (
        <div className="space-y-1.5 border-t border-border/40 bg-muted/10 px-1.5 py-1.5">
          {hasArgs && (
            <DetailDisclosure
              label="参数"
              meta={Object.keys(step.args).length + " 个字段"}
              value={formatValue(step.args)}
            />
          )}
          {hasResult && (
            <DetailDisclosure
              label="执行结果"
              meta={`${stringify(step.result).length} 字符`}
              value={stringify(step.result)}
              isResult
            />
          )}
        </div>
      )}
    </div>
  );
}

function DetailDisclosure({
  label,
  meta,
  value,
  isResult = false,
}: {
  label: string;
  meta: string;
  value: string;
  isResult?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="overflow-hidden rounded-md border border-border/40 bg-background/30">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-center gap-1.5 border-none bg-transparent px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted/20"
      >
        <ChevronRightIcon
          className={cn(
            "text-muted-foreground size-3 transition-transform duration-150",
            expanded && "rotate-90",
          )}
        />
        <span className={cn("font-medium", isResult ? "text-emerald-600 dark:text-emerald-400" : "text-foreground/80")}>
          {label}
        </span>
        <em className="text-muted-foreground/60 ml-auto text-[10px] not-italic">
          {meta}
        </em>
      </button>
      {expanded && (
        <pre className="mt-0 max-h-64 overflow-auto border-t border-border/30 bg-muted/15 p-2 font-mono text-[11px] leading-relaxed text-muted-foreground whitespace-pre-wrap">
          {value}
        </pre>
      )}
    </div>
  );
}

function formatValue(value: unknown): string {
  if (typeof value === "string") return truncate(value, 4000);
  if (value == null) return String(value);
  return truncate(JSON.stringify(value, null, 2), 4000);
}

function stringify(value: unknown): string {
  if (typeof value === "string") return value;
  if (value == null) return String(value);
  return JSON.stringify(value, null, 2);
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + "…" : text;
}
