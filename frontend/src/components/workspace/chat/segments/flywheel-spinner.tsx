"use client";

import { cn } from "@/lib/utils";

/**
 * FlywheelSpinner — a fast-spinning turbine/flywheel indicator.
 *
 * Three curved blades radiating from a hub, rotating at 0.6s/rev to
 * convey high-speed processing. Used for streaming and idle-loading
 * states throughout the chat.
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
      className={cn(
        "text-primary inline-block shrink-0",
        "[animation:flywheel-spin_0.6s_linear_infinite]",
        className,
      )}
      aria-hidden="true"
    >
      {/* Outer guide ring (static, faint) */}
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeOpacity="0.12"
        strokeWidth="1.5"
      />
      {/* Rotating blades */}
      <g fill="currentColor">
        <path
          d="M12 12 C12 7.5, 14.5 4, 18.5 3 C17.5 6.5, 15 9.5, 12 12 Z"
          opacity="1"
        />
        <path
          d="M12 12 C16.5 12, 20 14.5, 21 18.5 C17.5 17.5, 14.5 15, 12 12 Z"
          opacity="0.7"
        />
        <path
          d="M12 12 C12 16.5, 9.5 20, 5.5 21 C6.5 17.5, 9 15, 12 12 Z"
          opacity="0.45"
        />
        <path
          d="M12 12 C7.5 12, 4 9.5, 3 5.5 C6.5 6.5, 9.5 9, 12 12 Z"
          opacity="0.25"
        />
      </g>
      {/* Center hub */}
      <circle cx="12" cy="12" r="2.2" fill="currentColor" />
    </svg>
  );
}
