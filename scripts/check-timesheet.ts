/**
 * Grouping tracked entries into timesheet lines.
 *
 *     pnpm check:timesheet
 */
import { buildTimesheet, type TimesheetEntry } from "../src/lib/timesheet";

let failed = 0;

function check(label: string, ok: boolean, detail = "") {
    if (!ok) failed += 1;
    console.log(
        `${ok ? "  ok  " : "FAIL  "}${label}${detail ? ` - ${detail}` : ""}`,
    );
}

const mirage = {
    id: "p-mirage",
    name: "Mirage",
    polarisTask: "1500 - Ongoing Support",
    polarisMeetingTask: "0200 - Meetings",
    client: { id: "c", name: "Mirage", shortName: "Mirage" },
};

let seq = 0;

function entry(
    over: Partial<TimesheetEntry> & { minutes: number },
): TimesheetEntry {
    const { minutes, ...rest } = over;

    return {
        id: `e${seq++}`,
        description: "work",
        ticketNumber: null,
        kind: "WORK",
        billingType: "BILLABLE",
        startedAt: "2026-09-14T13:00:00",
        endedAt: "2026-09-14T14:00:00",
        timesheetDurationMinutes: minutes,
        unbillablePercent: 0,
        project: mirage,
        ...rest,
    } as TimesheetEntry;
}

const rowsOf = (days: ReturnType<typeof buildTimesheet>) =>
    days.flatMap((d) => d.projects.flatMap((p) => p.rows));

// The real case: one ticket, two different pieces of work.
{
    const days = buildTimesheet(
        [
            entry({
                minutes: 15,
                ticketNumber: "204",
                kind: "MEETING",
                description: "Mirage 204 - Mirage/Microsoft/Evenica meeting",
            }),
            entry({
                minutes: 30,
                ticketNumber: "204",
                description:
                    "Mirage 204 - Meeting with lead to investigate the code",
            }),
        ],
        "combined",
    );

    const rows = rowsOf(days);

    check(
        "different work on one ticket stays on separate lines",
        rows.length === 2,
        `${rows.length} row(s)`,
    );
    check(
        "and each keeps its own hours",
        rows.every((r) => r.billedMinutes === 15 || r.billedMinutes === 30),
        rows.map((r) => r.billedMinutes).join(" / "),
    );
    check(
        "the meeting is still marked as one",
        rows.filter((r) => r.isMeeting).length === 1,
    );
}

// Repeated sessions of the same work still fold together - that is the point
// of combined mode.
{
    const rows = rowsOf(
        buildTimesheet(
            [
                entry({
                    minutes: 15,
                    ticketNumber: "204",
                    description: "Mirage 204 - build the thing",
                }),
                entry({
                    minutes: 45,
                    ticketNumber: "204",
                    description: "Mirage 204 - build the thing",
                }),
            ],
            "combined",
        ),
    );

    check("the same work on one ticket still combines", rows.length === 1);
    check(
        "and its minutes add up",
        rows[0]?.billedMinutes === 60,
        String(rows[0]?.billedMinutes),
    );
    check("with both sessions kept", rows[0]?.entries.length === 2);
}

// Case and stray spacing should not split a line.
{
    const rows = rowsOf(
        buildTimesheet(
            [
                entry({
                    minutes: 15,
                    ticketNumber: "9",
                    description: "Review the PR",
                }),
                entry({
                    minutes: 15,
                    ticketNumber: "9",
                    description: "  review the pr  ",
                }),
            ],
            "combined",
        ),
    );

    check(
        "the same words combine regardless of case or spacing",
        rows.length === 1,
        `${rows.length} row(s)`,
    );
}

// Individual mode is unaffected.
{
    const rows = rowsOf(
        buildTimesheet(
            [
                entry({
                    minutes: 15,
                    ticketNumber: "204",
                    description: "same",
                }),
                entry({
                    minutes: 45,
                    ticketNumber: "204",
                    description: "same",
                }),
            ],
            "individual",
        ),
    );

    check("individual mode still keeps every session apart", rows.length === 2);
}

// A written-off entry still splits into two lines, not four.
{
    const rows = rowsOf(
        buildTimesheet(
            [
                entry({
                    minutes: 60,
                    ticketNumber: "7",
                    description: "half off",
                    unbillablePercent: 50,
                }),
            ],
            "combined",
        ),
    );

    check("a split entry is two lines", rows.length === 2, `${rows.length}`);
    check(
        "one billable and one not",
        new Set(rows.map((r) => r.portion)).size === 2,
    );
}

console.log(failed ? `\n${failed} FAILED` : "\nthe timesheet grouping holds");
process.exit(failed ? 1 : 0);
