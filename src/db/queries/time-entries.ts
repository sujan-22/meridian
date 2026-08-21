import { and, asc, desc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";

import { db } from "@/db";
import { clients, projects, timeEntries } from "@/db/schema";

type EntryRow = typeof timeEntries.$inferSelect;
type ProjectRow = typeof projects.$inferSelect;
type ClientRow = typeof clients.$inferSelect;

export type TimeEntryWithProject = EntryRow & {
    project: ProjectRow & { client: ClientRow };
};

const selection = {
    entry: timeEntries,
    project: projects,
    client: clients,
};

type JoinedRow = {
    entry: EntryRow;
    project: ProjectRow;
    client: ClientRow;
};

function shape(row: JoinedRow): TimeEntryWithProject {
    return {
        ...row.entry,
        project: {
            ...row.project,
            client: row.client,
        },
    };
}

function baseQuery() {
    return db
        .select(selection)
        .from(timeEntries)
        .innerJoin(projects, eq(timeEntries.projectId, projects.id))
        .innerJoin(clients, eq(projects.clientId, clients.id));
}

/** Reload a set of entries after a bulk update, in start order. */
export async function findEntriesByIds(
    ids: readonly string[],
): Promise<TimeEntryWithProject[]> {
    if (ids.length === 0) {
        return [];
    }

    const rows = await baseQuery()
        .where(inArray(timeEntries.id, [...ids]))
        .orderBy(asc(timeEntries.startedAt));

    return rows.map(shape);
}

export async function findEntryById(
    id: string,
): Promise<TimeEntryWithProject | null> {
    const rows = await baseQuery().where(eq(timeEntries.id, id)).limit(1);

    return rows[0] ? shape(rows[0]) : null;
}

/**
 * Entries that started inside the range, oldest first. `to` is inclusive so
 * callers can pass an end-of-day instant.
 */
export async function findEntriesBetween(
    from: Date,
    to: Date,
): Promise<TimeEntryWithProject[]> {
    const rows = await baseQuery()
        .where(and(gte(timeEntries.startedAt, from), lte(timeEntries.startedAt, to)))
        .orderBy(asc(timeEntries.startedAt));

    return rows.map(shape);
}

/** The single entry with no end time, if a timer is running. */
export async function findRunningEntry(): Promise<TimeEntryWithProject | null> {
    const rows = await baseQuery()
        .where(isNull(timeEntries.endedAt))
        .orderBy(desc(timeEntries.startedAt))
        .limit(1);

    return rows[0] ? shape(rows[0]) : null;
}

/**
 * Most recent finished entries, de-duplicated on
 * (project, ticket, description) so the "continue" list is not the same line
 * five times over.
 */
export async function findRecentEntries(
    limit: number,
): Promise<TimeEntryWithProject[]> {
    const rows = await baseQuery()
        .where(sql`${timeEntries.endedAt} is not null`)
        .orderBy(desc(timeEntries.startedAt))
        .limit(Math.max(limit, 1) * 6);

    const seen = new Set<string>();
    const results: TimeEntryWithProject[] = [];

    for (const row of rows) {
        const entry = shape(row);

        const key = [
            entry.projectId,
            entry.ticketNumber ?? "",
            entry.description.trim().toLowerCase(),
        ].join("::");

        if (seen.has(key)) {
            continue;
        }

        seen.add(key);
        results.push(entry);

        if (results.length >= limit) {
            break;
        }
    }

    return results;
}

/**
 * Past descriptions matching what is being typed, newest first. Powers the
 * "recent for #39494" suggestions in the timer input.
 */
export async function findDescriptionSuggestions(
    query: string,
    limit: number,
): Promise<TimeEntryWithProject[]> {
    const term = query.trim();

    if (term.length < 2) {
        return [];
    }

    const rows = await baseQuery()
        .where(sql`${timeEntries.description} ilike ${`%${term}%`}`)
        .orderBy(desc(timeEntries.startedAt))
        .limit(Math.max(limit, 1) * 6);

    const seen = new Set<string>();
    const results: TimeEntryWithProject[] = [];

    for (const row of rows) {
        const entry = shape(row);
        const key = entry.description.trim().toLowerCase();

        if (seen.has(key)) {
            continue;
        }

        seen.add(key);
        results.push(entry);

        if (results.length >= limit) {
            break;
        }
    }

    return results;
}
