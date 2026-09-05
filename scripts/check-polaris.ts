/**
 * The mapping from tracked entries to Polaris rows.
 *
 *     pnpm check:polaris
 *
 * Pure functions only - no database, no network.
 */
import { buildPolarisGrid } from "../src/lib/polaris";
import type { TimesheetEntry } from "../src/lib/timesheet";

let failed = 0;

function check(label: string, ok: boolean, detail = "") {
    if (!ok) failed += 1;
    console.log(
        `${ok ? "  ok  " : "FAIL  "}${label}${detail ? ` - ${detail}` : ""}`,
    );
}

const gardner = {
    id: "p-gardner",
    name: "Gardner - Ongoing Support",
    polarisTask: "1500 - Ongoing Support",
    polarisMeetingTask: "0200 - Meetings",
    client: { id: "c-gardner", name: "Gardner Inc.", shortName: "Gardner" },
};

const unmapped = {
    id: "p-mirage",
    name: "Mirage",
    polarisTask: null,
    polarisMeetingTask: null,
    client: { id: "c-mirage", name: "Mirage", shortName: "Mirage" },
};

let seq = 0;

function entry(
    over: Partial<TimesheetEntry> & { minutes: number; day: string },
): TimesheetEntry {
    const { minutes, day, ...rest } = over;

    return {
        id: `e${seq++}`,
        description: "work",
        ticketNumber: null,
        kind: "WORK",
        billingType: "BILLABLE",
        startedAt: `${day}T09:00:00`,
        endedAt: `${day}T10:00:00`,
        timesheetDurationMinutes: minutes,
        unbillablePercent: 0,
        project: gardner,
        ...rest,
    } as TimesheetEntry;
}

// Work and meetings on the same project must not share a row.
{
    const grid = buildPolarisGrid([
        entry({
            minutes: 60,
            day: "2026-08-24",
            ticketNumber: "14222",
            description: "Gardner 14222 - build",
        }),
        entry({
            minutes: 15,
            day: "2026-08-24",
            kind: "MEETING",
            description: "Gardner Scrum",
        }),
    ]);

    check(
        "work and meetings land on different rows",
        grid.rows.length === 2,
        `${grid.rows.length} rows`,
    );
    check(
        "the meeting uses the meetings task",
        grid.rows.some(
            (r) => r.task === "0200 - Meetings" && r.totalHours === 0.25,
        ),
    );
    check(
        "the work uses the work task",
        grid.rows.some(
            (r) => r.task === "1500 - Ongoing Support" && r.totalHours === 1,
        ),
    );
}

// Same ticket across days is one row with a cell per day.
{
    const grid = buildPolarisGrid([
        entry({ minutes: 285, day: "2026-08-25", ticketNumber: "14222" }),
        entry({ minutes: 330, day: "2026-08-28", ticketNumber: "14222" }),
    ]);

    check("one row spans the week", grid.rows.length === 1);
    check("with a cell per day", grid.rows[0].cells.length === 2);
    check(
        "cells carry the right hours",
        grid.rows[0].cells[0].hours === 4.75 &&
            grid.rows[0].cells[1].hours === 5.5,
        grid.rows[0].cells.map((c) => `${c.day}=${c.hours}`).join(" "),
    );
    check(
        "the row total adds up",
        grid.rows[0].totalHours === 10.25,
        String(grid.rows[0].totalHours),
    );
}

// Two sessions on the same day, same ticket, share a cell.
{
    const grid = buildPolarisGrid([
        entry({ minutes: 45, day: "2026-08-24", ticketNumber: "14226" }),
        entry({ minutes: 180, day: "2026-08-24", ticketNumber: "14226" }),
    ]);

    check("same day and ticket is one cell", grid.rows[0].cells.length === 1);
    check(
        "the cell sums the sessions",
        grid.rows[0].cells[0].hours === 3.75,
        String(grid.rows[0].cells[0].hours),
    );
}

// A partly written-off entry produces both a billable and a non-billable row.
{
    const grid = buildPolarisGrid([
        entry({
            minutes: 180,
            day: "2026-08-25",
            ticketNumber: "14222",
            unbillablePercent: 33,
        }),
    ]);

    const billable = grid.rows.find((r) => r.billing === "Billable");
    const nonBillable = grid.rows.find((r) => r.billing === "Non Billable");

    check("a split entry makes two rows", grid.rows.length === 2);
    check(
        "the two sides sum to the whole",
        billable!.totalHours + nonBillable!.totalHours === 3,
        `${billable!.totalHours} + ${nonBillable!.totalHours}`,
    );
    check(
        "each side lands on a quarter",
        [billable!.totalHours, nonBillable!.totalHours].every(
            (h) => (h * 4) % 1 === 0,
        ),
        `${billable!.totalHours} / ${nonBillable!.totalHours}`,
    );
}

// A non-billable entry never produces a billable row.
{
    const grid = buildPolarisGrid([
        entry({ minutes: 30, day: "2026-08-26", billingType: "NON_BILLABLE" }),
    ]);

    check(
        "non-billable stays non-billable",
        grid.rows.length === 1 && grid.rows[0].billing === "Non Billable",
    );
}

// A project with no task is reported, not filed somewhere plausible.
{
    const grid = buildPolarisGrid([
        entry({ minutes: 60, day: "2026-08-24", project: unmapped }),
        entry({
            minutes: 15,
            day: "2026-08-24",
            kind: "MEETING",
            project: unmapped,
        }),
    ]);

    check("unmapped work produces no row", grid.rows.length === 0);
    check(
        "and is reported instead",
        grid.unmappable.length === 2,
        `${grid.unmappable.length}`,
    );
    check(
        "naming which task is missing",
        grid.unmappable.some((u) => u.missing === "work") &&
            grid.unmappable.some((u) => u.missing === "meeting"),
    );
}

// A meeting on a project with only a work task is not silently mis-filed.
{
    const workOnly = { ...gardner, polarisMeetingTask: null };
    const grid = buildPolarisGrid([
        entry({
            minutes: 15,
            day: "2026-08-24",
            kind: "MEETING",
            project: workOnly,
        }),
    ]);

    check(
        "a meeting never falls back to the work task",
        grid.rows.length === 0 && grid.unmappable[0]?.missing === "meeting",
    );
}

// The whole week's total is preserved.
{
    const entries = [
        entry({ minutes: 225, day: "2026-08-24", ticketNumber: "14226" }),
        entry({
            minutes: 105,
            day: "2026-08-24",
            ticketNumber: "14226",
            unbillablePercent: 100,
        }),
        entry({ minutes: 285, day: "2026-08-25", ticketNumber: "14222" }),
        entry({
            minutes: 60,
            day: "2026-08-25",
            ticketNumber: "14222",
            unbillablePercent: 100,
        }),
        entry({ minutes: 15, day: "2026-08-25", kind: "MEETING" }),
    ];

    const tracked =
        entries.reduce((sum, e) => sum + (e.timesheetDurationMinutes ?? 0), 0) /
        60;
    const grid = buildPolarisGrid(entries);

    check(
        "no tracked time is lost or invented",
        Math.abs(grid.totalHours - tracked) < 0.001,
        `tracked ${tracked}, grid ${grid.totalHours}`,
    );
}

// --- the requests that would be sent to Replicon ---
async function repliconChecks() {
    const { buildRepliconPlan } = await import("../src/lib/replicon");

    const grid = buildPolarisGrid([
        entry({
            minutes: 15,
            day: "2026-08-31",
            kind: "MEETING",
            description: "CSBN: Self Service Portal Scrum",
            billingType: "NON_BILLABLE",
        }),
        entry({
            minutes: 285,
            day: "2026-09-01",
            ticketNumber: "14222",
            description: "Gardner 14222 - build",
        }),
    ]);

    const placements = new Map(
        grid.rows.map((row, i) => [
            row.key,
            {
                taskId: row.task.startsWith("0200") ? "14510" : "1500",
                rowNumber: 26 + i,
            },
        ]),
    );

    const plan = buildRepliconPlan(
        grid,
        { tenant: "keyorainc", userId: "2430" },
        placements,
        () => "67768404-9fbc-4a08-904f-2b908b1ee070",
    );

    check(
        "one request per filled cell",
        plan.requests.length === 2,
        `${plan.requests.length}`,
    );

    const meeting = plan.requests.find((r) =>
        r.summary.includes("2026-08-31"),
    )!;
    const b = (meeting.body as Record<string, any>).timeEntryRevisionGroup;
    const meta = Object.fromEntries(
        b.customMetadata.map((m: any) => [m.keyUri.split(":").pop(), m.value]),
    );

    check(
        "duration is sent as h/m/s",
        b.interval.hours.hours === 0 && b.interval.hours.minutes === 15,
        JSON.stringify(b.interval.hours),
    );
    check(
        "the date is split into y/m/d",
        b.entryDate.year === 2026 &&
            b.entryDate.month === 8 &&
            b.entryDate.day === 31,
        JSON.stringify(b.entryDate),
    );
    check(
        "the task is sent as a tenant URN",
        meta.task.uri === "urn:replicon-tenant:keyorainc:task:14510",
        meta.task.uri,
    );
    check(
        "a non-billable meeting is flagged not billable",
        meta["is-billable"].bool === false,
    );
    check(
        "the comment carries the description",
        meta.comments.text === "CSBN: Self Service Portal Scrum",
        meta.comments.text,
    );
    check("the row number is included", meta["row-number"].number === 26);
    check(
        "the user is the tenant user URN",
        b.user.uri === "urn:replicon-tenant:keyorainc:user:2430",
    );

    const work = plan.requests.find((r) => r.summary.includes("2026-09-01"))!;
    const wb = (work.body as Record<string, any>).timeEntryRevisionGroup;
    const wmeta = Object.fromEntries(
        wb.customMetadata.map((m: any) => [m.keyUri.split(":").pop(), m.value]),
    );

    check(
        "billable work is flagged billable",
        wmeta["is-billable"].bool === true,
    );
    check(
        "4.75 h becomes 4 h 45 m",
        wb.interval.hours.hours === 4 && wb.interval.hours.minutes === 45,
        JSON.stringify(wb.interval.hours),
    );
    check(
        "the plan totals what the grid holds",
        plan.totalHours === grid.totalHours,
        `${plan.totalHours} vs ${grid.totalHours}`,
    );

    // A row with nowhere to land must be reported, never posted blind.
    const orphan = buildRepliconPlan(
        grid,
        { tenant: "keyorainc", userId: "2430" },
        new Map(),
    );

    check(
        "a row with no placement is skipped, not guessed",
        orphan.requests.length === 0 &&
            orphan.skipped.length === grid.rows.length,
        `${orphan.skipped.length} skipped`,
    );
}

repliconChecks().then(() => {
    console.log(failed ? `\n${failed} FAILED` : "\nthe Polaris mapping holds");
    process.exit(failed ? 1 : 0);
});
