import { eq } from "drizzle-orm";

import { db } from "@/db";
import { preferences } from "@/db/schema";

export type PreferencesRow = typeof preferences.$inferSelect;

/** A person's preferences, created with column defaults on first read. */
export async function findPreferences(userId: string): Promise<PreferencesRow> {
    const existing = await db
        .select()
        .from(preferences)
        .where(eq(preferences.userId, userId))
        .limit(1);

    if (existing[0]) {
        return existing[0];
    }

    const [created] = await db
        .insert(preferences)
        .values({ userId })
        .onConflictDoNothing()
        .returning();

    // A concurrent request may have won the insert; read back either way.
    if (created) {
        return created;
    }

    const [row] = await db
        .select()
        .from(preferences)
        .where(eq(preferences.userId, userId))
        .limit(1);

    return row;
}

export async function savePreferences(
    userId: string,
    patch: Partial<
        Omit<PreferencesRow, "id" | "userId" | "createdAt" | "updatedAt">
    >,
): Promise<PreferencesRow> {
    await findPreferences(userId);

    const [updated] = await db
        .update(preferences)
        .set(patch)
        .where(eq(preferences.userId, userId))
        .returning();

    return updated;
}
