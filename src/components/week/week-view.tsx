"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@apollo/client/react";
import {
    addWeeks,
    eachDayOfInterval,
    format,
    getISOWeek,
    isSameDay,
    isSameMonth,
    isWeekend,
    startOfDay,
} from "date-fns";
import {
    ChevronLeft,
    ChevronRight,
    Minus,
    Plus,
    Settings2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SettingsDialog } from "@/components/settings/settings-dialog";
import { EntryDialog, type EntryDraft } from "@/components/timer/entry-dialog";
import { useEntryActions } from "@/components/timer/use-entry-actions";
import { WeekCalendar, ZOOM_LEVELS } from "@/components/week/week-calendar";
import { WeekSummary, type DayTally } from "@/components/week/week-summary";
import { useToday } from "@/hooks/use-clock";
import { usePreferences } from "@/hooks/use-preferences";
import {
    EntriesDocument,
    PreferencesDocument,
    ProjectsDocument,
    UpdatePreferencesDocument,
    type TimeEntryFieldsFragment,
} from "@/gql/graphql";
import { weekRange, type WeekStartsOn } from "@/lib/dates";
import { entryBilledMinutes, formatMinutesAsHours } from "@/lib/duration";
import { cn } from "@/lib/utils";

export function WeekView() {
    const today = useToday();
    const { preferences } = usePreferences();

    const [weekOffset, setWeekOffset] = useState(0);
    const [settingsOpen, setSettingsOpen] = useState(false);

    // Zoom is stored rather than local state, so it survives a refresh.
    const [savePreferences] = useMutation(UpdatePreferencesDocument, {
        refetchQueries: [PreferencesDocument],
    });

    const zoom = clampZoom(preferences.calendarZoom);

    const changeZoom = (next: number) => {
        void savePreferences({
            variables: { input: { calendarZoom: clampZoom(next) } },
        });
    };

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<TimeEntryFieldsFragment | null>(
        null,
    );
    const [dialogDay, setDialogDay] = useState<Date | null>(null);
    const [prefill, setPrefill] = useState<Partial<EntryDraft> | null>(null);

    const anchor = today ? addWeeks(today, weekOffset) : null;

    const range = anchor
        ? weekRange(anchor, preferences.weekStartsOn as WeekStartsOn)
        : null;

    const projectsQuery = useQuery(ProjectsDocument);

    const entriesQuery = useQuery(EntriesDocument, {
        variables: range
            ? { from: range.from.toISOString(), to: range.to.toISOString() }
            : { from: "", to: "" },
        skip: !range,
    });

    const { updateEntry, deleteEntry } = useEntryActions();

    const projects = projectsQuery.data?.projects ?? [];
    const entries = entriesQuery.data?.entries ?? [];

    // The query always covers the whole week so totals stay honest; only the
    // columns are hidden when weekends are switched off.
    const allDays = range
        ? eachDayOfInterval({ start: range.from, end: range.to })
        : [];

    const days = preferences.showWeekend
        ? allDays
        : allDays.filter((day) => !isWeekend(day));

    const entriesByDay = new Map<string, TimeEntryFieldsFragment[]>();

    for (const day of allDays) {
        entriesByDay.set(day.toDateString(), []);
    }

    for (const entry of entries) {
        const key = startOfDay(new Date(entry.startedAt)).toDateString();

        entriesByDay.get(key)?.push(entry);
    }

    const dailyTarget = preferences.dailyTargetMinutes;

    const tallies: DayTally[] = days.map((day) => ({
        date: day,
        billedMinutes: (entriesByDay.get(day.toDateString()) ?? []).reduce(
            (total, entry) => total + entryBilledMinutes(entry),
            0,
        ),
        targetMinutes: isWeekend(day) ? 0 : dailyTarget,
        isFuture: today ? day > today : false,
        isToday: today ? isSameDay(day, today) : false,
    }));

    const trackedMinutes = tallies.reduce(
        (total, day) => total + day.billedMinutes,
        0,
    );

    function openEntry(entry: TimeEntryFieldsFragment) {
        setEditing(entry);
        setPrefill(null);
        setDialogDay(startOfDay(new Date(entry.startedAt)));
        setDialogOpen(true);
    }

    const toTime = (minute: number) =>
        `${String(Math.floor(minute / 60) % 24).padStart(2, "0")}:${String(
            minute % 60,
        ).padStart(2, "0")}`;

    /** Clicking empty grid opens Add, pre-filled with the slot that was hit. */
    function openSlot(day: Date, minuteOfDay: number) {
        openRange(day, minuteOfDay, minuteOfDay + 60);
    }

    /** Sweeping out a range opens Add for exactly what was drawn. */
    function openRange(day: Date, startMinute: number, endMinute: number) {
        setEditing(null);
        setDialogDay(day);
        setPrefill({
            startTime: toTime(startMinute),
            endTime: toTime(endMinute),
        });
        setDialogOpen(true);
    }

    /** Copies land on the same slot as the original, ready to be adjusted. */
    function duplicateEntry(entry: TimeEntryFieldsFragment) {
        const day = startOfDay(new Date(entry.startedAt));
        const started = new Date(entry.startedAt);

        const startMinute = started.getHours() * 60 + started.getMinutes();

        setEditing(null);
        setDialogDay(day);
        setPrefill({
            description: entry.description,
            projectId: entry.project.id,
            ticketNumber: entry.ticketNumber ?? "",
            billingType: entry.billingType,
            kind: entry.kind,
            unbillablePercent: entry.unbillablePercent,
            startTime: toTime(startMinute),
            endTime: toTime(startMinute + entryBilledMinutes(entry)),
        });
        setDialogOpen(true);
    }

    return (
        <div className="flex w-full flex-1 flex-col px-5 py-4 lg:px-8 2xl:px-10">
            <header className="mb-3 flex flex-wrap items-end justify-between gap-4">
                <div className="min-w-0">
                    <h2 className="text-xl font-semibold tracking-tight">
                        {anchor ? `Week ${getISOWeek(anchor)}` : "Week"}
                    </h2>

                    <div className="mt-1 h-5 text-sm text-muted-foreground">
                        {range ? (
                            formatRange(range.from, range.to)
                        ) : (
                            <Skeleton className="h-4 w-44" />
                        )}
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-1">
                        <Button
                            type="button"
                            variant="outline"
                            size="icon-sm"
                            aria-label="Previous week"
                            onClick={() => setWeekOffset((week) => week - 1)}
                        >
                            <ChevronLeft />
                        </Button>

                        <Button
                            type="button"
                            variant={weekOffset === 0 ? "secondary" : "outline"}
                            size="sm"
                            onClick={() => setWeekOffset(0)}
                        >
                            This week
                        </Button>

                        <Button
                            type="button"
                            variant="outline"
                            size="icon-sm"
                            aria-label="Next week"
                            onClick={() => setWeekOffset((week) => week + 1)}
                        >
                            <ChevronRight />
                        </Button>
                    </div>

                    <div className="flex items-center gap-1">
                        <Button
                            type="button"
                            variant="outline"
                            size="icon-sm"
                            aria-label="Zoom out"
                            disabled={zoom === 0}
                            onClick={() => changeZoom(zoom - 1)}
                        >
                            <Minus />
                        </Button>

                        <Button
                            type="button"
                            variant="outline"
                            size="icon-sm"
                            aria-label="Zoom in"
                            disabled={zoom === ZOOM_LEVELS.length - 1}
                            onClick={() => changeZoom(zoom + 1)}
                        >
                            <Plus />
                        </Button>

                        <Button
                            type="button"
                            variant="outline"
                            size="icon-sm"
                            aria-label="Week settings"
                            onClick={() => setSettingsOpen(true)}
                        >
                            <Settings2 />
                        </Button>
                    </div>

                    <WeekTotal
                        trackedMinutes={trackedMinutes}
                        targetMinutes={preferences.weeklyTargetMinutes}
                    />
                </div>
            </header>

            <div className="mb-2">
                {days.length === 0 ? (
                    <Skeleton className="h-8 w-full rounded-lg" />
                ) : (
                    <WeekSummary
                        days={tallies}
                        onSelectDay={(day) =>
                            openSlot(day, preferences.dayStartHour * 60)
                        }
                    />
                )}
            </div>

            {entriesQuery.loading && entries.length === 0 ? (
                <Skeleton className="h-96 w-full rounded-xl" />
            ) : (
                today &&
                days.length > 0 && (
                    <WeekCalendar
                        days={days}
                        entriesByDay={entriesByDay}
                        hourHeight={ZOOM_LEVELS[zoom].hourHeight}
                        tickMinutes={ZOOM_LEVELS[zoom].tickMinutes}
                        today={today}
                        dayStartHour={preferences.dayStartHour}
                        dayEndHour={preferences.dayEndHour}
                        onEditEntry={openEntry}
                        onDuplicateEntry={duplicateEntry}
                        onDeleteEntry={(entry) => void deleteEntry(entry.id)}
                        onSelectSlot={openSlot}
                        onSelectRange={openRange}
                        onMoveEntry={(entry, startedAt, endedAt) =>
                            void updateEntry(entry.id, {
                                startedAt: startedAt.toISOString(),
                                endedAt: endedAt.toISOString(),
                            })
                        }
                    />
                )
            )}

            {dialogDay && (
                <EntryDialog
                    open={dialogOpen}
                    onOpenChange={setDialogOpen}
                    projects={projects}
                    day={dialogDay}
                    entry={editing}
                    initial={prefill}
                />
            )}

            <SettingsDialog
                open={settingsOpen}
                onOpenChange={setSettingsOpen}
            />
        </div>
    );
}

interface WeekTotalProps {
    trackedMinutes: number;
    targetMinutes: number;
}

function WeekTotal({ trackedMinutes, targetMinutes }: WeekTotalProps) {
    const complete = trackedMinutes >= targetMinutes;

    const progress =
        targetMinutes === 0
            ? 0
            : Math.min(100, (trackedMinutes / targetMinutes) * 100);

    return (
        <div className="w-44">
            <div className="flex items-baseline justify-between gap-2">
                <span className="text-[0.6875rem] uppercase tracking-[0.12em] text-muted-foreground">
                    Week
                </span>

                <span className="font-mono text-lg font-medium tabular-nums">
                    {formatMinutesAsHours(trackedMinutes)}

                    <span className="ml-1 text-xs font-normal text-muted-foreground">
                        / {formatMinutesAsHours(targetMinutes)} h
                    </span>
                </span>
            </div>

            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                    className={cn(
                        "h-full rounded-full transition-[width] duration-500",
                        complete ? "bg-emerald-500" : "bg-primary",
                    )}
                    style={{ width: `${progress}%` }}
                />
            </div>
        </div>
    );
}

function clampZoom(level: number): number {
    return Math.min(ZOOM_LEVELS.length - 1, Math.max(0, level));
}

function formatRange(from: Date, to: Date): string {
    return isSameMonth(from, to)
        ? `${format(from, "d")} – ${format(to, "d MMMM yyyy")}`
        : `${format(from, "d MMM")} – ${format(to, "d MMM yyyy")}`;
}
