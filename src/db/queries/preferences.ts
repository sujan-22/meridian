import { eq } from "drizzle-orm";

import { db } from "@/db";
import { preferences, PREFERENCES_ID } from "@/db/schema";

export type PreferencesRow = typeof preferences.$inferSelect;

/** The single preferences row, created with column defaults on first read. */
export async function findPreferences(): Promise<PreferencesRow> {
    const existing = await db
        .select()
        .from(preferences)
        .where(eq(preferences.id, PREFERENCES_ID))
        .limit(1);

    if (existing[0]) {
        return existing[0];
    }

    const [created] = await db
        .insert(preferences)
        .values({ id: PREFERENCES_ID })
        .onConflictDoNothing()
        .returning();

    // A concurrent request may have won the insert; read back either way.
    if (created) {
        return created;
    }

    const [row] = await db
        .select()
        .from(preferences)
        .where(eq(preferences.id, PREFERENCES_ID))
        .limit(1);

    return row;
}

export async function savePreferences(
    patch: Partial<Omit<PreferencesRow, "id" | "createdAt" | "updatedAt">>,
): Promise<PreferencesRow> {
    await findPreferences();

    const [updated] = await db
        .update(preferences)
        .set(patch)
        .where(eq(preferences.id, PREFERENCES_ID))
        .returning();

    return updated;
}
