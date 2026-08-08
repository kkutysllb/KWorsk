"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const RIGHT_PANEL_KEY = "kworks.workspace.rightPanelOpen";
const HISTORY_KEY = "kworks.workspace.historyCollapsed";
const SECTIONS_KEY = "kworks.workspace.panelSections";

export type PanelSectionId =
  | "todos"
  | "subagents"
  | "resources"
  | "artifacts";

interface WorkspaceLayoutValue {
  rightPanelOpen: boolean;
  toggleRightPanel: () => void;
  setRightPanelOpen: (open: boolean) => void;
  historyCollapsed: boolean;
  toggleHistory: () => void;
  isSectionCollapsed: (id: PanelSectionId) => boolean;
  toggleSection: (id: PanelSectionId) => void;
}

const WorkspaceLayoutContext = createContext<WorkspaceLayoutValue | undefined>(
  undefined,
);

function readBoolean(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v === "true";
  } catch {
    return fallback;
  }
}

function readSections(): Record<PanelSectionId, boolean> {
  try {
    const raw = localStorage.getItem(SECTIONS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<
        Record<PanelSectionId, boolean>
      >;
      return {
        todos: parsed.todos ?? false,
        subagents: parsed.subagents ?? false,
        resources: parsed.resources ?? false,
        artifacts: parsed.artifacts ?? false,
      };
    }
  } catch {
    /* ignore */
  }
  return { todos: false, subagents: false, resources: false, artifacts: false };
}

export function WorkspaceLayoutProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [rightPanelOpen, setRightPanelOpenState] = useState(false);
  const [historyCollapsed, setHistoryCollapsed] = useState(false);
  const [sections, setSections] = useState<Record<PanelSectionId, boolean>>({
    todos: false,
    subagents: false,
    resources: false,
    artifacts: false,
  });

  // 初始化从 localStorage 恢复
  useEffect(() => {
    setRightPanelOpenState(readBoolean(RIGHT_PANEL_KEY, false));
    setHistoryCollapsed(readBoolean(HISTORY_KEY, false));
    setSections(readSections());
  }, []);

  const setRightPanelOpen = useCallback((open: boolean) => {
    setRightPanelOpenState(open);
    try {
      localStorage.setItem(RIGHT_PANEL_KEY, String(open));
    } catch {
      /* ignore */
    }
  }, []);

  const toggleRightPanel = useCallback(
    () => setRightPanelOpen(!rightPanelOpen),
    [rightPanelOpen, setRightPanelOpen],
  );

  const toggleHistory = useCallback(() => {
    setHistoryCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(HISTORY_KEY, String(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const isSectionCollapsed = useCallback(
    (id: PanelSectionId) => sections[id] ?? false,
    [sections],
  );

  const toggleSection = useCallback((id: PanelSectionId) => {
    setSections((prev) => {
      const next = { ...prev, [id]: !(prev[id] ?? false) };
      try {
        localStorage.setItem(SECTIONS_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      rightPanelOpen,
      toggleRightPanel,
      setRightPanelOpen,
      historyCollapsed,
      toggleHistory,
      isSectionCollapsed,
      toggleSection,
    }),
    [
      rightPanelOpen,
      toggleRightPanel,
      setRightPanelOpen,
      historyCollapsed,
      toggleHistory,
      isSectionCollapsed,
      toggleSection,
    ],
  );

  return (
    <WorkspaceLayoutContext.Provider value={value}>
      {children}
    </WorkspaceLayoutContext.Provider>
  );
}

export function useWorkspaceLayout() {
  const ctx = useContext(WorkspaceLayoutContext);
  if (!ctx) {
    throw new Error(
      "useWorkspaceLayout must be used within a WorkspaceLayoutProvider",
    );
  }
  return ctx;
}
