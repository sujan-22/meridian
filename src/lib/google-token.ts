import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { accounts } from "@/db/schema";
import { auth } from "@/lib/auth";

export const CALENDAR_SCOPE =
    "https://www.googleapis.com/auth/calendar.readonly";

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
 * Whether the Google grant covers the calendar.
 *
 * Anyone who signed in before the scope was asked for has a perfectly good
 * session and no calendar access; this is what tells them apart so the UI can
 * say "sign in again" rather than showing an empty lane forever.
 */
export async function hasCalendarScope(userId: string): Promise<boolean> {
    const account = await googleAccount(userId);

    return (account?.scope ?? "").includes(CALENDAR_SCOPE);
}

export class CalendarAccessError extends Error {}

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
        throw new CalendarAccessError("This account is not linked to Google.");
    }

    if (!(account.scope ?? "").includes(CALENDAR_SCOPE)) {
        throw new CalendarAccessError(
            "Calendar access was never granted. Sign out and back in to allow it.",
        );
    }

    try {
        const { accessToken } = await auth.api.getAccessToken({
            body: { accountId: account.id, userId },
        });

        return accessToken;
    } catch {
        throw new CalendarAccessError(
            "Google would not renew the calendar access. Sign out and back in.",
        );
    }
}
