"use server";

import { cookies, headers } from "next/headers";

import {
    ACCESS_COOKIE,
    ACCESS_MAX_AGE_SECONDS,
    accessCookieValue,
    isCorrectAccessCode,
} from "@/lib/auth/access-code";
import {
    checkAccessAttempts,
    clearAttempts,
    clientHash,
    recordFailure,
} from "@/lib/auth/rate-limit";

export interface UnlockState {
    error: string | null;
}

/** Minutes and seconds, for a wait someone has to sit through. */
function describeWait(seconds: number): string {
    if (seconds < 60) {
        return `${seconds} seconds`;
    }

    const minutes = Math.ceil(seconds / 60);

    if (minutes < 60) {
        return `${minutes} minute${minutes === 1 ? "" : "s"}`;
    }

    const hours = Math.ceil(minutes / 60);

    return `${hours} hour${hours === 1 ? "" : "s"}`;
}

/**
 * The address the request came from.
 *
 * Order matters. `x-vercel-forwarded-for` and `x-real-ip` are written by the
 * platform and cannot be set by the caller; `x-forwarded-for` is a header
 * anyone can send, and is only trusted last. Getting that backwards would let
 * a guesser rotate a made-up address and never meet the limit at all.
 *
 * Anything unidentifiable shares a single bucket - better that a few clients
 * share one limit than that a missing header hands out unlimited guesses.
 */
async function clientAddress(): Promise<string> {
    const store = await headers();

    return (
        store.get("x-vercel-forwarded-for")?.trim() ||
        store.get("x-real-ip")?.trim() ||
        store.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        "unknown"
    );
}

/**
 * Trades a correct access code for the cookie that opens the outer door.
 *
 * Deliberately says nothing beyond "wrong": there is one code, and a message
 * about its length or shape would only help someone guessing at it.
 */
export async function unlock(
    _previous: UnlockState,
    formData: FormData,
): Promise<UnlockState> {
    const code = String(formData.get("code") ?? "");
    const hash = clientHash(await clientAddress());

    // Checked before the code is even looked at, so a locked-out client
    // learns nothing from how long the answer takes.
    const limit = await checkAccessAttempts(hash);

    if (!limit.allowed) {
        return {
            error: `Too many attempts. Try again in ${describeWait(limit.retryAfterSeconds)}.`,
        };
    }

    if (!code.trim()) {
        return { error: "Enter the access code to continue." };
    }

    if (!isCorrectAccessCode(code)) {
        const next = await recordFailure(hash);

        if (!next.allowed) {
            return {
                error: `That code is not right. Too many attempts — try again in ${describeWait(next.retryAfterSeconds)}.`,
            };
        }

        return {
            error:
                next.remaining <= 2
                    ? `That code is not right. ${next.remaining} attempt${next.remaining === 1 ? "" : "s"} left.`
                    : "That code is not right.",
        };
    }

    await clearAttempts(hash);

    const store = await cookies();

    store.set(ACCESS_COOKIE, accessCookieValue(), {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: ACCESS_MAX_AGE_SECONDS,
    });

    return { error: null };
}
