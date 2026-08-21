import { asc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { clients, projects, timeEntries } from "@/db/schema";

type ProjectRow = typeof projects.$inferSelect;
type ClientRow = typeof clients.$inferSelect;

export type ProjectWithClient = ProjectRow & { client: ClientRow };

export interface ProjectSummaryRow {
    project: ProjectWithClient;
    /** Quarter-hour minutes across every entry on the project. */
    totalMinutes: number;
    entryCount: number;
    lastTrackedAt: Date | null;
}

/**
 * Per-project totals in one grouped pass, so the projects screen never fans
 * out into a query per row.
 *
 * `sum`/`count` come back from Postgres as numeric and bigint, which the
 * driver hands over as strings - the casts keep them numbers.
 */
const entryStats = db
    .select({
        projectId: timeEntries.projectId,

        totalMinutes:
            sql<number>`coalesce(sum(coalesce(${timeEntries.timesheetDurationMinutes}, 0)), 0)::int`.as(
                "total_minutes",
            ),

        entryCount: sql<number>`count(*)::int`.as("entry_count"),

        // Raw aggregates bypass drizzle's column mappers, so this arrives as
        // a timestamp string rather than a Date.
        lastTrackedAt: sql<string | null>`max(${timeEntries.startedAt})`.as(
            "last_tracked_at",
        ),
    })
    .from(timeEntries)
    .groupBy(timeEntries.projectId)
    .as("entry_stats");

export async function findProjectSummaries(
    includeArchived: boolean,
): Promise<ProjectSummaryRow[]> {
    const rows = await db
        .select({
            project: projects,
            client: clients,
            totalMinutes: entryStats.totalMinutes,
            entryCount: entryStats.entryCount,
            lastTrackedAt: entryStats.lastTrackedAt,
        })
        .from(projects)
        .innerJoin(clients, eq(projects.clientId, clients.id))
        .leftJoin(entryStats, eq(entryStats.projectId, projects.id))
        .where(includeArchived ? undefined : eq(projects.archived, false))
        .orderBy(asc(clients.name), asc(projects.name));

    return rows.map((row) => ({
        project: { ...row.project, client: row.client },

        // A project with no entries has no stats row at all.
        totalMinutes: row.totalMinutes ?? 0,
        entryCount: row.entryCount ?? 0,

        lastTrackedAt: row.lastTrackedAt
            ? new Date(row.lastTrackedAt)
            : null,
    }));
}

export async function findProjectById(
    id: string,
): Promise<ProjectWithClient | null> {
    const rows = await db
        .select({ project: projects, client: clients })
        .from(projects)
        .innerJoin(clients, eq(projects.clientId, clients.id))
        .where(eq(projects.id, id))
        .limit(1);

    return rows[0] ? { ...rows[0].project, client: rows[0].client } : null;
}

/** How many time entries reference a project - deletion is blocked if any do. */
export async function countProjectEntries(projectId: string): Promise<number> {
    const [row] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(timeEntries)
        .where(eq(timeEntries.projectId, projectId));

    return row?.count ?? 0;
}
