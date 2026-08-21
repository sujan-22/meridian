import { inArray } from "drizzle-orm";
import { GraphQLError } from "graphql";

import { db } from "@/db";
import { timeEntries } from "@/db/schema";
import { findEntriesByIds } from "@/db/queries/time-entries";
import {
    findTimesheetWeek,
    upsertTimesheetWeek,
} from "@/db/queries/timesheet-weeks";
import { findPreferences } from "@/db/queries/preferences";

import type { AppBuilder } from "../builder";
import type { Refs } from "../refs";
import { toTimesheetWeekModel } from "../types/timesheet-week";

export function registerTimesheetMutations(builder: AppBuilder, refs: Refs) {
    builder.mutationFields((t) => ({
        /**
         * Ticks entries off as copied into Polaris. Takes a list because a
         * combined row on the timesheet stands for several raw entries.
         */
        markTimeEntriesTransferred: t.field({
            type: [refs.TimeEntry],

            args: {
                ids: t.arg.idList({ required: true }),
                transferred: t.arg.boolean({ required: true }),
            },

            resolve: async (_parent, args) => {
                const ids = args.ids.map(String);

                if (ids.length === 0) {
                    return [];
                }

                await db
                    .update(timeEntries)
                    .set({
                        timesheetEnteredAt: args.transferred
                            ? new Date()
                            : null,
                    })
                    .where(inArray(timeEntries.id, ids));

                return findEntriesByIds(ids);
            },
        }),

        completeTimesheetWeek: t.field({
            type: refs.TimesheetWeek,

            args: {
                weekStart: t.arg({ type: "Date", required: true }),
                weekEnd: t.arg({ type: "Date", required: true }),
            },

            resolve: async (_parent, args) => {
                if (args.weekEnd < args.weekStart) {
                    throw new GraphQLError(
                        "A week cannot end before it starts",
                    );
                }

                const preferences = await findPreferences();

                const row = await upsertTimesheetWeek(
                    args.weekStart,
                    args.weekEnd,
                    {
                        completedAt: new Date(),
                        targetMinutes: preferences.weeklyTargetMinutes,
                    },
                );

                return toTimesheetWeekModel(
                    args.weekStart,
                    args.weekEnd,
                    preferences.weeklyTargetMinutes,
                    row,
                );
            },
        }),

        /** Reopening keeps the row so the week's target is not lost. */
        reopenTimesheetWeek: t.field({
            type: refs.TimesheetWeek,

            args: {
                weekStart: t.arg({ type: "Date", required: true }),
                weekEnd: t.arg({ type: "Date", required: true }),
            },

            resolve: async (_parent, args) => {
                const preferences = await findPreferences();

                await upsertTimesheetWeek(args.weekStart, args.weekEnd, {
                    completedAt: null,
                });

                const row = await findTimesheetWeek(args.weekStart);

                return toTimesheetWeekModel(
                    args.weekStart,
                    args.weekEnd,
                    preferences.weeklyTargetMinutes,
                    row,
                );
            },
        }),
    }));
}
