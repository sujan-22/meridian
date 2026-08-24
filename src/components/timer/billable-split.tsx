"use client";

import { formatMinutesAsHours } from "@/lib/duration";
import { cn } from "@/lib/utils";

interface BillableSplitProps {
    billableMinutes: number;
    unbillableMinutes: number;
    /** Drops the trailing words where space is tight, as in a calendar block. */
    compact?: boolean;
    className?: string;
}

/**
 * The hours an entry is worth, split when part of it is written off.
 *
 * A single total hides the number that actually matters on a partly written-off
 * entry, so both figures are shown wherever there is room for them.
 */
export function BillableSplit({
    billableMinutes,
    unbillableMinutes,
    compact = false,
    className,
}: BillableSplitProps) {
    const total = billableMinutes + unbillableMinutes;

    if (unbillableMinutes === 0) {
        return (
            <span className={cn("tabular-nums", className)}>
                {formatMinutesAsHours(total)} h
            </span>
        );
    }

    if (billableMinutes === 0) {
        return (
            <span className={cn("tabular-nums", className)}>
                {formatMinutesAsHours(total)} h
                {!compact && (
                    <span className="ml-1 opacity-70">non-billable</span>
                )}
            </span>
        );
    }

    return (
        <span
            className={cn("tabular-nums", className)}
            title={`${formatMinutesAsHours(billableMinutes)} h billable, ${formatMinutesAsHours(unbillableMinutes)} h written off`}
        >
            <span className="text-emerald-400">
                {formatMinutesAsHours(billableMinutes)}
            </span>

            {!compact && <span className="opacity-70"> billable</span>}

            <span className="opacity-70"> · </span>

            <span>{formatMinutesAsHours(unbillableMinutes)}</span>

            <span className="opacity-70"> {compact ? "off" : "written off"}</span>
        </span>
    );
}
