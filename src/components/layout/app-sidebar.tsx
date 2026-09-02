"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    BarChart3,
    Building2,
    CalendarDays,
    CheckSquare2,
    Clock3,
    FolderKanban,
    Gauge,
    Settings,
} from "lucide-react";

import { Logo } from "@/components/brand/logo";
import { AccountMenu, type AccountUser } from "@/components/layout/account-menu";

import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarRail,
} from "@/components/ui/sidebar";

const navigation = [
    {
        label: "Track",
        items: [
            {
                title: "Today",
                href: "/today",
                icon: Clock3,
            },
            {
                title: "Week",
                href: "/week",
                icon: CalendarDays,
            },
        ],
    },
    {
        label: "Timesheet",
        items: [
            {
                title: "Timesheet",
                href: "/timesheet",
                icon: CheckSquare2,
            },
        ],
    },
    {
        label: "Analyze",
        items: [
            {
                title: "Tickets",
                href: "/tickets",
                icon: Gauge,
            },
            {
                title: "Reports",
                href: "/reports",
                icon: BarChart3,
            },
        ],
    },
    {
        label: "Manage",
        items: [
            {
                title: "Projects",
                href: "/projects",
                icon: FolderKanban,
            },
            {
                title: "Clients",
                href: "/clients",
                icon: Building2,
            },
        ],
    },
];

export function AppSidebar({ user }: { user: AccountUser }) {
    const pathname = usePathname();

    return (
        <Sidebar collapsible="icon" className="border-sidebar-border">
            {/* h-14 with no padding of its own, so this border lands on
                exactly the same line as the topbar's. */}
            <SidebarHeader className="h-14 justify-center border-b border-sidebar-border p-0">
                <div className="flex items-center gap-3 px-2">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm shadow-primary/20">
                        <Logo className="size-4.5" />
                    </div>

                    <div className="min-w-0 group-data-[collapsible=icon]:hidden">
                        <p className="truncate text-sm font-semibold tracking-tight">
                            Quanta
                        </p>

                        <p className="truncate text-[0.6875rem] text-muted-foreground">
                            Quarter-hour time tracking
                        </p>
                    </div>
                </div>
            </SidebarHeader>

            <SidebarContent className="py-2">
                {navigation.map((group) => (
                    <SidebarGroup key={group.label}>
                        <SidebarGroupLabel>{group.label}</SidebarGroupLabel>

                        <SidebarGroupContent>
                            <SidebarMenu>
                                {group.items.map((item) => {
                                    const active =
                                        pathname === item.href ||
                                        pathname.startsWith(`${item.href}/`);

                                    return (
                                        <SidebarMenuItem key={item.href}>
                                            <SidebarMenuButton
                                                render={
                                                    <Link href={item.href} />
                                                }
                                                isActive={active}
                                            >
                                                <item.icon />

                                                <span>{item.title}</span>
                                            </SidebarMenuButton>
                                        </SidebarMenuItem>
                                    );
                                })}
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                ))}
            </SidebarContent>

            <SidebarFooter className="border-t border-sidebar-border">
                <SidebarMenu>
                    <SidebarMenuItem>
                        <AccountMenu user={user} />
                    </SidebarMenuItem>

                    <SidebarMenuItem>
                        <SidebarMenuButton
                            render={<Link href="/settings" />}
                            isActive={pathname === "/settings"}
                        >
                            <Settings />

                            <span>Settings</span>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>

            <SidebarRail />
        </Sidebar>
    );
}
