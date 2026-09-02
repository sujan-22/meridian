import {
    findDescriptionSuggestions,
    findEntriesBetween,
    findRecentEntries,
    findRunningEntry,
} from "@/db/queries/time-entries";

import type { AppBuilder } from "../builder";
import type { Refs } from "../refs";

export function registerTimeEntryQueries(builder: AppBuilder, refs: Refs) {
    builder.queryFields((t) => ({
        /** The one entry that has been started but not stopped, if any. */
        activeTimer: t.field({
            type: refs.TimeEntry,
            nullable: true,

            resolve: (_parent, _args, ctx) => findRunningEntry(ctx.userId),
        }),

        /**
         * Entries started within an instant range. Day and week boundaries are
         * resolved by the client so the server never guesses a timezone.
         */
        entries: t.field({
            type: [refs.TimeEntry],

            args: {
                from: t.arg({ type: "DateTime", required: true }),
                to: t.arg({ type: "DateTime", required: true }),
            },

            resolve: (_parent, args, ctx) =>
                findEntriesBetween(ctx.userId, args.from, args.to),
        }),

        /** Distinct recent work, for resuming something without retyping it. */
        recentEntries: t.field({
            type: [refs.TimeEntry],

            args: {
                limit: t.arg.int({ defaultValue: 6 }),
            },

            resolve: (_parent, args, ctx) =>
                findRecentEntries(ctx.userId, args.limit ?? 6),
        }),

        /** Past descriptions matching what is currently being typed. */
        descriptionSuggestions: t.field({
            type: [refs.TimeEntry],

            args: {
                query: t.arg.string({ required: true }),
                limit: t.arg.int({ defaultValue: 5 }),
            },

            resolve: (_parent, args, ctx) =>
                findDescriptionSuggestions(ctx.userId, args.query, args.limit ?? 5),
        }),
    }));
}
