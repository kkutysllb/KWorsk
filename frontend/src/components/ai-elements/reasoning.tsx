"use client";

import { useControllableState } from "@radix-ui/react-use-controllable-state";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { BrainIcon, ChevronRightIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { createContext, memo, useContext, useEffect, useState } from "react";
import { reasoningPlugins } from "@/core/streamdown/plugins";
import { ClipboardSafeStreamdown } from "./streamdown";
import { Shimmer } from "./shimmer";

type ReasoningContextValue = {
  isStreaming: boolean;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  duration: number | undefined;
  startTime: number | null;
};

const ReasoningContext = createContext<ReasoningContextValue | null>(null);

export const useReasoning = () => {
  const context = useContext(ReasoningContext);
  if (!context) {
    throw new Error("Reasoning components must be used within Reasoning");
  }
  return context;
};

export type ReasoningProps = ComponentProps<typeof Collapsible> & {
  isStreaming?: boolean;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  duration?: number;
  startTimeProp?: number | null;
  onTurnDurationChange?: (duration: number | undefined) => void;
};

const AUTO_CLOSE_DELAY = 1000;
const MS_IN_S = 1000;

export const Reasoning = memo(
  ({
    className,
    isStreaming = false,
    open,
    defaultOpen = true,
    onOpenChange,
    duration: durationProp,
    startTimeProp,
    onTurnDurationChange,
    children,
    ...props
  }: ReasoningProps) => {
    const [isOpen, setIsOpen] = useControllableState({
      prop: open,
      defaultProp: defaultOpen,
      onChange: onOpenChange,
    });
    const [duration, setDuration] = useControllableState<number | undefined>({
      prop: durationProp,
      defaultProp: undefined,
      onChange: onTurnDurationChange,
    });

    const [hasAutoClosed, setHasAutoClosed] = useState(false);
    const [startTime, setStartTime] = useState<number | null>(
      () => startTimeProp ?? (isStreaming ? Date.now() : null),
    );

    // Track duration when streaming starts and ends
    useEffect(() => {
      if (isStreaming) {
        // Sync the start time with the Turn start time if provided
        if (startTimeProp != null && startTime !== startTimeProp) {
          setStartTime(startTimeProp);
        } else if (startTimeProp == null && startTime === null) {
          setStartTime(Date.now());
        }
      } else if (startTime !== null) {
        setDuration(Math.floor((Date.now() - startTime) / MS_IN_S));
        setStartTime(null);
      }
    }, [isStreaming, startTimeProp, startTime, setDuration]);

    // Auto-open when streaming starts, auto-close when streaming ends (once only)
    useEffect(() => {
      if (defaultOpen && !isStreaming && isOpen && !hasAutoClosed) {
        // Add a small delay before closing to allow user to see the content
        const timer = setTimeout(() => {
          setIsOpen(false);
          setHasAutoClosed(true);
        }, AUTO_CLOSE_DELAY);

        return () => clearTimeout(timer);
      }
    }, [isStreaming, isOpen, defaultOpen, setIsOpen, hasAutoClosed]);

    const handleOpenChange = (newOpen: boolean) => {
      setIsOpen(newOpen);
    };

    return (
      <ReasoningContext.Provider
        value={{ isStreaming, isOpen, setIsOpen, duration, startTime }}
      >
        <Collapsible
          className={cn(
            "not-prose",
            // KStock-style: left accent border + left padding.
            "border-l-2 border-emerald-500/25 pl-3",
            isStreaming && "border-blue-500/50",
            className,
          )}
          onOpenChange={handleOpenChange}
          open={isOpen}
          {...props}
        >
          {children}
        </Collapsible>
      </ReasoningContext.Provider>
    );
  },
);

export type ReasoningTriggerProps = ComponentProps<
  typeof CollapsibleTrigger
> & {
  getThinkingMessage?: (
    isStreaming: boolean,
    duration?: number,
    startTime?: number | null,
  ) => ReactNode;
  hasContent?: boolean;
};

const LiveTimer = ({ startTime }: { startTime: number }) => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const calculateElapsed = () => Math.floor((Date.now() - startTime) / 1000);
    setElapsed(calculateElapsed());

    const interval = setInterval(() => {
      setElapsed(calculateElapsed());
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime]);

  return (
    <span className="flex items-center gap-1.5">
      <Shimmer duration={1}>思考中…</Shimmer>
      <span className="text-muted-foreground/80">({elapsed}s)</span>
    </span>
  );
};

const defaultGetThinkingMessage = (
  isStreaming: boolean,
  duration?: number,
  startTime?: number | null,
) => {
  if (isStreaming && startTime != null && startTime !== undefined) {
    return <LiveTimer startTime={startTime} />;
  }
  if (isStreaming || duration === 0) {
    return <Shimmer duration={1}>思考中…</Shimmer>;
  }
  if (duration === undefined) {
    return <span>已思考</span>;
  }
  return <span>已思考 {duration}s</span>;
};

export const ReasoningTrigger = memo(
  ({
    className,
    children,
    getThinkingMessage = defaultGetThinkingMessage,
    hasContent = true,
    ...props
  }: ReasoningTriggerProps) => {
    const { isStreaming, isOpen, duration, startTime } = useReasoning();

    return (
      <CollapsibleTrigger
        className={cn(
          // KStock-style: inline transparent summary button.
          "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors",
          "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
          isStreaming && "text-blue-500",
          !hasContent && "cursor-default",
          className,
        )}
        {...props}
      >
        {children ?? (
          <>
            <BrainIcon className="size-3.5 shrink-0" />
            <span>{getThinkingMessage(isStreaming, duration, startTime)}</span>
            {hasContent && (
              <ChevronRightIcon
                className={cn(
                  "size-3 shrink-0 transition-transform duration-150",
                  isOpen && "rotate-90",
                )}
              />
            )}
          </>
        )}
      </CollapsibleTrigger>
    );
  },
);

export type ReasoningContentProps = ComponentProps<
  typeof CollapsibleContent
> & {
  children: string;
};

export const ReasoningContent = memo(
  ({ className, children, ...props }: ReasoningContentProps) => (
    <CollapsibleContent
      className={cn(
        "mt-2",
        "data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 data-[state=closed]:animate-out data-[state=open]:animate-in outline-none",
        className,
      )}
      {...props}
    >
      <div className="text-muted-foreground text-[13px] leading-relaxed italic">
        <ClipboardSafeStreamdown {...reasoningPlugins}>
          {children}
        </ClipboardSafeStreamdown>
      </div>
    </CollapsibleContent>
  ),
);

Reasoning.displayName = "Reasoning";
ReasoningTrigger.displayName = "ReasoningTrigger";
ReasoningContent.displayName = "ReasoningContent";
