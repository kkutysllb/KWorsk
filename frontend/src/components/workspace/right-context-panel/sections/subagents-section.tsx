"use client";

import { BotIcon } from "lucide-react";

import { useSubtaskContext } from "@/core/tasks/context";
import { useI18n } from "@/core/i18n/hooks";

import { PanelEmpty, PanelSection } from "../panel-section";

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
            <li key={task.id} className="flex items-start gap-2 text-xs">
              <span
                className={
                  task.status === "completed"
                    ? "text-emerald-500"
                    : task.status === "failed"
                      ? "text-rose-500"
                      : "text-amber-500"
                }
              >
                {task.status === "completed"
                  ? "✓"
                  : task.status === "failed"
                    ? "✕"
                    : "●"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground">
                  {task.subagent_type}
                </p>
                <p className="break-all text-muted-foreground">
                  {task.description}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </PanelSection>
  );
}
