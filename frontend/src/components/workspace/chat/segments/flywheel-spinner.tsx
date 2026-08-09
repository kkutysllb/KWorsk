"use client";

import { cn } from "@/lib/utils";

/**
 * FlywheelSpinner — a single-gradient-arc spinner used for streaming and
 * idle-loading states throughout the chat.
 *
 * One quarter-arc renders on a translucent track ring and rotates at
 * 1s/rev, with a small inner pulse ring counter-rotating at 2s/rev to
 * suggest activity without competing visual motion.
 */
export function FlywheelSpinner({
  className,
}: {
  className?: string;
}) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={cn("text-primary inline-block shrink-0", className)}
    >
      <defs>
        <linearGradient id="flywheel-arc" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="1" />
        </linearGradient>
      </defs>

      {/* Track ring */}
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeOpacity="0.15"
        strokeWidth="2"
      />

      {/* Rotating gradient arc */}
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="url(#flywheel-arc)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="14 56"
        transform="rotate(-90 12 12)"
        className="origin-center animate-[flywheel-spin_1s_linear_infinite]"
      />

      {/* Inner counter-rotating pulse */}
      <circle
        cx="12"
        cy="12"
        r="5"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="1.5"
        strokeDasharray="2 12"
        className="origin-center animate-[flywheel-spin_2s_linear_infinite_reverse]"
      />

      {/* Center dot */}
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </svg>
  );
}