import {
    and,
    eq,
    gte,
    inArray,
    isNull,
    lt,
    lte,
    notInArray,
} from "drizzle-orm";

import { db } from "@/db";
import {
    calendarConnections,
    calendarEvents,
    projects,
    timeEntries,
} from "@/db/schema";
import { toQuarterMinutes } from "@/lib/duration";
import type { GoogleCalendarEvent } from "@/lib/google-calendar";
import { detectProjectId } from "@/lib/parse-entry";

export type CalendarEventRow = typeof calendarEvents.$inferSelect;
export type CalendarConnectionRow = typeof calendarConnections.$inferSelect;

export async function findCalendarConnection(
    userId: string,
): Promise<CalendarConnectionRow | null> {
    const rows = await db
        .select()
        .from(calendarConnections)
        .where(eq(calendarConnections.userId, userId))
        .limit(1);

    return rows[0] ?? null;
}

/**
 * Records the connection on first sync, and stamps every one after that. A
 * sync that got as far as calling this one worked, so it also clears any
 * standing "needs reconnecting" flag.
 */
export async function touchCalendarConnection(
    userId: string,
    patch: { defaultProjectId?: string | null; autoPromote?: boolean } = {},
): Promise<CalendarConnectionRow> {
    const [row] = await db
        .insert(calendarConnections)
        .values({ userId, lastSyncedAt: new Date(), ...patch })
        .onConflictDoUpdate({
            target: calendarConnections.userId,
            set: {
                lastSyncedAt: new Date(),
                reauthRequiredAt: null,
                ...patch,
            },
        })
        .returning();

    return row;
}

/**
 * Remembers that Google stopped renewing access, so the week can say so on
 * the next load without another round trip to find out.
 */
export async function markReauthRequired(userId: string): Promise<void> {
    await db
        .insert(calendarConnections)
        .values({ userId, reauthRequiredAt: new Date() })
        .onConflictDoUpdate({
            target: calendarConnections.userId,
            set: { reauthRequiredAt: new Date() },
        });
}

export async function findCalendarEvents(
    userId: string,
    from: Date,
    to: Date,
): Promise<CalendarEventRow[]> {
    return db
        .select()
        .from(calendarEvents)
        .where(
            and(
                eq(calendarEvents.userId, userId),
                gte(calendarEvents.startsAt, from),
                lte(calendarEvents.startsAt, to),
                isNull(calendarEvents.dismissedAt),
            ),
        )
        .orderBy(calendarEvents.startsAt);
}

/**
 * Writes a window of Google's answer over ours.
 *
 * Meetings that Google no longer returns within the window have been deleted
 * or cancelled upstream, so they go - unless they were already promoted, in
 * which case the entry is the user's now and the row stays to keep the link.
 */
export async function syncCalendarWindow(
    userId: string,
    from: Date,
    to: Date,
    events: readonly GoogleCalendarEvent[],
): Promise<{ stored: number; removed: number }> {
    return db.transaction(async (tx) => {
        for (const event of events) {
            await tx
                .insert(calendarEvents)
                .values({
                    userId,
                    googleEventId: event.googleEventId,
                    calendarId: event.calendarId,
                    title: event.title,
                    startsAt: event.startsAt,
                    endsAt: event.endsAt,
                })
                .onConflictDoUpdate({
                    target: [
                        calendarEvents.userId,
                        calendarEvents.googleEventId,
                    ],
                    // A promoted entry is not rewritten by a later sync; only
                    // the meeting's own details are refreshed.
                    set: {
                        title: event.title,
                        startsAt: event.startsAt,
                        endsAt: event.endsAt,
                        calendarId: event.calendarId,
                    },
                })
                .returning({ id: calendarEvents.id });
        }

        const seen = events.map((event) => event.googleEventId);

        const removed = await tx
            .delete(calendarEvents)
            .where(
                and(
                    eq(calendarEvents.userId, userId),
                    gte(calendarEvents.startsAt, from),
                    lte(calendarEvents.startsAt, to),
                    isNull(calendarEvents.promotedEntryId),
                    // `notInArray` rather than a template: an array
                    // interpolated into raw SQL becomes one array-typed
                    // parameter, not a list, and the delete would take the
                    // whole window with it.
                    seen.length > 0
                        ? notInArray(calendarEvents.googleEventId, seen)
                        : undefined,
                ),
            )
            .returning({ id: calendarEvents.id });

        return { stored: events.length, removed: removed.length };
    });
}

/**
 * Turns a meeting into a tracked entry.
 *
 * The project is worked out from the meeting's title where it can be - a
 * "Gardner Scrum" belongs to Gardner - and falls back to whatever the
 * calendar connection nominates. With neither, there is nowhere to put it.
 */
export async function promoteCalendarEvent(
    userId: string,
    eventId: string,
    projectId?: string | null,
): Promise<{ entryId: string } | { error: string }> {
    const [event] = await db
        .select()
        .from(calendarEvents)
        .where(
            and(
                eq(calendarEvents.userId, userId),
                eq(calendarEvents.id, eventId),
            ),
        )
        .limit(1);

    if (!event) {
        return { error: "That meeting is no longer in the calendar." };
    }

    if (event.promotedEntryId) {
        return { entryId: event.promotedEntryId };
    }

    const resolved = projectId ?? (await resolveProject(userId, event.title));

    if (!resolved) {
        return {
            error: "No project to put this against. Pick one in Settings, or promote it by hand.",
        };
    }

    const durationSeconds = Math.max(
        0,
        Math.round((event.endsAt.getTime() - event.startsAt.getTime()) / 1000),
    );

    return db.transaction(async (tx) => {
        const [entry] = await tx
            .insert(timeEntries)
            .values({
                userId,
                projectId: resolved,
                description: event.title,
                ticketNumber: null,
                billingType: "non_billable",
                kind: "meeting",
                startedAt: event.startsAt,
                endedAt: event.endsAt,
                durationSeconds,
                timesheetDurationMinutes: toQuarterMinutes(durationSeconds),
            })
            .returning({ id: timeEntries.id });

        await tx
            .update(calendarEvents)
            .set({ promotedEntryId: entry.id })
            .where(eq(calendarEvents.id, event.id));

        return { entryId: entry.id };
    });
}

/** The project named by the meeting title, or the configured fallback. */
async function resolveProject(
    userId: string,
    title: string,
): Promise<string | null> {
    const owned = await db
        .select({
            id: projects.id,
            name: projects.name,
            archived: projects.archived,
        })
        .from(projects)
        .where(and(eq(projects.userId, userId), eq(projects.archived, false)));

    const detected = detectProjectId(
        title,
        owned.map((project) => ({ id: project.id, name: project.name })),
    );

    if (detected) {
        return detected;
    }

    const connection = await findCalendarConnection(userId);

    return connection?.defaultProjectId ?? null;
}

export async function dismissCalendarEvent(
    userId: string,
    eventId: string,
): Promise<boolean> {
    const rows = await db
        .update(calendarEvents)
        .set({ dismissedAt: new Date() })
        .where(
            and(
                eq(calendarEvents.userId, userId),
                eq(calendarEvents.id, eventId),
            ),
        )
        .returning({ id: calendarEvents.id });

    return rows.length > 0;
}

/**
 * Promotes every meeting that has finished since the calendar was connected.
 *
 * The connection date is the guard that matters: without it, connecting a
 * calendar would backfill months of past weeks with entries nobody asked for.
 */
export async function autoPromoteFinished(
    userId: string,
    now: Date,
): Promise<number> {
    const connection = await findCalendarConnection(userId);

    if (!connection?.autoPromote) {
        return 0;
    }

    const due = await db
        .select({ id: calendarEvents.id })
        .from(calendarEvents)
        .where(
            and(
                eq(calendarEvents.userId, userId),
                isNull(calendarEvents.promotedEntryId),
                isNull(calendarEvents.dismissedAt),
                lt(calendarEvents.endsAt, now),
                gte(calendarEvents.endsAt, connection.connectedAt),
            ),
        );

    let promoted = 0;

    for (const row of due) {
        const result = await promoteCalendarEvent(userId, row.id);

        if ("entryId" in result) {
            promoted += 1;
        }
    }

    return promoted;
}

/** Used by the entry list to show which entries came from a meeting. */
export async function findEventsForEntries(
    userId: string,
    entryIds: readonly string[],
): Promise<CalendarEventRow[]> {
    if (entryIds.length === 0) {
        return [];
    }

    return db
        .select()
        .from(calendarEvents)
        .where(
            and(
                eq(calendarEvents.userId, userId),
                inArray(calendarEvents.promotedEntryId, [...entryIds]),
            ),
        );
}
