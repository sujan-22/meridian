import type { ReactNode } from "react";

import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppTopbar } from "@/components/layout/app-topbar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

interface AppLayoutProps {
    children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
    return (
        <SidebarProvider
            defaultOpen
            style={
                {
                    "--sidebar-width": "14.5rem",
                } as React.CSSProperties
            }
        >
            <AppSidebar />

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
