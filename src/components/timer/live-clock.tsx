"use client";

import { useNow } from "@/hooks/use-clock";
import {
    formatClock,
    formatMinutesAsHours,
    toQuarterMinutes,
} from "@/lib/duration";
import { cn } from "@/lib/utils";

interface LiveClockProps {
    startedAt: string;
    className?: string;
    /** Show the quarter-hour figure (`0.25`) instead of `00:12:41`. */
    asBilledHours?: boolean;
}

/**
 * Elapsed time for a running entry, derived from `startedAt` on every tick.
 *
 * Renders `00:00:00` on the server and on the first client render so that
 * hydration matches; the real value appears on the first tick after mount.
 */
export function LiveClock({
    startedAt,
    className,
    asBilledHours = false,
}: LiveClockProps) {
    const now = useNow();

    const seconds =
        now === null
            ? 0
            : Math.max(
                  0,
                  Math.round((now - new Date(startedAt).getTime()) / 1000),
              );

    return (
        <span className={cn("tabular-nums", className)}>
            {asBilledHours
                ? formatMinutesAsHours(toQuarterMinutes(seconds))
                : formatClock(seconds)}
        </span>
    );
}
