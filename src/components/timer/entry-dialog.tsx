"use client";

import { useState } from "react";
import { addDays } from "date-fns";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { KindToggle } from "@/components/timer/kind-toggle";
import {
    ProjectSelect,
    type SelectableProject,
} from "@/components/timer/project-select";
import {
    nearestQuarterTime,
    TimeSelect,
} from "@/components/timer/time-select";
import { useEntryActions } from "@/components/timer/use-entry-actions";
import type {
    BillingType,
    EntryKind,
    TimeEntryFieldsFragment,
} from "@/gql/graphql";
import { withTimeOfDay } from "@/lib/dates";
import {
    formatMinutesAsHours,
    splitBillableMinutes,
    toQuarterMinutes,
} from "@/lib/duration";
import { parseEntryDescription } from "@/lib/parse-entry";

interface EntryDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    projects: readonly SelectableProject[];
    /** The day the entry belongs to; times are picked within it. */
    day: Date;
    /** Omit to add a new entry. */
    entry?: TimeEntryFieldsFragment | null;
    /** Pre-fills a brand new entry, used by "duplicate". */
    initial?: Partial<EntryDraft> | null;
}

export interface EntryDraft {
    description: string;
    projectId: string | null;
    ticketNumber: string;
    billingType: BillingType | null;
    kind: EntryKind;
    unbillablePercent: number;
    startTime: string;
    endTime: string;
}

const BILLING_OPTIONS = [
    { label: "Billable", value: "BILLABLE" },
    { label: "Non-billable", value: "NON_BILLABLE" },
] as const;

export function EntryDialog({
    open,
    onOpenChange,
    projects,
    day,
    entry,
    initial,
}: EntryDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                {/* Keyed so each open starts from the entry being edited. */}
                <EntryForm
                    key={entry?.id ?? JSON.stringify(initial) ?? "new"}
                    projects={projects}
                    day={day}
                    entry={entry}
                    initial={initial}
                    onDone={() => onOpenChange(false)}
                />
            </DialogContent>
        </Dialog>
    );
}

interface EntryFormProps {
    projects: readonly SelectableProject[];
    day: Date;
    entry?: TimeEntryFieldsFragment | null;
    initial?: Partial<EntryDraft> | null;
    onDone: () => void;
}

function EntryForm({
    projects,
    day,
    entry,
    initial,
    onDone,
}: EntryFormProps) {
    const editing = Boolean(entry);

    const [description, setDescription] = useState(
        entry?.description ?? initial?.description ?? "",
    );
    const [projectId, setProjectId] = useState<string | null>(
        entry?.project.id ?? initial?.projectId ?? null,
    );
    const [ticketNumber, setTicketNumber] = useState(
        entry?.ticketNumber ?? initial?.ticketNumber ?? "",
    );
    const [billingType, setBillingType] = useState<BillingType | null>(
        entry?.billingType ?? initial?.billingType ?? null,
    );
    const [kind, setKind] = useState<EntryKind>(
        entry?.kind ?? initial?.kind ?? "WORK",
    );
    const [unbillablePercent, setUnbillablePercent] = useState(
        String(entry?.unbillablePercent ?? initial?.unbillablePercent ?? 0),
    );

    const [startTime, setStartTime] = useState(
        entry
            ? nearestQuarterTime(new Date(entry.startedAt))
            : (initial?.startTime ?? nearestQuarterTime(new Date())),
    );
    const [endTime, setEndTime] = useState(
        entry?.endedAt
            ? nearestQuarterTime(new Date(entry.endedAt))
            : (initial?.endTime ?? shiftQuarters(startTime, 1)),
    );

    const [error, setError] = useState<string | null>(null);

    const { createEntry, updateEntry, pending } = useEntryActions();

    const range = resolveRange(day, startTime, endTime);

    const percent = Math.min(
        100,
        Math.max(0, Math.round(Number(unbillablePercent) || 0)),
    );

    const effectiveBilling =
        billingType ??
        projects.find((project) => project.id === projectId)
            ?.defaultBillingType ??
        null;

    /**
     * Fill in whatever the description reveals without ever clobbering a
     * value the user has already set by hand.
     */
    function handleDescriptionChange(next: string) {
        setDescription(next);

        const detected = parseEntryDescription(next, projects);

        if (!projectId && detected.projectId) {
            setProjectId(detected.projectId);
        }

        if (!ticketNumber && detected.ticketNumber) {
            setTicketNumber(detected.ticketNumber);
            setKind("WORK");

            return;
        }

        if (!ticketNumber && detected.kind === "MEETING") {
            setKind("MEETING");
        }
    }

    async function handleSubmit(event: React.FormEvent) {
        event.preventDefault();

        if (!description.trim()) {
            setError("A description is required");

            return;
        }

        if (!projectId) {
            setError("Pick a project");

            return;
        }

        if (!range) {
            setError("Pick a start and end time");

            return;
        }

        setError(null);

        const shared = {
            projectId,
            description: description.trim(),
            ticketNumber: ticketNumber.trim() || null,
            billingType: effectiveBilling,
            kind,
            unbillablePercent: percent,
            startedAt: range.startedAt.toISOString(),
            endedAt: range.endedAt.toISOString(),
        };

        const saved = entry
            ? await updateEntry(entry.id, shared)
            : await createEntry(shared);

        if (saved) {
            onDone();
        }
    }

    return (
        <form onSubmit={handleSubmit} className="contents">
            <DialogHeader>
                <DialogTitle>{editing ? "Edit entry" : "Add time"}</DialogTitle>

                <DialogDescription>
                    {editing
                        ? "Adjust the description, project or times of this entry."
                        : "Record work you did without running the timer."}
                </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-4">
                <Field label="Description">
                    <Textarea
                        value={description}
                        onChange={(event) =>
                            handleDescriptionChange(event.target.value)
                        }
                        rows={3}
                        placeholder="Gardner 14214 - Discussion with lead - Review SQL queries"
                        className="resize-none"
                    />
                </Field>

                <div className="flex items-center justify-between gap-4">
                    <KindToggle value={kind} onChange={setKind} />

                    <p className="text-xs text-muted-foreground">
                        {kind === "MEETING"
                            ? "No ticket needed"
                            : "Ticket read from the description"}
                    </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Project">
                        <ProjectSelect
                            projects={projects}
                            keepSelectable={entry?.project}
                            value={projectId}
                            onChange={setProjectId}
                        />
                    </Field>

                    <Field label="Ticket #">
                        <Input
                            value={ticketNumber}
                            onChange={(event) =>
                                setTicketNumber(event.target.value)
                            }
                            placeholder={
                                kind === "MEETING" ? "Not applicable" : "14214"
                            }
                            disabled={kind === "MEETING"}
                            autoComplete="off"
                            className="h-10"
                        />
                    </Field>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                    <Field label="Start">
                        <TimeSelect
                            aria-label="Start time"
                            value={startTime}
                            onChange={setStartTime}
                        />
                    </Field>

                    <Field label="End">
                        <TimeSelect
                            aria-label="End time"
                            value={endTime}
                            onChange={setEndTime}
                        />
                    </Field>

                    <Field label="Duration">
                        <div className="flex h-10 items-center rounded-md border border-input bg-muted/40 px-3 font-mono text-sm tabular-nums">
                            {range
                                ? `${formatMinutesAsHours(range.billedMinutes)} h`
                                : "—"}
                        </div>
                    </Field>
                </div>

                <Field label="Billing">
                    <Select
                        items={[...BILLING_OPTIONS]}
                        value={effectiveBilling}
                        onValueChange={(value) =>
                            setBillingType(value as BillingType)
                        }
                    >
                        <SelectTrigger aria-label="Billing" className="h-10">
                            <SelectValue placeholder="Project default" />
                        </SelectTrigger>

                        <SelectContent alignItemWithTrigger={false}>
                            {BILLING_OPTIONS.map((option) => (
                                <SelectItem
                                    key={option.value}
                                    value={option.value}
                                >
                                    {option.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </Field>

                {effectiveBilling === "BILLABLE" && (
                    <Field
                        label="Written off"
                        hint="The share of this entry the client is not charged for."
                    >
                        <div className="flex items-center gap-3">
                            <div className="relative w-28">
                                <Input
                                    value={unbillablePercent}
                                    onChange={(event) =>
                                        setUnbillablePercent(event.target.value)
                                    }
                                    inputMode="numeric"
                                    aria-label="Unbillable percent"
                                    className="h-10 pr-7 font-mono tabular-nums"
                                />

                                <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                                    %
                                </span>
                            </div>

                            {range && <SplitPreview
                                totalMinutes={range.billedMinutes}
                                percent={percent}
                            />}
                        </div>
                    </Field>
                )}

                {error && <p className="text-sm text-destructive">{error}</p>}
            </div>

            <DialogFooter>
                <Button
                    type="button"
                    variant="outline"
                    onClick={onDone}
                    disabled={pending}
                >
                    Cancel
                </Button>

                <Button type="submit" disabled={pending}>
                    {editing ? "Save changes" : "Add entry"}
                </Button>
            </DialogFooter>
        </form>
    );
}

interface SplitPreviewProps {
    totalMinutes: number;
    percent: number;
}

/**
 * Polaris only takes quarter hours, so show the two figures that will actually
 * be typed in rather than the raw percentage of the total.
 */
function SplitPreview({ totalMinutes, percent }: SplitPreviewProps) {
    const { billableMinutes, unbillableMinutes } = splitBillableMinutes(
        totalMinutes,
        percent,
        true,
    );

    if (unbillableMinutes === 0) {
        return (
            <span className="text-xs text-muted-foreground">
                All {formatMinutesAsHours(billableMinutes)} h billable
            </span>
        );
    }

    return (
        <span className="flex items-center gap-1.5 font-mono text-xs tabular-nums">
            <span className="text-emerald-400">
                {formatMinutesAsHours(billableMinutes)}
            </span>
            <span className="text-muted-foreground">billable ·</span>
            <span className="text-foreground">
                {formatMinutesAsHours(unbillableMinutes)}
            </span>
            <span className="text-muted-foreground">not</span>
        </span>
    );
}

interface FieldProps {
    label: string;
    hint?: string;
    children: React.ReactNode;
}

function Field({ label, hint, children }: FieldProps) {
    return (
        <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">
                {label}
            </span>

            {children}

            {hint && (
                <span className="text-[0.6875rem] text-muted-foreground">
                    {hint}
                </span>
            )}
        </label>
    );
}

/** Move a `HH:mm` slot by a number of quarter hours, wrapping at midnight. */
export function shiftQuarters(time: string, quarters: number): string {
    const [hours, minutes] = time.split(":").map(Number);

    const total = (hours * 60 + minutes + quarters * 15 + 1440) % 1440;

    return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(
        total % 60,
    ).padStart(2, "0")}`;
}

/**
 * Turn two slots into instants on the given day. An end at or before the start
 * is read as work that ran past midnight.
 */
function resolveRange(day: Date, startTime: string, endTime: string) {
    const startedAt = withTimeOfDay(day, startTime);
    const rawEnd = withTimeOfDay(day, endTime);

    if (!startedAt || !rawEnd) {
        return null;
    }

    const endedAt =
        rawEnd.getTime() <= startedAt.getTime() ? addDays(rawEnd, 1) : rawEnd;

    const seconds = Math.round(
        (endedAt.getTime() - startedAt.getTime()) / 1000,
    );

    return {
        startedAt,
        endedAt,
        billedMinutes: toQuarterMinutes(seconds),
    };
}
