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

/** The shape of a request body, for reading assertions off it. */
interface RevisionGroup {
    user: { uri: string };
    interval: { hours: { hours: number; minutes: number; seconds: number } };
    entryDate: { year: number; month: number; day: number };
    customMetadata: Array<{ keyUri: string; value: Record<string, unknown> }>;
}

function revisionGroup(body: unknown): RevisionGroup {
    return (body as { timeEntryRevisionGroup: RevisionGroup })
        .timeEntryRevisionGroup;
}

function metadata(
    group: RevisionGroup,
): Record<string, Record<string, unknown>> {
    return Object.fromEntries(
        group.customMetadata.map((m) => [
            m.keyUri.split(":").pop() as string,
            m.value,
        ]),
    );
}

// --- the requests that would be sent to Replicon ---
const REPLICON = {
    tenant: "keyorainc",
    userId: "2430",
    ticketFieldId: "700d5f14-ba85-415a-ab1f-fbc940102950",
};

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
        REPLICON,
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
    const b = revisionGroup(meeting.body);
    const meta = metadata(b);

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
        String(meta.task.uri),
    );
    check(
        "a non-billable meeting is flagged not billable",
        meta["is-billable"].bool === false,
    );
    check(
        "the comment carries the description",
        meta.comments.text === "CSBN: Self Service Portal Scrum",
        String(meta.comments.text),
    );
    check("the row number is included", meta["row-number"].number === 26);
    check(
        "the user is the tenant user URN",
        b.user.uri === "urn:replicon-tenant:keyorainc:user:2430",
    );

    const work = plan.requests.find((r) => r.summary.includes("2026-09-01"))!;
    const wb = revisionGroup(work.body);
    const wmeta = metadata(wb);

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
    const orphan = buildRepliconPlan(grid, REPLICON, new Map());

    check(
        "a row with no placement is skipped, not guessed",
        orphan.requests.length === 0 &&
            orphan.skipped.length === grid.rows.length,
        `${orphan.skipped.length} skipped`,
    );
}

/**
 * Replays the two requests captured from Replicon's own client.
 *
 * The builder is given the same inputs and must produce the same body, field
 * for field. This is the only check that can catch the shape being subtly
 * wrong - everything else only proves it is self-consistent.
 */
async function replayChecks() {
    const { buildRepliconPlan } = await import("../src/lib/replicon");

    const cases = [
        {
            name: "non-billable, with a ticket",
            hours: 1.75,
            billing: "Non Billable" as const,
            ticket: "14227",
            rowNumber: 11,
            comment:
                "Gardner 14227 - Discussion with lead - review updates from Gardner - review MSFT documentation on image optimization - Ecom code changes - Site builder changes as per the instructions - test image loading time",
            captured: {
                interval: {
                    hours: { hours: 1, minutes: 45, seconds: 0 },
                    timePair: null,
                },
                metadata: ["is-billable", "task", "comments", "row-number"],
                isBillable: false,
                ticketValue: "14227",
            },
        },
        {
            name: "billable, with a ticket",
            hours: 2.75,
            billing: "Billable" as const,
            ticket: "14222",
            rowNumber: 8,
            comment:
                "Gardner 14222 - Continue the working session to develop the add to order template functionality - implement template dialogs - implement error handling logic - working session to implement error modal - add stylings - test changes thoroughly.",
            captured: {
                interval: {
                    hours: { hours: 2, minutes: 45, seconds: 0 },
                    timePair: null,
                },
                metadata: [
                    "billing-rate",
                    "is-billable",
                    "task",
                    "comments",
                    "row-number",
                ],
                isBillable: true,
                ticketValue: "14222",
            },
        },
    ];

    for (const c of cases) {
        const row = {
            key: "k",
            clientName: "Gardner Inc.",
            projectName: "Gardner - Ongoing Support",
            task: "1500 - Ongoing Support",
            billing: c.billing,
            ticketNumber: c.ticket,
            cells: [{ day: "2026-08-31", hours: c.hours, entryIds: ["e"] }],
            totalHours: c.hours,
            comment: c.comment,
            entered: false,
        };

        const plan = buildRepliconPlan(
            { rows: [row], unmappable: [], totalHours: c.hours },
            REPLICON,
            new Map([["k", { taskId: "10894", rowNumber: c.rowNumber }]]),
            () => "53def72f-dd8a-42d4-8fef-1ce787b03ad0",
        );

        const g = revisionGroup(plan.requests[0].body);
        const keys = g.customMetadata.map((m) => m.keyUri.split(":").pop());
        const meta = metadata(g);
        const ext = (
            g as unknown as {
                extensionFieldValues: Array<{
                    definition: { uri: string };
                    textValue: string | null;
                }>;
            }
        ).extensionFieldValues;

        check(
            `replay (${c.name}): duration matches the capture`,
            JSON.stringify(g.interval) === JSON.stringify(c.captured.interval),
            JSON.stringify(g.interval.hours),
        );
        check(
            `replay (${c.name}): the same metadata keys, in the same order`,
            JSON.stringify(keys) === JSON.stringify(c.captured.metadata),
            keys.join(","),
        );
        check(
            `replay (${c.name}): is-billable matches`,
            meta["is-billable"].bool === c.captured.isBillable,
        );
        check(
            `replay (${c.name}): the ticket is the extension field's textValue`,
            ext.length === 1 && ext[0].textValue === c.captured.ticketValue,
            JSON.stringify(ext[0]?.textValue),
        );
        check(
            `replay (${c.name}): the extension definition uri matches`,
            ext[0]?.definition.uri ===
                "urn:replicon-tenant:keyorainc:object-extension-tag-definition:700d5f14-ba85-415a-ab1f-fbc940102950",
        );
        check(
            `replay (${c.name}): the comment is sent verbatim`,
            meta.comments.text === c.comment,
        );
    }

    // A row with no ticket sends an empty extension list, as the first
    // capture did - not a field with a null value.
    const noTicket = buildRepliconPlan(
        {
            rows: [
                {
                    key: "k",
                    clientName: "c",
                    projectName: "p",
                    task: "0220 - Scrum Meetings",
                    billing: "Non Billable" as const,
                    ticketNumber: null,
                    cells: [
                        { day: "2026-08-31", hours: 0.25, entryIds: ["e"] },
                    ],
                    totalHours: 0.25,
                    comment: "CSBN: Self Service Portal Scrum",
                    entered: false,
                },
            ],
            unmappable: [],
            totalHours: 0.25,
        },
        REPLICON,
        new Map([["k", { taskId: "14510", rowNumber: 26 }]]),
    );

    const g = revisionGroup(noTicket.requests[0].body) as unknown as {
        extensionFieldValues: unknown[];
    };

    check(
        "a row with no ticket sends no extension field",
        g.extensionFieldValues.length === 0,
        JSON.stringify(g.extensionFieldValues),
    );
}

/** The task catalogue, parsed from a real BulkGetProjectOrTaskDetails reply. */
async function catalogueChecks() {
    const { parseRepliconTasks, isMeetingTask, matchTasks } =
        await import("../src/lib/replicon-tasks");

    // Shaped exactly as the service answers, including the `d` wrapper.
    const payload = {
        d: [
            {
                uri: "urn:replicon-tenant:keyorainc:task:11646",
                program: { displayText: "Internal Administration" },
                project: {
                    code: null,
                    displayText: "Evenica Customer Care",
                    uri: "urn:replicon-tenant:keyorainc:project:4130",
                },
                taskAncestry: {
                    parentTask: null,
                    task: { code: "3850", displayText: "3850 - CC - Testing" },
                },
                clientSchedule: [
                    { clients: [{ client: { displayText: "Evenica Corp." } }] },
                ],
            },
            {
                uri: "urn:replicon-tenant:keyorainc:task:10891",
                program: { displayText: "Ongoing Support/Customer Care" },
                project: {
                    code: "SOW1286",
                    displayText: "Gardner - Ongoing Support",
                },
                taskAncestry: {
                    parentTask: null,
                    task: {
                        code: "0220",
                        displayText: "0220 - Scrum Meetings",
                    },
                },
                clientSchedule: [
                    { clients: [{ client: { displayText: "Gardner Inc." } }] },
                ],
            },
            {
                uri: "urn:replicon-tenant:keyorainc:task:13029",
                project: { code: "1329", displayText: "SNDL Ongoing Support" },
                taskAncestry: { parentTask: null },
                clientSchedule: [
                    { clients: [{ client: { displayText: "SNDL Inc." } }] },
                ],
            },
            { notATask: true },
        ],
    };

    const tasks = parseRepliconTasks(payload);

    check(
        "every task in the reply is read",
        tasks.length === 3,
        `${tasks.length}`,
    );
    check("the id comes off the URN", tasks[0].id === "11646", tasks[0].id);
    check(
        "the label is the display text",
        tasks[0].label === "3850 - CC - Testing",
    );
    check("the code is kept separately", tasks[0].code === "3850");
    check(
        "the project is read",
        tasks[0].projectName === "Evenica Customer Care",
    );
    check(
        "the client is dug out of the schedule",
        tasks[0].clientName === "Evenica Corp.",
        String(tasks[0].clientName),
    );
    check(
        "a task with no task node falls back to the project",
        tasks[2].label === "SNDL Ongoing Support",
        tasks[2].label,
    );
    check(
        "entries that are not tasks are ignored",
        !tasks.some((t) => t.id === undefined),
    );

    check(
        "a scrum task is recognised as a meeting task",
        isMeetingTask(tasks[1]),
    );
    check("a testing task is not", !isMeetingTask(tasks[0]));

    // Matching Meridian projects onto the catalogue.
    const gardner = matchTasks(
        { name: "Gardner", clientName: "Gardner Inc." },
        tasks,
    );

    check(
        "the Gardner meeting task is found",
        gardner.meeting?.id === "10891",
        String(gardner.meeting?.label),
    );

    check(
        "a client spelled differently still matches",
        matchTasks({ name: "SNDL", clientName: "SNDL" }, tasks).work?.id ===
            "13029",
    );

    check(
        "another client's tasks are never offered",
        matchTasks({ name: "Whatever", clientName: "Mirage" }, tasks).work ===
            null,
    );

    // Two tasks for one client is a question, not an answer.
    const twoForEvenica = matchTasks(
        { name: "Evenica - General", clientName: "Evenica Corp." },
        [
            ...tasks,
            {
                id: "99999",
                code: "3810",
                label: "3810 - CC - General Tasks",
                projectName: "Evenica Customer Care",
                clientName: "Evenica Corp.",
                programName: null,
            },
        ],
    );

    check(
        "an ambiguous client is reported, not guessed",
        twoForEvenica.work === null && twoForEvenica.ambiguousWork.length === 2,
        `${twoForEvenica.ambiguousWork.length} candidates`,
    );

    check(
        "a garbled payload yields nothing rather than throwing",
        parseRepliconTasks("not json at all").length === 0,
    );
}

repliconChecks()
    .then(replayChecks)
    .then(catalogueChecks)
    .then(() => {
        console.log(
            failed ? `\n${failed} FAILED` : "\nthe Polaris mapping holds",
        );
        process.exit(failed ? 1 : 0);
    });
