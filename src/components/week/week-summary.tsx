"use client";

import { format, isWeekend } from "date-fns";
import { Check } from "lucide-react";

import { AXIS_WIDTH } from "@/components/week/week-calendar";
import { formatMinutesAsHours } from "@/lib/duration";
import { cn } from "@/lib/utils";

export interface DayTally {
    date: Date;
    billedMinutes: number;
    /** Zero on days that carry no expectation, such as weekends. */
    targetMinutes: number;
    /** Days after today are not "missing" time - they have not happened yet. */
    isFuture: boolean;
    isToday: boolean;
}

interface WeekSummaryProps {
    days: readonly DayTally[];
    onSelectDay?: (date: Date) => void;
}

/**
 * Answers "is my week accounted for" before Friday, so a shortfall is visible
 * per day rather than only in the week total.
 *
 * One row, and the same column track as the calendar underneath - including
 * its leading time axis, without which every card sits left of the day it
 * describes and the error grows across the week.
 */
export function WeekSummary({ days, onSelectDay }: WeekSummaryProps) {
    return (
        <div
            className="grid"
            style={{
                gridTemplateColumns: `${AXIS_WIDTH} repeat(${days.length}, minmax(0, 1fr))`,
            }}
        >
            <div aria-hidden />

            {days.map((day) => (
                <DayCell
                    key={day.date.toISOString()}
                    day={day}
                    onSelect={onSelectDay}
                />
            ))}
        </div>
    );
}

interface DayCellProps {
    day: DayTally;
    onSelect?: (date: Date) => void;
}

function DayCell({ day, onSelect }: DayCellProps) {
    const complete =
        day.targetMinutes > 0 && day.billedMinutes >= day.targetMinutes;
    const shortfall = dayShortfall(day);

    return (
        // The margin insets the card without moving the column edge, so the
        // cards stay separated and still line up with the grid below.
        <button
            type="button"
            onClick={() => onSelect?.(day.date)}
            className={cn(
                "mx-[3px] flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-left transition-colors",
                day.isToday
                    ? "border-primary/50 bg-primary/5"
                    : "border-border/70 bg-card hover:bg-muted/40",
                isWeekend(day.date) && !day.isToday && "opacity-60",
            )}
        >
            <span
                className={cn(
                    "truncate text-[0.6875rem] uppercase tracking-wide",
                    day.isToday
                        ? "font-medium text-primary"
                        : "text-muted-foreground",
                )}
            >
                {format(day.date, "EEE d")}
            </span>

            <span className="flex shrink-0 items-center gap-1.5">
                {shortfall > 0 && (
                    <span className="font-mono text-[0.625rem] tabular-nums text-amber-400">
                        −{formatMinutesAsHours(shortfall)}
                    </span>
                )}

                {complete && (
                    <Check className="size-3.5 shrink-0 text-emerald-500" />
                )}

                <span
                    className={cn(
                        "font-mono text-sm font-medium tabular-nums",
                        day.billedMinutes === 0 && "text-muted-foreground/50",
                    )}
                >
                    {formatMinutesAsHours(day.billedMinutes)}
                </span>
            </span>
        </button>
    );
}

function dayShortfall(day: DayTally): number {
    if (day.isFuture) {
        return 0;
    }

    return Math.max(0, day.targetMinutes - day.billedMinutes);
}
