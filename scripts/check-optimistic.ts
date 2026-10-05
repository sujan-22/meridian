/**
 * The entry we show before the server has agreed to it.
 *
 *     pnpm check:optimistic
 *
 * Every derived field matters: if the guess is wrong the week's totals flicker
 * to one number and back to another, which is worse than waiting.
 */
import { optimisticEntry } from "../src/lib/optimistic-entry";
import type { TimeEntryFieldsFragment } from "../src/gql/graphql";

let failed = 0;

function check(label: string, ok: boolean, detail = "") {
    if (!ok) failed += 1;
    console.log(
        `${ok ? "  ok  " : "FAIL  "}${label}${detail ? ` - ${detail}` : ""}`,
    );
}

const base = {
    id: "e1",
    description: "Gardner 14222 - build",
    ticketNumber: "14222",
    billingType: "BILLABLE",
    kind: "WORK",
    unbillablePercent: 0,
    startedAt: "2026-09-21T13:00:00.000Z",
    endedAt: "2026-09-21T14:00:00.000Z",
    durationSeconds: 3600,
    elapsedSeconds: 3600,
    isRunning: false,
    timesheetDurationMinutes: 60,
    billedMinutes: 60,
    billableMinutes: 60,
    unbillableMinutes: 0,
    timesheetEnteredAt: null,
    nonBillableEnteredAt: null,
    project: {
        id: "p1",
        name: "Gardner",
        color: "#2444e5",
        defaultBillingType: "BILLABLE",
        polarisTask: "1500 - Ongoing Support",
        polarisMeetingTask: "0220 - Scrum Meetings",
        client: { id: "c1", name: "Gardner Inc.", shortName: "Gardner" },
    },
} as unknown as TimeEntryFieldsFragment;

// Dragging an hour-long entry to a new time keeps its length.
{
    const moved = optimisticEntry(base, {
        startedAt: "2026-09-21T15:00:00.000Z",
        endedAt: "2026-09-21T16:00:00.000Z",
    });

    check("a move keeps the duration", moved.durationSeconds === 3600);
    check("and the billed minutes", moved.billedMinutes === 60);
    check(
        "and lands where it was dropped",
        moved.startedAt === "2026-09-21T15:00:00.000Z",
    );
    check(
        "leaving everything else alone",
        moved.description === base.description,
    );
}

// Resizing recomputes duration and the quarter-hour figure together.
{
    const longer = optimisticEntry(base, {
        endedAt: "2026-09-21T15:45:00.000Z",
    });

    check(
        "a resize recomputes the duration",
        longer.durationSeconds === 9900,
        String(longer.durationSeconds),
    );
    check(
        "and rounds to the quarter hour",
        longer.timesheetDurationMinutes === 165,
        String(longer.timesheetDurationMinutes),
    );
    check(
        "and the billable split follows",
        longer.billableMinutes === 165,
        String(longer.billableMinutes),
    );
}

// A write-off splits the time without inventing or losing any.
{
    const split = optimisticEntry(base, { unbillablePercent: 25 });

    check(
        "a write-off splits the hour",
        split.billableMinutes + split.unbillableMinutes === split.billedMinutes,
        `${split.billableMinutes} + ${split.unbillableMinutes} vs ${split.billedMinutes}`,
    );
    check(
        "on a quarter boundary",
        split.unbillableMinutes % 15 === 0,
        String(split.unbillableMinutes),
    );
}

// Non-billable work is never shown as billable, even for a moment.
{
    const off = optimisticEntry(base, { billingType: "NON_BILLABLE" });

    check("non-billable has no billable minutes", off.billableMinutes === 0);
    check(
        "and all of it unbillable",
        off.unbillableMinutes === 60,
        String(off.unbillableMinutes),
    );
}

// Moving an entry to another project takes its colour and client along, and
// keeps the fields the picker does not carry.
{
    const moved = optimisticEntry(
        base,
        { projectId: "p2" },
        {
            id: "p2",
            name: "Millcraft",
            color: "#60c473",
            client: { id: "c2", name: "The MillCraft Paper Company, Inc" },
        },
    );

    check("the new project is used", moved.project.id === "p2");
    check("with its colour", moved.project.color === "#60c473");
    check(
        "and its client",
        moved.project.client.name.startsWith("The MillCraft"),
    );
    check(
        "a field the picker omits is kept",
        moved.project.polarisTask === "1500 - Ongoing Support",
        String(moved.project.polarisTask),
    );
    check(
        "and a client field it omits too",
        moved.project.client.shortName === "Gardner",
    );
}

// An entry with no end is still running, and claims no time yet.
{
    const running = optimisticEntry(base, { endedAt: null });

    check("an open entry is running", running.isRunning === true);
    check(
        "and books nothing yet",
        running.billedMinutes === 0,
        String(running.billedMinutes),
    );
    check("with no duration", running.durationSeconds === null);
}

// An empty patch changes nothing.
{
    const same = optimisticEntry(base, {});

    check(
        "an empty change is a no-op",
        same.startedAt === base.startedAt &&
            same.billedMinutes === base.billedMinutes &&
            same.project.id === base.project.id,
    );
}

console.log(failed ? `\n${failed} FAILED` : "\nthe optimistic entry holds");
process.exit(failed ? 1 : 0);
