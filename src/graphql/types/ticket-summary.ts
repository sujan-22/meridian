import type { TicketSummaryRow } from "@/db/queries/tickets";

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
                entryCount: t.exposeInt("entryCount"),

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
