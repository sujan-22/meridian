import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { accounts } from "@/db/schema";
import { auth } from "@/lib/auth";

/** The Google account row for a user, which is where the tokens live. */
async function googleAccount(userId: string) {
    const rows = await db
        .select()
        .from(accounts)
        .where(
            and(eq(accounts.userId, userId), eq(accounts.providerId, "google")),
        )
        .limit(1);

    return rows[0] ?? null;
}

/**
 * Whether there is a Google account to read a calendar with.
 *
 * Deliberately not a check of the stored `scope` string. Google does not
 * reliably echo the full granted set back in the token response when
 * incremental authorization is in play, so that column can say "no calendar"
 * about an account Google's own permissions page says has it. The only honest
 * test is to call the API, so that is what decides - this just answers
 * whether there is anything to try with.
 */
export async function hasGoogleAccount(userId: string): Promise<boolean> {
    return (await googleAccount(userId)) !== null;
}

/**
 * Why the calendar cannot be read. The distinction matters: a missing scope
 * is a one-off setup step, while an expired grant is the recurring cost of
 * an app that Google still considers to be in testing.
 */
export type CalendarAccessReason = "unlinked" | "no-scope" | "expired";

export class CalendarAccessError extends Error {
    constructor(
        message: string,
        readonly reason: CalendarAccessReason,
    ) {
        super(message);
        this.name = "CalendarAccessError";
    }
}

/**
 * A currently-valid Google access token, refreshed if it has expired.
 *
 * better-auth owns the refresh: it holds the refresh token, knows the
 * provider's endpoint, and writes the new token back. Doing it here would
 * mean a second copy of that logic drifting out of step.
 */
export async function googleAccessToken(userId: string): Promise<string> {
    const account = await googleAccount(userId);

    if (!account) {
        throw new CalendarAccessError(
            "This account is not linked to Google.",
            "unlinked",
        );
    }

    try {
        const { accessToken } = await auth.api.getAccessToken({
            body: { accountId: account.id, userId },
        });

        return accessToken;
    } catch {
        // Google refused to mint a new token from the refresh token. For an
        // app in Testing that is routine rather than exceptional - those
        // refresh tokens are only good for seven days.
        throw new CalendarAccessError(
            "Google would not renew the calendar access. Signing in again restores it.",
            "expired",
        );
    }
}
