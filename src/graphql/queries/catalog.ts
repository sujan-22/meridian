import { asc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { clients, projects } from "@/db/schema";
import { findPreferences } from "@/db/queries/preferences";
import { findProjectSummaries } from "@/db/queries/projects";
import { findTicketSummaries } from "@/db/queries/tickets";
import { findTimesheetWeek } from "@/db/queries/timesheet-weeks";
import { toTimesheetWeekModel } from "../types/timesheet-week";

import type { AppBuilder } from "../builder";
import type { Refs } from "../refs";

export function registerCatalogQueries(builder: AppBuilder, refs: Refs) {
    builder.queryFields((t) => ({
        health: t.string({
            resolve: async () => {
                await db.execute(sql`select 1`);

                return "ok";
            },
        }),

        preferences: t.field({
            type: refs.Preferences,

            resolve: () => findPreferences(),
        }),

        /** Every ticket with tracked time, and how it sits against estimate. */
        ticketSummaries: t.field({
            type: [refs.TicketSummary],

            resolve: () => findTicketSummaries(),
        }),

        timesheetWeek: t.field({
            type: refs.TimesheetWeek,

            args: {
                weekStart: t.arg({ type: "Date", required: true }),
                weekEnd: t.arg({ type: "Date", required: true }),
            },

            resolve: async (_parent, args) => {
                const [row, preferences] = await Promise.all([
                    findTimesheetWeek(args.weekStart),
                    findPreferences(),
                ]);

                return toTimesheetWeekModel(
                    args.weekStart,
                    args.weekEnd,
                    preferences.weeklyTargetMinutes,
                    row,
                );
            },
        }),

        clients: t.field({
            type: [refs.Client],

            args: {
                includeArchived: t.arg.boolean({
                    defaultValue: false,
                }),
            },

            resolve: async (_parent, args) => {
                return db
                    .select()
                    .from(clients)
                    .where(
                        args.includeArchived
                            ? undefined
                            : eq(clients.archived, false),
                    )
                    .orderBy(asc(clients.name));
            },
        }),

        projects: t.field({
            type: [refs.Project],

            args: {
                includeArchived: t.arg.boolean({
                    defaultValue: false,
                }),
            },

            resolve: async (_parent, args) => {
                const rows = await db
                    .select({
                        project: projects,
                        client: clients,
                    })
                    .from(projects)
                    .innerJoin(clients, eq(projects.clientId, clients.id))
                    .where(
                        args.includeArchived
                            ? undefined
                            : eq(projects.archived, false),
                    )
                    .orderBy(asc(clients.name), asc(projects.name));

                return rows.map(({ project, client }) => ({
                    ...project,
                    client,
                }));
            },
        }),

        /** Projects with their tracked totals, for the projects screen. */
        projectSummaries: t.field({
            type: [refs.ProjectSummary],

            args: {
                includeArchived: t.arg.boolean({
                    defaultValue: false,
                }),
            },

            resolve: (_parent, args) =>
                findProjectSummaries(args.includeArchived ?? false),
        }),
    }));
}
