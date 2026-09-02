import { GraphQLError } from "graphql";

import {
    findCalendarConnection,
    findCalendarEvents,
} from "@/db/queries/calendar";

import type { AppBuilder } from "../builder";
import type { Refs } from "../refs";
import { hasGoogleAccount } from "@/lib/google-token";

export function registerCalendarQueries(builder: AppBuilder, refs: Refs) {
    builder.queryFields((t) => ({
        calendarEvents: t.field({
            type: [refs.CalendarEvent],

            args: {
                from: t.arg({ type: "DateTime", required: true }),
                to: t.arg({ type: "DateTime", required: true }),
            },

            resolve: async (_parent, args, ctx) => {
                if (args.to < args.from) {
                    throw new GraphQLError("The range ends before it starts.");
                }

                return findCalendarEvents(ctx.userId, args.from, args.to);
            },
        }),

        calendarStatus: t.field({
            type: refs.CalendarStatus,

            resolve: async (_parent, _args, ctx) => {
                const connection = await findCalendarConnection(ctx.userId);

                return {
                    connected: connection !== null,
                    lastSyncedAt: connection?.lastSyncedAt ?? null,
                    autoPromote: connection?.autoPromote ?? true,
                    defaultProjectId: connection?.defaultProjectId ?? null,
                    googleLinked: await hasGoogleAccount(ctx.userId),
                    needsReconnect: connection?.reauthRequiredAt != null,
                };
            },
        }),
    }));
}
