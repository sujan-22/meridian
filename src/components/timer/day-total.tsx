"use client";

import { useNow } from "@/hooks/use-clock";
import { formatMinutesAsHours, toQuarterMinutes } from "@/lib/duration";
import { DAILY_TARGET_MINUTES } from "@/lib/targets";
import { cn } from "@/lib/utils";

export interface DayTotals {
    /** Minutes from entries that have already stopped. */
    billableMinutes: number;
    nonBillableMinutes: number;
    /** Start of the running entry, if the timer is going. */
    runningSince?: string | null;
    runningIsBillable?: boolean;
}

interface DayTotalProps extends DayTotals {
    targetMinutes?: number;
}

/**
 * Isolated from the rest of the page so the per-second tick only re-renders
 * this readout instead of the whole day.
 */
export function DayTotal({
    billableMinutes,
    nonBillableMinutes,
    runningSince,
    runningIsBillable,
    targetMinutes = DAILY_TARGET_MINUTES,
}: DayTotalProps) {
    const now = useNow();

    const runningMinutes =
        runningSince && now !== null
            ? toQuarterMinutes(
                  Math.max(
                      0,
                      Math.round(
                          (now - new Date(runningSince).getTime()) / 1000,
                      ),
                  ),
              )
            : 0;

    const billable = billableMinutes + (runningIsBillable ? runningMinutes : 0);

    const nonBillable =
        nonBillableMinutes + (runningIsBillable ? 0 : runningMinutes);

    const total = billable + nonBillable;
    const complete = total >= targetMinutes;

    // Two stacked segments of one bar, each a share of the daily target and
    // together never exceeding it.
    const billableWidth = Math.min(100, (billable / targetMinutes) * 100);

    const nonBillableWidth = Math.min(
        100 - billableWidth,
        (nonBillable / targetMinutes) * 100,
    );

    return (
        <div className="w-full sm:w-64">
            <div className="flex items-baseline justify-between gap-3">
                <span className="text-[0.6875rem] uppercase tracking-[0.12em] text-muted-foreground">
                    Today
                </span>

                <span className="font-mono text-lg font-medium tabular-nums">
                    {formatMinutesAsHours(total)}

                    <span className="ml-1 text-xs font-normal text-muted-foreground">
                        / {formatMinutesAsHours(targetMinutes)} h
                    </span>
                </span>
            </div>

            <div className="mt-2 flex h-1.5 gap-px overflow-hidden rounded-full bg-muted">
                <div
                    className={cn(
                        "h-full transition-[width] duration-500",
                        complete ? "bg-emerald-500" : "bg-primary",
                    )}
                    style={{ width: `${billableWidth}%` }}
                />

                <div
                    className="h-full bg-muted-foreground/50 transition-[width] duration-500"
                    style={{ width: `${nonBillableWidth}%` }}
                />
            </div>

            <div className="mt-2 flex items-center justify-between gap-3 text-[0.6875rem]">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                    <span
                        aria-hidden
                        className={cn(
                            "size-1.5 rounded-full",
                            complete ? "bg-emerald-500" : "bg-primary",
                        )}
                    />
                    Billable
                    <span className="font-mono tabular-nums text-foreground">
                        {formatMinutesAsHours(billable)}
                    </span>
                </span>

                <span className="flex items-center gap-1.5 text-muted-foreground">
                    <span
                        aria-hidden
                        className="size-1.5 rounded-full bg-muted-foreground/50"
                    />
                    Non-billable
                    <span className="font-mono tabular-nums text-foreground">
                        {formatMinutesAsHours(nonBillable)}
                    </span>
                </span>
            </div>
        </div>
    );
}
