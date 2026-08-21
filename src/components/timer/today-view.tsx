"use client";

import { useState } from "react";
import { useQuery } from "@apollo/client/react";
import { format } from "date-fns";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DayTotal } from "@/components/timer/day-total";
import {
    EntryDialog,
    shiftQuarters,
    type EntryDraft,
} from "@/components/timer/entry-dialog";
import { EntryList, type GroupMode } from "@/components/timer/entry-list";
import { RecentStrip } from "@/components/timer/recent-strip";
import { nearestQuarterTime } from "@/components/timer/time-select";
import { TimerBar, type TimerDraft } from "@/components/timer/timer-bar";
import { useEntryActions } from "@/components/timer/use-entry-actions";
import { useToday } from "@/hooks/use-clock";
import {
    ActiveTimerDocument,
    EntriesDocument,
    ProjectsDocument,
    RecentEntriesDocument,
    type TimeEntryFieldsFragment,
} from "@/gql/graphql";
import { dayRange } from "@/lib/dates";
import { entryBilledMinutes, QUARTER_MINUTES } from "@/lib/duration";
import { cn } from "@/lib/utils";

const EMPTY_DRAFT: TimerDraft = {
    description: "",
    projectId: null,
    ticketNumber: "",
    kind: "WORK",
};

const GROUP_OPTIONS: Array<{ value: GroupMode; label: string }> = [
    { value: "none", label: "None" },
    { value: "project", label: "Project" },
    { value: "client", label: "Client" },
];

export function TodayView() {
    const today = useToday();

    const [draft, setDraft] = useState<TimerDraft>(EMPTY_DRAFT);
    const [groupBy, setGroupBy] = useState<GroupMode>("none");

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<TimeEntryFieldsFragment | null>(null);
    const [prefill, setPrefill] = useState<Partial<EntryDraft> | null>(null);

    const projectsQuery = useQuery(ProjectsDocument);
    const activeQuery = useQuery(ActiveTimerDocument);
    const recentQuery = useQuery(RecentEntriesDocument, {
        variables: { limit: 5 },
    });

    const range = today ? dayRange(today) : null;

    const entriesQuery = useQuery(EntriesDocument, {
        variables: range
            ? { from: range.from.toISOString(), to: range.to.toISOString() }
            : { from: "", to: "" },
        skip: !range,
    });

    const { startTimer, deleteEntry } = useEntryActions();

    const projects = projectsQuery.data?.projects ?? [];
    const activeEntry = activeQuery.data?.activeTimer ?? null;
    const entries = entriesQuery.data?.entries ?? [];

    const finished = entries.filter((entry) => !entry.isRunning);

    const billableMinutes = finished
        .filter((entry) => entry.billingType === "BILLABLE")
        .reduce((total, entry) => total + entryBilledMinutes(entry), 0);

    const nonBillableMinutes = finished
        .filter((entry) => entry.billingType !== "BILLABLE")
        .reduce((total, entry) => total + entryBilledMinutes(entry), 0);

    /** Resume past work immediately - same project and ticket, timer running. */
    function handleContinue(entry: TimeEntryFieldsFragment) {
        void startTimer({
            projectId: entry.project.id,
            description: entry.description,
            ticketNumber: entry.ticketNumber,
            kind: entry.kind,
        });
    }

    /**
     * Open a pre-filled Add dialog rather than writing straight away, so the
     * copy can be adjusted before it lands - and parked in the next free slot
     * after the day's last entry so it never lands on top of existing work.
     */
    function handleDuplicate(entry: TimeEntryFieldsFragment) {
        const startTime = nextFreeSlot(entries);

        setEditing(null);
        setPrefill({
            description: entry.description,
            projectId: entry.project.id,
            ticketNumber: entry.ticketNumber ?? "",
            billingType: entry.billingType,
            kind: entry.kind,
            startTime,
            endTime: shiftQuarters(
                startTime,
                Math.max(1, entryBilledMinutes(entry) / QUARTER_MINUTES),
            ),
        });
        setDialogOpen(true);
    }

    function handleEdit(entry: TimeEntryFieldsFragment) {
        setPrefill(null);
        setEditing(entry);
        setDialogOpen(true);
    }

    function handleAdd() {
        setPrefill({ startTime: nextFreeSlot(entries) });
        setEditing(null);
        setDialogOpen(true);
    }

    return (
        <div className="flex w-full flex-1 flex-col px-5 py-6 lg:px-8 2xl:px-10">
            <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h2 className="text-xl font-semibold tracking-tight">
                        Today
                    </h2>

                    {/* The date depends on the browser timezone, so it stays
                        a placeholder until the clock store has mounted. */}
                    <div className="mt-1 h-5 text-sm text-muted-foreground">
                        {today ? (
                            format(today, "EEEE, d MMMM yyyy")
                        ) : (
                            <Skeleton className="h-4 w-40" />
                        )}
                    </div>
                </div>

                <DayTotal
                    billableMinutes={billableMinutes}
                    nonBillableMinutes={nonBillableMinutes}
                    runningSince={activeEntry?.startedAt}
                    runningIsBillable={activeEntry?.billingType === "BILLABLE"}
                />
            </header>

            <TimerBar
                projects={projects}
                activeEntry={activeEntry}
                loadingProjects={projectsQuery.loading}
                projectsError={Boolean(projectsQuery.error)}
                draft={draft}
                onDraftChange={setDraft}
            />

            {!activeEntry && (
                <div className="mt-5">
                    <RecentStrip
                        entries={recentQuery.data?.recentEntries ?? []}
                        onContinue={handleContinue}
                    />
                </div>
            )}

            <section className="mt-8 flex flex-1 flex-col">
                <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <h3 className="text-sm font-medium">
                            Today&apos;s entries
                        </h3>

                        <p className="mt-0.5 text-xs text-muted-foreground">
                            {entries.length === 0
                                ? "Your tracked work will appear here."
                                : `${entries.length} ${entries.length === 1 ? "entry" : "entries"}`}
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <GroupSwitch value={groupBy} onChange={setGroupBy} />

                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleAdd}
                            disabled={projects.length === 0}
                            className="gap-1.5"
                        >
                            <Plus className="size-3.5" />
                            Add manually
                        </Button>
                    </div>
                </div>

                {entriesQuery.loading && entries.length === 0 ? (
                    <div className="flex flex-col gap-2">
                        <Skeleton className="h-16 w-full rounded-xl" />
                        <Skeleton className="h-16 w-full rounded-xl" />
                    </div>
                ) : (
                    <EntryList
                        entries={entries}
                        groupBy={groupBy}
                        onContinue={handleContinue}
                        onDuplicate={handleDuplicate}
                        onEdit={handleEdit}
                        onDelete={(entry) => void deleteEntry(entry.id)}
                    />
                )}
            </section>

            {today && (
                <EntryDialog
                    open={dialogOpen}
                    onOpenChange={setDialogOpen}
                    projects={projects}
                    day={today}
                    entry={editing}
                    initial={prefill}
                />
            )}
        </div>
    );
}

interface GroupSwitchProps {
    value: GroupMode;
    onChange: (mode: GroupMode) => void;
}

function GroupSwitch({ value, onChange }: GroupSwitchProps) {
    return (
        <div className="flex items-center gap-2">
            <span className="hidden text-xs text-muted-foreground sm:inline">
                Group by
            </span>

            <div
                role="radiogroup"
                aria-label="Group entries by"
                className="inline-flex rounded-md border border-input p-0.5"
            >
                {GROUP_OPTIONS.map((option) => (
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

/** The quarter slot just after the day's latest entry, or now if empty. */
function nextFreeSlot(entries: readonly TimeEntryFieldsFragment[]): string {
    const latest = entries.reduce<Date | null>((latestEnd, entry) => {
        const end = entry.endedAt ? new Date(entry.endedAt) : null;

        return end && (!latestEnd || end > latestEnd) ? end : latestEnd;
    }, null);

    return nearestQuarterTime(latest ?? new Date());
}
