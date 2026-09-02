"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { unlock, type UnlockState } from "./actions";

const INITIAL: UnlockState = { error: null };

export function UnlockForm() {
    const router = useRouter();
    const [state, action, pending] = useActionState(unlock, INITIAL);

    // The cookie is set by the action, but this page was rendered before it
    // existed - a refresh is what moves it on to the Google step.
    useEffect(() => {
        if (state === INITIAL || state.error) {
            return;
        }

        router.refresh();
    }, [state, router]);

    return (
        <form action={action} className="flex flex-col gap-3">
            <Input
                name="code"
                autoFocus
                autoComplete="off"
                spellCheck={false}
                placeholder="Access code"
                aria-label="Access code"
                aria-invalid={state.error ? true : undefined}
                className="h-11 text-center font-mono tracking-[0.2em] placeholder:tracking-normal placeholder:font-sans"
            />

            {state.error ? (
                <p role="alert" className="text-sm text-destructive">
                    {state.error}
                </p>
            ) : null}

            <Button type="submit" size="lg" disabled={pending}>
                {pending ? "Checking…" : "Continue"}
            </Button>
        </form>
    );
}
