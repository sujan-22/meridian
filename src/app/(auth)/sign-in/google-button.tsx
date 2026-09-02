"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { signIn } from "@/lib/auth/client";
import { toast } from "@/components/ui/toast";

/** Google's mark, which their branding terms require be shown unaltered. */
function GoogleMark() {
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4.5">
            <path
                fill="#4285F4"
                d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.87c2.26-2.08 3.57-5.15 3.57-8.81Z"
            />
            <path
                fill="#34A853"
                d="M12 24c3.24 0 5.96-1.08 7.94-2.92l-3.88-3c-1.08.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.28v3.09A12 12 0 0 0 12 24Z"
            />
            <path
                fill="#FBBC05"
                d="M5.29 14.28a7.2 7.2 0 0 1 0-4.56v-3.1H1.28a12 12 0 0 0 0 10.76l4.01-3.1Z"
            />
            <path
                fill="#EA4335"
                d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.43-3.43C17.95 1.18 15.24 0 12 0A12 12 0 0 0 1.28 6.62l4.01 3.1C6.23 6.88 8.88 4.77 12 4.77Z"
            />
        </svg>
    );
}

export function GoogleButton({ next }: { next: string }) {
    const [pending, setPending] = useState(false);

    async function start() {
        setPending(true);

        const { error } = await signIn.social({
            provider: "google",
            callbackURL: next,
        });

        if (error) {
            setPending(false);
            toast.add({
                title: "Google sign-in did not go through",
                description: error.message ?? undefined,
                type: "error",
            });
        }
    }

    return (
        <Button
            type="button"
            size="lg"
            variant="outline"
            className="w-full gap-3"
            onClick={start}
            disabled={pending}
        >
            <GoogleMark />

            {pending ? "Opening Google…" : "Continue with Google"}
        </Button>
    );
}
