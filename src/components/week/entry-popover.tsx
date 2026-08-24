"use client";

import { useEffect, useRef } from "react";
import { Copy, Pencil, Play, Trash2, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { TimeEntryFieldsFragment } from "@/gql/graphql";
import { formatTimeOfDay } from "@/lib/dates";
import { BillableSplit } from "@/components/timer/billable-split";
import { projectColor } from "@/lib/project-color";

export interface PopoverAnchor {
    /** Offsets within the calendar's positioned container. */
    left: number;
    top: number;
}

interface EntryPopoverProps {
    entry: TimeEntryFieldsFragment;
    anchor: PopoverAnchor;
    onClose: () => void;
    onEdit: (entry: TimeEntryFieldsFragment) => void;
    onDuplicate: (entry: TimeEntryFieldsFragment) => void;
    onContinue: (entry: TimeEntryFieldsFragment) => void;
    onDelete: (entry: TimeEntryFieldsFragment) => void;
}

/**
 * Opened by clicking a block: shows the whole description - which never fits
 * inside the block itself - plus the actions that would otherwise mean a trip
 * to the Today screen.
 */
export function EntryPopover({
    entry,
    anchor,
    onClose,
    onEdit,
    onDuplicate,
    onContinue,
    onDelete,
}: EntryPopoverProps) {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handlePointerDown = (event: PointerEvent) => {
            if (!ref.current?.contains(event.target as Node)) {
                onClose();
            }
        };

        const handleKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                onClose();
            }
        };

        // `pointerdown` in the capture phase so a click on another block
        // closes this one before that block opens its own.
        window.addEventListener("pointerdown", handlePointerDown, true);
        window.addEventListener("keydown", handleKey);

        return () => {
            window.removeEventListener("pointerdown", handlePointerDown, true);
            window.removeEventListener("keydown", handleKey);
        };
    }, [onClose]);

    const color = projectColor(entry.project);

    return (
        <div
            ref={ref}
            role="dialog"
            aria-label="Entry actions"
            className="absolute z-40 w-72 rounded-xl border border-border bg-popover p-3 shadow-xl"
            style={{ left: `${anchor.left}px`, top: `${anchor.top}px` }}
        >
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

                    <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                        <span className="truncate">{entry.project.name}</span>

                        {entry.kind === "MEETING" ? (
                            <span className="flex items-center gap-1">
                                <Users className="size-3" />
                                Meeting
                            </span>
                        ) : (
                            entry.ticketNumber && (
                                <span className="font-mono">
                                    #{entry.ticketNumber}
                                </span>
                            )
                        )}
                    </p>

                    <p className="mt-1 font-mono text-xs tabular-nums text-muted-foreground">
                        {formatTimeOfDay(entry.startedAt)}
                        {" – "}
                        {entry.endedAt
                            ? formatTimeOfDay(entry.endedAt)
                            : "now"}
                        <BillableSplit
                            billableMinutes={entry.billableMinutes}
                            unbillableMinutes={entry.unbillableMinutes}
                            className="ml-2 text-foreground"
                        />
                    </p>
                </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-1.5">
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onEdit(entry)}
                    className="gap-1.5"
                >
                    <Pencil className="size-3.5" />
                    Edit
                </Button>

                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onDuplicate(entry)}
                    className="gap-1.5"
                >
                    <Copy className="size-3.5" />
                    Duplicate
                </Button>

                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={entry.isRunning}
                    onClick={() => onContinue(entry)}
                    className="gap-1.5"
                >
                    <Play className="size-3.5" />
                    Continue
                </Button>

                <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => onDelete(entry)}
                    className="gap-1.5"
                >
                    <Trash2 className="size-3.5" />
                    Delete
                </Button>
            </div>
        </div>
    );
}
