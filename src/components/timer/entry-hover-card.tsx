"use client";

import { CircleDollarSign, Users } from "lucide-react";

import {
    HoverCard,
    HoverCardContent,
    HoverCardTrigger,
} from "@/components/ui/hover-card";
import type { TimeEntryFieldsFragment } from "@/gql/graphql";
import { formatTimeOfDay } from "@/lib/dates";
import { entryBilledMinutes, formatMinutesAsHours } from "@/lib/duration";
import { projectColor } from "@/lib/project-color";
import { cn } from "@/lib/utils";

interface EntryHoverCardProps {
    entry: TimeEntryFieldsFragment;
    /**
     * A single element. It becomes the trigger itself rather than being
     * wrapped: a wrapper with `display: contents` has no layout box, so the
     * positioner has nothing to anchor to and the card lands at the corner of
     * the page.
     */
    children: React.ReactElement;
    side?: "top" | "bottom" | "left" | "right";
    /** Skip the card entirely - used while an entry is being dragged. */
    disabled?: boolean;
}

/**
 * The full description of an entry, which never fits in a calendar block or a
 * truncated list row. Replaces the browser's unstyled `title` tooltip.
 */
export function EntryHoverCard({
    entry,
    children,
    side = "right",
    disabled = false,
}: EntryHoverCardProps) {
    if (disabled) {
        return <>{children}</>;
    }

    const color = projectColor(entry.project);
    const billable = entry.billingType === "BILLABLE";

    return (
        <HoverCard>
            <HoverCardTrigger render={children} />

            <HoverCardContent side={side} className="w-72 p-3">
                <div className="flex items-start gap-2">
                    <span
                        aria-hidden
                        className="mt-1 size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: color }}
                    />

                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium leading-snug">
                            {entry.description}
                        </p>

                        <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                            <span className="truncate">
                                {entry.project.name}
                            </span>

                            {entry.kind === "MEETING" ? (
                                <span className="flex items-center gap-1">
                                    <Users className="size-3" />
                                    Meeting
                                </span>
                            ) : (
                                entry.ticketNumber && (
                                    <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.6875rem] text-foreground/80">
                                        #{entry.ticketNumber}
                                    </span>
                                )
                            )}
                        </p>

                        <p className="mt-1.5 flex items-center gap-2 font-mono text-xs tabular-nums text-muted-foreground">
                            <span>
                                {formatTimeOfDay(entry.startedAt)}
                                {" – "}
                                {entry.endedAt
                                    ? formatTimeOfDay(entry.endedAt)
                                    : "now"}
                            </span>

                            <span className="font-medium text-foreground">
                                {formatMinutesAsHours(
                                    entryBilledMinutes(entry),
                                )}{" "}
                                h
                            </span>

                            <span
                                className={cn(
                                    "flex items-center",
                                    billable
                                        ? "text-emerald-400"
                                        : "text-muted-foreground/60",
                                )}
                                title={billable ? "Billable" : "Non-billable"}
                            >
                                <CircleDollarSign className="size-3.5" />
                            </span>
                        </p>
                    </div>
                </div>
            </HoverCardContent>
        </HoverCard>
    );
}
