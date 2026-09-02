"use server";

import { cookies } from "next/headers";

import {
    ACCESS_COOKIE,
    ACCESS_MAX_AGE_SECONDS,
    accessCookieValue,
    isCorrectAccessCode,
} from "@/lib/auth/access-code";

export interface UnlockState {
    error: string | null;
}

/**
 * Trades a correct access code for the cookie that opens the outer door.
 *
 * Deliberately says nothing beyond "wrong": there is one code, and a message
 * about length or shape would only help someone guessing at it.
 */
export async function unlock(
    _previous: UnlockState,
    formData: FormData,
): Promise<UnlockState> {
    const code = String(formData.get("code") ?? "");

    if (!code.trim()) {
        return { error: "Enter the access code to continue." };
    }

    if (!isCorrectAccessCode(code)) {
        return { error: "That code is not right." };
    }

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
