/**
 * Fills in the Polaris task mapping from Replicon's own catalogue.
 *
 *     pnpm polaris:tasks <bulk-get-task-details.json>          # show the plan
 *     pnpm polaris:tasks <bulk-get-task-details.json> --write  # apply it
 *
 * The file is the response body of `BulkGetProjectOrTaskDetails`, saved from
 * DevTools. Matching is only ever a suggestion: anything short of a strong
 * match is left alone and reported, because a task mapped to the wrong client
 * bills someone else's project.
 */
import { readFileSync } from "node:fs";

import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const [file] = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
const write = process.argv.includes("--write");

async function main() {
    if (!file) {
        throw new Error("Usage: pnpm polaris:tasks <response.json> [--write]");
    }

    const { eq, and } = await import("drizzle-orm");
    const { db } = await import("../src/db");
    const { clients, projects } = await import("../src/db/schema");
    const { parseRepliconTasks, matchTasks } =
        await import("../src/lib/replicon-tasks");

    const tasks = parseRepliconTasks(JSON.parse(readFileSync(file, "utf8")));

    if (tasks.length === 0) {
        throw new Error(
            "No tasks found in that file. Save the whole response body, including the `d` wrapper.",
        );
    }

    console.log(`\n  ${tasks.length} tasks in the catalogue:\n`);

    for (const task of tasks) {
        console.log(
            `    ${task.id.padEnd(7)} ${task.label.slice(0, 34).padEnd(36)} ${task.clientName ?? "—"}`,
        );
    }

    const owned = await db
        .select({
            id: projects.id,
            name: projects.name,
            clientName: clients.name,
            polarisTaskId: projects.polarisTaskId,
            polarisMeetingTaskId: projects.polarisMeetingTaskId,
        })
        .from(projects)
        .innerJoin(clients, eq(clients.id, projects.clientId))
        .where(eq(projects.archived, false));

    console.log("\n  proposed mapping:\n");

    const updates: Array<{
        id: string;
        label: string;
        work?: string;
        meeting?: string;
    }> = [];

    for (const project of owned) {
        const match = matchTasks(project, tasks);
        const label = `${project.clientName} / ${project.name}`;
        const pad = " ".repeat(46);

        if (!match.work && !match.meeting) {
            const options = [...match.ambiguousWork, ...match.ambiguousMeeting];

            console.log(
                `    ${label.slice(0, 44).padEnd(46)} ${
                    options.length
                        ? `${options.length} candidates, none decisive`
                        : "no task for this client"
                }`,
            );

            for (const option of options) {
                console.log(`    ${pad}   ? ${option.id} ${option.label}`);
            }

            continue;
        }

        console.log(
            `    ${label.slice(0, 44).padEnd(46)} work: ${
                match.work
                    ? `${match.work.id} ${match.work.label.slice(0, 26)}`
                    : "—"
            }`,
        );

        if (match.meeting) {
            console.log(
                `    ${pad} meet: ${match.meeting.id} ${match.meeting.label.slice(0, 26)}`,
            );
        }

        for (const option of [
            ...match.ambiguousWork,
            ...match.ambiguousMeeting,
        ]) {
            console.log(`    ${pad}   ? ${option.id} ${option.label}`);
        }

        updates.push({
            id: project.id,
            label,
            work: match.work?.id,
            meeting: match.meeting?.id,
        });
    }

    if (!write) {
        console.log(
            `\n  ${updates.length} project(s) would be updated. Re-run with --write to apply.`,
        );
        process.exit(0);
    }

    for (const update of updates) {
        await db
            .update(projects)
            .set({
                ...(update.work ? { polarisTaskId: update.work } : {}),
                ...(update.meeting
                    ? { polarisMeetingTaskId: update.meeting }
                    : {}),
            })
            .where(and(eq(projects.id, update.id)));
    }

    console.log(`\n  Updated ${updates.length} project(s).`);
    process.exit(0);
}

main().catch((error) => {
    console.error(`\n${error instanceof Error ? error.message : error}`);
    process.exit(1);
});
