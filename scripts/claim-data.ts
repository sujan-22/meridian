/**
 * Points the data at one account.
 *
 *     pnpm claim you@example.com                # give unowned rows an owner
 *     pnpm claim you@example.com --take-over    # ...and move everyone else's too
 *
 * The plain form is for the ownership migration: rows that existed before the
 * app had accounts belong to whoever was using it.
 *
 * `--take-over` is for the case where the account that ends up signing in is
 * not the one the data was first claimed to - sign in with Google, then run
 * this with that address and everything follows. It is deliberately explicit,
 * because on a database with real users it would be a hostile thing to do by
 * accident.
 */
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, isNull, ne, sql } from "drizzle-orm";
import postgres from "postgres";

import {
    accounts,
    clients,
    preferences,
    projects,
    ticketEstimates,
    timeEntries,
    timesheetWeeks,
    users,
} from "../src/db/schema";

config({ path: ".env.local" });

const email = process.argv[2];
const takeOver = process.argv.includes("--take-over");

if (!email || !email.includes("@")) {
    console.error(
        "Usage: pnpm claim <the-email-you-sign-in-with> [--take-over]",
    );
    process.exit(1);
}

const url = process.env.DATABASE_URL;

if (!url) {
    throw new Error("DATABASE_URL is not defined");
}

const client = postgres(url, { max: 1 });
const db = drizzle(client);

const OWNED = [
    { name: "clients", table: clients },
    { name: "projects", table: projects },
    { name: "time_entries", table: timeEntries },
    { name: "ticket_estimates", table: ticketEstimates },
    { name: "timesheet_weeks", table: timesheetWeeks },
    { name: "preferences", table: preferences },
] as const;

async function claim() {
    const existing = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

    if (!existing[0] && takeOver) {
        throw new Error(
            `No account for ${email}. Sign in with Google first, then run this again.`,
        );
    }

    const owner =
        existing[0] ??
        (
            await db
                .insert(users)
                .values({
                    id: crypto.randomUUID(),
                    name: email.split("@")[0],
                    email,
                    // Google confirms this on first sign-in; creating the row
                    // now just gives the data an owner to belong to.
                    emailVerified: true,
                })
                .returning()
        )[0];

    console.log(
        `${existing[0] ? "Using existing" : "Created"} account for ${email}\n`,
    );

    // One transaction: a half-moved database would be worse than either end.
    await db.transaction(async (tx) => {
        for (const { name, table } of OWNED) {
            const orphans = await tx
                .update(table)
                .set({ userId: owner.id })
                .where(isNull(table.userId))
                .returning({ id: table.id });

            const moved = takeOver
                ? await tx
                      .update(table)
                      .set({ userId: owner.id })
                      .where(ne(table.userId, owner.id))
                      .returning({ id: table.id })
                : [];

            const parts = [`claimed ${orphans.length}`];

            if (takeOver) {
                parts.push(`moved ${moved.length}`);
            }

            console.log(`  ${name.padEnd(16)} ${parts.join(", ")}`);
        }
    });

    // Anything still unowned would be invisible to every query, so say so.
    for (const { name, table } of OWNED) {
        const [row] = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(table)
            .where(isNull(table.userId));

        if (row.count > 0) {
            console.warn(`  WARNING ${name}: ${row.count} still unowned`);
        }
    }

    await reportLeftovers(owner.id);

    await client.end();
}

/**
 * An account holding no data and no sign-in provider can only be a leftover
 * placeholder from an earlier claim. Worth naming, not worth deleting behind
 * someone's back.
 */
async function reportLeftovers(ownerId: string) {
    const others = await db.select().from(users).where(ne(users.id, ownerId));

    for (const other of others) {
        const [linked] = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(accounts)
            .where(eq(accounts.userId, other.id));

        const [owns] = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(timeEntries)
            .where(eq(timeEntries.userId, other.id));

        if (linked.count === 0 && owns.count === 0) {
            console.log(
                `\nLeftover account with no data and no Google link: ${other.email}` +
                    `\n  Remove it with:  psql "$DATABASE_URL" -c ` +
                    `"delete from \\"user\\" where email = '${other.email}'"`,
            );
        }
    }
}

claim().catch(async (error) => {
    console.error(`\n${error instanceof Error ? error.message : error}`);

    await client.end();
    process.exit(1);
});
