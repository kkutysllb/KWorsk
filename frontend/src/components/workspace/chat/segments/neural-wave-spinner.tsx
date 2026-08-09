"use client";

import { cn } from "@/lib/utils";

/**
 * NeuralWaveSpinner — a flowing sine-wave indicator used for streaming and
 * idle-loading states throughout the chat.
 *
 * Two sine-wave paths at different phases and speeds flow rightward inside
 * a clipped viewBox, creating a clean "signal/brain-wave" animation that
 * reads well even at 16 px.
 */
export function NeuralWaveSpinner({
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
      className={cn("text-primary inline-block shrink-0 overflow-hidden", className)}
    >
      {/* Echo wave — faded, slower, phase-inverted */}
      <path
        d="M-12 12 Q-10 16 -8 12 T-4 12 T0 12 T4 12 T8 12 T12 12 T16 12 T20 12 T24 12 T28 12 T32 12 T36 12"
        stroke="currentColor"
        strokeOpacity="0.22"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
        className="animate-[neural-wave_1.4s_linear_infinite]"
      />

      {/* Main wave — prominent, faster */}
      <path
        d="M-12 12 Q-10 8 -8 12 T-4 12 T0 12 T4 12 T8 12 T12 12 T16 12 T20 12 T24 12 T28 12 T32 12 T36 12"
        stroke="currentColor"
        strokeOpacity="0.85"
        strokeWidth="2.2"
        fill="none"
        strokeLinecap="round"
        className="animate-[neural-wave_0.9s_linear_infinite]"
      />
    </svg>
  );
}
