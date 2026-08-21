"use client";

import { useRef, useState } from "react";
import { addMinutes, format, isWeekend, startOfDay } from "date-fns";
import { Users } from "lucide-react";

import { useMinute } from "@/hooks/use-clock";
import {
    EntryPopover,
    type PopoverAnchor,
} from "@/components/week/entry-popover";
import {
    useEntryDrag,
    type DragPreview,
    type EntryPlacement,
} from "@/components/week/use-entry-drag";
import { EntryHoverCard } from "@/components/timer/entry-hover-card";
import type { TimeEntryFieldsFragment } from "@/gql/graphql";
import { layoutDay, type LayoutInput } from "@/lib/calendar-layout";
import {
    entryBilledMinutes,
    formatMinutesAsHours,
    QUARTER_MINUTES,
} from "@/lib/duration";
import { projectColor } from "@/lib/project-color";
import { cn } from "@/lib/utils";

/**
 * Zoom steps. Each one is tall enough that its own gridline interval stays
 * readable - quarter-hour lines only appear once there is room to label them.
 */
export const ZOOM_LEVELS = [
    { hourHeight: 72, tickMinutes: 60 },
    { hourHeight: 108, tickMinutes: 30 },
    { hourHeight: 152, tickMinutes: 15 },
] as const;

export const DEFAULT_ZOOM = 1;

const AXIS_WIDTH = "3.25rem";
const MINUTES_PER_DAY = 24 * 60;
const POPOVER_WIDTH = 288;

interface WeekCalendarProps {
    days: readonly Date[];
    entriesByDay: ReadonlyMap<string, TimeEntryFieldsFragment[]>;
    hourHeight: number;
    /** Gridline spacing in minutes: 60, 30 or 15 depending on zoom. */
    tickMinutes: number;
    today: Date;
    /** The working window from settings; widened to fit anything outside it. */
    dayStartHour: number;
    dayEndHour: number;
    onEditEntry: (entry: TimeEntryFieldsFragment) => void;
    onDuplicateEntry: (entry: TimeEntryFieldsFragment) => void;
    onContinueEntry: (entry: TimeEntryFieldsFragment) => void;
    onDeleteEntry: (entry: TimeEntryFieldsFragment) => void;
    onSelectSlot: (day: Date, minuteOfDay: number) => void;
    onMoveEntry: (
        entry: TimeEntryFieldsFragment,
        startedAt: Date,
        endedAt: Date,
    ) => void;
}

interface Placement extends LayoutInput {
    entry: TimeEntryFieldsFragment;
    dayIndex: number;
}

export function WeekCalendar({
    days,
    entriesByDay,
    hourHeight,
    tickMinutes,
    today,
    dayStartHour,
    dayEndHour,
    onEditEntry,
    onDuplicateEntry,
    onContinueEntry,
    onDeleteEntry,
    onSelectSlot,
    onMoveEntry,
}: WeekCalendarProps) {
    // Minute resolution is enough here - a per-second tick would re-lay-out
    // the whole grid for no visible gain. `null` until mounted, so nothing
    // clock-dependent renders on the server.
    const now = useMinute();

    const surfaceRef = useRef<HTMLDivElement>(null);

    const [selected, setSelected] = useState<{
        entry: TimeEntryFieldsFragment;
        anchor: PopoverAnchor;
    } | null>(null);

    const placements: Placement[] = [];

    days.forEach((day, dayIndex) => {
        for (const entry of entriesByDay.get(day.toDateString()) ?? []) {
            placements.push(toPlacement(entry, day, dayIndex, now));
        }
    });

    const { preview, begin } = useEntryDrag({
        hourHeight,

        onCommit: (result) => {
            const placement = placements.find(
                (item) => item.entry.id === result.entryId,
            );

            const day = days[result.dayIndex];

            if (!placement || !day) {
                return;
            }

            const midnight = startOfDay(day);

            onMoveEntry(
                placement.entry,
                addMinutes(midnight, result.startMinute),
                addMinutes(midnight, result.endMinute),
            );
        },

        onActivate: (entryId, element) => {
            const placement = placements.find(
                (item) => item.entry.id === entryId,
            );

            const surface = surfaceRef.current;

            if (!placement || !surface) {
                return;
            }

            const block = element.getBoundingClientRect();
            const bounds = surface.getBoundingClientRect();

            setSelected({
                entry: placement.entry,
                anchor: {
                    // Keep the card inside the calendar rather than letting it
                    // hang off the right edge on the last day column.
                    left: Math.max(
                        0,
                        Math.min(
                            block.left - bounds.left + surface.scrollLeft,
                            surface.scrollWidth - POPOVER_WIDTH - 8,
                        ),
                    ),
                    top: block.top - bounds.top + surface.scrollTop + 4,
                },
            });
        },
    });

    const applied = preview
        ? placements.map((placement) =>
              placement.entry.id === preview.entryId
                  ? applyPreview(placement, preview)
                  : placement,
          )
        : placements;

    const { startHour, endHour } = windowFor(applied, dayStartHour, dayEndHour);

    const ticks = buildTicks(startHour, endHour, tickMinutes);

    const closePopover = () => setSelected(null);

    const runAction =
        (action: (entry: TimeEntryFieldsFragment) => void) =>
        (entry: TimeEntryFieldsFragment) => {
            closePopover();

            action(entry);
        };

    return (
        <div className="overflow-hidden rounded-xl border border-border/70 bg-card">
            <div ref={surfaceRef} className="relative overflow-x-auto">
                <div className="min-w-184">
                    <div
                        className="sticky top-0 z-20 grid border-b border-border/60 bg-card/95 backdrop-blur"
                        style={{
                            gridTemplateColumns: `${AXIS_WIDTH} repeat(${days.length}, minmax(0, 1fr))`,
                        }}
                    >
                        <div />

                        {days.map((day) => (
                            <DayHeading
                                key={day.toISOString()}
                                day={day}
                                today={today}
                                entries={entriesByDay.get(day.toDateString())}
                            />
                        ))}
                    </div>

                    <div
                        className="relative grid"
                        style={{
                            gridTemplateColumns: `${AXIS_WIDTH} repeat(${days.length}, minmax(0, 1fr))`,
                            height: `${(endHour - startHour) * hourHeight}px`,
                        }}
                    >
                        <div className="relative border-r border-border/60">
                            {ticks.map((tick, index) => (
                                <span
                                    key={tick.minute}
                                    className={cn(
                                        "absolute right-2 font-mono tabular-nums",
                                        tick.isHour
                                            ? "text-[10px] text-muted-foreground"
                                            : "text-[9px] text-muted-foreground/55",
                                        // The topmost label would be clipped
                                        // if it were centred on the line.
                                        index === 0
                                            ? "translate-y-0"
                                            : "-translate-y-1/2",
                                    )}
                                    style={{
                                        top: `${((tick.minute - startHour * 60) / 60) * hourHeight}px`,
                                    }}
                                >
                                    {tick.label}
                                </span>
                            ))}
                        </div>

                        {days.map((day, dayIndex) => (
                            <DayColumn
                                key={day.toISOString()}
                                day={day}
                                dayIndex={dayIndex}
                                placements={applied.filter(
                                    (item) => item.dayIndex === dayIndex,
                                )}
                                draggingId={preview?.entryId ?? null}
                                ticks={ticks}
                                startHour={startHour}
                                endHour={endHour}
                                hourHeight={hourHeight}
                                today={today}
                                now={now}
                                onSelectSlot={onSelectSlot}
                                onBeginDrag={begin}
                            />
                        ))}
                    </div>
                </div>

                {selected && (
                    <EntryPopover
                        entry={selected.entry}
                        anchor={selected.anchor}
                        onClose={closePopover}
                        onEdit={runAction(onEditEntry)}
                        onDuplicate={runAction(onDuplicateEntry)}
                        onContinue={runAction(onContinueEntry)}
                        onDelete={runAction(onDeleteEntry)}
                    />
                )}
            </div>
        </div>
    );
}

interface DayHeadingProps {
    day: Date;
    today: Date;
    entries?: readonly TimeEntryFieldsFragment[];
}

function DayHeading({ day, today, entries }: DayHeadingProps) {
    const isToday = day.toDateString() === today.toDateString();

    const minutes = (entries ?? []).reduce(
        (total, entry) => total + entryBilledMinutes(entry),
        0,
    );

    return (
        <div
            className={cn(
                "flex items-baseline gap-2 border-l border-border/60 px-2.5 py-2",
                isWeekend(day) && !isToday && "opacity-60",
            )}
        >
            <span
                className={cn(
                    "text-xs font-medium",
                    isToday ? "text-primary" : "text-foreground",
                )}
            >
                {format(day, "EEE d")}
            </span>

            <span
                className={cn(
                    "ml-auto font-mono text-xs tabular-nums",
                    minutes === 0
                        ? "text-muted-foreground/50"
                        : "text-muted-foreground",
                )}
            >
                {formatMinutesAsHours(minutes)}
            </span>
        </div>
    );
}

interface DayColumnProps {
    day: Date;
    dayIndex: number;
    placements: Placement[];
    draggingId: string | null;
    ticks: Tick[];
    startHour: number;
    endHour: number;
    hourHeight: number;
    today: Date;
    now: number | null;
    onSelectSlot: (day: Date, minuteOfDay: number) => void;
    onBeginDrag: (
        event: React.PointerEvent<HTMLElement>,
        mode: "move" | "resize-start" | "resize-end",
        entryId: string,
        placement: EntryPlacement,
    ) => void;
}

function DayColumn({
    day,
    dayIndex,
    placements,
    draggingId,
    ticks,
    startHour,
    endHour,
    hourHeight,
    today,
    now,
    onSelectSlot,
    onBeginDrag,
}: DayColumnProps) {
    const isToday = day.toDateString() === today.toDateString();
    const positioned = layoutDay(placements);

    const minutesFromTop = (minute: number) =>
        ((minute - startHour * 60) / 60) * hourHeight;

    function handleBackgroundClick(event: React.MouseEvent<HTMLDivElement>) {
        const bounds = event.currentTarget.getBoundingClientRect();

        const minute =
            startHour * 60 + ((event.clientY - bounds.top) / hourHeight) * 60;

        onSelectSlot(
            day,
            Math.max(0, Math.round(minute / QUARTER_MINUTES) * QUARTER_MINUTES),
        );
    }

    const nowDate = now === null ? null : new Date(now);

    const nowMinute = nowDate
        ? nowDate.getHours() * 60 + nowDate.getMinutes()
        : 0;

    const showNowLine =
        nowDate !== null &&
        isToday &&
        nowMinute >= startHour * 60 &&
        nowMinute <= endHour * 60;

    return (
        <div
            data-day-index={dayIndex}
            className={cn(
                "relative border-l border-border/60",
                isWeekend(day) && "bg-muted/20",
            )}
        >
            <div
                role="button"
                tabIndex={-1}
                aria-label={`Add time on ${format(day, "EEEE d MMMM")}`}
                onClick={handleBackgroundClick}
                className="absolute inset-0 cursor-copy"
            >
                {ticks.map((tick, index) => (
                    <div
                        key={tick.minute}
                        className={cn(
                            "absolute inset-x-0 border-t",
                            index === 0
                                ? "border-transparent"
                                : tick.isHour
                                  ? "border-border/40"
                                  : "border-border/20",
                        )}
                        style={{
                            top: `${((tick.minute - startHour * 60) / 60) * hourHeight}px`,
                        }}
                    />
                ))}
            </div>

            {positioned.map(({ item, left, width }) => (
                <EntryBlock
                    key={item.entry.id}
                    entry={item.entry}
                    dayIndex={dayIndex}
                    startMinute={item.startMinute}
                    endMinute={item.endMinute}
                    top={minutesFromTop(item.startMinute)}
                    height={
                        ((item.endMinute - item.startMinute) / 60) * hourHeight
                    }
                    left={left}
                    width={width}
                    dragging={draggingId === item.entry.id}
                    onBeginDrag={onBeginDrag}
                />
            ))}

            {showNowLine && (
                <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 z-10 flex items-center"
                    style={{ top: `${minutesFromTop(nowMinute)}px` }}
                >
                    <span className="size-1.5 shrink-0 rounded-full bg-primary" />
                    <span className="h-px flex-1 bg-primary/70" />
                </div>
            )}
        </div>
    );
}

interface EntryBlockProps {
    entry: TimeEntryFieldsFragment;
    dayIndex: number;
    startMinute: number;
    endMinute: number;
    top: number;
    height: number;
    left: number;
    width: number;
    dragging: boolean;
    onBeginDrag: DayColumnProps["onBeginDrag"];
}

function EntryBlock({
    entry,
    dayIndex,
    startMinute,
    endMinute,
    top,
    height,
    left,
    width,
    dragging,
    onBeginDrag,
}: EntryBlockProps) {
    const color = projectColor(entry.project);

    // A running timer has no fixed end, so it is edited from the timer bar
    // rather than dragged around the grid.
    const interactive = !entry.isRunning;

    const placement: EntryPlacement = { dayIndex, startMinute, endMinute };

    const compact = height < 46;

    return (
        <div
            data-entry-id={entry.id}
            className={cn("absolute", dragging && "z-30 opacity-90 shadow-lg")}
            style={{
                top: `${top}px`,
                height: `${Math.max(height - 2, 20)}px`,
                left: `calc(${left * 100}% + 2px)`,
                width: `calc(${width * 100}% - 4px)`,
            }}
        >
            <EntryHoverCard entry={entry} disabled={dragging}>
                <button
                    type="button"
                    onPointerDown={(event) => {
                        if (interactive) {
                            onBeginDrag(event, "move", entry.id, placement);
                        }
                    }}
                    className={cn(
                        "flex size-full flex-col items-stretch justify-start overflow-hidden rounded-md border-l-2 px-1.5 text-left transition-[filter] hover:brightness-125",
                        compact ? "py-0" : "py-1",
                        interactive
                            ? "cursor-grab active:cursor-grabbing"
                            : "cursor-default",
                        entry.isRunning && "ring-1 ring-primary",
                    )}
                    style={{
                        borderLeftColor: color,
                        backgroundColor: `color-mix(in oklab, ${color} 26%, transparent)`,
                    }}
                >
                    <span className="block truncate text-[11px] font-medium leading-tight text-foreground">
                        {entry.kind === "MEETING" && (
                            <Users className="mr-1 inline size-2.5 align-[-1px]" />
                        )}
                        {entry.description}
                    </span>

                    {!compact && (
                        <span className="mt-0.5 block truncate text-[10px] leading-tight text-foreground/60">
                            {formatMinutesAsHours(entryBilledMinutes(entry))} h
                            {" · "}
                            {entry.project.name}
                        </span>
                    )}
                </button>
            </EntryHoverCard>

            {interactive && (
                <>
                    <ResizeHandle
                        edge="start"
                        entry={entry}
                        onPointerDown={(event) =>
                            onBeginDrag(
                                event,
                                "resize-start",
                                entry.id,
                                placement,
                            )
                        }
                    />

                    <ResizeHandle
                        edge="end"
                        entry={entry}
                        onPointerDown={(event) =>
                            onBeginDrag(
                                event,
                                "resize-end",
                                entry.id,
                                placement,
                            )
                        }
                    />
                </>
            )}
        </div>
    );
}

interface ResizeHandleProps {
    edge: "start" | "end";
    entry: TimeEntryFieldsFragment;
    onPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
}

function ResizeHandle({ edge, entry, onPointerDown }: ResizeHandleProps) {
    return (
        <div
            role="separator"
            aria-label={`${
                edge === "start" ? "Change start time" : "Change end time"
            } of ${entry.description}`}
            data-resize={edge}
            onPointerDown={onPointerDown}
            className={cn(
                "absolute inset-x-0 z-10 h-2 cursor-ns-resize",
                edge === "start" ? "top-0" : "bottom-0",
            )}
        />
    );
}

interface Tick {
    minute: number;
    label: string;
    isHour: boolean;
}

function buildTicks(
    startHour: number,
    endHour: number,
    tickMinutes: number,
): Tick[] {
    const ticks: Tick[] = [];

    for (
        let minute = startHour * 60;
        minute < endHour * 60;
        minute += tickMinutes
    ) {
        const hour = Math.floor(minute / 60);
        const rest = minute % 60;

        ticks.push({
            minute,
            label: `${String(hour).padStart(2, "0")}:${String(rest).padStart(2, "0")}`,
            isHour: rest === 0,
        });
    }

    return ticks;
}

function applyPreview(placement: Placement, preview: DragPreview): Placement {
    return {
        ...placement,
        dayIndex: preview.dayIndex,
        startMinute: preview.startMinute,
        endMinute: preview.endMinute,
    };
}

/** Clamp an entry to the day it is drawn on, so overnight work still fits. */
function toPlacement(
    entry: TimeEntryFieldsFragment,
    day: Date,
    dayIndex: number,
    now: number | null,
): Placement {
    const dayStart = startOfDay(day).getTime();

    const started = new Date(entry.startedAt).getTime();

    const ended = entry.endedAt
        ? new Date(entry.endedAt).getTime()
        : (now ?? started);

    const startMinute = Math.max(0, (started - dayStart) / 60_000);
    const endMinute = Math.min(MINUTES_PER_DAY, (ended - dayStart) / 60_000);

    return {
        id: entry.id,
        entry,
        dayIndex,
        startMinute,
        // Never shorter than a quarter, so every block stays readable.
        endMinute: Math.max(endMinute, startMinute + QUARTER_MINUTES),
    };
}

function windowFor(
    placements: readonly Placement[],
    dayStartHour: number,
    dayEndHour: number,
) {
    let startHour = dayStartHour;
    let endHour = dayEndHour;

    for (const placement of placements) {
        startHour = Math.min(startHour, Math.floor(placement.startMinute / 60));
        endHour = Math.max(endHour, Math.ceil(placement.endMinute / 60));
    }

    return {
        startHour: Math.max(0, startHour),
        endHour: Math.min(24, Math.max(endHour, startHour + 1)),
    };
}
