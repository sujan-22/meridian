import { asc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { accessAllowlist } from "@/db/schema";

export type AllowlistRow = typeof accessAllowlist.$inferSelect;

/** Addresses are matched lower-cased, never as they happened to be typed. */
function normalize(email: string): string {
    return email.trim().toLowerCase();
}

/**
 * Whether this address may sign in.
 *
 * An empty list admits nobody. That is the safe direction: the alternative -
 * "empty means everyone" - turns a failed migration or a wrong database into
 * an open door, and the failure is silent. The rollout seeds the list from
 * the accounts that already existed, so it is never empty by accident.
 */
export async function isAllowed(
    email: string | null | undefined,
): Promise<boolean> {
    if (!email) {
        return false;
    }

    const [row] = await db
        .select({ email: accessAllowlist.email })
        .from(accessAllowlist)
        .where(eq(accessAllowlist.email, normalize(email)))
        .limit(1);

    return row !== undefined;
}

export async function listAllowed(): Promise<AllowlistRow[]> {
    return db
        .select()
        .from(accessAllowlist)
        .orderBy(asc(accessAllowlist.email));
}

export async function addAllowed(
    email: string,
    addedBy: string,
    note?: string | null,
): Promise<AllowlistRow> {
    const [row] = await db
        .insert(accessAllowlist)
        .values({ email: normalize(email), addedBy, note: note ?? null })
        .onConflictDoUpdate({
            target: accessAllowlist.email,
            set: { note: note ?? null },
        })
        .returning();

    return row;
}

/**
 * Removes an address, unless it is the last one.
 *
 * A list that can be emptied is a list that can lock everybody out, with no
 * way back in short of the database.
 */
export async function removeAllowed(
    email: string,
): Promise<{ removed: boolean; reason?: string }> {
    const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(accessAllowlist);

    if (count <= 1) {
        return {
            removed: false,
            reason: "This is the only address left. Removing it would lock everyone out.",
        };
    }

    const rows = await db
        .delete(accessAllowlist)
        .where(eq(accessAllowlist.email, normalize(email)))
        .returning({ email: accessAllowlist.email });

    return { removed: rows.length > 0 };
}
