import { pgEnum } from "drizzle-orm/pg-core";

export const billingTypeEnum = pgEnum("billing_type", [
    "billable",
    "non_billable",
]);

/**
 * Scrums, syncs and other ceremonies carry no ticket number and usually map to
 * a different Polaris task than the work they surround, so they are worth
 * telling apart from ticketed work.
 */
export const entryKindEnum = pgEnum("entry_kind", ["work", "meeting"]);
