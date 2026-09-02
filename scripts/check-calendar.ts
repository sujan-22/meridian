/**
 * Exercises the calendar sync rules against the fixture database.
 *
 *     pnpm test:setup && pnpm check:calendar
 */
import { config } from "dotenv";

config({ path: ".env.test", quiet: true, override: true });

let failed = 0;

function check(label: string, ok: boolean, detail = "") {
    if (!ok) failed += 1;
    console.log(
        `${ok ? "  ok  " : "FAIL  "}${label}${detail ? ` - ${detail}` : ""}`,
    );
}

async function main() {
    if (!/meridian_test/.test(process.env.DATABASE_URL ?? "")) {
        throw new Error("Refusing to run outside the fixture database.");
    }

    const { and, eq } = await import("drizzle-orm");
    const { db } = await import("../src/db");
    const { calendarConnections, calendarEvents, projects, timeEntries } =
        await import("../src/db/schema");
    const calendar = await import("../src/db/queries/calendar");

    const USER = "test-user-meridian";
    const from = new Date("2026-08-17T00:00:00Z");
    const to = new Date("2026-08-23T00:00:00Z");

    const at = (h: number, m = 0) => new Date(Date.UTC(2026, 7, 19, h, m, 0));

    const [gardner] = await db
        .select()
        .from(projects)
        .where(and(eq(projects.userId, USER), eq(projects.archived, false)))
        .limit(1);

    async function reset() {
        await db.delete(calendarEvents).where(eq(calendarEvents.userId, USER));
        await db
            .delete(calendarConnections)
            .where(eq(calendarConnections.userId, USER));
    }

    await reset();
    await calendar.touchCalendarConnection(USER);

    // A first sync stores what Google returned.
    await calendar.syncCalendarWindow(USER, from, to, [
        {
            googleEventId: "g1",
            calendarId: "primary",
            title: `${gardner.name} Scrum`,
            startsAt: at(9),
            endsAt: at(9, 15),
        },
        {
            googleEventId: "g2",
            calendarId: "primary",
            title: "Design review",
            startsAt: at(11),
            endsAt: at(12),
        },
    ]);
    let stored = await calendar.findCalendarEvents(USER, from, to);
    check(
        "first sync stores both meetings",
        stored.length === 2,
        `got ${stored.length}`,
    );

    // Re-syncing with one gone removes it.
    await calendar.syncCalendarWindow(USER, from, to, [
        {
            googleEventId: "g1",
            calendarId: "primary",
            title: `${gardner.name} Scrum`,
            startsAt: at(9),
            endsAt: at(9, 15),
        },
    ]);
    stored = await calendar.findCalendarEvents(USER, from, to);
    check(
        "a cancelled meeting is dropped on re-sync",
        stored.length === 1,
        `got ${stored.length}`,
    );

    // A moved meeting is updated, not duplicated.
    await calendar.syncCalendarWindow(USER, from, to, [
        {
            googleEventId: "g1",
            calendarId: "primary",
            title: `${gardner.name} Scrum`,
            startsAt: at(10),
            endsAt: at(10, 15),
        },
    ]);
    stored = await calendar.findCalendarEvents(USER, from, to);
    check(
        "a moved meeting updates in place",
        stored.length === 1 && stored[0].startsAt.getUTCHours() === 10,
        `${stored.length} row(s), starts ${stored[0]?.startsAt.toISOString()}`,
    );

    // Promotion creates an entry against the project named in the title.
    const promoted = await calendar.promoteCalendarEvent(USER, stored[0].id);
    check(
        "promoting creates an entry",
        "entryId" in promoted,
        JSON.stringify(promoted),
    );

    if ("entryId" in promoted) {
        const [entry] = await db
            .select()
            .from(timeEntries)
            .where(eq(timeEntries.id, promoted.entryId));

        check("entry is a meeting", entry.kind === "meeting");
        check(
            "entry matched the project from the title",
            entry.projectId === gardner.id,
        );
        check(
            "entry is quarter-aligned",
            (entry.timesheetDurationMinutes ?? 0) % 15 === 0,
            `${entry.timesheetDurationMinutes} min`,
        );
    }

    // Promoting twice returns the same entry rather than making another.
    const again = await calendar.promoteCalendarEvent(USER, stored[0].id);
    check(
        "promoting twice is a no-op",
        "entryId" in again &&
            "entryId" in promoted &&
            again.entryId === promoted.entryId,
    );

    // A promoted meeting survives a sync that no longer returns it.
    await calendar.syncCalendarWindow(USER, from, to, []);
    const survivors = await db
        .select()
        .from(calendarEvents)
        .where(eq(calendarEvents.userId, USER));
    check(
        "a promoted meeting is not deleted by a later sync",
        survivors.length === 1,
        `got ${survivors.length}`,
    );

    // Auto-promote ignores anything that ended before the calendar was linked.
    await reset();
    const connection = await calendar.touchCalendarConnection(USER);
    await calendar.syncCalendarWindow(USER, from, to, [
        {
            googleEventId: "old",
            calendarId: "primary",
            title: `${gardner.name} Old standup`,
            startsAt: at(8),
            endsAt: at(8, 15),
        },
    ]);
    let count = await calendar.autoPromoteFinished(USER, new Date());
    check(
        "meetings from before the connection are left alone",
        count === 0,
        `promoted ${count}`,
    );

    // One that ends after the connection, and is over, promotes itself.
    const after = new Date(connection.connectedAt.getTime() + 60_000);
    await calendar.syncCalendarWindow(
        USER,
        from,
        new Date(after.getTime() + 86_400_000),
        [
            {
                googleEventId: "new",
                calendarId: "primary",
                title: `${gardner.name} Standup`,
                startsAt: new Date(after.getTime()),
                endsAt: new Date(after.getTime() + 900_000),
            },
        ],
    );
    count = await calendar.autoPromoteFinished(
        USER,
        new Date(after.getTime() + 1_800_000),
    );
    check(
        "a finished meeting promotes itself",
        count === 1,
        `promoted ${count}`,
    );

    // A meeting still running is not promoted early.
    count = await calendar.autoPromoteFinished(
        USER,
        new Date(after.getTime() + 60_000),
    );
    check(
        "a meeting still in progress is left alone",
        count === 0,
        `promoted ${count}`,
    );

    await reset();
    await db
        .delete(timeEntries)
        .where(
            and(eq(timeEntries.userId, USER), eq(timeEntries.kind, "meeting")),
        );

    console.log(failed ? `\n${failed} FAILED` : "\nall calendar rules hold");
    process.exit(failed ? 1 : 0);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
