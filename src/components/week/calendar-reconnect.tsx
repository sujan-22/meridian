"use client";

import { CalendarX } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth/client";

/**
 * Says the calendar has gone stale, on the screen where it would otherwise
 * just look empty.
 *
 * Google expires the refresh tokens it issues to an app in testing after
 * seven days, so this is a recurring, expected state rather than a fault -
 * and an empty lane is a terrible way to be told about it.
 */
export function CalendarReconnect() {
    const router = useRouter();
    const [leaving, setLeaving] = useState(false);

    async function reconnect() {
        setLeaving(true);

        await signOut();

        router.push("/sign-in");
        router.refresh();
    }

    return (
        <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-xs">
            <span className="flex items-center gap-1.5 font-medium text-amber-400">
                <CalendarX className="size-3.5" />
                Calendar needs reconnecting
            </span>

            <span className="text-muted-foreground">
                Google stopped renewing access. Meetings will not appear until
                you sign in again — nothing you have tracked is affected.
            </span>

            <Button
                type="button"
                variant="outline"
                size="sm"
                className="ml-auto h-7"
                disabled={leaving}
                onClick={reconnect}
            >
                {leaving ? "Signing out…" : "Reconnect"}
            </Button>
        </div>
    );
}
