import type { TimeEntryWithProject } from "@/db/queries/time-entries";
import {
    entryBilledMinutes,
    entryDurationSeconds,
    splitBillableMinutes,
} from "@/lib/duration";

import type { AppBuilder } from "../builder";

import type { BillingTypeRef } from "./billing-type";
import type { EntryKindRef } from "./entry-kind";
import type { ProjectRef } from "./project";

export type TimeEntryModel = TimeEntryWithProject;

export function timeEntryRef(
    builder: AppBuilder,
    refs: {
        BillingType: BillingTypeRef;
        EntryKind: EntryKindRef;
        Project: ProjectRef;
    },
) {
    return builder.objectRef<TimeEntryModel>("TimeEntry").implement({
        fields: (t) => ({
            id: t.exposeID("id"),

            description: t.exposeString("description"),

            ticketNumber: t.exposeString("ticketNumber", {
                nullable: true,
            }),

            billingType: t.field({
                type: refs.BillingType,
                resolve: (entry) => entry.billingType,
            }),

            kind: t.field({
                type: refs.EntryKind,
                resolve: (entry) => entry.kind,
            }),

            /** Share of a billable entry written off, 0-100. */
            unbillablePercent: t.exposeInt("unbillablePercent"),

            startedAt: t.field({
                type: "DateTime",
                resolve: (entry) => entry.startedAt,
            }),

            endedAt: t.field({
                type: "DateTime",
                nullable: true,
                resolve: (entry) => entry.endedAt,
            }),

            /**
             * Null while the timer is running - clients derive the live value
             * from `startedAt` so the display keeps ticking without polling.
             */
            durationSeconds: t.int({
                nullable: true,
                resolve: (entry) => entry.durationSeconds,
            }),

            /** Seconds tracked so far, including a still-running timer. */
            elapsedSeconds: t.int({
                resolve: (entry) => entryDurationSeconds(entry),
            }),

            isRunning: t.boolean({
                resolve: (entry) => entry.endedAt === null,
            }),

            timesheetDurationMinutes: t.int({
                nullable: true,
                resolve: (entry) => entry.timesheetDurationMinutes,
            }),

            /**
             * The quarter-hour figure the whole app reports in - stored once
             * the entry stops, rounded live while it is still running.
             */
            billedMinutes: t.int({
                resolve: (entry) => entryBilledMinutes(entry),
            }),

            timesheetEnteredAt: t.field({
                type: "DateTime",
                nullable: true,
                resolve: (entry) => entry.timesheetEnteredAt,
            }),

            nonBillableEnteredAt: t.field({
                type: "DateTime",
                nullable: true,
                resolve: (entry) => entry.nonBillableEnteredAt,
            }),

            /** Quarter-aligned halves that add back up to `billedMinutes`. */
            billableMinutes: t.int({
                resolve: (entry) =>
                    splitBillableMinutes(
                        entryBilledMinutes(entry),
                        entry.unbillablePercent,
                        entry.billingType === "billable",
                    ).billableMinutes,
            }),

            unbillableMinutes: t.int({
                resolve: (entry) =>
                    splitBillableMinutes(
                        entryBilledMinutes(entry),
                        entry.unbillablePercent,
                        entry.billingType === "billable",
                    ).unbillableMinutes,
            }),

            project: t.field({
                type: refs.Project,
                resolve: (entry) => entry.project,
            }),
        }),
    });
}

export type TimeEntryRef = ReturnType<typeof timeEntryRef>;
