import { GraphQLError } from "graphql";

import {
    autoPromoteFinished,
    dismissCalendarEvent,
    promoteCalendarEvent,
    syncCalendarWindow,
    touchCalendarConnection,
} from "@/db/queries/calendar";
import { findEntryById } from "@/db/queries/time-entries";
import {
    fetchCalendarEvents,
    GoogleCalendarError,
} from "@/lib/google-calendar";
import { CalendarAccessError, googleAccessToken } from "@/lib/google-token";

import type { AppBuilder } from "../builder";
import type { Refs } from "../refs";

export function registerCalendarMutations(builder: AppBuilder, refs: Refs) {
    builder.mutationFields((t) => ({
        /**
         * Pulls a window of the calendar in, then promotes whatever has
         * finished. Called by the week screen; there is no background worker,
         * so opening the week is what makes the calendar current.
         */
        syncCalendar: t.field({
            type: refs.CalendarSyncResult,

            args: {
                from: t.arg({ type: "DateTime", required: true }),
                to: t.arg({ type: "DateTime", required: true }),
            },

            resolve: async (_parent, args, ctx) => {
                if (args.to <= args.from) {
                    throw new GraphQLError("The range ends before it starts.");
                }

                let token: string;

                try {
                    token = await googleAccessToken(ctx.userId);
                } catch (error) {
                    throw new GraphQLError(
                        error instanceof CalendarAccessError
                            ? error.message
                            : "Could not reach Google.",
                    );
                }

                let events;

                try {
                    events = await fetchCalendarEvents(
                        token,
                        args.from,
                        args.to,
                    );
                } catch (error) {
                    throw new GraphQLError(
                        error instanceof GoogleCalendarError
                            ? error.message
                            : "Could not read the calendar.",
                    );
                }

                // First sync is what records the connection, and the date it
                // stamps is what keeps auto-promotion out of past weeks.
                await touchCalendarConnection(ctx.userId);

                const { stored, removed } = await syncCalendarWindow(
                    ctx.userId,
                    args.from,
                    args.to,
                    events,
                );

                const autoPromoted = await autoPromoteFinished(
                    ctx.userId,
                    new Date(),
                );

                return { stored, removed, autoPromoted };
            },
        }),

        /** Turns one meeting into a tracked entry. */
        promoteCalendarEvent: t.field({
            type: refs.TimeEntry,

            args: {
                id: t.arg.id({ required: true }),
                projectId: t.arg.id(),
            },

            resolve: async (_parent, args, ctx) => {
                const result = await promoteCalendarEvent(
                    ctx.userId,
                    String(args.id),
                    args.projectId ? String(args.projectId) : null,
                );

                if ("error" in result) {
                    throw new GraphQLError(result.error);
                }

                const entry = await findEntryById(ctx.userId, result.entryId);

                if (!entry) {
                    throw new GraphQLError("The entry could not be read back.");
                }

                return entry;
            },
        }),

        /** Waves a meeting away; it stays hidden through later syncs. */
        dismissCalendarEvent: t.boolean({
            args: {
                id: t.arg.id({ required: true }),
            },

            resolve: (_parent, args, ctx) =>
                dismissCalendarEvent(ctx.userId, String(args.id)),
        }),

        updateCalendarSettings: t.field({
            type: refs.CalendarStatus,

            args: {
                autoPromote: t.arg.boolean(),
                defaultProjectId: t.arg.id(),
                clearDefaultProject: t.arg.boolean(),
            },

            resolve: async (_parent, args, ctx) => {
                const connection = await touchCalendarConnection(ctx.userId, {
                    ...(args.autoPromote != null && {
                        autoPromote: args.autoPromote,
                    }),

                    ...(args.clearDefaultProject
                        ? { defaultProjectId: null }
                        : args.defaultProjectId != null && {
                              defaultProjectId: String(args.defaultProjectId),
                          }),
                });

                const { hasCalendarScope } = await import("@/lib/google-token");

                return {
                    connected: true,
                    lastSyncedAt: connection.lastSyncedAt,
                    autoPromote: connection.autoPromote,
                    defaultProjectId: connection.defaultProjectId,
                    hasCalendarScope: await hasCalendarScope(ctx.userId),
                };
            },
        }),
    }));
}
