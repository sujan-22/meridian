"use client";

import { usePathname } from "next/navigation";

import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

const pageTitles: Record<string, string> = {
    "/today": "Today",
    "/week": "Week",
    "/timesheet": "Timesheet",
    "/tickets": "Tickets",
    "/reports": "Reports",
    "/projects": "Projects",
    "/clients": "Clients",
    "/settings": "Settings",
};

export function AppTopbar() {
    const pathname = usePathname();

    const title =
        Object.entries(pageTitles).find(([route]) =>
            pathname.startsWith(route),
        )?.[1] ?? "Quanta";

    return (
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center border-b border-border/70 bg-background/90 px-4 backdrop-blur-xl">
            <SidebarTrigger className="-ml-1" />

            <Separator orientation="vertical" className="mx-3 h-4" />

            <h1 className="text-sm font-medium tracking-tight">{title}</h1>
        </header>
    );
}
