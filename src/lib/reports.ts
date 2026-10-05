/**
 * Turning a span of tracked time into the few numbers worth looking at.
 *
 * The questions this answers are the ones a consultancy week actually raises:
 * how much went on the books, how much was written off, where it went, and
 * whether the weeks are landing on target. Everything is derived from the
 * entries themselves with the same arithmetic the week and timesheet use, so
 * no screen can disagree with another about the same hour.
 */

import { eachWeekOfInterval, isWeekend, startOfWeek } from "date-fns";

import { entryBilledMinutes, splitBillableMinutes } from "./duration";
import type { WeekStartsOn } from "./dates";

export interface ReportEntry {
    id: string;
    startedAt: string;
    endedAt?: string | null;
    durationSeconds?: number | null;
    timesheetDurationMinutes?: number | null;
    billingType: string;
    unbillablePercent?: number | null;
    ticketNumber?: string | null;
    kind: string;
    description: string;
    project: {
        id: string;
        name: string;
        color?: string | null;
        client: { id: string; name: string; shortName?: string | null };
    };
}

export interface Totals {
    trackedMinutes: number;
    billableMinutes: number;
    unbillableMinutes: number;
    entryCount: number;
}

export interface ReportWeek extends Totals {
    /** Local date of the week's first day, `YYYY-MM-DD`. */
    weekStart: string;
    date: Date;
}

export interface ReportGroup extends Totals {
    key: string;
    name: string;
    detail: string;
    color?: string | null;
    /**
     * The project the colour belongs to. A ticket row is keyed by project and
     * number, and a client row by client, so neither key can be handed to
     * `projectColor` - it would derive a colour from the wrong thing.
     */
    colorKey?: string;
    /** Share of the period's tracked time, 0-100. */
    share: number;
}

export interface Report extends Totals {
    /** Billable as a share of everything tracked, 0-100. */
    billablePercent: number;
    /** Working days in the span times the daily target. */
    targetMinutes: number;
    weeks: ReportWeek[];
    clients: ReportGroup[];
    projects: ReportGroup[];
    tickets: ReportGroup[];
    meetingMinutes: number;
}

interface ReportOptions {
    from: Date;
    to: Date;
    weekStartsOn: WeekStartsOn;
    dailyTargetMinutes: number;
}

function emptyTotals(): Totals {
    return {
        trackedMinutes: 0,
        billableMinutes: 0,
        unbillableMinutes: 0,
        entryCount: 0,
    };
}

function dayKey(date: Date): string {
    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0"),
    ].join("-");
}

function add(
    into: Totals,
    minutes: number,
    billable: number,
    unbillable: number,
) {
    into.trackedMinutes += minutes;
    into.billableMinutes += billable;
    into.unbillableMinutes += unbillable;
    into.entryCount += 1;
}

/**
 * What a period is expected to hold.
 *
 * Weekends carry no target, which matches how the week screen counts a day as
 * short - otherwise every report would show a shortfall it does not have.
 */
function workingTarget(
    from: Date,
    to: Date,
    dailyTargetMinutes: number,
): number {
    let minutes = 0;
    const cursor = new Date(from);

    while (cursor <= to) {
        if (!isWeekend(cursor)) {
            minutes += dailyTargetMinutes;
        }

        cursor.setDate(cursor.getDate() + 1);
    }

    return minutes;
}

function rank(
    groups: Map<string, ReportGroup>,
    trackedMinutes: number,
): ReportGroup[] {
    return [...groups.values()]
        .map((group) => ({
            ...group,
            share:
                trackedMinutes > 0
                    ? Math.round(
                          (group.trackedMinutes / trackedMinutes) * 1000,
                      ) / 10
                    : 0,
        }))
        .sort((a, b) => b.trackedMinutes - a.trackedMinutes);
}

export function buildReport(
    entries: readonly ReportEntry[],
    options: ReportOptions,
): Report {
    const report: Report = {
        ...emptyTotals(),
        billablePercent: 0,
        targetMinutes: workingTarget(
            options.from,
            options.to,
            options.dailyTargetMinutes,
        ),
        weeks: [],
        clients: [],
        projects: [],
        tickets: [],
        meetingMinutes: 0,
    };

    // Every week in the span, present whether or not anything was tracked -
    // a blank week is itself worth seeing.
    const weeks = new Map<string, ReportWeek>();

    for (const start of eachWeekOfInterval(
        { start: options.from, end: options.to },
        { weekStartsOn: options.weekStartsOn },
    )) {
        weeks.set(dayKey(start), {
            ...emptyTotals(),
            weekStart: dayKey(start),
            date: start,
        });
    }

    const clients = new Map<string, ReportGroup>();
    const projectClients = new Map<string, string>();
    const projects = new Map<string, ReportGroup>();
    const tickets = new Map<string, ReportGroup>();

    for (const entry of entries) {
        const minutes = entryBilledMinutes(entry);

        if (minutes <= 0) {
            continue;
        }

        const split = splitBillableMinutes(
            minutes,
            entry.unbillablePercent ?? 0,
            entry.billingType === "BILLABLE" ||
                entry.billingType === "billable",
        );

        add(report, minutes, split.billableMinutes, split.unbillableMinutes);

        if (entry.kind === "MEETING" || entry.kind === "meeting") {
            report.meetingMinutes += minutes;
        }

        const started = new Date(entry.startedAt);

        const week = weeks.get(
            dayKey(
                startOfWeek(started, { weekStartsOn: options.weekStartsOn }),
            ),
        );

        if (week) {
            add(week, minutes, split.billableMinutes, split.unbillableMinutes);
        }

        const client = entry.project.client;

        projectClients.set(entry.project.id, client.id);

        const intoClient = clients.get(client.id) ?? {
            ...emptyTotals(),
            key: client.id,
            name: client.shortName?.trim() || client.name,
            detail: client.name,
            share: 0,
        };

        add(
            intoClient,
            minutes,
            split.billableMinutes,
            split.unbillableMinutes,
        );
        clients.set(client.id, intoClient);

        const intoProject = projects.get(entry.project.id) ?? {
            ...emptyTotals(),
            key: entry.project.id,
            name: entry.project.name,
            detail: client.name,
            color: entry.project.color,
            colorKey: entry.project.id,
            share: 0,
        };

        add(
            intoProject,
            minutes,
            split.billableMinutes,
            split.unbillableMinutes,
        );
        projects.set(entry.project.id, intoProject);

        const ticketNumber = entry.ticketNumber?.trim();

        if (ticketNumber) {
            const key = `${entry.project.id}:${ticketNumber}`;

            const intoTicket = tickets.get(key) ?? {
                ...emptyTotals(),
                key,
                name: `#${ticketNumber}`,
                detail: entry.project.name,
                color: entry.project.color,
                colorKey: entry.project.id,
                share: 0,
            };

            add(
                intoTicket,
                minutes,
                split.billableMinutes,
                split.unbillableMinutes,
            );
            tickets.set(key, intoTicket);
        }
    }

    report.billablePercent =
        report.trackedMinutes > 0
            ? Math.round(
                  (report.billableMinutes / report.trackedMinutes) * 1000,
              ) / 10
            : 0;

    report.weeks = [...weeks.values()].sort(
        (a, b) => a.date.getTime() - b.date.getTime(),
    );

    report.clients = rank(clients, report.trackedMinutes);
    report.projects = rank(projects, report.trackedMinutes);

    const biggestProject = new Map<string, ReportGroup>();

    for (const project of report.projects) {
        const clientId = projectClients.get(project.key);

        // `report.projects` is ranked, so the first project to reach a client
        // is the one it spent the most time in.
        if (clientId && !biggestProject.has(clientId)) {
            biggestProject.set(clientId, project);
        }
    }

    for (const client of report.clients) {
        const project = biggestProject.get(client.key);

        if (project) {
            client.color = project.color;
            client.colorKey = project.key;
        }
    }

    report.tickets = rank(tickets, report.trackedMinutes);

    return report;
}
