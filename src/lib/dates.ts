/**
 * Date helpers.
 *
 * Everything the API takes is an absolute instant (`DateTime`). Day and week
 * boundaries are resolved in the browser's timezone and sent as instants so
 * the server never has to guess which timezone "today" means.
 */

import {
    endOfDay,
    endOfWeek,
    format,
    startOfDay,
    startOfWeek,
} from "date-fns";

/** date-fns' `weekStartsOn`: 0 = Sunday … 6 = Saturday. */
export type WeekStartsOn = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Used only until stored preferences load. Polaris weeks run Saturday to
 * Friday, so this is genuinely configurable rather than a constant.
 */
export const DEFAULT_WEEK_STARTS_ON: WeekStartsOn = 1;

export interface InstantRange {
    from: Date;
    to: Date;
}

export function dayRange(date: Date): InstantRange {
    return {
        from: startOfDay(date),
        to: endOfDay(date),
    };
}

export function weekRange(
    date: Date,
    weekStartsOn: WeekStartsOn = DEFAULT_WEEK_STARTS_ON,
): InstantRange {
    return {
        from: startOfWeek(date, { weekStartsOn }),
        to: endOfWeek(date, { weekStartsOn }),
    };
}

/** `2026-08-19` - stable key for grouping and for `date` columns. */
export function toDateKey(date: Date | string): string {
    return format(new Date(date), "yyyy-MM-dd");
}

/** `09:15` - how entry start and end times are shown in lists. */
export function formatTimeOfDay(date: Date | string): string {
    return format(new Date(date), "HH:mm");
}

/** Combine a day with a `HH:mm` string typed into a form. */
export function withTimeOfDay(day: Date, timeOfDay: string): Date | null {
    const match = /^(\d{1,2}):(\d{2})$/.exec(timeOfDay.trim());

    if (!match) {
        return null;
    }

    const hours = Number(match[1]);
    const minutes = Number(match[2]);

    if (hours > 23 || minutes > 59) {
        return null;
    }

    const result = new Date(day);

    result.setHours(hours, minutes, 0, 0);

    return result;
}
