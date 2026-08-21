"use client";

import { useState } from "react";
import { CircleDollarSign, Hash, Play, Square } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    ProjectSelect,
    type SelectableProject,
} from "@/components/timer/project-select";
import { KindToggle } from "@/components/timer/kind-toggle";
import { LiveClock } from "@/components/timer/live-clock";
import { useEntryActions } from "@/components/timer/use-entry-actions";
import type {
    BillingType,
    EntryKind,
    TimeEntryFieldsFragment,
} from "@/gql/graphql";
import { parseEntryDescription } from "@/lib/parse-entry";
import { cn } from "@/lib/utils";

/**
 * The description field reads as a bare line of text, not a form control.
 * `dark:bg-transparent` is needed because the base Input carries
 * `dark:bg-input/30`, which a plain `bg-transparent` does not override.
 */
const DESCRIPTION_INPUT_CLASS =
    "h-14 border-0 bg-transparent px-0 text-base shadow-none ring-0 placeholder:text-muted-foreground/45 focus-visible:ring-0 md:text-lg dark:bg-transparent";

export interface TimerDraft {
    description: string;
    projectId: string | null;
    ticketNumber: string;
    kind: EntryKind;
}

interface TimerBarProps {
    projects: readonly SelectableProject[];
    activeEntry: TimeEntryFieldsFragment | null;
    loadingProjects?: boolean;
    projectsError?: boolean;
    /** Seeded by "continue" so the composer opens pre-filled. */
    draft: TimerDraft;
    onDraftChange: (draft: TimerDraft) => void;
}

export function TimerBar({
    projects,
    activeEntry,
    loadingProjects,
    projectsError,
    draft,
    onDraftChange,
}: TimerBarProps) {
    return (
        <section
            className={cn(
                "overflow-hidden rounded-xl border bg-card shadow-sm transition-colors",
                activeEntry
                    ? "border-primary/40 shadow-primary/10"
                    : "border-border/70",
            )}
        >
            {activeEntry ? (
                // Keyed so switching tasks rebuilds the inputs from the new
                // entry instead of syncing state through an effect.
                <RunningTimer
                    key={activeEntry.id}
                    entry={activeEntry}
                    projects={projects}
                    loadingProjects={loadingProjects}
                    projectsError={projectsError}
                />
            ) : (
                <IdleComposer
                    projects={projects}
                    loadingProjects={loadingProjects}
                    projectsError={projectsError}
                    draft={draft}
                    onDraftChange={onDraftChange}
                />
            )}
        </section>
    );
}

function IdleComposer({
    projects,
    loadingProjects,
    projectsError,
    draft,
    onDraftChange,
}: Omit<TimerBarProps, "activeEntry">) {
    // Detection stops as soon as the user picks a value by hand.
    const [projectPinned, setProjectPinned] = useState(false);
    const [ticketPinned, setTicketPinned] = useState(false);

    const { startTimer, pending } = useEntryActions();

    const selectedProject = projects.find(
        (project) => project.id === draft.projectId,
    );

    const canStart =
        draft.description.trim().length > 0 && draft.projectId !== null;

    function handleDescriptionChange(description: string) {
        const detected = parseEntryDescription(description, projects);

        const ticketNumber = ticketPinned
            ? draft.ticketNumber
            : (detected.ticketNumber ?? draft.ticketNumber);

        onDraftChange({
            description,

            projectId: projectPinned
                ? draft.projectId
                : (detected.projectId ?? draft.projectId),

            ticketNumber,

            // A ticket means real work; only unticketed lines can read as a
            // scrum or sync.
            kind: ticketNumber ? "WORK" : detected.kind,
        });
    }

    async function handleStart() {
        if (!canStart || pending) {
            return;
        }

        const started = await startTimer({
            projectId: draft.projectId!,
            description: draft.description.trim(),
            ticketNumber: draft.ticketNumber.trim() || null,
            kind: draft.kind,
        });

        if (started) {
            onDraftChange({
                description: "",
                projectId: null,
                ticketNumber: "",
                kind: "WORK",
            });

            setProjectPinned(false);
            setTicketPinned(false);
        }
    }

    return (
        <div className="p-5 lg:p-6">
            <div className="flex flex-col gap-5">
                <div>
                    <p className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                        What are you working on?
                    </p>

                    <Input
                        value={draft.description}
                        onChange={(event) =>
                            handleDescriptionChange(event.target.value)
                        }
                        onKeyDown={(event) => {
                            if (event.key === "Enter") {
                                event.preventDefault();

                                void handleStart();
                            }
                        }}
                        // Short, and in the "Client 12345 - what you did"
                        // shape the parser reads.
                        placeholder="Gardner 14214 - Review order history"
                        autoComplete="off"
                        className={DESCRIPTION_INPUT_CLASS}
                    />
                </div>

                <div className="h-px bg-border/60" />

                <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
                    <div className="grid flex-1 gap-3 sm:grid-cols-2 xl:flex xl:items-center">
                        <ProjectSelect
                            projects={projects}
                            value={draft.projectId}
                            onChange={(projectId) => {
                                setProjectPinned(true);

                                onDraftChange({ ...draft, projectId });
                            }}
                            loading={loadingProjects}
                            error={projectsError}
                            className="sm:min-w-72"
                        />

                        <TicketInput
                            value={draft.ticketNumber}
                            disabled={draft.kind === "MEETING"}
                            onChange={(ticketNumber) => {
                                setTicketPinned(true);

                                onDraftChange({ ...draft, ticketNumber });
                            }}
                        />

                        <KindToggle
                            value={draft.kind}
                            onChange={(kind) => {
                                setTicketPinned(true);

                                onDraftChange({
                                    ...draft,
                                    kind,
                                    // A meeting never carries a ticket.
                                    ticketNumber:
                                        kind === "MEETING"
                                            ? ""
                                            : draft.ticketNumber,
                                });
                            }}
                        />
                    </div>

                    <div className="flex items-center justify-between gap-4 xl:justify-end">
                        <BillingIndicator
                            billingType={selectedProject?.defaultBillingType}
                        />

                        <div className="hidden h-7 w-px bg-border xl:block" />

                        <div className="flex items-center gap-3">
                            <span className="min-w-24 text-right font-mono text-lg font-medium tabular-nums text-muted-foreground">
                                00:00:00
                            </span>

                            <Button
                                type="button"
                                disabled={!canStart || pending}
                                onClick={handleStart}
                                className="h-10 gap-2 px-5 font-medium shadow-sm shadow-primary/20"
                            >
                                <Play className="size-4 fill-current" />
                                Start
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

interface RunningTimerProps {
    entry: TimeEntryFieldsFragment;
    projects: readonly SelectableProject[];
    loadingProjects?: boolean;
    projectsError?: boolean;
}

function RunningTimer({
    entry,
    projects,
    loadingProjects,
    projectsError,
}: RunningTimerProps) {
    const [description, setDescription] = useState(entry.description);
    const [ticketNumber, setTicketNumber] = useState(entry.ticketNumber ?? "");

    const { stopTimer, updateEntry, pending } = useEntryActions();

    /** Refinements made while the work is still in progress. */
    function commit(patch: { description?: string; ticketNumber?: string }) {
        const nextDescription = (patch.description ?? description).trim();
        const nextTicket = (patch.ticketNumber ?? ticketNumber).trim();

        const descriptionChanged = nextDescription !== entry.description.trim();
        const ticketChanged = nextTicket !== (entry.ticketNumber ?? "").trim();

        if (!nextDescription || (!descriptionChanged && !ticketChanged)) {
            return;
        }

        void updateEntry(entry.id, {
            description: nextDescription,
            ticketNumber: nextTicket || null,
        });
    }

    return (
        <div className="p-5 lg:p-6">
            <div className="flex flex-col gap-5">
                <div>
                    <p className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-primary">
                        <span className="relative flex size-2">
                            <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60" />
                            <span className="relative inline-flex size-2 rounded-full bg-primary" />
                        </span>
                        Tracking now
                    </p>

                    <Input
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                        onBlur={() => commit({})}
                        onKeyDown={(event) => {
                            if (event.key === "Enter") {
                                event.currentTarget.blur();
                            }
                        }}
                        placeholder="What are you working on?"
                        autoComplete="off"
                        className={DESCRIPTION_INPUT_CLASS}
                    />
                </div>

                <div className="h-px bg-border/60" />

                <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
                    <div className="grid flex-1 gap-3 sm:grid-cols-2 xl:flex xl:items-center">
                        <ProjectSelect
                            projects={projects}
                            value={entry.project.id}
                            onChange={(projectId) => {
                                if (projectId && projectId !== entry.project.id) {
                                    void updateEntry(entry.id, { projectId });
                                }
                            }}
                            loading={loadingProjects}
                            error={projectsError}
                            className="sm:min-w-72"
                        />

                        <TicketInput
                            value={ticketNumber}
                            disabled={entry.kind === "MEETING"}
                            onChange={setTicketNumber}
                            onBlur={() => commit({})}
                        />

                        <KindToggle
                            value={entry.kind}
                            onChange={(kind) => {
                                if (kind === "MEETING") {
                                    setTicketNumber("");
                                }

                                void updateEntry(entry.id, {
                                    kind,
                                    ticketNumber:
                                        kind === "MEETING" ? null : ticketNumber,
                                });
                            }}
                        />
                    </div>

                    <div className="flex items-center justify-between gap-4 xl:justify-end">
                        <BillingIndicator billingType={entry.billingType} />

                        <div className="hidden h-7 w-px bg-border xl:block" />

                        <div className="flex items-center gap-3">
                            <LiveClock
                                startedAt={entry.startedAt}
                                className="min-w-24 text-right font-mono text-lg font-medium text-foreground"
                            />

                            <Button
                                type="button"
                                variant="destructive"
                                disabled={pending}
                                onClick={() => void stopTimer(entry.id)}
                                className="h-10 gap-2 px-5 font-medium"
                            >
                                <Square className="size-3.5 fill-current" />
                                Stop
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

interface TicketInputProps {
    value: string;
    onChange: (value: string) => void;
    onBlur?: () => void;
    disabled?: boolean;
}

function TicketInput({ value, onChange, onBlur, disabled }: TicketInputProps) {
    return (
        <div className="relative sm:max-w-52">
            <Hash className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

            <Input
                value={value}
                onChange={(event) => onChange(event.target.value)}
                onBlur={onBlur}
                disabled={disabled}
                placeholder={disabled ? "No ticket" : "Ticket #"}
                autoComplete="off"
                aria-label="Ticket number"
                className="h-10 pl-9"
            />
        </div>
    );
}

interface BillingIndicatorProps {
    billingType?: BillingType;
}

function BillingIndicator({ billingType }: BillingIndicatorProps) {
    if (!billingType) {
        return (
            <span className="hidden text-xs text-muted-foreground sm:inline">
                Select a project
            </span>
        );
    }

    const billable = billingType === "BILLABLE";

    return (
        <div
            className={cn(
                "flex items-center gap-1.5 text-xs",
                billable ? "text-emerald-400" : "text-muted-foreground",
            )}
        >
            <CircleDollarSign className="size-4" />

            <span>{billable ? "Billable" : "Non-billable"}</span>
        </div>
    );
}
