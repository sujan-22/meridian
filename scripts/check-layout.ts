/**
 * Placing blocks on a day column.
 *
 *     pnpm check:layout
 *
 * Pure functions only - no database, no browser.
 */
import { layoutDay } from "../src/lib/calendar-layout";

let failed = 0;

function check(label: string, ok: boolean, detail = "") {
    if (!ok) failed += 1;
    console.log(
        `${ok ? "  ok  " : "FAIL  "}${label}${detail ? ` - ${detail}` : ""}`,
    );
}

const at = (id: string, startMinute: number, endMinute: number) => ({
    id,
    startMinute,
    endMinute,
});

// Blocks that never overlap each take the whole column.
{
    const laid = layoutDay([at("a", 540, 600), at("b", 660, 720)]);

    check(
        "separate blocks are full width",
        laid.every((b) => b.width === 1),
    );
    check("and each is its own cluster", laid[0].cluster !== laid[1].cluster);
}

// Tuesday's real shape: four entries that transitively overlap.
{
    const laid = layoutDay([
        at("work-1", 540, 600),
        at("synch", 570, 630),
        at("csbn", 600, 615),
        at("work-2", 615, 720),
    ]);

    check(
        "a transitive run is one cluster",
        new Set(laid.map((b) => b.cluster)).size === 1,
    );
    check(
        "two columns are enough for it",
        laid.every((b) => b.width === 0.5),
        String(laid[0].width),
    );
    check(
        "the cluster spans the whole run",
        laid[0].clusterStart === 540 && laid[0].clusterEnd === 720,
        `${laid[0].clusterStart}-${laid[0].clusterEnd}`,
    );
    check(
        "blocks that can share a column do",
        laid.filter((b) => b.left === 0).length === 3,
        `${laid.filter((b) => b.left === 0).length} in the first column`,
    );
}

// A block shorter than the minimum still reserves readable height, and that
// reservation is what decides whether the next block can share its column.
{
    const laid = layoutDay([at("tiny", 540, 545), at("next", 550, 600)]);

    check(
        "a very short block pushes the next one aside",
        laid.every((b) => b.width === 0.5),
        String(laid[1].width),
    );
}

// Cluster boundaries are what a caller needs to reason about a group.
{
    const laid = layoutDay([
        at("morning", 540, 600),
        at("afternoon-1", 840, 900),
        at("afternoon-2", 870, 930),
    ]);

    const morning = laid.find((b) => b.item.id === "morning")!;
    const afternoon = laid.find((b) => b.item.id === "afternoon-1")!;

    check(
        "an untouched block reports its own span",
        morning.clusterStart === 540 && morning.clusterEnd === 600,
    );
    check(
        "an overlapping pair reports the union",
        afternoon.clusterStart === 840 && afternoon.clusterEnd === 930,
        `${afternoon.clusterStart}-${afternoon.clusterEnd}`,
    );
    check(
        "clusters are numbered in order",
        morning.cluster === 0 && afternoon.cluster === 1,
    );
}

console.log(failed ? `\n${failed} FAILED` : "\nthe day layout holds");
process.exit(failed ? 1 : 0);
