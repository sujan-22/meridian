import type { TimesheetWeekRow } from "@/db/queries/timesheet-weeks";

import type { AppBuilder } from "../builder";

/**
 * A week that has no stored row yet still resolves, so the Friday screen never
 * has to special-case "never touched".
 */
export interface TimesheetWeekModel {
    weekStart: string;
    weekEnd: string;
    targetMinutes: number;
    completedAt: Date | null;
}

export function toTimesheetWeekModel(
    weekStart: string,
    weekEnd: string,
    targetMinutes: number,
    row: TimesheetWeekRow | null,
): TimesheetWeekModel {
    return {
        weekStart,
        weekEnd,
        targetMinutes: row?.targetMinutes ?? targetMinutes,
        completedAt: row?.completedAt ?? null,
    };
}

export function timesheetWeekRef(builder: AppBuilder) {
    return builder
        .objectRef<TimesheetWeekModel>("TimesheetWeek")
        .implement({
            fields: (t) => ({
                weekStart: t.field({
                    type: "Date",
                    resolve: (week) => week.weekStart,
                }),

                weekEnd: t.field({
                    type: "Date",
                    resolve: (week) => week.weekEnd,
                }),

                targetMinutes: t.exposeInt("targetMinutes"),

                completedAt: t.field({
                    type: "DateTime",
                    nullable: true,
                    resolve: (week) => week.completedAt,
                }),

                isComplete: t.boolean({
                    resolve: (week) => week.completedAt !== null,
                }),
            }),
        });
}

export type TimesheetWeekRef = ReturnType<typeof timesheetWeekRef>;
