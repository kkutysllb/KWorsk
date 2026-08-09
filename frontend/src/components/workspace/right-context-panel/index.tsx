"use client";

import { useI18n } from "@/core/i18n/hooks";
import { useActiveThreadId } from "@/hooks/use-active-thread";
import { cn } from "@/lib/utils";

import { useWorkspaceLayout } from "../workspace-layout-context";
import { ResourcesSection } from "./sections/resources-section";
import { SubagentsSection } from "./sections/subagents-section";
import { TodosSection } from "./sections/todos-section";

export function RightContextPanel() {
  const { t } = useI18n();
  const { rightPanelOpen } = useWorkspaceLayout();
  const threadId = useActiveThreadId();

  // 无会话页面（settings/mcp/crons 等）隐藏右面板
  const showPanel = rightPanelOpen && threadId !== null;

  return (
    <aside
      aria-label={t.rightPanel.title}
      className={cn(
        "hidden shrink-0 overflow-hidden border-l bg-background transition-all duration-200 lg:flex",
        "flex-col",
        showPanel ? "w-[360px]" : "w-0",
      )}
    >
      {showPanel && (
        <div className="flex h-full flex-col overflow-y-auto">
          <TodosSection />
          <SubagentsSection />
          <ResourcesSection threadId={threadId} />
        </div>
      )}
    </aside>
  );
}
