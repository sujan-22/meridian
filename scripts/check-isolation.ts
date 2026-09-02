/**
 * Two people, one database.
 *
 * Every query is asked for A's data while B's data sits right beside it in the
 * same tables. Nothing of B's may come back, in either direction, and A must
 * not be able to write to anything of B's.
 *
 *     pnpm test:setup && pnpm check:isolation
 *
 * The imports are dynamic because the database module reads DATABASE_URL when
 * it is first loaded, which has to happen after the fixture env is in place.
 */
import { config } from "dotenv";

config({ path: ".env.test", quiet: true, override: true });

const A = "test-user-meridian";
const B = "test-user-intruder";

let failed = 0;

function check(label: string, ok: boolean, detail = "") {
    if (!ok) {
        failed += 1;
    }

    console.log(
        `${ok ? "  ok  " : "FAIL  "}${label}${detail ? ` - ${detail}` : ""}`,
    );
}

async function main() {
    if (!/meridian_test/.test(process.env.DATABASE_URL ?? "")) {
        throw new Error(
            "Refusing to run: DATABASE_URL is not the meridian_test database.",
        );
    }

    const { eq } = await import("drizzle-orm");
    const { db } = await import("../src/db");
    const { clients, projects, timeEntries, users } =
        await import("../src/db/schema");

    const entries = await import("../src/db/queries/time-entries");
    const projectQueries = await import("../src/db/queries/projects");
    const tickets = await import("../src/db/queries/tickets");
    const prefs = await import("../src/db/queries/preferences");
    const weeks = await import("../src/db/queries/timesheet-weeks");

    /** Clears B out, so a run that fails partway does not block the next. */
    async function removeIntruder() {
        await db.delete(timeEntries).where(eq(timeEntries.userId, B));
        await db.delete(projects).where(eq(projects.userId, B));
        await db.delete(clients).where(eq(clients.userId, B));
        await db.delete(users).where(eq(users.id, B));
    }

    await removeIntruder();

    // Give B a client, a project and an entry of their own.
    await db
        .insert(users)
        .values({
            id: B,
            name: "Intruder",
            email: "intruder@example.com",
            emailVerified: true,
        })
        .onConflictDoNothing();

    const [bClient] = await db
        .insert(clients)
        .values({ userId: B, name: "Secret Corp", shortName: "Secret" })
        .returning();

    const [bProject] = await db
        .insert(projects)
        .values({
            userId: B,
            clientId: bClient.id,
            name: "Secret Project",
            color: "#ff0000",
        })
        .returning();

    const startedAt = new Date("2026-08-20T09:00:00Z");

    const [bEntry] = await db
        .insert(timeEntries)
        .values({
            userId: B,
            projectId: bProject.id,
            description: "Secret work 99999 - do not leak",
            ticketNumber: "99999",
            billingType: "billable",
            kind: "work",
            startedAt,
            endedAt: new Date(startedAt.getTime() + 3_600_000),
            durationSeconds: 3600,
            timesheetDurationMinutes: 60,
        })
        .returning();

    const secrets = [
        bClient.id,
        bProject.id,
        bEntry.id,
        "Secret Corp",
        "Secret Project",
        "Secret work",
    ];

    /** Serialises a result and looks for anything at all belonging to B. */
    function clean(label: string, value: unknown) {
        const json = JSON.stringify(value ?? null);
        const leaked = secrets.filter((secret) => json.includes(secret));

        check(label, leaked.length === 0, leaked.join(", "));
    }

    const from = new Date("2026-08-01T00:00:00Z");
    const to = new Date("2026-09-30T00:00:00Z");

    clean("findEntriesBetween", await entries.findEntriesBetween(A, from, to));
    clean(
        "findEntryById on B's entry",
        await entries.findEntryById(A, bEntry.id),
    );
    clean(
        "findProjectSummaries",
        await projectQueries.findProjectSummaries(A, true),
    );
    clean(
        "findProjectById on B's project",
        await projectQueries.findProjectById(A, bProject.id),
    );
    clean("findTicketSummaries", await tickets.findTicketSummaries(A));
    clean("findPreferences", await prefs.findPreferences(A));
    clean("findTimesheetWeek", await weeks.findTimesheetWeek(A, "2026-08-17"));

    // The other direction too: B must not be handed A's fixtures.
    const bSees = await entries.findEntriesBetween(B, from, to);

    check(
        "B sees only their own entry",
        bSees.length === 1 && bSees[0].id === bEntry.id,
        `saw ${bSees.length}`,
    );

    // And a cross-user write must not land. This is the same statement the
    // delete mutation runs, with A asking for B's row.
    const { and } = await import("drizzle-orm");

    const deleted = await db
        .delete(timeEntries)
        .where(and(eq(timeEntries.userId, A), eq(timeEntries.id, bEntry.id)))
        .returning({ id: timeEntries.id });

    const survived = await db
        .select()
        .from(timeEntries)
        .where(eq(timeEntries.id, bEntry.id));

    check(
        "A cannot delete B's entry",
        deleted.length === 0 && survived.length === 1,
    );

    // Leave the fixture database exactly as seeded.
    await removeIntruder();

    console.log(
        failed ? `\n${failed} FAILED` : "\nno leakage in either direction",
    );
    process.exit(failed ? 1 : 0);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
