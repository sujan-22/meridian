import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { timesheetWeeks } from "@/db/schema";

export type TimesheetWeekRow = typeof timesheetWeeks.$inferSelect;

/**
 * A week is only written once it is interacted with, so an untouched week has
 * no row. Callers get a consistent shape either way.
 */
export async function findTimesheetWeek(
    userId: string,
    weekStart: string,
): Promise<TimesheetWeekRow | null> {
    const rows = await db
        .select()
        .from(timesheetWeeks)
        .where(
            and(
                eq(timesheetWeeks.userId, userId),
                eq(timesheetWeeks.weekStart, weekStart),
            ),
        )
        .limit(1);

    return rows[0] ?? null;
}

export async function upsertTimesheetWeek(
    userId: string,
    weekStart: string,
    weekEnd: string,
    patch: { completedAt?: Date | null; targetMinutes?: number },
): Promise<TimesheetWeekRow> {
    const [row] = await db
        .insert(timesheetWeeks)
        .values({ userId, weekStart, weekEnd, ...patch })
        .onConflictDoUpdate({
            target: [timesheetWeeks.userId, timesheetWeeks.weekStart],
            set: { weekEnd, ...patch },
        })
        .returning();

    return row;
}
