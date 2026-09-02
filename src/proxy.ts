import { getSessionCookie } from "better-auth/cookies";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { ACCESS_COOKIE, hasValidAccessCookie } from "@/lib/auth/access-code";

/**
 * Two doors, in order.
 *
 * The access code decides who may see the site at all; Google decides who they
 * are once inside. Both checks here are the cheap kind - a cookie is present
 * and correctly signed - which is all a proxy should do. The session is
 * verified for real in the app layout and again in the GraphQL route, so a
 * stale or hand-made session cookie buys nothing but a redirect.
 */
const SIGN_IN = "/sign-in";

/** Reachable once signed in, for someone the allowlist turns away. */
const NOT_ALLOWED = "/not-allowed";

export function proxy(request: NextRequest) {
    const { pathname, search } = request.nextUrl;

    const unlocked = hasValidAccessCookie(
        request.cookies.get(ACCESS_COOKIE)?.value,
    );

    if (pathname.startsWith("/api/auth")) {
        // Starting an OAuth flow is the one thing here that creates an
        // account, so it needs the code as much as any page does. The rest -
        // Google's callback, session reads, signing out - has to stay open or
        // the flow cannot complete.
        if (pathname.startsWith("/api/auth/sign-in") && !unlocked) {
            return NextResponse.redirect(new URL(SIGN_IN, request.url));
        }

        return NextResponse.next();
    }

    const signedIn = Boolean(getSessionCookie(request));

    if (pathname === NOT_ALLOWED) {
        return unlocked && signedIn
            ? NextResponse.next()
            : NextResponse.redirect(new URL(SIGN_IN, request.url));
    }

    if (pathname === SIGN_IN) {
        // Nothing left to ask for; send them where they were going.
        if (unlocked && signedIn) {
            const next = request.nextUrl.searchParams.get("next");

            return NextResponse.redirect(
                new URL(isSafeNext(next) ? next : "/week", request.url),
            );
        }

        return NextResponse.next();
    }

    if (unlocked && signedIn) {
        return NextResponse.next();
    }

    const target = new URL(SIGN_IN, request.url);

    // Come back to the page that was actually asked for, once both doors open.
    if (pathname !== "/") {
        target.searchParams.set("next", `${pathname}${search}`);
    }

    return NextResponse.redirect(target);
}

/** Only same-site paths, so `next` cannot bounce anyone off to another host. */
function isSafeNext(value: string | null): value is string {
    return Boolean(value) && value!.startsWith("/") && !value!.startsWith("//");
}

export const config = {
    matcher: [
        /*
         * Everything except Next's own build output and static files - the
         * GraphQL route included, since that is where the data actually is.
         */
        "/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png|manifest.webmanifest|robots.txt|sitemap.xml).*)",
    ],
};
