import type { Metadata } from "next";

import { Logo } from "@/components/brand/logo";
import { SignOutButton } from "@/components/layout/sign-out-button";

export const metadata: Metadata = {
    title: "No access",
    robots: { index: false, follow: false },
};

/**
 * Shown to someone who signed in with Google successfully but is not on the
 * allowlist. Says plainly what happened, without hinting at what would work.
 */
export default function NotAllowedPage() {
    return (
        <div className="rounded-xl border bg-card p-8 text-center">
            <Logo className="mx-auto size-12" />

            <h1 className="mt-4 text-xl font-semibold tracking-tight">
                Not on the list
            </h1>

            <p className="mt-2 text-sm text-muted-foreground">
                That Google account is not one of the accounts allowed here. Ask
                Sujan to add it, then sign in again.
            </p>

            <div className="mt-6 flex justify-center">
                <SignOutButton label="Sign in as someone else" />
            </div>
        </div>
    );
}
