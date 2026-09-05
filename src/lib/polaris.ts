/**
 * Turning a tracked week into the grid Polaris expects.
 *
 * Polaris keys a row by (project, task, billing, ticket) and puts hours in a
 * cell per day. That is very nearly the shape the timesheet already groups
 * into, with one difference that matters: the task is not a property of the
 * project alone. The same project books work to one task and its ceremonies
 * to another, so a scrum and the ticket it was about belong on different rows.
 *
 * Nothing here guesses. A project with no task mapped is reported as
 * unmappable rather than being filed somewhere plausible - a timesheet feeds
 * an invoice, and a confident wrong answer is worse than a blank.
 */

import {
    portionEntered,
    portionMinutes,
    type EntryPortion,
    type TimesheetEntry,
} from "./timesheet";

export type PolarisBilling = "Billable" | "Non Billable";

export interface PolarisCell {
    /** Local date, `YYYY-MM-DD`. */
    day: string;
    hours: number;
    entryIds: string[];
}

export interface PolarisRow {
    /** Stable across rebuilds, so a transfer can be resumed. */
    key: string;
    clientName: string;
    projectName: string;
    task: string;
    billing: PolarisBilling;
    ticketNumber: string | null;
    cells: PolarisCell[];
    totalHours: number;
    /** What goes in the comment box, longest description first. */
    comment: string;
    /** Every part of this row is already ticked off in Meridian. */
    entered: boolean;
}

export interface PolarisUnmappable {
    projectId: string;
    projectName: string;
    clientName: string;
    /** Which task is missing: work entries, meetings, or both. */
    missing: "work" | "meeting";
    minutes: number;
}

export interface PolarisGrid {
    rows: PolarisRow[];
    unmappable: PolarisUnmappable[];
    totalHours: number;
}

/** Polaris takes hours to two decimals; everything here is quarter-aligned. */
function toHours(minutes: number): number {
    return Math.round((minutes / 60) * 100) / 100;
}

function dayKey(date: Date): string {
    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0"),
    ].join("-");
}

function isMeeting(entry: TimesheetEntry): boolean {
    return entry.kind === "MEETING" || entry.kind === "meeting";
}

/** The task an entry books to, which depends on what kind of entry it is. */
function taskFor(entry: TimesheetEntry): string | null {
    const project = entry.project;

    if (isMeeting(entry)) {
        // Falling back to the work task would be a guess, and a wrong row in
        // Polaris is harder to notice than a missing one.
        return project.polarisMeetingTask?.trim() || null;
    }

    return project.polarisTask?.trim() || null;
}

/**
 * The comment for a row.
 *
 * Longest first: when several sessions share a ticket the fullest description
 * is the one worth reading, and Polaris shows only the start of it.
 */
function buildComment(descriptions: readonly string[]): string {
    const unique = [
        ...new Set(descriptions.map((d) => d.trim()).filter(Boolean)),
    ];

    unique.sort((a, b) => b.length - a.length);

    return unique.join(" | ");
}

const PORTIONS: readonly EntryPortion[] = ["billable", "nonBillable"];

export function buildPolarisGrid(
    entries: readonly TimesheetEntry[],
): PolarisGrid {
    const rows = new Map<
        string,
        {
            row: Omit<
                PolarisRow,
                "cells" | "totalHours" | "comment" | "entered"
            >;
            cells: Map<string, PolarisCell>;
            descriptions: string[];
            entered: boolean[];
        }
    >();

    const unmappable = new Map<string, PolarisUnmappable>();

    for (const entry of entries) {
        const task = taskFor(entry);

        for (const portion of PORTIONS) {
            const minutes = portionMinutes(entry, portion);

            if (minutes <= 0) {
                continue;
            }

            if (!task) {
                const kind = isMeeting(entry) ? "meeting" : "work";
                const key = `${entry.project.id}:${kind}`;
                const existing = unmappable.get(key);

                unmappable.set(key, {
                    projectId: entry.project.id,
                    projectName: entry.project.name,
                    clientName: entry.project.client.name,
                    missing: kind,
                    minutes: (existing?.minutes ?? 0) + minutes,
                });

                continue;
            }

            const billing: PolarisBilling =
                portion === "billable" ? "Billable" : "Non Billable";

            // Exactly Polaris's own row identity.
            const ticket = entry.ticketNumber?.trim() || null;
            const key = [entry.project.id, task, billing, ticket ?? ""].join(
                "|",
            );

            let bucket = rows.get(key);

            if (!bucket) {
                bucket = {
                    row: {
                        key,
                        clientName: entry.project.client.name,
                        projectName: entry.project.name,
                        task,
                        billing,
                        ticketNumber: ticket,
                    },
                    cells: new Map(),
                    descriptions: [],
                    entered: [],
                };

                rows.set(key, bucket);
            }

            const day = dayKey(new Date(entry.startedAt));
            const cell = bucket.cells.get(day);

            if (cell) {
                cell.hours = toHours(cell.hours * 60 + minutes);
                cell.entryIds.push(entry.id);
            } else {
                bucket.cells.set(day, {
                    day,
                    hours: toHours(minutes),
                    entryIds: [entry.id],
                });
            }

            bucket.descriptions.push(entry.description);
            bucket.entered.push(portionEntered(entry, portion));
        }
    }

    const built: PolarisRow[] = [...rows.values()].map((bucket) => {
        const cells = [...bucket.cells.values()].sort((a, b) =>
            a.day.localeCompare(b.day),
        );

        return {
            ...bucket.row,
            cells,
            totalHours:
                Math.round(cells.reduce((sum, c) => sum + c.hours, 0) * 100) /
                100,
            comment: buildComment(bucket.descriptions),
            entered: bucket.entered.every(Boolean),
        };
    });

    built.sort(
        (a, b) =>
            a.clientName.localeCompare(b.clientName) ||
            a.task.localeCompare(b.task) ||
            a.billing.localeCompare(b.billing) ||
            (a.ticketNumber ?? "").localeCompare(b.ticketNumber ?? ""),
    );

    return {
        rows: built,
        unmappable: [...unmappable.values()].sort(
            (a, b) => b.minutes - a.minutes,
        ),
        totalHours:
            Math.round(built.reduce((sum, r) => sum + r.totalHours, 0) * 100) /
            100,
    };
}
