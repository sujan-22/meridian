/**
 * Fixture data for the test database.
 *
 * Deliberately small and predictable: the browser suites assert against these
 * exact clients, projects and entries, so they never depend on whatever is in
 * the real database that day.
 */
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";

import { clients, projects, timeEntries } from "../src/db/schema";

config({ path: ".env.test" });
config({ path: ".env.local" });

const url = process.env.DATABASE_URL;

if (!url) {
    throw new Error("DATABASE_URL is not defined");
}

if (!/quanta_test/.test(url)) {
    throw new Error(
        `Refusing to seed: ${url.replace(/:[^:@]*@/, ":***@")} is not the test database`,
    );
}

const client = postgres(url, { max: 1 });
const db = drizzle(client);

/** Monday of the current week, so week-relative assertions always line up. */
function monday(): Date {
    const date = new Date();

    date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
    date.setHours(0, 0, 0, 0);

    return date;
}

function at(hour: number, minute: number, dayOffset = 0): Date {
    const date = monday();

    date.setDate(date.getDate() + dayOffset);
    date.setHours(hour, minute, 0, 0);

    return date;
}

const QUARTER = 15;

async function seed() {
    await db.execute(sql`
        truncate table ${timeEntries}, ${projects}, ${clients},
                      ticket_estimates, timesheet_weeks, preferences
        restart identity cascade
    `);

    const [gardner, millcraft, evenica] = await db
        .insert(clients)
        .values([
            { name: "Gardner Inc.", shortName: "Gardner", color: "#6574cd" },
            {
                name: "The MillCraft Paper Company, Inc.",
                shortName: "Millcraft",
                color: "#d84a4a",
            },
            { name: "Evenica Corp.", shortName: "Evenica", color: "#d88c34" },
        ])
        .returning();

    const [gardnerSupport, millcraftSupport, meetings, retired] = await db
        .insert(projects)
        .values([
            {
                clientId: gardner.id,
                name: "Gardner - Ongoing Support",
                color: "#6574cd",
                defaultBillingType: "billable",
                polarisTask: "1500 - Ongoing Support",
            },
            {
                clientId: millcraft.id,
                name: "Millcraft - Ongoing Support",
                color: "#d84a4a",
                defaultBillingType: "billable",
                polarisTask: "1500 - Ongoing Support",
            },
            {
                clientId: evenica.id,
                name: "CC - Meetings",
                color: "#31b5a4",
                defaultBillingType: "non_billable",
                polarisTask: "3830 - CC - Internal Meetings",
            },
            // Archived on purpose: the suites check it stays off the pickers
            // but remains selectable on the entry that already uses it.
            {
                clientId: gardner.id,
                name: "Gardner - Retired Stream",
                color: "#9b6bd6",
                defaultBillingType: "billable",
                archived: true,
            },
        ])
        .returning();

    const rows = [
        {
            projectId: gardnerSupport.id,
            description: "Gardner Scrum",
            ticketNumber: null,
            kind: "meeting" as const,
            billingType: "billable" as const,
            unbillablePercent: 0,
            start: at(9, 0),
            minutes: QUARTER,
        },
        {
            projectId: gardnerSupport.id,
            description:
                "Gardner 14214 - Review SQL queries and F&O order history logic",
            ticketNumber: "14214",
            kind: "work" as const,
            billingType: "billable" as const,
            unbillablePercent: 0,
            start: at(9, 15),
            minutes: 90,
        },
        {
            projectId: gardnerSupport.id,
            description: "Gardner 14214 - Test the changes on TEST2",
            ticketNumber: "14214",
            kind: "work" as const,
            billingType: "billable" as const,
            unbillablePercent: 0,
            start: at(11, 0),
            minutes: 45,
        },
        // 1.25 h at 60% -> 0.50 billable / 0.75 written off
        {
            projectId: gardnerSupport.id,
            description: "Gardner 14224 - Review CSU PR changes and ECOM work",
            ticketNumber: "14224",
            kind: "work" as const,
            billingType: "billable" as const,
            unbillablePercent: 60,
            start: at(13, 45),
            minutes: 75,
        },
        {
            projectId: millcraftSupport.id,
            description: "Millcraft 39494 - Working session to configure CDX",
            ticketNumber: "39494",
            kind: "work" as const,
            billingType: "billable" as const,
            unbillablePercent: 0,
            start: at(15, 0),
            minutes: 60,
        },
        {
            projectId: meetings.id,
            description: "Customer Care Scrum",
            ticketNumber: null,
            kind: "meeting" as const,
            billingType: "non_billable" as const,
            unbillablePercent: 0,
            start: at(9, 0, 1),
            minutes: QUARTER,
        },
        {
            projectId: retired.id,
            description: "Gardner 9001 - Work on the retired stream",
            ticketNumber: "9001",
            kind: "work" as const,
            billingType: "billable" as const,
            unbillablePercent: 0,
            start: at(10, 0, 1),
            minutes: 60,
        },
    ];

    await db.insert(timeEntries).values(
        rows.map((row) => ({
            projectId: row.projectId,
            description: row.description,
            ticketNumber: row.ticketNumber,
            kind: row.kind,
            billingType: row.billingType,
            unbillablePercent: row.unbillablePercent,
            startedAt: row.start,
            endedAt: new Date(row.start.getTime() + row.minutes * 60_000),
            durationSeconds: row.minutes * 60,
            timesheetDurationMinutes: row.minutes,
        })),
    );

    console.log(
        `seeded: 3 clients, 4 projects (1 archived), ${rows.length} entries`,
    );

    await client.end();
}

seed().catch(async (error) => {
    console.error(error);

    await client.end();
    process.exit(1);
});
