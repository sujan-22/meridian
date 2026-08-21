import { eq } from "drizzle-orm";
import { GraphQLError } from "graphql";

import { db } from "@/db";
import { clients, projects } from "@/db/schema";
import { countProjectEntries, findProjectById } from "@/db/queries/projects";

import type { AppBuilder } from "../builder";
import type { Refs } from "../refs";
import type { ProjectModel } from "../types/project";

async function loadOrThrow(id: string): Promise<ProjectModel> {
    const project = await findProjectById(id);

    if (!project) {
        throw new GraphQLError(`No project with id ${id}`);
    }

    return project;
}

/** Postgres unique-violation, surfaced as something a person can act on. */
function rethrowDuplicate(error: unknown, message: string): never {
    if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: string }).code === "23505"
    ) {
        throw new GraphQLError(message);
    }

    throw error;
}

export function registerProjectMutations(builder: AppBuilder, refs: Refs) {
    const CreateClientInput = builder.inputType("CreateClientInput", {
        fields: (t) => ({
            name: t.string({ required: true }),
            shortName: t.string(),
            color: t.string(),
        }),
    });

    const CreateProjectInput = builder.inputType("CreateProjectInput", {
        fields: (t) => ({
            clientId: t.id({ required: true }),
            name: t.string({ required: true }),
            color: t.string(),
            defaultBillingType: t.field({ type: refs.BillingType }),
            polarisTask: t.string(),
        }),
    });

    const UpdateProjectInput = builder.inputType("UpdateProjectInput", {
        fields: (t) => ({
            clientId: t.id(),
            name: t.string(),
            color: t.string(),
            defaultBillingType: t.field({ type: refs.BillingType }),
            polarisTask: t.string(),
            archived: t.boolean(),
        }),
    });

    builder.mutationFields((t) => ({
        createClient: t.field({
            type: refs.Client,

            args: {
                input: t.arg({ type: CreateClientInput, required: true }),
            },

            resolve: async (_parent, { input }) => {
                const name = input.name.trim();

                if (!name) {
                    throw new GraphQLError("A client name is required");
                }

                try {
                    const [created] = await db
                        .insert(clients)
                        .values({
                            name,
                            shortName: input.shortName?.trim() || null,
                            color: input.color?.trim() || null,
                        })
                        .returning();

                    return created;
                } catch (error) {
                    rethrowDuplicate(
                        error,
                        `A client named "${name}" already exists`,
                    );
                }
            },
        }),

        createProject: t.field({
            type: refs.Project,

            args: {
                input: t.arg({ type: CreateProjectInput, required: true }),
            },

            resolve: async (_parent, { input }) => {
                const name = input.name.trim();

                if (!name) {
                    throw new GraphQLError("A project name is required");
                }

                try {
                    const [created] = await db
                        .insert(projects)
                        .values({
                            clientId: String(input.clientId),
                            name,
                            color: input.color?.trim() || null,
                            defaultBillingType:
                                input.defaultBillingType ?? "non_billable",
                            polarisTask: input.polarisTask?.trim() || null,
                        })
                        .returning({ id: projects.id });

                    return loadOrThrow(created.id);
                } catch (error) {
                    rethrowDuplicate(
                        error,
                        `That client already has a project named "${name}"`,
                    );
                }
            },
        }),

        updateProject: t.field({
            type: refs.Project,

            args: {
                id: t.arg.id({ required: true }),
                input: t.arg({ type: UpdateProjectInput, required: true }),
            },

            resolve: async (_parent, args) => {
                const id = String(args.id);
                const { input } = args;

                await loadOrThrow(id);

                try {
                    await db
                        .update(projects)
                        .set({
                            ...(input.clientId != null && {
                                clientId: String(input.clientId),
                            }),

                            ...(input.name != null && {
                                name: input.name.trim(),
                            }),

                            // `null` clears the colour back to the derived one.
                            ...(input.color !== undefined && {
                                color: input.color?.trim() || null,
                            }),

                            ...(input.defaultBillingType != null && {
                                defaultBillingType: input.defaultBillingType,
                            }),

                            ...(input.polarisTask !== undefined && {
                                polarisTask: input.polarisTask?.trim() || null,
                            }),

                            ...(input.archived != null && {
                                archived: input.archived,
                            }),
                        })
                        .where(eq(projects.id, id));
                } catch (error) {
                    rethrowDuplicate(
                        error,
                        "That client already has a project with this name",
                    );
                }

                return loadOrThrow(id);
            },
        }),

        /**
         * Only ever removes a project nothing was tracked against; anything
         * with history should be archived so the entries keep their project.
         */
        deleteProject: t.boolean({
            args: {
                id: t.arg.id({ required: true }),
            },

            resolve: async (_parent, args) => {
                const id = String(args.id);
                const entryCount = await countProjectEntries(id);

                if (entryCount > 0) {
                    throw new GraphQLError(
                        `This project has ${entryCount} time ${
                            entryCount === 1 ? "entry" : "entries"
                        }. Archive it instead so the history is kept.`,
                    );
                }

                const deleted = await db
                    .delete(projects)
                    .where(eq(projects.id, id))
                    .returning({ id: projects.id });

                return deleted.length > 0;
            },
        }),
    }));
}
