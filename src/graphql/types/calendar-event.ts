import type { CalendarEventRow } from "@/db/queries/calendar";

import type { AppBuilder } from "../builder";

/** A meeting sitting in the second lane, waiting to become an entry. */
export function calendarEventRef(builder: AppBuilder) {
    return builder.objectRef<CalendarEventRow>("CalendarEvent").implement({
        fields: (t) => ({
            id: t.exposeID("id"),
            title: t.exposeString("title"),

            startsAt: t.field({
                type: "DateTime",
                resolve: (event) => event.startsAt,
            }),

            endsAt: t.field({
                type: "DateTime",
                resolve: (event) => event.endsAt,
            }),

            /** Already a tracked entry; the lane stops drawing it. */
            isPromoted: t.boolean({
                resolve: (event) => event.promotedEntryId !== null,
            }),
        }),
    });
}

export interface CalendarStatusModel {
    connected: boolean;
    lastSyncedAt: Date | null;
    autoPromote: boolean;
    defaultProjectId: string | null;
    /** False when the Google grant does not cover the calendar. */
    hasCalendarScope: boolean;
}

export function calendarStatusRef(builder: AppBuilder) {
    return builder.objectRef<CalendarStatusModel>("CalendarStatus").implement({
        fields: (t) => ({
            connected: t.exposeBoolean("connected"),
            autoPromote: t.exposeBoolean("autoPromote"),
            hasCalendarScope: t.exposeBoolean("hasCalendarScope"),

            defaultProjectId: t.exposeID("defaultProjectId", {
                nullable: true,
            }),

            lastSyncedAt: t.field({
                type: "DateTime",
                nullable: true,
                resolve: (status) => status.lastSyncedAt,
            }),
        }),
    });
}

export interface CalendarSyncResultModel {
    stored: number;
    removed: number;
    autoPromoted: number;
}

export function calendarSyncResultRef(builder: AppBuilder) {
    return builder
        .objectRef<CalendarSyncResultModel>("CalendarSyncResult")
        .implement({
            fields: (t) => ({
                stored: t.exposeInt("stored"),
                removed: t.exposeInt("removed"),
                autoPromoted: t.exposeInt("autoPromoted"),
            }),
        });
}
