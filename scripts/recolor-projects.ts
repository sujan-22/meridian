/**
 * Re-colours every project from the current palette.
 *
 *     pnpm recolor            # show what would change
 *     pnpm recolor --write    # apply it
 *
 * Colours set before the palette was reworked are a mix of muted web colours,
 * several of them duplicated across projects. This walks projects from
 * most-tracked to least and hands out palette colours in order, so the ones
 * seen every day are the furthest apart, and no two projects belonging to the
 * same client ever match.
 */
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const write = process.argv.includes("--write");

async function main() {
    const { desc, eq, sql } = await import("drizzle-orm");
    const { db } = await import("../src/db");
    const { clients, projects, timeEntries } = await import("../src/db/schema");
    const { PROJECT_COLOR_PALETTE } = await import("../src/lib/project-color");

    const rows = await db
        .select({
            id: projects.id,
            name: projects.name,
            color: projects.color,
            clientId: projects.clientId,
            clientName: clients.shortName,
            entries: sql<number>`count(${timeEntries.id})::int`,
        })
        .from(projects)
        .innerJoin(clients, eq(clients.id, projects.clientId))
        .leftJoin(timeEntries, eq(timeEntries.projectId, projects.id))
        .groupBy(projects.id, clients.shortName)
        .orderBy(desc(sql`count(${timeEntries.id})`));

    const usedByClient = new Map<string, Set<string>>();
    const planned: Array<{
        id: string;
        name: string;
        from: string | null;
        to: string;
    }> = [];

    rows.forEach((row, index) => {
        const taken = usedByClient.get(row.clientId) ?? new Set<string>();

        // Start where the running order says, then step forward until the
        // colour is free for this client.
        let color = PROJECT_COLOR_PALETTE[index % PROJECT_COLOR_PALETTE.length];

        for (let step = 0; step < PROJECT_COLOR_PALETTE.length; step += 1) {
            const candidate =
                PROJECT_COLOR_PALETTE[
                    (index + step) % PROJECT_COLOR_PALETTE.length
                ];

            if (!taken.has(candidate.value)) {
                color = candidate;

                break;
            }
        }

        taken.add(color.value);
        usedByClient.set(row.clientId, taken);

        planned.push({
            id: row.id,
            name: `${row.clientName} / ${row.name}`,
            from: row.color,
            to: color.value,
        });
    });

    for (const change of planned) {
        console.log(
            `  ${change.name.padEnd(42).slice(0, 42)} ${change.from ?? "(none)"} -> ${change.to}`,
        );
    }

    if (!write) {
        console.log(
            `\n${planned.length} projects. Re-run with --write to apply.`,
        );
        process.exit(0);
    }

    await db.transaction(async (tx) => {
        for (const change of planned) {
            await tx
                .update(projects)
                .set({ color: change.to })
                .where(eq(projects.id, change.id));
        }
    });

    console.log(`\nRecoloured ${planned.length} projects.`);
    process.exit(0);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
