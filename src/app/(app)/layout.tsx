import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { auth } from "@/lib/auth";
import { isAllowed } from "@/lib/auth/allowlist";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppTopbar } from "@/components/layout/app-topbar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

interface AppLayoutProps {
    children: ReactNode;
}

export default async function AppLayout({ children }: AppLayoutProps) {
    // The proxy only checks that a session cookie is present, which is all a
    // proxy should do. This is where the session is actually verified, so
    // every page below here can assume a real signed-in person.
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user) {
        redirect("/sign-in");
    }

    // Signing in with Google proves who someone is, not that they are wanted
    // here. The allowlist is the gate that actually protects the data - the
    // access code only decides who reaches the sign-in page.
    if (!(await isAllowed(session.user.email))) {
        redirect("/not-allowed");
    }

    return (
        <SidebarProvider
            defaultOpen
            style={
                {
                    "--sidebar-width": "14.5rem",
                } as React.CSSProperties
            }
        >
            <AppSidebar user={session.user} />

            {/* SidebarInset ships as `w-full flex-1`, which floors its
                automatic minimum width at the full viewport - so it renders
                the sidebar's width past the right edge and the page scrolls
                horizontally. `min-w-0` lets it shrink to the space actually
                left over. */}
            <SidebarInset className="min-w-0">
                <AppTopbar />

                <main className="flex min-h-0 min-w-0 flex-1 flex-col">
                    {children}
                </main>
            </SidebarInset>
        </SidebarProvider>
    );
}
