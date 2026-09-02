import { and, asc, eq, isNotNull, sql } from "drizzle-orm";

import { db } from "@/db";
import { clients, projects, ticketEstimates, timeEntries } from "@/db/schema";

type ProjectRow = typeof projects.$inferSelect;
type ClientRow = typeof clients.$inferSelect;
type EstimateRow = typeof ticketEstimates.$inferSelect;

export interface TicketSummaryRow {
    project: ProjectRow & { client: ClientRow };
    ticketNumber: string;
    /** Quarter-hour minutes tracked against this ticket. */
    trackedMinutes: number;
    entryCount: number;
    firstTrackedAt: Date | null;
    lastTrackedAt: Date | null;
    estimate: EstimateRow | null;
}

/**
 * Every (project, ticket) that has tracked time, with its estimate attached.
 *
 * Tickets are discovered from the entries rather than maintained separately -
 * you never create a ticket here, you just tell it what was quoted.
 */
export async function findTicketSummaries(
    userId: string,
): Promise<TicketSummaryRow[]> {
    const rows = await db
        .select({
            project: projects,
            client: clients,
            ticketNumber: timeEntries.ticketNumber,

            trackedMinutes:
                sql<number>`coalesce(sum(coalesce(${timeEntries.timesheetDurationMinutes}, 0)), 0)::int`.as(
                    "tracked_minutes",
                ),

            entryCount: sql<number>`count(*)::int`.as("entry_count"),

            // Raw aggregates bypass drizzle's column mappers, so these arrive
            // as timestamp strings rather than Dates.
            firstTrackedAt: sql<string | null>`min(${timeEntries.startedAt})`.as(
                "first_tracked_at",
            ),
            lastTrackedAt: sql<string | null>`max(${timeEntries.startedAt})`.as(
                "last_tracked_at",
            ),

            estimate: ticketEstimates,
        })
        .from(timeEntries)
        .innerJoin(projects, eq(timeEntries.projectId, projects.id))
        .innerJoin(clients, eq(projects.clientId, clients.id))
        .leftJoin(
            ticketEstimates,
            and(
                eq(ticketEstimates.projectId, timeEntries.projectId),
                eq(ticketEstimates.ticketNumber, timeEntries.ticketNumber),
            ),
        )
        .where(
            and(
                eq(timeEntries.userId, userId),
                isNotNull(timeEntries.ticketNumber),
            ),
        )
        .groupBy(projects.id, clients.id, timeEntries.ticketNumber, ticketEstimates.id)
        .orderBy(asc(clients.name), asc(projects.name), asc(timeEntries.ticketNumber));

    return rows.map((row) => ({
        project: { ...row.project, client: row.client },
        ticketNumber: row.ticketNumber ?? "",
        trackedMinutes: row.trackedMinutes ?? 0,
        entryCount: row.entryCount ?? 0,
        firstTrackedAt: row.firstTrackedAt
            ? new Date(row.firstTrackedAt)
            : null,
        lastTrackedAt: row.lastTrackedAt ? new Date(row.lastTrackedAt) : null,
        estimate: row.estimate ?? null,
    }));
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
