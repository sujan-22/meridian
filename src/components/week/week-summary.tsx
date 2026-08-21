"use client";

import { format, isWeekend } from "date-fns";
import { Check, TriangleAlert } from "lucide-react";

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
 * The point of this strip is to answer "is my week accounted for" before
 * Friday, so shortfalls are called out per day rather than only in the total.
 */
export function WeekSummary({ days, onSelectDay }: WeekSummaryProps) {
    const shortfalls = days.filter((day) => dayShortfall(day) > 0);

    return (
        <div className="flex flex-col gap-3">
            <div
                className="grid gap-1.5"
                style={{
                    gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))`,
                }}
            >
                {days.map((day) => (
                    <DayCell
                        key={day.date.toISOString()}
                        day={day}
                        onSelect={onSelectDay}
                    />
                ))}
            </div>

            {shortfalls.length > 0 && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-xs">
                    <span className="flex items-center gap-1.5 font-medium text-amber-400">
                        <TriangleAlert className="size-3.5" />
                        Missing time
                    </span>

                    {shortfalls.map((day) => (
                        <button
                            key={day.date.toISOString()}
                            type="button"
                            onClick={() => onSelectDay?.(day.date)}
                            className="text-muted-foreground transition-colors hover:text-foreground"
                        >
                            {format(day.date, "EEEE")}
                            <span className="ml-1 font-mono tabular-nums text-amber-400">
                                {formatMinutesAsHours(dayShortfall(day))} h
                            </span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

interface DayCellProps {
    day: DayTally;
    onSelect?: (date: Date) => void;
}

function DayCell({ day, onSelect }: DayCellProps) {
    const complete = day.targetMinutes > 0 && day.billedMinutes >= day.targetMinutes;
    const shortfall = dayShortfall(day);

    return (
        <button
            type="button"
            onClick={() => onSelect?.(day.date)}
            className={cn(
                "flex flex-col gap-1 rounded-lg border px-2.5 py-2 text-left transition-colors",
                day.isToday
                    ? "border-primary/50 bg-primary/5"
                    : "border-border/70 bg-card hover:bg-muted/40",
                isWeekend(day.date) && !day.isToday && "opacity-60",
            )}
        >
            <span className="flex items-baseline justify-between gap-1">
                <span
                    className={cn(
                        "text-[11px] uppercase tracking-wide",
                        day.isToday
                            ? "font-medium text-primary"
                            : "text-muted-foreground",
                    )}
                >
                    {format(day.date, "EEE")}
                </span>

                <span className="text-[11px] tabular-nums text-muted-foreground">
                    {format(day.date, "d")}
                </span>
            </span>

            <span className="flex items-center justify-between gap-1">
                <span
                    className={cn(
                        "font-mono text-sm font-medium tabular-nums",
                        day.billedMinutes === 0 && "text-muted-foreground/50",
                    )}
                >
                    {formatMinutesAsHours(day.billedMinutes)}
                </span>

                {complete && (
                    <Check className="size-3.5 shrink-0 text-emerald-500" />
                )}

                {shortfall > 0 && (
                    <span className="shrink-0 font-mono text-[10px] tabular-nums text-amber-400">
                        −{formatMinutesAsHours(shortfall)}
                    </span>
                )}
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
