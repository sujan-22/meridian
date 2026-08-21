import { and, asc, eq, gte, lte } from "drizzle-orm";
import { GraphQLError } from "graphql";

import { db } from "@/db";
import { clients, projects, timeEntries } from "@/db/schema";
import { toQuarterMinutes } from "@/lib/duration";
import { detectKind, detectTicketNumber } from "@/lib/parse-entry";
import { clientNameFromProject } from "@/lib/toggl-import";
import { PROJECT_COLOR_PALETTE } from "@/lib/project-color";

import type { AppBuilder } from "../builder";
import type { Refs } from "../refs";

const MAX_ROWS = 20_000;

/**
 * Identifies an entry by what it is rather than by an id, so importing the
 * same export twice does not duplicate anything.
 */
function naturalKey(
    projectId: string,
    startedAt: Date,
    endedAt: Date,
    description: string,
): string {
    return [
        projectId,
        startedAt.toISOString(),
        endedAt.toISOString(),
        description.trim().toLowerCase(),
    ].join("|");
}

export function registerImportMutations(builder: AppBuilder, refs: Refs) {
    const ImportTimeEntryInput = builder.inputType("ImportTimeEntryInput", {
        fields: (t) => ({
            projectName: t.string({ required: true }),
            description: t.string({ required: true }),
            billable: t.boolean({ required: true }),
            startedAt: t.field({ type: "DateTime", required: true }),
            endedAt: t.field({ type: "DateTime", required: true }),
        }),
    });

    const ImportResultRef = builder
        .objectRef<{
            imported: number;
            duplicatesSkipped: number;
            unmatchedRows: number;
            projectsCreated: string[];
            clientsCreated: string[];
        }>("ImportResult")
        .implement({
            fields: (t) => ({
                imported: t.exposeInt("imported"),
                duplicatesSkipped: t.exposeInt("duplicatesSkipped"),
                unmatchedRows: t.exposeInt("unmatchedRows"),
                projectsCreated: t.exposeStringList("projectsCreated"),
                clientsCreated: t.exposeStringList("clientsCreated"),
            }),
        });

    builder.mutationFields((t) => ({
        importTimeEntries: t.field({
            type: ImportResultRef,

            args: {
                rows: t.arg({
                    type: [ImportTimeEntryInput],
                    required: true,
                }),
                createMissingProjects: t.arg.boolean({ defaultValue: true }),
            },

            resolve: async (_parent, args) => {
                const rows = args.rows;

                if (rows.length === 0) {
                    throw new GraphQLError("There is nothing to import.");
                }

                if (rows.length > MAX_ROWS) {
                    throw new GraphQLError(
                        `That is ${rows.length} rows; the limit is ${MAX_ROWS}.`,
                    );
                }

                const existingProjects = await db
                    .select({ project: projects, client: clients })
                    .from(projects)
                    .innerJoin(clients, eq(projects.clientId, clients.id));

                const projectByName = new Map(
                    existingProjects.map(({ project }) => [
                        project.name.trim().toLowerCase(),
                        project,
                    ]),
                );

                const existingClients = await db.select().from(clients);

                // Toggl project names carry the short name ("Gardner"), while
                // the client is stored in full ("Gardner Inc."), so both have
                // to be matchable or the import invents a duplicate client.
                const clientByName = new Map<
                    string,
                    (typeof existingClients)[number]
                >();

                for (const client of existingClients) {
                    clientByName.set(client.name.trim().toLowerCase(), client);

                    const shortName = client.shortName?.trim().toLowerCase();

                    if (shortName && !clientByName.has(shortName)) {
                        clientByName.set(shortName, client);
                    }
                }

                const projectsCreated: string[] = [];
                const clientsCreated: string[] = [];

                // Create anything the file references but the app does not
                // know about yet, so a whole year imports in one pass.
                if (args.createMissingProjects) {
                    const wanted = [
                        ...new Set(
                            rows
                                .map((row) => row.projectName.trim())
                                .filter(Boolean),
                        ),
                    ];

                    for (const name of wanted) {
                        if (projectByName.has(name.toLowerCase())) {
                            continue;
                        }

                        const clientName = clientNameFromProject(name);
                        let client = clientByName.get(
                            clientName.toLowerCase(),
                        );

                        if (!client) {
                            const [created] = await db
                                .insert(clients)
                                .values({
                                    name: clientName,
                                    shortName: clientName,
                                })
                                .returning();

                            client = created;
                            clientByName.set(clientName.toLowerCase(), created);
                            clientsCreated.push(clientName);
                        }

                        const color =
                            PROJECT_COLOR_PALETTE[
                                projectsCreated.length %
                                    PROJECT_COLOR_PALETTE.length
                            ].value;

                        const [createdProject] = await db
                            .insert(projects)
                            .values({
                                clientId: client.id,
                                name,
                                color,
                            })
                            .returning();

                        projectByName.set(name.toLowerCase(), createdProject);
                        projectsCreated.push(name);
                    }
                }

                // Only the span the file covers needs checking for duplicates.
                const times = rows.map((row) => row.startedAt.getTime());
                const from = new Date(Math.min(...times));
                const to = new Date(Math.max(...times));

                const existingEntries = await db
                    .select({
                        projectId: timeEntries.projectId,
                        startedAt: timeEntries.startedAt,
                        endedAt: timeEntries.endedAt,
                        description: timeEntries.description,
                    })
                    .from(timeEntries)
                    .where(
                        and(
                            gte(timeEntries.startedAt, from),
                            lte(timeEntries.startedAt, to),
                        ),
                    )
                    .orderBy(asc(timeEntries.startedAt));

                // Counted rather than a plain set: a day can legitimately hold
                // two identical sessions, and the second should still import.
                const seen = new Map<string, number>();

                for (const entry of existingEntries) {
                    if (!entry.endedAt) {
                        continue;
                    }

                    const key = naturalKey(
                        entry.projectId,
                        entry.startedAt,
                        entry.endedAt,
                        entry.description,
                    );

                    seen.set(key, (seen.get(key) ?? 0) + 1);
                }

                const pending: Array<typeof timeEntries.$inferInsert> = [];

                let duplicatesSkipped = 0;
                let unmatchedRows = 0;

                for (const row of rows) {
                    const project = projectByName.get(
                        row.projectName.trim().toLowerCase(),
                    );

                    if (!project) {
                        unmatchedRows += 1;

                        continue;
                    }

                    const key = naturalKey(
                        project.id,
                        row.startedAt,
                        row.endedAt,
                        row.description,
                    );

                    const remaining = seen.get(key) ?? 0;

                    if (remaining > 0) {
                        seen.set(key, remaining - 1);
                        duplicatesSkipped += 1;

                        continue;
                    }

                    const description = row.description.trim();
                    const ticketNumber = detectTicketNumber(description);

                    const durationSeconds = Math.max(
                        0,
                        Math.round(
                            (row.endedAt.getTime() - row.startedAt.getTime()) /
                                1000,
                        ),
                    );

                    pending.push({
                        projectId: project.id,
                        description,
                        ticketNumber,
                        // The export marks everything non-billable, so the
                        // project's own default is the better signal.
                        billingType: row.billable
                            ? "billable"
                            : project.defaultBillingType,
                        kind:
                            detectKind(description, ticketNumber) === "MEETING"
                                ? "meeting"
                                : "work",
                        startedAt: row.startedAt,
                        endedAt: row.endedAt,
                        durationSeconds,
                        timesheetDurationMinutes:
                            toQuarterMinutes(durationSeconds),
                    });
                }

                // Postgres caps bound parameters per statement, so insert in
                // chunks rather than one enormous VALUES list.
                for (let index = 0; index < pending.length; index += 500) {
                    await db
                        .insert(timeEntries)
                        .values(pending.slice(index, index + 500));
                }

                return {
                    imported: pending.length,
                    duplicatesSkipped,
                    unmatchedRows,
                    projectsCreated,
                    clientsCreated,
                };
            },
        }),
    }));

    return { ImportResultRef, refs };
}
