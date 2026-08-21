/**
 * Duration helpers.
 *
 * Tracked time is always stored in seconds. Timesheet time is stored in
 * minutes because Polaris is filled in with decimal hours rounded to a
 * quarter of an hour.
 */

export const SECONDS_PER_MINUTE = 60;
export const SECONDS_PER_HOUR = 3600;

/**
 * `01:23:45` - the live timer readout.
 */
export function formatClock(seconds: number): string {
    const safe = Math.max(0, Math.floor(seconds));

    const hours = Math.floor(safe / SECONDS_PER_HOUR);
    const minutes = Math.floor((safe % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
    const remainder = safe % SECONDS_PER_MINUTE;

    return [hours, minutes, remainder]
        .map((part) => String(part).padStart(2, "0"))
        .join(":");
}

/**
 * `2.25` - the number that gets typed into Polaris.
 */
export function formatDecimalHours(seconds: number): string {
    return (Math.max(0, seconds) / SECONDS_PER_HOUR).toFixed(2);
}

/**
 * `1h 30m` / `45m` - compact human reading for dense lists.
 */
export function formatCompactDuration(seconds: number): string {
    const safe = Math.max(0, Math.floor(seconds));

    const hours = Math.floor(safe / SECONDS_PER_HOUR);
    const minutes = Math.round((safe % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);

    if (hours === 0) {
        return `${minutes}m`;
    }

    if (minutes === 0) {
        return `${hours}h`;
    }

    return `${hours}h ${minutes}m`;
}

/**
 * Timesheets are filled in quarter hours, so that is the unit the whole app
 * reports in. Raw `startedAt`/`endedAt` stay exact in the database; this is
 * the number that gets shown, totalled and copied into Polaris.
 */
export const QUARTER_MINUTES = 15;

/** Nearest quarter hour, never less than one - you cannot bill under 15 min. */
export function toQuarterMinutes(seconds: number): number {
    const minutes = Math.max(0, seconds) / SECONDS_PER_MINUTE;

    const rounded =
        Math.round(minutes / QUARTER_MINUTES) * QUARTER_MINUTES;

    return Math.max(QUARTER_MINUTES, rounded);
}

/** `2.25` from a minute count. */
export function formatMinutesAsHours(minutes: number): string {
    return (Math.max(0, minutes) / 60).toFixed(2);
}

export const ROUNDING_INCREMENTS = [0, 5, 10, 15, 30] as const;

export type RoundingIncrement = (typeof ROUNDING_INCREMENTS)[number];

export type RoundingMode = "nearest" | "up" | "down";

/**
 * Turn a tracked duration into the minutes that will be entered on the
 * timesheet. An increment of `0` means "no rounding".
 */
export function roundSecondsToMinutes(
    seconds: number,
    increment: number,
    mode: RoundingMode = "nearest",
): number {
    const exactMinutes = Math.max(0, seconds) / SECONDS_PER_MINUTE;

    if (increment <= 0) {
        return Math.round(exactMinutes);
    }

    const blocks = exactMinutes / increment;

    const rounded =
        mode === "up"
            ? Math.ceil(blocks)
            : mode === "down"
              ? Math.floor(blocks)
              : Math.round(blocks);

    return rounded * increment;
}

/**
 * Seconds elapsed for an entry, whether it is running or already stopped.
 */
export function entryDurationSeconds(
    entry: {
        startedAt: string | Date;
        endedAt?: string | Date | null;
        durationSeconds?: number | null;
    },
    now: number = Date.now(),
): number {
    if (entry.durationSeconds != null) {
        return entry.durationSeconds;
    }

    const startedAt = new Date(entry.startedAt).getTime();
    const endedAt = entry.endedAt ? new Date(entry.endedAt).getTime() : now;

    return Math.max(0, Math.round((endedAt - startedAt) / 1000));
}

/**
 * The quarter-hour figure for an entry: the stored timesheet duration once it
 * exists, or a live rounding of a still-running timer.
 */
export function entryBilledMinutes(
    entry: {
        startedAt: string | Date;
        endedAt?: string | Date | null;
        durationSeconds?: number | null;
        timesheetDurationMinutes?: number | null;
    },
    now: number = Date.now(),
): number {
    if (entry.timesheetDurationMinutes != null) {
        return entry.timesheetDurationMinutes;
    }

    return toQuarterMinutes(entryDurationSeconds(entry, now));
}
