"use client";

import { useEffect, useRef, useState } from "react";

import { toast } from "@/components/ui/toast";

/** How long a copied field stays acknowledged. */
const FEEDBACK_MS = 1200;

/**
 * Copy-to-clipboard with per-target acknowledgement.
 *
 * On the Friday screen the same button gets pressed dozens of times, so the
 * confirmation has to be immediate and local to the button rather than a toast
 * for every copy.
 */
export function useCopy() {
    const [copiedKey, setCopiedKey] = useState<string | null>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(
        () => () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
        },
        [],
    );

    async function copy(key: string, value: string) {
        try {
            await navigator.clipboard.writeText(value);

            setCopiedKey(key);

            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }

            timerRef.current = setTimeout(() => setCopiedKey(null), FEEDBACK_MS);
        } catch {
            // Clipboard access can be refused (insecure origin, permissions);
            // say so rather than silently doing nothing.
            toast.add({
                title: "Could not copy",
                description: "Your browser blocked clipboard access.",
                type: "error",
            });
        }
    }

    return { copiedKey, copy };
}
