import type { TicketEntryRow, TicketSummaryRow } from "@/db/queries/tickets";

import type { AppBuilder } from "../builder";

import type { ProjectRef } from "./project";

export type TicketSummaryModel = TicketSummaryRow;

/**
 * How tracked time stands against the estimate quoted to the client.
 *
 * `NEARING` fires at 80% of the top of the range - late enough not to nag,
 * early enough to renegotiate before the number is blown.
 */
export const NEARING_THRESHOLD = 0.8;

export type EstimateStatus = "NONE" | "OK" | "NEARING" | "OVER";

export function estimateStatus(summary: TicketSummaryRow): EstimateStatus {
    if (!summary.estimate) {
        return "NONE";
    }

    if (summary.trackedMinutes > summary.estimate.maxMinutes) {
        return "OVER";
    }

    if (
        summary.trackedMinutes >=
        summary.estimate.maxMinutes * NEARING_THRESHOLD
    ) {
        return "NEARING";
    }

    return "OK";
}

export function ticketSummaryRef(
    builder: AppBuilder,
    refs: { Project: ProjectRef },
) {
    const EstimateStatusRef = builder.enumType("EstimateStatus", {
        values: {
            NONE: { value: "NONE" },
            OK: { value: "OK" },
            NEARING: { value: "NEARING" },
            OVER: { value: "OVER" },
        } as const,
    });

    /** A single session booked against the ticket. */
    const TicketEntryRef = builder
        .objectRef<TicketEntryRow>("TicketEntry")
        .implement({
            fields: (t) => ({
                id: t.exposeID("id"),
                description: t.exposeString("description"),
                kind: t.exposeString("kind"),
                billingType: t.exposeString("billingType"),
                unbillablePercent: t.exposeInt("unbillablePercent"),
                billedMinutes: t.exposeInt("billedMinutes"),
                billableMinutes: t.exposeInt("billableMinutes"),
                unbillableMinutes: t.exposeInt("unbillableMinutes"),

                startedAt: t.field({
                    type: "DateTime",
                    resolve: (entry) => entry.startedAt,
                }),

                endedAt: t.field({
                    type: "DateTime",
                    nullable: true,
                    resolve: (entry) => entry.endedAt,
                }),
            }),
        });

    const ref = builder
        .objectRef<TicketSummaryModel>("TicketSummary")
        .implement({
            fields: (t) => ({
                ticketNumber: t.exposeString("ticketNumber"),

                project: t.field({
                    type: refs.Project,
                    resolve: (summary) => summary.project,
                }),

                trackedMinutes: t.exposeInt("trackedMinutes"),

                /** The two halves of `trackedMinutes`, which they sum to. */
                billableMinutes: t.exposeInt("billableMinutes"),
                unbillableMinutes: t.exposeInt("unbillableMinutes"),

                entryCount: t.exposeInt("entryCount"),

                entries: t.field({
                    type: [TicketEntryRef],
                    resolve: (summary) => summary.entries,
                }),

                firstTrackedAt: t.field({
                    type: "DateTime",
                    nullable: true,
                    resolve: (summary) => summary.firstTrackedAt,
                }),

                lastTrackedAt: t.field({
                    type: "DateTime",
                    nullable: true,
                    resolve: (summary) => summary.lastTrackedAt,
                }),

                estimateMinMinutes: t.int({
                    nullable: true,
                    resolve: (summary) => summary.estimate?.minMinutes ?? null,
                }),

                estimateMaxMinutes: t.int({
                    nullable: true,
                    resolve: (summary) => summary.estimate?.maxMinutes ?? null,
                }),

                estimateNotes: t.string({
                    nullable: true,
                    resolve: (summary) => summary.estimate?.notes ?? null,
                }),

                /** Minutes left before the top of the estimate; null if none. */
                remainingMinutes: t.int({
                    nullable: true,
                    resolve: (summary) =>
                        summary.estimate
                            ? summary.estimate.maxMinutes -
                              summary.trackedMinutes
                            : null,
                }),

                status: t.field({
                    type: EstimateStatusRef,
                    resolve: (summary) => estimateStatus(summary),
                }),
            }),
        });

    return ref;
}

export type TicketSummaryRef = ReturnType<typeof ticketSummaryRef>;
