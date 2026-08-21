"use client";

import {
    CircleDollarSign,
    Copy,
    MoreHorizontal,
    Pencil,
    Play,
    Trash2,
    Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { EntryHoverCard } from "@/components/timer/entry-hover-card";
import { LiveClock } from "@/components/timer/live-clock";
import type { TimeEntryFieldsFragment } from "@/gql/graphql";
import { formatTimeOfDay } from "@/lib/dates";
import { entryBilledMinutes, formatMinutesAsHours } from "@/lib/duration";
import { projectColor } from "@/lib/project-color";
import { cn } from "@/lib/utils";

export type GroupMode = "none" | "project" | "client";

interface EntryActions {
    onContinue: (entry: TimeEntryFieldsFragment) => void;
    onDuplicate: (entry: TimeEntryFieldsFragment) => void;
    onEdit: (entry: TimeEntryFieldsFragment) => void;
    onDelete: (entry: TimeEntryFieldsFragment) => void;
}

interface EntryListProps extends EntryActions {
    entries: readonly TimeEntryFieldsFragment[];
    groupBy: GroupMode;
}

export function EntryList({ entries, groupBy, ...actions }: EntryListProps) {
    if (entries.length === 0) {
        return (
            <div className="rounded-xl border border-dashed border-border/70 px-6 py-16 text-center">
                <p className="text-sm text-muted-foreground">
                    No time tracked yet.
                </p>

                <p className="mt-1 text-xs text-muted-foreground/70">
                    Describe what you&apos;re doing above and hit Start.
                </p>
            </div>
        );
    }

    if (groupBy === "none") {
        return <EntryRows entries={entries} {...actions} />;
    }

    return (
        <div className="flex flex-col gap-4">
            {groupEntries(entries, groupBy).map((group) => (
                <section key={group.key}>
                    <header className="mb-1.5 flex items-baseline justify-between gap-3 px-1">
                        <h4 className="flex min-w-0 items-center gap-2 text-xs font-medium">
                            <span
                                aria-hidden
                                className="size-2 shrink-0 rounded-full"
                                style={{ backgroundColor: group.color }}
                            />

                            <span className="truncate">{group.label}</span>

                            <span className="shrink-0 text-muted-foreground">
                                {group.entries.length}
                            </span>
                        </h4>

                        <span className="shrink-0 font-mono text-xs font-medium tabular-nums text-muted-foreground">
                            {formatMinutesAsHours(group.billedMinutes)} h
                        </span>
                    </header>

                    <EntryRows entries={group.entries} {...actions} />
                </section>
            ))}
        </div>
    );
}

function EntryRows({
    entries,
    ...actions
}: { entries: readonly TimeEntryFieldsFragment[] } & EntryActions) {
    return (
        <ul className="overflow-hidden rounded-xl border border-border/70 bg-card">
            {entries.map((entry, index) => (
                <EntryRow
                    key={entry.id}
                    entry={entry}
                    isFirst={index === 0}
                    {...actions}
                />
            ))}
        </ul>
    );
}

interface EntryRowProps extends EntryActions {
    entry: TimeEntryFieldsFragment;
    isFirst: boolean;
}

function EntryRow({
    entry,
    isFirst,
    onContinue,
    onDuplicate,
    onEdit,
    onDelete,
}: EntryRowProps) {
    const color = projectColor(entry.project);
    const billable = entry.billingType === "BILLABLE";
    const isMeeting = entry.kind === "MEETING";

    return (
        <li
            className={cn(
                "group relative flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/40",
                !isFirst && "border-t border-border/60",
                entry.isRunning && "bg-primary/5",
            )}
        >
            <span
                aria-hidden
                className="absolute inset-y-0 left-0 w-0.75"
                style={{ backgroundColor: color }}
            />

            <div className="min-w-0 flex-1 pl-1">
                <EntryHoverCard entry={entry} side="bottom">
                    <button
                        type="button"
                        onClick={() => onEdit(entry)}
                        className="block w-full truncate text-left text-sm font-medium text-foreground hover:underline"
                    >
                        {entry.description}
                    </button>
                </EntryHoverCard>

                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                        <span
                            aria-hidden
                            className="size-2 shrink-0 rounded-full"
                            style={{ backgroundColor: color }}
                        />

                        <span className="truncate">{entry.project.name}</span>
                    </span>

                    {isMeeting ? (
                        <span className="flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[0.6875rem] text-foreground/80">
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

                    <Tooltip>
                        <TooltipTrigger
                            render={
                                <span
                                    className={cn(
                                        "flex items-center",
                                        billable
                                            ? "text-emerald-400/80"
                                            : "text-muted-foreground/60",
                                    )}
                                />
                            }
                        >
                            <CircleDollarSign className="size-3.5" />
                        </TooltipTrigger>

                        <TooltipContent>
                            {billable ? "Billable" : "Non-billable"}
                        </TooltipContent>
                    </Tooltip>
                </div>
            </div>

            <div className="flex shrink-0 items-center gap-2 pt-0.5">
                <span className="hidden font-mono text-xs tabular-nums text-muted-foreground sm:inline">
                    {formatTimeOfDay(entry.startedAt)}
                    {" – "}
                    {entry.endedAt ? formatTimeOfDay(entry.endedAt) : "now"}
                </span>

                <span
                    className={cn(
                        "w-14 text-right font-mono text-sm font-medium tabular-nums",
                        entry.isRunning && "text-primary",
                    )}
                >
                    {entry.isRunning ? (
                        <LiveClock startedAt={entry.startedAt} asBilledHours />
                    ) : (
                        formatMinutesAsHours(entryBilledMinutes(entry))
                    )}
                </span>

                <div className="flex items-center gap-0.5">
                    {!entry.isRunning && (
                        <Tooltip>
                            <TooltipTrigger
                                render={
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon-sm"
                                        aria-label="Continue this work"
                                        onClick={() => onContinue(entry)}
                                        className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                                    />
                                }
                            >
                                <Play className="size-3.5" />
                            </TooltipTrigger>

                            <TooltipContent>Continue</TooltipContent>
                        </Tooltip>
                    )}

                    <DropdownMenu>
                        <DropdownMenuTrigger
                            render={
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon-sm"
                                    aria-label="Entry actions"
                                />
                            }
                        >
                            <MoreHorizontal className="size-4" />
                        </DropdownMenuTrigger>

                        <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem onClick={() => onEdit(entry)}>
                                <Pencil />
                                Edit
                            </DropdownMenuItem>

                            <DropdownMenuItem
                                onClick={() => onDuplicate(entry)}
                            >
                                <Copy />
                                Duplicate
                            </DropdownMenuItem>

                            {!entry.isRunning && (
                                <DropdownMenuItem
                                    onClick={() => onContinue(entry)}
                                >
                                    <Play />
                                    Continue
                                </DropdownMenuItem>
                            )}

                            <DropdownMenuSeparator />

                            <DropdownMenuItem
                                variant="destructive"
                                onClick={() => onDelete(entry)}
                            >
                                <Trash2 />
                                Delete
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
        </li>
    );
}

interface EntryGroup {
    key: string;
    label: string;
    color: string;
    entries: TimeEntryFieldsFragment[];
    billedMinutes: number;
}

/** Groups keep the day's chronological order within each bucket. */
function groupEntries(
    entries: readonly TimeEntryFieldsFragment[],
    mode: Exclude<GroupMode, "none">,
): EntryGroup[] {
    const groups = new Map<string, EntryGroup>();

    for (const entry of entries) {
        const key =
            mode === "project" ? entry.project.id : entry.project.client.id;

        const label =
            mode === "project"
                ? entry.project.name
                : (entry.project.client.shortName ?? entry.project.client.name);

        const existing = groups.get(key);

        if (existing) {
            existing.entries.push(entry);
            existing.billedMinutes += entryBilledMinutes(entry);

            continue;
        }

        groups.set(key, {
            key,
            label,
            color: projectColor(entry.project),
            entries: [entry],
            billedMinutes: entryBilledMinutes(entry),
        });
    }

    return [...groups.values()].sort(
        (a, b) => b.billedMinutes - a.billedMinutes,
    );
}
