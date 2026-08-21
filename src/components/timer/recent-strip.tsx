"use client";

import { formatDistanceToNowStrict } from "date-fns";
import { Play } from "lucide-react";

import { EntryHoverCard } from "@/components/timer/entry-hover-card";
import type { TimeEntryFieldsFragment } from "@/gql/graphql";
import { projectColor } from "@/lib/project-color";

interface RecentStripProps {
    entries: readonly TimeEntryFieldsFragment[];
    onContinue: (entry: TimeEntryFieldsFragment) => void;
}

/** One-click resume of work already done, so it never has to be retyped. */
export function RecentStrip({ entries, onContinue }: RecentStripProps) {
    if (entries.length === 0) {
        return null;
    }

    return (
        <div className="flex flex-col gap-2">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Continue
            </p>

            <div className="flex flex-wrap gap-2">
                {entries.map((entry) => (
                    <EntryHoverCard key={entry.id} entry={entry} side="bottom">
                        <button
                            type="button"
                            onClick={() => onContinue(entry)}
                            className="group flex max-w-xs items-center gap-2 rounded-lg border border-border/70 bg-card px-3 py-2 text-left transition-colors hover:border-primary/50 hover:bg-muted/50"
                        >
                            <span
                                aria-hidden
                                className="size-2 shrink-0 rounded-full"
                                style={{
                                    backgroundColor: projectColor(
                                        entry.project,
                                    ),
                                }}
                            />

                            <span className="min-w-0 flex-1">
                                <span className="block truncate text-xs font-medium">
                                    {entry.description}
                                </span>

                                <span className="block truncate text-[11px] text-muted-foreground">
                                    {entry.project.name}
                                    {" · "}
                                    {formatDistanceToNowStrict(
                                        new Date(entry.startedAt),
                                        {
                                            addSuffix: true,
                                        },
                                    )}
                                </span>
                            </span>

                            <Play className="size-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
                        </button>
                    </EntryHoverCard>
                ))}
            </div>
        </div>
    );
}
