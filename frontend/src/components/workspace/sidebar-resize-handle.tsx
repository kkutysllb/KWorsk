"use client";

import { useCallback, useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

const MIN_WIDTH = 180;
const MAX_WIDTH = 360;
const DEFAULT_WIDTH = 248;
const STORAGE_KEY = "kworks.workspace.sidebarWidth";
const KEYBOARD_STEP = 8;

function clampWidth(v: number): number {
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, v));
}

function getWrapper(el: HTMLElement | null): HTMLElement | null {
  if (!el) return null;
  return el.closest('[data-slot="sidebar-wrapper"]');
}

/**
 * 侧边栏宽度拖拽手柄。
 * 通过修改最近 [data-slot="sidebar-wrapper"] 的 --sidebar-width CSS 变量实现。
 * 宽度持久化到 localStorage，范围 180-360px。
 */
export function SidebarResizeHandle({
  collapsed,
}: {
  collapsed: boolean;
}) {
  const handleRef = useRef<HTMLDivElement>(null);

  // 初始化：从 localStorage 恢复宽度
  useEffect(() => {
    const wrapper = getWrapper(handleRef.current);
    if (!wrapper) return;
    let width = DEFAULT_WIDTH;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) width = clampWidth(parseInt(raw, 10));
    } catch {
      /* ignore */
    }
    wrapper.style.setProperty("--sidebar-width", `${width}px`);
  }, []);

  const applyWidth = useCallback((clientX: number) => {
    const wrapper = getWrapper(handleRef.current);
    if (!wrapper) return;
    const rect = wrapper.getBoundingClientRect();
    const width = clampWidth(clientX - rect.left);
    wrapper.style.setProperty("--sidebar-width", `${width}px`);
    return width;
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      const move = (ev: PointerEvent) => {
        applyWidth(ev.clientX);
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        // 持久化最终宽度
        const wrapper = getWrapper(handleRef.current);
        if (wrapper) {
          const raw = wrapper.style.getPropertyValue("--sidebar-width");
          const px = parseInt(raw, 10);
          if (!Number.isNaN(px)) {
            try {
              localStorage.setItem(STORAGE_KEY, String(px));
            } catch {
              /* ignore */
            }
          }
        }
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    },
    [applyWidth],
  );

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    const wrapper = getWrapper(handleRef.current);
    if (!wrapper) return;
    const raw = wrapper.style.getPropertyValue("--sidebar-width");
    let current = parseInt(raw, 10);
    if (Number.isNaN(current)) current = DEFAULT_WIDTH;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      const next = clampWidth(current - KEYBOARD_STEP);
      wrapper.style.setProperty("--sidebar-width", `${next}px`);
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        /* ignore */
      }
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      const next = clampWidth(current + KEYBOARD_STEP);
      wrapper.style.setProperty("--sidebar-width", `${next}px`);
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        /* ignore */
      }
    }
  }, []);

  if (collapsed) return null;

  return (
    <div
      ref={handleRef}
      role="separator"
      aria-orientation="vertical"
      aria-label="调整侧边栏宽度"
      tabIndex={0}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      className={cn(
        "absolute top-0 right-0 z-30 hidden h-full w-1 cursor-col-resize",
        "bg-transparent transition-colors hover:bg-primary/20",
        "md:block",
      )}
    />
  );
}
