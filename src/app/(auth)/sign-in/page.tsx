import type { Metadata } from "next";
import Image from "next/image";
import { cookies } from "next/headers";

import { ACCESS_COOKIE, hasValidAccessCookie } from "@/lib/auth/access-code";

import { GoogleButton } from "./google-button";
import { UnlockForm } from "./unlock-form";

export const metadata: Metadata = {
    title: "Sign in",
    // Nothing here should ever turn up in a search result.
    robots: { index: false, follow: false },
};

interface SignInPageProps {
    searchParams: Promise<{ next?: string }>;
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
    const { next } = await searchParams;
    const store = await cookies();

    const unlocked = hasValidAccessCookie(store.get(ACCESS_COOKIE)?.value);

    // Only same-site paths survive, so this cannot be pointed at another host.
    const destination =
        next && next.startsWith("/") && !next.startsWith("//") ? next : "/week";

    return (
        <div className="rounded-xl border bg-card p-8 shadow-sm">
            <div className="flex flex-col items-center gap-4 text-center">
                {/* The one place the image gets to be itself. It is a photo,
                    not a mark - at sidebar size the halftone collapses into a
                    grey smudge - so it runs large here and the drawn mark
                    does the small sizes.

                    `mix-blend-screen` is what lets it sit on the card at all.
                    The file has no transparency and carries its own black
                    square; under `screen` black is the colour that changes
                    nothing, so the square disappears and only the glow is
                    left. Alt is empty on purpose - the name is the heading
                    directly below, and reading the picture out too would say
                    it twice. */}
                <Image
                    src="/logo.png"
                    alt=""
                    width={431}
                    height={431}
                    loading="eager"
                    className="pointer-events-none size-28 select-none mix-blend-screen"
                />

                <div className="space-y-1.5">
                    <h1 className="text-xl font-semibold tracking-tight">
                        Meridian
                    </h1>

                    <p className="text-sm text-muted-foreground">
                        {unlocked
                            ? "Sign in to get to your week."
                            : "This is a private tracker. Enter the access code you were given."}
                    </p>
                </div>
            </div>

            <div className="mt-7">
                {unlocked ? (
                    <GoogleButton next={destination} />
                ) : (
                    <UnlockForm />
                )}
            </div>

            <p className="mt-6 text-center text-xs text-muted-foreground">
                {unlocked
                    ? "Your time is yours alone - nobody else can see it."
                    : "No code? Ask Sujan."}
            </p>
        </div>
    );
}
