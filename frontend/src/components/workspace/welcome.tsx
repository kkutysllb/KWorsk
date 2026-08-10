"use client";

import { useI18n } from "@/core/i18n/hooks";
import { cn } from "@/lib/utils";

export function Welcome({
  className,
}: {
  className?: string;
  /** Kept for backward compatibility — no longer rendered. */
  effort?: "minimal" | "low" | "medium" | "high";
}) {
  const { t } = useI18n();
  return (
    <div
      className={cn(
        "relative mx-auto flex min-h-[60vh] w-full flex-col items-center justify-center overflow-hidden px-8 py-6 text-center",
        className,
      )}
    >
      {/* Ambient KWorks wordmark — large, low contrast, sits behind the
          tagline so it reads as brand background rather than a second
          headline. Anchored to the welcome container (which spans the
          full chat area) so the watermark is centred relative to chat,
          not the whole viewport (which includes the sidebar). Font size
          is clamped so it never exceeds the chat column width. */}
      <div
        aria-hidden
        className="text-foreground/8 pointer-events-none absolute inset-x-0 top-1/2 flex select-none items-center justify-center"
      >
        <span className="-translate-y-1/2 text-[clamp(8rem,18vw,14rem)] font-extrabold tracking-tighter whitespace-nowrap">
          KWorks
        </span>
      </div>

      {/* Foreground tagline */}
      <h2 className="text-foreground relative text-4xl font-semibold tracking-tight md:text-5xl">
        {t.welcome.tagline}
      </h2>
    </div>
  );
}