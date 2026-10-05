import { and, asc, eq, isNotNull } from "drizzle-orm";

import { db } from "@/db";
import { clients, projects, ticketEstimates, timeEntries } from "@/db/schema";
import { entryBilledMinutes, splitBillableMinutes } from "@/lib/duration";

type ProjectRow = typeof projects.$inferSelect;
type ClientRow = typeof clients.$inferSelect;
type EstimateRow = typeof ticketEstimates.$inferSelect;

/** One session booked against a ticket. */
export interface TicketEntryRow {
    id: string;
    description: string;
    kind: string;
    billingType: string;
    unbillablePercent: number;
    startedAt: Date;
    endedAt: Date | null;
    billedMinutes: number;
    billableMinutes: number;
    unbillableMinutes: number;
}

export interface TicketSummaryRow {
    project: ProjectRow & { client: ClientRow };
    ticketNumber: string;
    /** Quarter-hour minutes tracked against this ticket. */
    trackedMinutes: number;
    /** The two sides of `trackedMinutes`; they always add back up to it. */
    billableMinutes: number;
    unbillableMinutes: number;
    entryCount: number;
    firstTrackedAt: Date | null;
    lastTrackedAt: Date | null;
    estimate: EstimateRow | null;
    /** Every session, oldest first. */
    entries: TicketEntryRow[];
}

/**
 * Every (project, ticket) that has tracked time, with its sessions, its
 * billable split and its estimate attached.
 *
 * Tickets are discovered from the entries rather than maintained separately -
 * you never create a ticket here, you just tell it what was quoted.
 *
 * The totals are summed in TypeScript rather than SQL on purpose: the split
 * between billed and written-off time snaps to quarter hours, and that rule
 * lives in one place. Expressing it twice - once here in SQL and once in the
 * app - is how the timesheet and this screen would come to disagree.
 */
export async function findTicketSummaries(
    userId: string,
): Promise<TicketSummaryRow[]> {
    const rows = await db
        .select({ entry: timeEntries, project: projects, client: clients })
        .from(timeEntries)
        .innerJoin(projects, eq(timeEntries.projectId, projects.id))
        .innerJoin(clients, eq(projects.clientId, clients.id))
        .where(
            and(
                eq(timeEntries.userId, userId),
                isNotNull(timeEntries.ticketNumber),
            ),
        )
        .orderBy(asc(timeEntries.startedAt));

    const estimates = await db
        .select()
        .from(ticketEstimates)
        .where(eq(ticketEstimates.userId, userId));

    const estimateFor = new Map(
        estimates.map((estimate) => [
            `${estimate.projectId}:${estimate.ticketNumber}`,
            estimate,
        ]),
    );

    const summaries = new Map<string, TicketSummaryRow>();

    for (const { entry, project, client } of rows) {
        const ticketNumber = entry.ticketNumber ?? "";
        const key = `${project.id}:${ticketNumber}`;

        const billedMinutes = entryBilledMinutes(entry);

        const split = splitBillableMinutes(
            billedMinutes,
            entry.unbillablePercent ?? 0,
            entry.billingType === "billable",
        );

        let summary = summaries.get(key);

        if (!summary) {
            summary = {
                project: { ...project, client },
                ticketNumber,
                trackedMinutes: 0,
                billableMinutes: 0,
                unbillableMinutes: 0,
                entryCount: 0,
                firstTrackedAt: entry.startedAt,
                lastTrackedAt: entry.startedAt,
                estimate: estimateFor.get(key) ?? null,
                entries: [],
            };

            summaries.set(key, summary);
        }

        summary.trackedMinutes += billedMinutes;
        summary.billableMinutes += split.billableMinutes;
        summary.unbillableMinutes += split.unbillableMinutes;
        summary.entryCount += 1;

        // Rows arrive oldest first, so the last one seen is the latest.
        summary.lastTrackedAt = entry.startedAt;

        summary.entries.push({
            id: entry.id,
            description: entry.description,
            kind: entry.kind,
            billingType: entry.billingType,
            unbillablePercent: entry.unbillablePercent ?? 0,
            startedAt: entry.startedAt,
            endedAt: entry.endedAt,
            billedMinutes,
            billableMinutes: split.billableMinutes,
            unbillableMinutes: split.unbillableMinutes,
        });
    }

    return [...summaries.values()].sort(
        (a, b) =>
            a.project.client.name.localeCompare(b.project.client.name) ||
            a.project.name.localeCompare(b.project.name) ||
            a.ticketNumber.localeCompare(b.ticketNumber, undefined, {
                numeric: true,
            }),
    );
}

export async function upsertTicketEstimate(input: {
    userId: string;
    projectId: string;
    ticketNumber: string;
    minMinutes: number | null;
    maxMinutes: number;
    notes: string | null;
}): Promise<EstimateRow> {
    const [row] = await db
        .insert(ticketEstimates)
        .values(input)
        .onConflictDoUpdate({
            target: [ticketEstimates.projectId, ticketEstimates.ticketNumber],
            set: {
                minMinutes: input.minMinutes,
                maxMinutes: input.maxMinutes,
                notes: input.notes,
            },
        })
        .returning();

    return row;
}

export async function deleteTicketEstimate(
    userId: string,
    projectId: string,
    ticketNumber: string,
): Promise<boolean> {
    const deleted = await db
        .delete(ticketEstimates)
        .where(
            and(
                eq(ticketEstimates.userId, userId),
                eq(ticketEstimates.projectId, projectId),
                eq(ticketEstimates.ticketNumber, ticketNumber),
            ),
        )
        .returning({ id: ticketEstimates.id });

    return deleted.length > 0;
}
