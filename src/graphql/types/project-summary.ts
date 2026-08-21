import type { ProjectSummaryRow } from "@/db/queries/projects";

import type { AppBuilder } from "../builder";

import type { ProjectRef } from "./project";

export type ProjectSummaryModel = ProjectSummaryRow;

/**
 * A project plus its tracked totals.
 *
 * Kept separate from `Project` so that the aggregates are only ever paid for
 * where they are asked for - `TimeEntry.project` stays a plain lookup.
 */
export function projectSummaryRef(
    builder: AppBuilder,
    refs: { Project: ProjectRef },
) {
    return builder
        .objectRef<ProjectSummaryModel>("ProjectSummary")
        .implement({
            fields: (t) => ({
                project: t.field({
                    type: refs.Project,
                    resolve: (summary) => summary.project,
                }),

                /** Quarter-hour minutes tracked against the project. */
                totalMinutes: t.exposeInt("totalMinutes"),

                entryCount: t.exposeInt("entryCount"),

                lastTrackedAt: t.field({
                    type: "DateTime",
                    nullable: true,
                    resolve: (summary) => summary.lastTrackedAt,
                }),
            }),
        });
}

export type ProjectSummaryRef = ReturnType<typeof projectSummaryRef>;
