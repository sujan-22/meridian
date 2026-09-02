"use client";

import { useRef, useState } from "react";
import { addMinutes, format, isWeekend, startOfDay } from "date-fns";
import { Calendar, Check, Plus, Users, X } from "lucide-react";

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
import { BillableSplit } from "@/components/timer/billable-split";
import { EntryHoverCard } from "@/components/timer/entry-hover-card";
import type {
    CalendarEventFieldsFragment,
    TimeEntryFieldsFragment,
} from "@/gql/graphql";
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
    { hourHeight: 104, tickMinutes: 60 },
    { hourHeight: 156, tickMinutes: 30 },
    { hourHeight: 224, tickMinutes: 15 },
] as const;

export const DEFAULT_ZOOM = 1;

/** Width of the time axis. The summary strip above lines up against it. */
export const AXIS_WIDTH = "3.25rem";
const MINUTES_PER_DAY = 24 * 60;
const POPOVER_WIDTH = 288;

/**
 * Share of a day column given over to calendar meetings when there are any.
 * A day with none keeps its full width for tracked time.
 */
const MEETING_LANE = 0.34;

/** Minutes since midnight, in the viewer's own timezone. */
function minuteOfDay(date: Date): number {
    return date.getHours() * 60 + date.getMinutes();
}

interface WeekCalendarProps {
    days: readonly Date[];
    /** What a working day is expected to hold, for the shortfall readout. */
    dailyTargetMinutes: number;
    /** Google Calendar meetings, keyed the same way as the entries. */
    eventsByDay: ReadonlyMap<string, CalendarEventFieldsFragment[]>;
    onPromoteEvent: (event: CalendarEventFieldsFragment) => void;
    onDismissEvent: (event: CalendarEventFieldsFragment) => void;
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
    onDeleteEntry: (entry: TimeEntryFieldsFragment) => void;
    onSelectSlot: (day: Date, minuteOfDay: number) => void;
    /** A range swept out on empty grid. */
    onSelectRange: (day: Date, startMinute: number, endMinute: number) => void;
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
    eventsByDay,
    onPromoteEvent,
    onDismissEvent,
    dailyTargetMinutes,
    hourHeight,
    tickMinutes,
    today,
    dayStartHour,
    dayEndHour,
    onEditEntry,
    onDuplicateEntry,
    onDeleteEntry,
    onSelectSlot,
    onSelectRange,
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

    /** The block being swept out on empty grid, before it becomes an entry. */
    const [sketch, setSketch] = useState<{
        dayIndex: number;
        startMinute: number;
        endMinute: number;
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
                                dailyTargetMinutes={dailyTargetMinutes}
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
                                            ? "text-[0.625rem] text-muted-foreground"
                                            : "text-[0.5625rem] text-muted-foreground/55",
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
                                events={
                                    eventsByDay.get(day.toDateString()) ?? []
                                }
                                onPromoteEvent={onPromoteEvent}
                                onDismissEvent={onDismissEvent}
                                draggingId={preview?.entryId ?? null}
                                ticks={ticks}
                                startHour={startHour}
                                endHour={endHour}
                                hourHeight={hourHeight}
                                today={today}
                                now={now}
                                onSelectSlot={onSelectSlot}
                                onBeginDrag={begin}
                                sketch={
                                    sketch?.dayIndex === dayIndex
                                        ? sketch
                                        : null
                                }
                                onSketch={setSketch}
                                onSketchDone={(day, from, to) => {
                                    setSketch(null);
                                    onSelectRange(day, from, to);
                                }}
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
                        onDelete={runAction(onDeleteEntry)}
                    />
                )}
            </div>
        </div>
    );
}

interface MeetingBlockProps {
    event: CalendarEventFieldsFragment;
    top: number;
    height: number;
    left: number;
    width: number;
    onPromote: (event: CalendarEventFieldsFragment) => void;
    onDismiss: (event: CalendarEventFieldsFragment) => void;
}

/**
 * A meeting read from Google, drawn as an outline rather than a solid block:
 * it is not tracked time yet, and should not read as though it were. Clicking
 * it accepts it into the day.
 */
function MeetingBlock({
    event,
    top,
    height,
    left,
    width,
    onPromote,
    onDismiss,
}: MeetingBlockProps) {
    const start = new Date(event.startsAt);
    const end = new Date(event.endsAt);
    const minutes = Math.round((end.getTime() - start.getTime()) / 60_000);

    return (
        <div
            className="group absolute"
            style={{
                top: `${top}px`,
                height: `${Math.max(height, 14)}px`,
                left: `${left * 100}%`,
                width: `${width * 100}%`,
            }}
        >
            <button
                type="button"
                onClick={() => onPromote(event)}
                title={`${event.title} · ${format(start, "HH:mm")}–${format(end, "HH:mm")}\nClick to add to the day`}
                aria-label={`Add "${event.title}" at ${format(start, "HH:mm")} to the day`}
                className="flex size-full flex-col items-stretch justify-start overflow-hidden rounded-md border border-dashed border-primary/45 bg-primary/5 px-1.5 py-1 text-left transition-colors hover:border-primary/80 hover:bg-primary/15"
            >
                {/* A quarter-hour box has room for one line, and the title
                    is the part worth reading - the time is already told by
                    where the block sits. */}
                {minutes < QUARTER_MINUTES * 2 ? (
                    <span className="flex items-center gap-1 text-[0.6875rem] text-foreground/80">
                        <Calendar className="size-2.5 shrink-0 text-primary/80" />

                        <span className="truncate">{event.title}</span>
                    </span>
                ) : (
                    <>
                        <span className="flex items-center gap-1 text-[0.625rem] text-primary/80">
                            <Calendar className="size-2.5 shrink-0" />

                            <span className="truncate font-mono tabular-nums">
                                {format(start, "HH:mm")}
                            </span>
                        </span>

                        <span className="mt-0.5 line-clamp-4 text-[0.6875rem] leading-tight text-foreground/80">
                            {event.title}
                        </span>
                    </>
                )}
            </button>

            {/* Both actions stay out of the way until the block is hovered. */}
            <span className="pointer-events-none absolute right-0.5 top-0.5 flex gap-0.5 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
                <button
                    type="button"
                    aria-label={`Add "${event.title}" to the day`}
                    onClick={() => onPromote(event)}
                    className="flex size-4 items-center justify-center rounded bg-primary text-primary-foreground"
                >
                    <Plus className="size-3" />
                </button>

                <button
                    type="button"
                    aria-label={`Hide "${event.title}"`}
                    onClick={() => onDismiss(event)}
                    className="flex size-4 items-center justify-center rounded bg-muted text-muted-foreground hover:text-foreground"
                >
                    <X className="size-3" />
                </button>
            </span>
        </div>
    );
}

interface DayHeadingProps {
    dailyTargetMinutes: number;
    day: Date;
    today: Date;
    entries?: readonly TimeEntryFieldsFragment[];
}

/**
 * How far a day is from what it should hold.
 *
 * Days that have not happened yet are not short of anything, and a weekend is
 * not expected to hold work at all.
 */
function dayShortfall(
    day: Date,
    today: Date,
    minutes: number,
    dailyTargetMinutes: number,
): number {
    if (day > today || isWeekend(day)) {
        return 0;
    }

    return Math.max(0, dailyTargetMinutes - minutes);
}

function DayHeading({
    day,
    today,
    dailyTargetMinutes,
    entries,
}: DayHeadingProps) {
    const isToday = day.toDateString() === today.toDateString();

    const minutes = (entries ?? []).reduce(
        (total, entry) => total + entryBilledMinutes(entry),
        0,
    );

    const shortfall = dayShortfall(day, today, minutes, dailyTargetMinutes);
    const complete = !isWeekend(day) && minutes >= dailyTargetMinutes;

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

            {/* The day is short: say by how much, right where the total is. */}
            {shortfall > 0 && (
                <span className="ml-auto font-mono text-[0.625rem] tabular-nums text-amber-400">
                    −{formatMinutesAsHours(shortfall)}
                </span>
            )}

            {complete && (
                <Check className="ml-auto size-3 shrink-0 self-center text-emerald-500" />
            )}

            <span
                className={cn(
                    "font-mono text-xs tabular-nums",
                    shortfall > 0 || complete ? "" : "ml-auto",
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
    events: readonly CalendarEventFieldsFragment[];
    onPromoteEvent: (event: CalendarEventFieldsFragment) => void;
    onDismissEvent: (event: CalendarEventFieldsFragment) => void;
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
    sketch: { startMinute: number; endMinute: number } | null;
    onSketch: (
        sketch: {
            dayIndex: number;
            startMinute: number;
            endMinute: number;
        } | null,
    ) => void;
    onSketchDone: (day: Date, startMinute: number, endMinute: number) => void;
}

function DayColumn({
    day,
    dayIndex,
    placements,
    events,
    onPromoteEvent,
    onDismissEvent,
    draggingId,
    ticks,
    startHour,
    endHour,
    hourHeight,
    today,
    now,
    onSelectSlot,
    onBeginDrag,
    sketch,
    onSketch,
    onSketchDone,
}: DayColumnProps) {
    const isToday = day.toDateString() === today.toDateString();
    const positioned = layoutDay(placements);

    /**
     * Meetings not yet accepted. Promoted ones are already drawn as entries in
     * the primary lane, so leaving them here too would show the same hour
     * twice.
     */
    const pending = events.filter((event) => !event.isPromoted);

    const meetingPlacements = pending.map((event) => ({
        id: event.id,
        event,
        startMinute: minuteOfDay(new Date(event.startsAt)),
        endMinute: minuteOfDay(new Date(event.endsAt)),
    }));

    const meetings = layoutDay(meetingPlacements);

    // The lane only takes space when it has something to show.
    const trackWidth = pending.length > 0 ? 1 - MEETING_LANE : 1;

    const minutesFromTop = (minute: number) =>
        ((minute - startHour * 60) / 60) * hourHeight;

    /** Pointer position -> the quarter-hour line nearest to it. */
    function minuteAt(clientY: number, bounds: DOMRect): number {
        const minute =
            startHour * 60 + ((clientY - bounds.top) / hourHeight) * 60;

        return Math.max(
            0,
            Math.min(
                MINUTES_PER_DAY,
                Math.round(minute / QUARTER_MINUTES) * QUARTER_MINUTES,
            ),
        );
    }

    /**
     * Sweeping down empty grid draws the block as it goes and opens Add with
     * that range; a press that never moves is treated as a plain click.
     */
    function handleBackgroundPointerDown(
        event: React.PointerEvent<HTMLDivElement>,
    ) {
        if (event.button !== 0) {
            return;
        }

        const bounds = event.currentTarget.getBoundingClientRect();
        const anchorMinute = minuteAt(event.clientY, bounds);

        let moved = false;

        const handleMove = (moveEvent: PointerEvent) => {
            const current = minuteAt(moveEvent.clientY, bounds);

            if (!moved && current === anchorMinute) {
                return;
            }

            moved = true;

            onSketch({
                dayIndex,
                startMinute: Math.min(anchorMinute, current),
                endMinute: Math.max(
                    anchorMinute + QUARTER_MINUTES,
                    Math.max(current, anchorMinute),
                ),
            });
        };

        const finish = (upEvent: PointerEvent) => {
            window.removeEventListener("pointermove", handleMove);
            window.removeEventListener("pointerup", finish);

            if (!moved) {
                onSketch(null);
                onSelectSlot(day, anchorMinute);

                return;
            }

            const end = minuteAt(upEvent.clientY, bounds);

            onSketchDone(
                day,
                Math.min(anchorMinute, end),
                Math.max(
                    Math.min(anchorMinute, end) + QUARTER_MINUTES,
                    Math.max(anchorMinute, end),
                ),
            );
        };

        window.addEventListener("pointermove", handleMove);
        window.addEventListener("pointerup", finish);
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
                onPointerDown={handleBackgroundPointerDown}
                className="absolute inset-0 cursor-copy select-none"
            >
                {ticks.map((tick, index) => (
                    <div
                        key={tick.minute}
                        className={cn(
                            "absolute inset-x-0 border-t",
                            index === 0
                                ? "border-transparent"
                                : tick.isHour
                                  ? "border-grid-hour"
                                  : tick.isHalf
                                    ? "border-grid-half"
                                    : "border-grid-quarter",
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
                    left={left * trackWidth}
                    width={width * trackWidth}
                    dragging={draggingId === item.entry.id}
                    onBeginDrag={onBeginDrag}
                />
            ))}

            {meetings.map(({ item, left, width }) => (
                <MeetingBlock
                    key={item.id}
                    event={item.event}
                    top={minutesFromTop(item.startMinute)}
                    height={
                        ((item.endMinute - item.startMinute) / 60) * hourHeight
                    }
                    left={trackWidth + left * MEETING_LANE}
                    width={width * MEETING_LANE}
                    onPromote={onPromoteEvent}
                    onDismiss={onDismissEvent}
                />
            ))}

            {sketch && (
                <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0.5 z-20 rounded-md border border-dashed border-primary bg-primary/20 px-1.5 py-1"
                    style={{
                        top: `${minutesFromTop(sketch.startMinute)}px`,
                        height: `${((sketch.endMinute - sketch.startMinute) / 60) * hourHeight}px`,
                    }}
                >
                    <span className="font-mono text-[0.625rem] tabular-nums text-foreground">
                        {formatMinutesAsHours(
                            sketch.endMinute - sketch.startMinute,
                        )}{" "}
                        h
                    </span>
                </div>
            )}

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

    // A quarter hour stays on one line with an ellipsis; anything half an hour
    // or longer gets as many lines as its block can hold, so the description
    // is not cut off at a handful of words when there is room to show it.
    const durationMinutes = endMinute - startMinute;

    const LINE_HEIGHT = 14;
    const CHROME = compact ? 4 : 24;

    const descriptionLines =
        durationMinutes < 2 * QUARTER_MINUTES
            ? 1
            : Math.max(1, Math.floor((height - CHROME) / LINE_HEIGHT));

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
                    <span
                        className="block overflow-hidden text-[0.6875rem] font-medium leading-tight text-foreground"
                        style={
                            descriptionLines === 1
                                ? {
                                      whiteSpace: "nowrap",
                                      textOverflow: "ellipsis",
                                  }
                                : {
                                      display: "-webkit-box",
                                      WebkitBoxOrient: "vertical",
                                      WebkitLineClamp: descriptionLines,
                                  }
                        }
                    >
                        {entry.kind === "MEETING" && (
                            <Users className="mr-1 inline size-2.5 align-[-1px]" />
                        )}
                        {entry.description}
                    </span>

                    {!compact && (
                        <span className="mt-0.5 block truncate text-[0.625rem] leading-tight text-foreground/60">
                            <BillableSplit
                                billableMinutes={entry.billableMinutes}
                                unbillableMinutes={entry.unbillableMinutes}
                                compact
                            />
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
    /** Half past. Sits between the hour and the quarters in weight. */
    isHalf: boolean;
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
            isHalf: rest === 30,
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
