"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@apollo/client/react";
import { addWeeks, format, getISOWeek, isSameMonth } from "date-fns";
import {
    Check,
    ChevronLeft,
    ChevronRight,
    CircleDollarSign,
    RotateCcw,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { TimesheetRow } from "@/components/timesheet/timesheet-row";
import { useToday } from "@/hooks/use-clock";
import { useCopy } from "@/hooks/use-copy";
import { usePreferences } from "@/hooks/use-preferences";
import {
    CompleteTimesheetWeekDocument,
    EntriesDocument,
    MarkTimeEntriesTransferredDocument,
    ReopenTimesheetWeekDocument,
    TimesheetWeekDocument,
} from "@/gql/graphql";
import { toDateKey, weekRange, type WeekStartsOn } from "@/lib/dates";
import { formatMinutesAsHours } from "@/lib/duration";
import { projectColor } from "@/lib/project-color";
import {
    buildTimesheet,
    timesheetProgress,
    type TimesheetEntry,
    type TimesheetMode,
    type TimesheetRow as Row,
} from "@/lib/timesheet";
import { cn } from "@/lib/utils";

const MODE_OPTIONS: Array<{ value: TimesheetMode; label: string }> = [
    { value: "combined", label: "Combined" },
    { value: "individual", label: "Individual" },
];

export function TimesheetView() {
    const today = useToday();
    const { preferences } = usePreferences();

    const [weekOffset, setWeekOffset] = useState(0);
    const [mode, setMode] = useState<TimesheetMode>("combined");
    const [hideEntered, setHideEntered] = useState(false);

    const { copiedKey, copy } = useCopy();

    const anchor = today ? addWeeks(today, weekOffset) : null;

    const range = anchor
        ? weekRange(anchor, preferences.weekStartsOn as WeekStartsOn)
        : null;

    const entriesQuery = useQuery(EntriesDocument, {
        variables: range
            ? { from: range.from.toISOString(), to: range.to.toISOString() }
            : { from: "", to: "" },
        skip: !range,
    });

    const weekQuery = useQuery(TimesheetWeekDocument, {
        variables: range
            ? {
                  weekStart: toDateKey(range.from),
                  weekEnd: toDateKey(range.to),
              }
            : { weekStart: "1970-01-01", weekEnd: "1970-01-01" },
        skip: !range,
    });

    const refetchAll = {
        refetchQueries: [EntriesDocument, TimesheetWeekDocument],
        awaitRefetchQueries: true,
    };

    const [markTransferred] = useMutation(
        MarkTimeEntriesTransferredDocument,
        refetchAll,
    );
    const [completeWeek] = useMutation(
        CompleteTimesheetWeekDocument,
        refetchAll,
    );
    const [reopenWeek] = useMutation(ReopenTimesheetWeekDocument, refetchAll);

    const entries = (entriesQuery.data?.entries ?? []) as TimesheetEntry[];

    // Running work has no final duration yet, so it is not ready to transfer.
    const finished = entries.filter((entry) => entry.endedAt);

    const days = buildTimesheet(finished, mode);
    const progress = timesheetProgress(days);

    const week = weekQuery.data?.timesheetWeek;
    const everythingEntered =
        progress.entryCount > 0 && progress.enteredCount === progress.entryCount;

    async function toggleEntered(row: Row<TimesheetEntry>, entered: boolean) {
        await markTransferred({
            variables: {
                ids: row.entries.map((entry) => entry.id),
                transferred: entered,
            },
        });
    }

    async function markDay(dayKey: string, entered: boolean) {
        const day = days.find((candidate) => candidate.key === dayKey);

        if (!day) {
            return;
        }

        const ids = day.projects.flatMap((group) =>
            group.rows.flatMap((row) => row.entries.map((entry) => entry.id)),
        );

        await markTransferred({ variables: { ids, transferred: entered } });
    }

    async function toggleWeekComplete() {
        if (!range) {
            return;
        }

        const variables = {
            weekStart: toDateKey(range.from),
            weekEnd: toDateKey(range.to),
        };

        if (week?.isComplete) {
            await reopenWeek({ variables });

            toast.add({ title: "Week reopened", type: "info" });

            return;
        }

        await completeWeek({ variables });

        toast.add({ title: "Week marked complete", type: "success" });
    }

    const visibleDays = hideEntered
        ? days
              .map((day) => ({
                  ...day,
                  projects: day.projects
                      .map((group) => ({
                          ...group,
                          rows: group.rows.filter((row) => !row.allEntered),
                      }))
                      .filter((group) => group.rows.length > 0),
              }))
              .filter((day) => day.projects.length > 0)
        : days;

    return (
        <div className="flex w-full flex-1 flex-col px-5 py-6 lg:px-8 2xl:px-10">
            <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
                <div className="min-w-0">
                    <h2 className="text-xl font-semibold tracking-tight">
                        Timesheet
                    </h2>

                    <div className="mt-1 h-5 text-sm text-muted-foreground">
                        {range && anchor ? (
                            `Week ${getISOWeek(anchor)} · ${formatRange(range.from, range.to)}`
                        ) : (
                            <Skeleton className="h-4 w-52" />
                        )}
                    </div>
                </div>

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
            </header>

            <ProgressPanel
                progress={progress}
                targetMinutes={preferences.weeklyTargetMinutes}
                isComplete={Boolean(week?.isComplete)}
                canComplete={everythingEntered}
                onToggleComplete={toggleWeekComplete}
            />

            <div className="mb-4 mt-4 flex flex-wrap items-center gap-2">
                <Segmented
                    label="Show"
                    options={MODE_OPTIONS}
                    value={mode}
                    onChange={setMode}
                />

                <Button
                    type="button"
                    variant={hideEntered ? "secondary" : "outline"}
                    size="sm"
                    aria-pressed={hideEntered}
                    onClick={() => setHideEntered((hidden) => !hidden)}
                    className="gap-1.5"
                >
                    <Check className="size-3.5" />
                    Hide entered
                </Button>
            </div>

            {entriesQuery.loading && entries.length === 0 ? (
                <div className="flex flex-col gap-3">
                    <Skeleton className="h-32 w-full rounded-xl" />
                    <Skeleton className="h-32 w-full rounded-xl" />
                </div>
            ) : visibleDays.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/70 px-6 py-16 text-center">
                    <p className="text-sm text-muted-foreground">
                        {days.length === 0
                            ? "Nothing tracked this week yet."
                            : "Everything has been entered into Polaris."}
                    </p>
                </div>
            ) : (
                <div className="flex flex-col gap-5">
                    {visibleDays.map((day) => (
                        <section key={day.key}>
                            <header className="mb-2 flex items-baseline justify-between gap-3">
                                <h3 className="text-xs font-medium uppercase tracking-[0.12em]">
                                    {format(day.date, "EEEE d MMMM")}
                                </h3>

                                <div className="flex items-center gap-3">
                                    <span className="text-[0.6875rem] text-muted-foreground">
                                        {day.enteredCount}/{day.entryCount}{" "}
                                        entered
                                    </span>

                                    <span className="font-mono text-sm font-medium tabular-nums">
                                        {formatMinutesAsHours(
                                            day.billedMinutes,
                                        )}{" "}
                                        h
                                    </span>

                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="xs"
                                        aria-label={`Mark all of ${format(day.date, "EEEE")} entered`}
                                        onClick={() =>
                                            void markDay(
                                                day.key,
                                                day.enteredCount <
                                                    day.entryCount,
                                            )
                                        }
                                    >
                                        {day.enteredCount < day.entryCount
                                            ? "Mark all"
                                            : "Unmark all"}
                                    </Button>
                                </div>
                            </header>

                            <div className="overflow-hidden rounded-xl border border-border/70 bg-card">
                                {day.projects.map((group, index) => (
                                    <div
                                        key={group.key}
                                        className={cn(
                                            index > 0 &&
                                                "border-t border-border/60",
                                        )}
                                    >
                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border/40 bg-muted/20 px-3 py-2">
                                            <span
                                                aria-hidden
                                                className="size-2.5 shrink-0 rounded-full"
                                                style={{
                                                    backgroundColor:
                                                        projectColor(
                                                            group.project,
                                                        ),
                                                }}
                                            />

                                            <span className="text-xs font-medium">
                                                {group.project.name}
                                            </span>

                                            <span className="text-[0.6875rem] text-muted-foreground">
                                                {group.project.client
                                                    .shortName ??
                                                    group.project.client.name}
                                            </span>

                                            {group.project.polarisTask && (
                                                <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.625rem] text-foreground/70">
                                                    {group.project.polarisTask}
                                                </span>
                                            )}

                                            <span
                                                className={cn(
                                                    "flex items-center gap-1 text-[0.6875rem]",
                                                    group.billingType ===
                                                        "BILLABLE"
                                                        ? "text-emerald-400"
                                                        : "text-muted-foreground",
                                                )}
                                            >
                                                <CircleDollarSign className="size-3" />
                                                {group.billingType ===
                                                "BILLABLE"
                                                    ? "Billable"
                                                    : "Non-billable"}
                                            </span>

                                            <span className="ml-auto font-mono text-xs font-medium tabular-nums text-muted-foreground">
                                                {formatMinutesAsHours(
                                                    group.billedMinutes,
                                                )}{" "}
                                                h
                                            </span>
                                        </div>

                                        <div className="divide-y divide-border/40">
                                            {group.rows.map((row) => (
                                                <TimesheetRow
                                                    key={row.key}
                                                    row={row}
                                                    copiedKey={copiedKey}
                                                    onCopy={copy}
                                                    onToggleEntered={(
                                                        target,
                                                        entered,
                                                    ) =>
                                                        void toggleEntered(
                                                            target,
                                                            entered,
                                                        )
                                                    }
                                                />
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    ))}
                </div>
            )}
        </div>
    );
}

interface ProgressPanelProps {
    progress: ReturnType<typeof timesheetProgress>;
    targetMinutes: number;
    isComplete: boolean;
    canComplete: boolean;
    onToggleComplete: () => void;
}

function ProgressPanel({
    progress,
    targetMinutes,
    isComplete,
    canComplete,
    onToggleComplete,
}: ProgressPanelProps) {
    const entryPercent =
        progress.entryCount === 0
            ? 0
            : (progress.enteredCount / progress.entryCount) * 100;

    return (
        <div
            className={cn(
                "rounded-xl border p-4",
                isComplete
                    ? "border-emerald-500/40 bg-emerald-500/5"
                    : "border-border/70 bg-card",
            )}
        >
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
                    <Stat
                        label="Entered"
                        value={`${progress.enteredCount} / ${progress.entryCount}`}
                        suffix="entries"
                    />

                    <Stat
                        label="Transferred"
                        value={formatMinutesAsHours(progress.enteredMinutes)}
                        suffix={`/ ${formatMinutesAsHours(progress.billedMinutes)} h`}
                    />

                    <Stat
                        label="Week"
                        value={formatMinutesAsHours(progress.billedMinutes)}
                        suffix={`/ ${formatMinutesAsHours(targetMinutes)} h`}
                    />
                </div>

                <Button
                    type="button"
                    variant={isComplete ? "outline" : "default"}
                    size="sm"
                    disabled={!isComplete && !canComplete}
                    title={
                        !isComplete && !canComplete
                            ? "Every entry has to be ticked off first"
                            : undefined
                    }
                    onClick={onToggleComplete}
                    className="gap-1.5"
                >
                    {isComplete ? (
                        <>
                            <RotateCcw className="size-3.5" />
                            Reopen week
                        </>
                    ) : (
                        <>
                            <Check className="size-3.5" />
                            Mark week complete
                        </>
                    )}
                </Button>
            </div>

            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                    className="h-full rounded-full bg-emerald-500 transition-[width] duration-500"
                    style={{ width: `${entryPercent}%` }}
                />
            </div>
        </div>
    );
}

interface StatProps {
    label: string;
    value: string;
    suffix: string;
}

function Stat({ label, value, suffix }: StatProps) {
    return (
        <div>
            <p className="text-[0.6875rem] uppercase tracking-[0.12em] text-muted-foreground">
                {label}
            </p>

            <p className="mt-0.5 font-mono text-lg font-medium tabular-nums">
                {value}
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                    {suffix}
                </span>
            </p>
        </div>
    );
}

interface SegmentedProps<T extends string> {
    label: string;
    options: Array<{ value: T; label: string }>;
    value: T;
    onChange: (value: T) => void;
}

function Segmented<T extends string>({
    label,
    options,
    value,
    onChange,
}: SegmentedProps<T>) {
    return (
        <div className="flex items-center gap-2">
            <span className="hidden text-xs text-muted-foreground sm:inline">
                {label}
            </span>

            <div
                role="radiogroup"
                aria-label={label}
                className="inline-flex rounded-md border border-input p-0.5"
            >
                {options.map((option) => (
                    <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={option.value === value}
                        onClick={() => onChange(option.value)}
                        className={cn(
                            "h-7 rounded-[6px] px-2.5 text-xs font-medium transition-colors",
                            option.value === value
                                ? "bg-secondary text-secondary-foreground"
                                : "text-muted-foreground hover:text-foreground",
                        )}
                    >
                        {option.label}
                    </button>
                ))}
            </div>
        </div>
    );
}

function formatRange(from: Date, to: Date): string {
    return isSameMonth(from, to)
        ? `${format(from, "d")} – ${format(to, "d MMMM yyyy")}`
        : `${format(from, "d MMM")} – ${format(to, "d MMM yyyy")}`;
}
