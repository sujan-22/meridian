import {
    and,
    asc,
    desc,
    eq,
    gte,
    inArray,
    isNull,
    lte,
    sql,
    type SQL,
} from "drizzle-orm";

import { db } from "@/db";
import { clients, projects, timeEntries } from "@/db/schema";

type EntryRow = typeof timeEntries.$inferSelect;
type ProjectRow = typeof projects.$inferSelect;
type ClientRow = typeof clients.$inferSelect;

export type TimeEntryWithProject = EntryRow & {
    project: ProjectRow & { client: ClientRow };
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

/**
 * Every read of a time entry goes through here.
 *
 * The owner filter is applied inside rather than left to the caller, and any
 * extra condition is ANDed onto it - so there is no way to write a query that
 * forgets to scope itself to the signed-in person.
 */
function ownedBy(userId: string, extra?: SQL) {
    const owner = eq(timeEntries.userId, userId);

    return db
        .select({ entry: timeEntries, project: projects, client: clients })
        .from(timeEntries)
        .innerJoin(projects, eq(timeEntries.projectId, projects.id))
        .innerJoin(clients, eq(projects.clientId, clients.id))
        .where(extra ? and(owner, extra) : owner);
}

/** Reload a set of entries after a bulk update, in start order. */
export async function findEntriesByIds(
    userId: string,
    ids: readonly string[],
): Promise<TimeEntryWithProject[]> {
    if (ids.length === 0) {
        return [];
    }

    const rows = await ownedBy(userId, inArray(timeEntries.id, [...ids]))
        .orderBy(asc(timeEntries.startedAt));

    return rows.map(shape);
}

export async function findEntryById(
    userId: string,
    id: string,
): Promise<TimeEntryWithProject | null> {
    const rows = await ownedBy(userId, eq(timeEntries.id, id)).limit(1);

    return rows[0] ? shape(rows[0]) : null;
}

/**
 * Entries that started inside the range, oldest first. `to` is inclusive so
 * callers can pass an end-of-day instant.
 */
export async function findEntriesBetween(
    userId: string,
    from: Date,
    to: Date,
): Promise<TimeEntryWithProject[]> {
    const rows = await ownedBy(
        userId,
        and(gte(timeEntries.startedAt, from), lte(timeEntries.startedAt, to)),
    ).orderBy(asc(timeEntries.startedAt));

    return rows.map(shape);
}

/** The single entry with no end time, if a timer is running. */
export async function findRunningEntry(
    userId: string,
): Promise<TimeEntryWithProject | null> {
    const rows = await ownedBy(userId, isNull(timeEntries.endedAt))
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
    userId: string,
    limit: number,
): Promise<TimeEntryWithProject[]> {
    const rows = await ownedBy(
        userId,
        sql`${timeEntries.endedAt} is not null`,
    )
        .orderBy(desc(timeEntries.startedAt))
        .limit(Math.max(limit, 1) * 6);

    return distinctBy(rows.map(shape), limit, (entry) =>
        [
            entry.projectId,
            entry.ticketNumber ?? "",
            entry.description.trim().toLowerCase(),
        ].join("::"),
    );
}

/**
 * Past descriptions matching what is being typed, newest first. Powers the
 * "recent for #39494" suggestions in the timer input.
 */
export async function findDescriptionSuggestions(
    userId: string,
    query: string,
    limit: number,
): Promise<TimeEntryWithProject[]> {
    const term = query.trim();

    if (term.length < 2) {
        return [];
    }

    const rows = await ownedBy(
        userId,
        sql`${timeEntries.description} ilike ${`%${term}%`}`,
    )
        .orderBy(desc(timeEntries.startedAt))
        .limit(Math.max(limit, 1) * 6);

    return distinctBy(rows.map(shape), limit, (entry) =>
        entry.description.trim().toLowerCase(),
    );
}

function distinctBy<T>(
    items: readonly T[],
    limit: number,
    key: (item: T) => string,
): T[] {
    const seen = new Set<string>();
    const results: T[] = [];

    for (const item of items) {
        const fingerprint = key(item);

        if (seen.has(fingerprint)) {
            continue;
        }

        seen.add(fingerprint);
        results.push(item);

        if (results.length >= limit) {
            break;
        }
    }

    return results;
}
