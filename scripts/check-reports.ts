/**
 * The numbers the reports screen puts in front of you.
 *
 *     pnpm check:reports
 */
import { buildReport, type ReportEntry } from "../src/lib/reports";

let failed = 0;

function check(label: string, ok: boolean, detail = "") {
    if (!ok) failed += 1;
    console.log(
        `${ok ? "  ok  " : "FAIL  "}${label}${detail ? ` - ${detail}` : ""}`,
    );
}

let seq = 0;

function entry(
    over: Partial<ReportEntry> & { minutes: number; day: string },
): ReportEntry {
    const { minutes, day, ...rest } = over;

    return {
        id: `e${seq++}`,
        startedAt: `${day}T09:00:00`,
        endedAt: `${day}T10:00:00`,
        timesheetDurationMinutes: minutes,
        billingType: "BILLABLE",
        unbillablePercent: 0,
        kind: "WORK",
        description: "work",
        ticketNumber: null,
        project: {
            id: "p1",
            name: "Gardner",
            color: "#2444e5",
            client: { id: "c1", name: "Gardner Inc.", shortName: "Gardner" },
        },
        ...rest,
    } as ReportEntry;
}

const options = {
    from: new Date(2026, 8, 1),
    to: new Date(2026, 8, 30),
    weekStartsOn: 1 as const,
    dailyTargetMinutes: 450,
};

// Totals, and the split that must add back up to them.
{
    const report = buildReport(
        [
            entry({ minutes: 240, day: "2026-09-07" }),
            entry({ minutes: 120, day: "2026-09-08", unbillablePercent: 50 }),
            entry({
                minutes: 60,
                day: "2026-09-09",
                billingType: "NON_BILLABLE",
            }),
        ],
        options,
    );

    check("every entry is counted", report.entryCount === 3);
    check(
        "tracked is the sum",
        report.trackedMinutes === 420,
        String(report.trackedMinutes),
    );
    check(
        "the split adds back up",
        report.billableMinutes + report.unbillableMinutes ===
            report.trackedMinutes,
        `${report.billableMinutes} + ${report.unbillableMinutes}`,
    );
    check(
        "billable percent is of everything tracked",
        report.billablePercent === 71.4,
        String(report.billablePercent),
    );
}

// Weeks are present even when empty, and land in the right bucket.
{
    const report = buildReport(
        [entry({ minutes: 60, day: "2026-09-09" })],
        options,
    );

    check(
        "every week in the span appears",
        report.weeks.length >= 4,
        `${report.weeks.length}`,
    );
    check(
        "blank weeks are kept",
        report.weeks.some((w) => w.trackedMinutes === 0),
    );

    const busy = report.weeks.filter((w) => w.trackedMinutes > 0);

    check("the entry lands in exactly one week", busy.length === 1);
    check(
        "which is the week it happened in",
        busy[0].weekStart === "2026-09-07",
        busy[0].weekStart,
    );
}

// The target counts working days only.
{
    const oneWeek = buildReport([], {
        ...options,
        from: new Date(2026, 8, 7),
        to: new Date(2026, 8, 13),
    });

    check(
        "a week targets five working days",
        oneWeek.targetMinutes === 5 * 450,
        String(oneWeek.targetMinutes),
    );
}

// Grouping, and the shares that come with it.
{
    const report = buildReport(
        [
            entry({ minutes: 180, day: "2026-09-07" }),
            entry({
                minutes: 60,
                day: "2026-09-08",
                ticketNumber: "14222",
                project: {
                    id: "p2",
                    name: "Millcraft",
                    color: "#60c473",
                    client: {
                        id: "c2",
                        name: "The MillCraft Paper Company, Inc",
                        shortName: "Millcraft",
                    },
                },
            }),
        ],
        options,
    );

    check("clients are grouped", report.clients.length === 2);
    check("and ordered by time", report.clients[0].name === "Gardner");
    check(
        "shares are of the whole",
        report.clients[0].share === 75,
        String(report.clients[0].share),
    );
    check(
        "shares add to a hundred",
        Math.round(report.clients.reduce((s, c) => s + c.share, 0)) === 100,
    );
    check("projects are grouped too", report.projects.length === 2);
    check("only ticketed work becomes a ticket", report.tickets.length === 1);
    check("and it is named by its number", report.tickets[0].name === "#14222");
}

// A client wears the colour of the project it spent the most time in.
{
    const gardner = {
        id: "p1",
        name: "Gardner",
        color: "#003b64",
        client: { id: "c1", name: "Gardner Inc.", shortName: "Gardner" },
    };

    const report = buildReport(
        [
            entry({ minutes: 60, day: "2026-09-07", project: gardner }),
            entry({
                minutes: 300,
                day: "2026-09-08",
                project: {
                    ...gardner,
                    id: "p2",
                    name: "Gardner Support",
                    color: "#60c473",
                },
            }),
        ],
        options,
    );

    const client = report.clients[0];

    check(
        "a client takes a colour",
        client.color === "#60c473",
        String(client.color),
    );
    check(
        "from its biggest project, not its first",
        client.colorKey === "p2",
        String(client.colorKey),
    );
    check(
        "and the colour reaches the ranked list",
        report.clients.every((c) => c.colorKey !== undefined),
    );
    check(
        "a ticket is coloured by its project, not its own key",
        buildReport(
            [entry({ minutes: 60, day: "2026-09-07", ticketNumber: "14222" })],
            options,
        ).tickets[0].colorKey === "p1",
    );
}

// Meetings are counted separately without leaving the total.
{
    const report = buildReport(
        [
            entry({ minutes: 60, day: "2026-09-07" }),
            entry({ minutes: 15, day: "2026-09-07", kind: "MEETING" }),
        ],
        options,
    );

    check("meeting time is tallied", report.meetingMinutes === 15);
    check("and still counts towards the total", report.trackedMinutes === 75);
}

// An empty period is reported, not divided by zero.
{
    const report = buildReport([], options);

    check("an empty period has no tracked time", report.trackedMinutes === 0);
    check("and no billable percentage", report.billablePercent === 0);
    check("and no groups", report.clients.length === 0);
}

console.log(failed ? `\n${failed} FAILED` : "\nthe report arithmetic holds");
process.exit(failed ? 1 : 0);
