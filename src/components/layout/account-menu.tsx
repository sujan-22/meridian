"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import { signOut } from "@/lib/auth/client";

export interface AccountUser {
    name: string;
    email: string;
    image?: string | null;
}

/** The first letter of whatever we know them by, for the avatar fallback. */
function initial(user: AccountUser): string {
    const source = user.name?.trim() || user.email;

    return source.charAt(0).toUpperCase();
}

export function AccountMenu({ user }: { user: AccountUser }) {
    const router = useRouter();
    const [leaving, setLeaving] = useState(false);

    async function leave() {
        setLeaving(true);

        await signOut();

        // A full navigation, so no cached signed-in page is left behind.
        router.push("/sign-in");
        router.refresh();
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                render={
                    <SidebarMenuButton
                        size="lg"
                        className="gap-2.5"
                        aria-label="Account"
                    />
                }
            >
                <Avatar user={user} />

                <span className="grid min-w-0 flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
                    <span className="truncate text-sm font-medium">
                        {user.name?.trim() || "Signed in"}
                    </span>

                    <span className="truncate text-xs text-muted-foreground">
                        {user.email}
                    </span>
                </span>
            </DropdownMenuTrigger>

            <DropdownMenuContent
                side="top"
                align="start"
                sideOffset={8}
                className="w-56"
            >
                <DropdownMenuLabel className="font-normal">
                    <span className="block truncate text-sm font-medium">
                        {user.name?.trim() || "Signed in"}
                    </span>

                    <span className="block truncate text-xs text-muted-foreground">
                        {user.email}
                    </span>
                </DropdownMenuLabel>

                <DropdownMenuSeparator />

                <DropdownMenuItem onClick={leave} disabled={leaving}>
                    <LogOut />

                    {leaving ? "Signing out…" : "Sign out"}
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function Avatar({ user }: { user: AccountUser }) {
    const [failed, setFailed] = useState(false);

    if (user.image && !failed) {
        return (
            // Google's avatar host is not worth a next/image loader config for
            // one 32px square. `no-referrer` is required, not cosmetic:
            // lh3.googleusercontent.com answers 403 to a request carrying a
            // Referer from another origin, which renders as a broken image.
            // eslint-disable-next-line @next/next/no-img-element
            <img
                src={user.image}
                alt=""
                width={32}
                height={32}
                referrerPolicy="no-referrer"
                onError={() => setFailed(true)}
                className="size-8 shrink-0 rounded-lg object-cover"
            />
        );
    }

    return (
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-accent text-sm font-medium">
            {initial(user)}
        </span>
    );
}
