/**
 * Assigns every ownerless row to one account.
 *
 * Run once, after the ownership migration: all the data that existed before
 * the app had accounts belongs to whoever was using it. Signing in with
 * Google later attaches to this same account by email.
 */
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { isNull, eq, sql } from "drizzle-orm";
import postgres from "postgres";

import {
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

if (!email || !email.includes("@")) {
    console.error("Usage: pnpm claim <the-email-you-sign-in-with>");
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

    const owner =
        existing[0] ??
        (
            await db
                .insert(users)
                .values({
                    id: crypto.randomUUID(),
                    name: email.split("@")[0],
                    email,
                    // Google will confirm it; this only lets the account exist
                    // ahead of the first sign-in so the data has an owner.
                    emailVerified: true,
                })
                .returning()
        )[0];

    console.log(
        `${existing[0] ? "Using existing" : "Created"} account for ${email}`,
    );

    for (const { name, table } of OWNED) {
        const updated = await db
            .update(table)
            .set({ userId: owner.id })
            .where(isNull(table.userId))
            .returning({ id: table.id });

        console.log(`  ${name}: claimed ${updated.length}`);
    }

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

    console.log(
        "\nDone. Now run `pnpm db:migrate` to apply the NOT NULL step.",
    );

    await client.end();
}

claim().catch(async (error) => {
    console.error(error);

    await client.end();
    process.exit(1);
});
