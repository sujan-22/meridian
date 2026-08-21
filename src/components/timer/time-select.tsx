"use client";

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { QUARTER_MINUTES } from "@/lib/duration";
import { cn } from "@/lib/utils";

const MINUTES_PER_DAY = 24 * 60;

/** `00:00`, `00:15`, … `23:45` - every slot an entry can start or end on. */
export const QUARTER_TIME_OPTIONS = Array.from(
    { length: MINUTES_PER_DAY / QUARTER_MINUTES },
    (_, index) => {
        const minutes = index * QUARTER_MINUTES;

        const label = `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(
            minutes % 60,
        ).padStart(2, "0")}`;

        return { label, value: label, minutes };
    },
);

/** Snap an arbitrary time to the nearest selectable slot. */
export function nearestQuarterTime(date: Date): string {
    const minutes = date.getHours() * 60 + date.getMinutes();

    const snapped =
        (Math.round(minutes / QUARTER_MINUTES) * QUARTER_MINUTES) %
        MINUTES_PER_DAY;

    return QUARTER_TIME_OPTIONS[snapped / QUARTER_MINUTES].value;
}

interface TimeSelectProps {
    value: string;
    onChange: (value: string) => void;
    "aria-label"?: string;
    className?: string;
}

/**
 * Times are picked, never typed. Everything is billed in quarter hours, so
 * offering the exact set of legal slots removes both the parsing and the
 * chance of entering something that cannot be billed.
 */
export function TimeSelect({
    value,
    onChange,
    className,
    ...props
}: TimeSelectProps) {
    return (
        <Select
            items={QUARTER_TIME_OPTIONS}
            value={value}
            onValueChange={(next) => onChange(next as string)}
        >
            <SelectTrigger
                aria-label={props["aria-label"]}
                className={cn("h-10 font-mono tabular-nums", className)}
            >
                <SelectValue placeholder="--:--" />
            </SelectTrigger>

            <SelectContent alignItemWithTrigger={false} className="max-h-72">
                {QUARTER_TIME_OPTIONS.map((option) => (
                    <SelectItem
                        key={option.value}
                        value={option.value}
                        className="font-mono tabular-nums"
                    >
                        {option.label}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
