import { createHash } from "node:crypto";
import { and, eq, lt } from "drizzle-orm";

import { db } from "@/db";
import { accessAttempts } from "@/db/schema";

/** Wrong codes allowed before the door closes for a while. */
const FREE_ATTEMPTS = 5;

/** How long a run of failures stays on the record. */
const WINDOW_MS = 15 * 60 * 1000;

/** Lockouts double each time, so a persistent guesser gets nowhere fast. */
const BASE_LOCKOUT_MS = 60 * 1000;
const MAX_LOCKOUT_MS = 6 * 60 * 60 * 1000;

export interface RateLimitState {
    allowed: boolean;
    /** Seconds until another attempt is accepted; 0 when allowed. */
    retryAfterSeconds: number;
    /** Attempts left before a lockout, for the message shown to the user. */
    remaining: number;
}

/**
 * Identifies the client without keeping a record of who it was.
 *
 * A salted hash of the address is enough to count against; the address
 * itself is never stored, so the table cannot become a visitor log.
 */
export function clientHash(ip: string): string {
    return createHash("sha256")
        .update(`${process.env.BETTER_AUTH_SECRET ?? ""}:${ip}`)
        .digest("hex");
}

function lockoutFor(failures: number): number {
    const over = Math.max(1, failures - FREE_ATTEMPTS + 1);

    return Math.min(BASE_LOCKOUT_MS * 2 ** (over - 1), MAX_LOCKOUT_MS);
}

/** Whether this client may try a code right now. */
export async function checkAccessAttempts(
    hash: string,
    now = new Date(),
): Promise<RateLimitState> {
    const [row] = await db
        .select()
        .from(accessAttempts)
        .where(eq(accessAttempts.clientHash, hash))
        .limit(1);

    if (!row) {
        return {
            allowed: true,
            retryAfterSeconds: 0,
            remaining: FREE_ATTEMPTS,
        };
    }

    if (row.lockedUntil && row.lockedUntil > now) {
        return {
            allowed: false,
            retryAfterSeconds: Math.ceil(
                (row.lockedUntil.getTime() - now.getTime()) / 1000,
            ),
            remaining: 0,
        };
    }

    // A quiet spell wipes the slate; this is protection, not punishment.
    if (now.getTime() - row.firstFailureAt.getTime() > WINDOW_MS) {
        return {
            allowed: true,
            retryAfterSeconds: 0,
            remaining: FREE_ATTEMPTS,
        };
    }

    return {
        allowed: true,
        retryAfterSeconds: 0,
        remaining: Math.max(0, FREE_ATTEMPTS - row.failures),
    };
}

/** Records a wrong code, and locks the client out once there are enough. */
export async function recordFailure(
    hash: string,
    now = new Date(),
): Promise<RateLimitState> {
    const [existing] = await db
        .select()
        .from(accessAttempts)
        .where(eq(accessAttempts.clientHash, hash))
        .limit(1);

    const stale =
        existing &&
        now.getTime() - existing.firstFailureAt.getTime() > WINDOW_MS;

    const failures = !existing || stale ? 1 : existing.failures + 1;

    const lockedUntil =
        failures >= FREE_ATTEMPTS
            ? new Date(now.getTime() + lockoutFor(failures))
            : null;

    await db
        .insert(accessAttempts)
        .values({
            clientHash: hash,
            failures,
            firstFailureAt: now,
            lastFailureAt: now,
            lockedUntil,
        })
        .onConflictDoUpdate({
            target: accessAttempts.clientHash,
            set: {
                failures,
                ...(stale ? { firstFailureAt: now } : {}),
                lastFailureAt: now,
                lockedUntil,
            },
        });

    return {
        allowed: lockedUntil === null,
        retryAfterSeconds: lockedUntil
            ? Math.ceil((lockedUntil.getTime() - now.getTime()) / 1000)
            : 0,
        remaining: Math.max(0, FREE_ATTEMPTS - failures),
    };
}

/** A correct code clears the record for that client. */
export async function clearAttempts(hash: string): Promise<void> {
    await db.delete(accessAttempts).where(eq(accessAttempts.clientHash, hash));
}

/** Housekeeping, so the table does not grow without bound. */
export async function pruneAttempts(now = new Date()): Promise<void> {
    await db
        .delete(accessAttempts)
        .where(
            and(
                lt(
                    accessAttempts.lastFailureAt,
                    new Date(now.getTime() - WINDOW_MS),
                ),
                lt(accessAttempts.lockedUntil, now),
            ),
        );
}

export { FREE_ATTEMPTS };
