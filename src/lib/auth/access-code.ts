import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * The shared access code that fronts the whole app.
 *
 * Signing in still requires a Google account - this is the outer door, so the
 * site is not merely unlisted but closed to anyone who has not been handed the
 * code. The cookie stores an HMAC rather than the code itself: it cannot be
 * forged without the server secret, and the code never sits in a browser.
 */
export const ACCESS_COOKIE = "meridian.access";

/** Long enough that a person is not re-entering the code every week. */
export const ACCESS_MAX_AGE_SECONDS = 60 * 60 * 24 * 90;

function requiredEnv(name: string): string {
    const value = process.env[name];

    if (!value) {
        throw new Error(`${name} is not defined`);
    }

    return value;
}

function sign(value: string): string {
    return createHmac("sha256", requiredEnv("BETTER_AUTH_SECRET"))
        .update(value)
        .digest("hex");
}

/**
 * Compares by way of fixed-length digests, so the work done is the same
 * whether the first character is wrong or only the last one is.
 */
function equals(a: string, b: string): boolean {
    return timingSafeEqual(
        Buffer.from(sign(a), "hex"),
        Buffer.from(sign(b), "hex"),
    );
}

/** Whether what someone typed is the code, ignoring case and stray spaces. */
export function isCorrectAccessCode(candidate: string): boolean {
    const expected = requiredEnv("ACCESS_CODE").trim().toLowerCase();

    return equals(candidate.trim().toLowerCase(), expected);
}

/** The cookie value proving the code was entered on this browser. */
export function accessCookieValue(): string {
    return sign(requiredEnv("ACCESS_CODE").trim().toLowerCase());
}

/**
 * Rotating ACCESS_CODE invalidates every cookie already issued, because each
 * one is a signature over the code that was current when it was granted.
 */
export function hasValidAccessCookie(value: string | undefined): boolean {
    if (!value) {
        return false;
    }

    const expected = accessCookieValue();

    if (value.length !== expected.length) {
        return false;
    }

    return timingSafeEqual(Buffer.from(value), Buffer.from(expected));
}
