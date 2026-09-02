import type { Metadata } from "next";
import { cookies } from "next/headers";

import { Logo } from "@/components/brand/logo";
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
        next && next.startsWith("/") && !next.startsWith("//")
            ? next
            : "/week";

    return (
        <div className="rounded-xl border bg-card p-8 shadow-sm">
            <div className="flex flex-col items-center gap-4 text-center">
                <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm shadow-primary/20">
                    <Logo className="size-6" />
                </div>

                <div className="space-y-1.5">
                    <h1 className="text-xl font-semibold tracking-tight">
                        Quanta
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
