import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Failed access-code attempts, per client.
 *
 * Kept in the database rather than in memory because the app runs on
 * serverless instances: an in-process counter would be reset by every cold
 * start and would not be shared between concurrent instances, which is
 * exactly the situation someone guessing at the code creates.
 *
 * The client is identified by a hash of its address - enough to count
 * against, without keeping a log of who visited.
 */
export const accessAttempts = pgTable("access_attempts", {
    clientHash: text("client_hash").primaryKey(),

    failures: integer("failures").default(0).notNull(),

    firstFailureAt: timestamp("first_failure_at", { withTimezone: true })
        .defaultNow()
        .notNull(),

    lastFailureAt: timestamp("last_failure_at", { withTimezone: true })
        .defaultNow()
        .notNull(),

    /** Set once the failures pass the threshold; attempts are refused until. */
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
});

/**
 * Who is allowed to sign in.
 *
 * The access code decides who may reach the sign-in page; this decides who
 * may actually get in, and it is the one that protects the data. A code can
 * be passed around, guessed at, or pasted into the wrong chat - an address
 * has to be put on this list deliberately.
 */
export const accessAllowlist = pgTable("access_allowlist", {
    /** Lower-cased on the way in, so matching never depends on how it was typed. */
    email: text("email").primaryKey(),

    note: text("note"),

    addedBy: text("added_by"),

    createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
});
