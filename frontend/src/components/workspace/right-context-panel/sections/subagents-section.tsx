"use client";

import {
  BotIcon,
  ChevronRightIcon,
  ClockIcon,
} from "lucide-react";
import { useState } from "react";

import { useI18n } from "@/core/i18n/hooks";
import { useSubtaskContext } from "@/core/tasks/context";
import { cn } from "@/lib/utils";

import { PanelEmpty, PanelSection } from "../panel-section";

import { SubagentTimeline } from "./subagent-timeline";

export function SubagentsSection() {
  const { t } = useI18n();
  const { tasks } = useSubtaskContext();
  const taskList = Object.values(tasks);

  return (
    <PanelSection
      id="subagents"
      icon={BotIcon}
      title={t.rightPanel.subagents}
      count={taskList.length}
    >
      {taskList.length === 0 ? (
        <PanelEmpty text={t.rightPanel.empty} />
      ) : (
        <ul className="space-y-1.5">
          {taskList.map((task) => (
            <SubagentTaskItem key={task.id} task={task} />
          ))}
        </ul>
      )}
    </PanelSection>
  );
}

function SubagentTaskItem({
  task,
}: {
  task: NonNullable<ReturnType<typeof useSubtaskContext>["tasks"][string]>;
}) {
  const stepCount = task.steps?.length ?? 0;
  const durationLabel = task.duration_ms
    ? `${(task.duration_ms / 1000).toFixed(1)}s`
    : task.started_at && task.completed_at
      ? `${((new Date(task.completed_at).getTime() - new Date(task.started_at).getTime()) / 1000).toFixed(1)}s`
      : null;

  return (
    <li className="overflow-hidden rounded-lg border">
      <ExpandableTaskHeader
        task={task}
        stepCount={stepCount}
        durationLabel={durationLabel}
      />
    </li>
  );
}

function ExpandableTaskHeader({
  task,
  stepCount,
  durationLabel,
}: {
  task: NonNullable<ReturnType<typeof useSubtaskContext>["tasks"][string]>;
  stepCount: number;
  durationLabel: string | null;
}) {
  const [expanded, setExpanded] = useState(false);

  const statusColor =
    task.status === "completed"
      ? "text-emerald-500"
      : task.status === "failed"
        ? "text-rose-500"
        : "text-amber-500";

  const statusIcon =
    task.status === "completed" ? "✓" : task.status === "failed" ? "✕" : "●";

  return (
    <>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="hover:bg-muted/30 flex w-full items-start gap-2 px-2.5 py-2 text-left text-xs transition-colors"
      >
        <span className={cn("shrink-0 leading-relaxed", statusColor)}>
          {statusIcon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-foreground">
            {task.subagent_type}
          </p>
          <p className="text-muted-foreground break-all leading-relaxed">
            {task.description}
          </p>
          <div className="text-muted-foreground mt-0.5 flex items-center gap-2 text-[10px]">
            {stepCount > 0 && <span>{stepCount} 步</span>}
            {durationLabel && (
              <span className="flex items-center gap-0.5">
                <ClockIcon className="size-2.5" />
                {durationLabel}
              </span>
            )}
          </div>
        </div>
        <ChevronRightIcon
          className={cn(
            "text-muted-foreground mt-0.5 size-3.5 shrink-0 transition-transform duration-150",
            expanded && "rotate-90",
          )}
        />
      </button>
      {expanded && (
        <div className="border-t border-border/40 px-2.5 py-2">
          <SubagentTimeline task={task} />
        </div>
      )}
    </>
  );
}
