"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth/client";

/** Signs out and returns to the door. */
export function SignOutButton({ label = "Sign out" }: { label?: string }) {
    const router = useRouter();
    const [leaving, setLeaving] = useState(false);

    return (
        <Button
            type="button"
            variant="outline"
            disabled={leaving}
            onClick={async () => {
                setLeaving(true);

                await signOut();

                router.push("/sign-in");
                router.refresh();
            }}
        >
            {leaving ? "Signing out…" : label}
        </Button>
    );
}
