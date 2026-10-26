"use client";

import { useState } from "react";
import { useQuery } from "@apollo/client/react";
import { format, formatDistanceToNowStrict } from "date-fns";
import {
    ChevronDown,
    FolderTree,
    Gauge,
    Search,
    TriangleAlert,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EstimateDialog } from "@/components/tickets/estimate-dialog";
import {
    TicketSummariesDocument,
    type TicketSummaryFieldsFragment,
} from "@/gql/graphql";
import { formatMinutesAsHours } from "@/lib/duration";
import { projectColor } from "@/lib/project-color";
import { cn } from "@/lib/utils";

type Filter = "all" | "estimated" | "attention" | "unestimated";

type Sort = "attention" | "hours" | "recent";

const SORTS: Array<{ value: Sort; label: string }> = [
    { value: "recent", label: "Recently worked" },
    { value: "attention", label: "Needs attention" },
    { value: "hours", label: "Most hours" },
];

const FILTERS: Array<{ value: Filter; label: string }> = [
    { value: "all", label: "All" },
    { value: "attention", label: "Needs attention" },
    { value: "estimated", label: "Estimated" },
    { value: "unestimated", label: "No estimate" },
];

export function TicketsView() {
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState<Filter>("all");
    const [sort, setSort] = useState<Sort>("recent");
    const [byProject, setByProject] = useState(false);
    const [editing, setEditing] = useState<TicketSummaryFieldsFragment | null>(
        null,
    );

    const { data, loading } = useQuery(TicketSummariesDocument);

    const tickets = data?.ticketSummaries ?? [];

    const attention = tickets.filter(
        (ticket) => ticket.status === "OVER" || ticket.status === "NEARING",
    );

    const visible = tickets
        .filter((ticket) => {
            if (filter === "estimated") {
                return ticket.estimateMaxMinutes != null;
            }

            if (filter === "unestimated") {
                return ticket.estimateMaxMinutes == null;
            }

            if (filter === "attention") {
                return ticket.status === "OVER" || ticket.status === "NEARING";
            }

            return true;
        })
        .filter((ticket) => matches(ticket, search))
        .sort(sorterFor(sort));

    return (
        <div className="flex w-full flex-1 flex-col px-5 py-6 lg:px-8 2xl:px-10">
            <header className="mb-5">
                <h2 className="text-xl font-semibold tracking-tight">
                    Tickets
                </h2>

                <p className="mt-1 text-sm text-muted-foreground">
                    Time tracked per ticket, measured against the estimate given
                    to the client.
                </p>
            </header>

            {attention.length > 0 && (
                <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-xs">
                    <span className="flex items-center gap-1.5 font-medium text-amber-400">
                        <TriangleAlert className="size-3.5" />
                        {attention.length}{" "}
                        {attention.length === 1
                            ? "ticket needs"
                            : "tickets need"}{" "}
                        attention
                    </span>

                    {attention.slice(0, 4).map((ticket) => (
                        <button
                            key={`${ticket.project.id}:${ticket.ticketNumber}`}
                            type="button"
                            onClick={() => setEditing(ticket)}
                            className="text-muted-foreground transition-colors hover:text-foreground"
                        >
                            #{ticket.ticketNumber}
                            <span
                                className={cn(
                                    "ml-1 font-mono",
                                    ticket.status === "OVER"
                                        ? "text-destructive"
                                        : "text-amber-400",
                                )}
                            >
                                {describeRemaining(ticket)}
                            </span>
                        </button>
                    ))}
                </div>
            )}

            <div className="mb-4 flex flex-wrap items-center gap-2">
                <div className="relative min-w-0 flex-1 sm:max-w-72">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

                    <Input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search ticket, project or client"
                        aria-label="Search tickets"
                        className="h-9 pl-9"
                    />
                </div>

                <div
                    role="radiogroup"
                    aria-label="Filter tickets"
                    className="inline-flex rounded-md border border-input p-0.5"
                >
                    {FILTERS.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            role="radio"
                            aria-checked={option.value === filter}
                            onClick={() => setFilter(option.value)}
                            className={cn(
                                "h-7 rounded-[6px] px-2.5 text-xs font-medium transition-colors",
                                option.value === filter
                                    ? "bg-secondary text-secondary-foreground"
                                    : "text-muted-foreground hover:text-foreground",
                            )}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>

                <div
                    role="radiogroup"
                    aria-label="Sort tickets"
                    className="inline-flex rounded-md border border-input p-0.5"
                >
                    {SORTS.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            role="radio"
                            aria-checked={option.value === sort}
                            onClick={() => setSort(option.value)}
                            className={cn(
                                "h-7 rounded-[6px] px-2.5 text-xs font-medium transition-colors",
                                option.value === sort
                                    ? "bg-secondary text-secondary-foreground"
                                    : "text-muted-foreground hover:text-foreground",
                            )}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>

                <Button
                    type="button"
                    variant={byProject ? "secondary" : "outline"}
                    size="sm"
                    aria-pressed={byProject}
                    onClick={() => setByProject((grouped) => !grouped)}
                    className="gap-1.5"
                >
                    <FolderTree className="size-3.5" />
                    By project
                </Button>
            </div>

            {loading && !data ? (
                <div className="flex flex-col gap-2">
                    <Skeleton className="h-16 w-full rounded-xl" />
                    <Skeleton className="h-16 w-full rounded-xl" />
                </div>
            ) : visible.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/70 px-6 py-16 text-center">
                    <p className="text-sm text-muted-foreground">
                        {tickets.length === 0
                            ? "No ticketed work tracked yet."
                            : "No tickets match that filter."}
                    </p>
                </div>
            ) : byProject ? (
                <div className="flex flex-col gap-5">
                    {groupByProject(visible).map((group) => (
                        <ProjectGroup
                            key={group.project.id}
                            group={group}
                            onEdit={setEditing}
                        />
                    ))}
                </div>
            ) : (
                <ul className="flex flex-col gap-2">
                    {visible.map((ticket) => (
                        <TicketCard
                            key={`${ticket.project.id}:${ticket.ticketNumber}`}
                            ticket={ticket}
                            onEdit={setEditing}
                        />
                    ))}
                </ul>
            )}

            <EstimateDialog
                open={editing !== null}
                onOpenChange={(open) => !open && setEditing(null)}
                ticket={editing}
            />
        </div>
    );
}

/**
 * One project, what it has cost so far, and the tickets that make it up.
 *
 * The summary answers the question the flat list cannot: how much of this
 * client's work is on the books, and how much of it is being written off.
 */
function ProjectGroup({
    group,
    onEdit,
}: {
    group: ProjectTicketGroup;
    onEdit: (ticket: TicketSummaryFieldsFragment) => void;
}) {
    const color = projectColor(group.project);

    return (
        <section data-project-group={group.project.id}>
            <header className="mb-2 rounded-xl border border-border/70 bg-card px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                            <span
                                aria-hidden
                                className="size-2.5 shrink-0 rounded-full"
                                style={{ backgroundColor: color }}
                            />

                            <h3 className="text-sm font-semibold tracking-tight">
                                {group.project.name}
                            </h3>

                            <span className="text-xs text-muted-foreground">
                                {group.project.client.name}
                            </span>

                            {group.needsAttention > 0 && (
                                <span className="flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-[0.625rem] font-medium text-amber-400">
                                    <TriangleAlert className="size-3" />
                                    {group.needsAttention} over or nearing
                                </span>
                            )}
                        </div>

                        <p className="mt-1 text-[0.6875rem] text-muted-foreground">
                            {group.tickets.length}{" "}
                            {group.tickets.length === 1 ? "ticket" : "tickets"}
                            {" · "}
                            {group.entryCount}{" "}
                            {group.entryCount === 1 ? "entry" : "entries"}
                            {group.lastTrackedAt &&
                                ` · last worked ${formatDistanceToNowStrict(
                                    new Date(group.lastTrackedAt),
                                    { addSuffix: true },
                                )}`}
                        </p>
                    </div>

                    <div className="text-right">
                        <p className="font-mono text-base font-medium tabular-nums">
                            {formatMinutesAsHours(group.trackedMinutes)}
                            <span className="ml-1 text-xs font-normal text-muted-foreground">
                                h
                            </span>
                        </p>

                        <p className="mt-0.5 flex items-center justify-end gap-1.5 text-[0.6875rem]">
                            <span
                                className={cn(
                                    "font-mono tabular-nums",
                                    group.billableMinutes > 0
                                        ? "text-emerald-400"
                                        : "text-muted-foreground/50",
                                )}
                            >
                                {formatMinutesAsHours(group.billableMinutes)}{" "}
                                billable
                            </span>

                            <span className="text-muted-foreground/40">+</span>

                            <span
                                className={cn(
                                    "font-mono tabular-nums",
                                    group.unbillableMinutes > 0
                                        ? "text-amber-400"
                                        : "text-muted-foreground/50",
                                )}
                            >
                                {formatMinutesAsHours(group.unbillableMinutes)}{" "}
                                written off
                            </span>
                        </p>
                    </div>
                </div>
            </header>

            {/* Indented so the tickets read as belonging to the project. */}
            <ul className="flex flex-col gap-2 border-l border-border/50 pl-3">
                {group.tickets.map((ticket) => (
                    <TicketCard
                        key={`${ticket.project.id}:${ticket.ticketNumber}`}
                        ticket={ticket}
                        onEdit={onEdit}
                    />
                ))}
            </ul>
        </section>
    );
}

interface TicketCardProps {
    ticket: TicketSummaryFieldsFragment;
    onEdit: (ticket: TicketSummaryFieldsFragment) => void;
}

function TicketCard({ ticket, onEdit }: TicketCardProps) {
    const [expanded, setExpanded] = useState(false);
    const color = projectColor(ticket.project);
    const max = ticket.estimateMaxMinutes;
    const min = ticket.estimateMinMinutes;

    const percent =
        max && max > 0 ? Math.min(100, (ticket.trackedMinutes / max) * 100) : 0;

    const minPercent =
        max && max > 0 && min != null ? Math.min(100, (min / max) * 100) : null;

    return (
        <li
            data-ticket={ticket.ticketNumber}
            className="rounded-xl border border-border/70 bg-card px-4 py-3"
        >
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                        <span
                            aria-hidden
                            className="size-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: color }}
                        />

                        <span className="font-mono text-sm font-medium">
                            #{ticket.ticketNumber}
                        </span>

                        <span className="text-xs text-muted-foreground">
                            {ticket.project.name}
                        </span>

                        <StatusChip status={ticket.status} />
                    </div>

                    <p className="mt-1 text-[0.6875rem] text-muted-foreground">
                        {ticket.entryCount}{" "}
                        {ticket.entryCount === 1 ? "entry" : "entries"}
                        {ticket.lastTrackedAt &&
                            ` · last worked ${formatDistanceToNowStrict(
                                new Date(ticket.lastTrackedAt),
                                { addSuffix: true },
                            )}`}
                        {ticket.estimateNotes && ` · ${ticket.estimateNotes}`}
                    </p>

                    {/* The two halves, which add up to the total on the right. */}
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.6875rem]">
                        <span
                            className={cn(
                                "font-mono tabular-nums",
                                ticket.billableMinutes > 0
                                    ? "text-emerald-400"
                                    : "text-muted-foreground/50",
                            )}
                        >
                            {formatMinutesAsHours(ticket.billableMinutes)} h
                            billable
                        </span>

                        <span className="text-muted-foreground/40">+</span>

                        <span
                            className={cn(
                                "font-mono tabular-nums",
                                ticket.unbillableMinutes > 0
                                    ? "text-amber-400"
                                    : "text-muted-foreground/50",
                            )}
                        >
                            {formatMinutesAsHours(ticket.unbillableMinutes)} h
                            written off
                        </span>
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="text-right">
                        <p className="font-mono text-sm font-medium tabular-nums">
                            {formatMinutesAsHours(ticket.trackedMinutes)}
                            {max != null && (
                                <span className="text-xs font-normal text-muted-foreground">
                                    {" / "}
                                    {min != null
                                        ? `${formatMinutesAsHours(min)}–`
                                        : ""}
                                    {formatMinutesAsHours(max)} h
                                </span>
                            )}
                        </p>

                        {max != null && (
                            <p
                                className={cn(
                                    "text-[0.6875rem] tabular-nums",
                                    ticket.status === "OVER"
                                        ? "text-destructive"
                                        : ticket.status === "NEARING"
                                          ? "text-amber-400"
                                          : "text-muted-foreground",
                                )}
                            >
                                {describeRemaining(ticket)}
                            </p>
                        )}
                    </div>

                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onEdit(ticket)}
                        className="gap-1.5"
                    >
                        <Gauge className="size-3.5" />
                        {max == null ? "Add estimate" : "Edit"}
                    </Button>

                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-expanded={expanded}
                        aria-label={`${expanded ? "Hide" : "Show"} the ${
                            ticket.entryCount
                        } entries on ticket ${ticket.ticketNumber}`}
                        onClick={() => setExpanded((shown) => !shown)}
                    >
                        <ChevronDown
                            className={cn(
                                "size-4 transition-transform",
                                expanded && "rotate-180",
                            )}
                        />
                    </Button>
                </div>
            </div>

            {max != null && (
                <div className="relative mt-2.5 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                        className={cn(
                            "h-full rounded-full transition-[width] duration-500",
                            ticket.status === "OVER"
                                ? "bg-destructive"
                                : ticket.status === "NEARING"
                                  ? "bg-amber-500"
                                  : "bg-primary",
                        )}
                        style={{ width: `${percent}%` }}
                    />

                    {/* Where the low end of the quoted range sits. */}
                    {minPercent !== null && minPercent < 100 && (
                        <span
                            aria-hidden
                            className="absolute inset-y-0 w-px bg-foreground/40"
                            style={{ left: `${minPercent}%` }}
                        />
                    )}
                </div>
            )}

            {expanded && <TicketEntries ticket={ticket} />}
        </li>
    );
}

/**
 * Every session booked against the ticket, oldest first.
 *
 * The written-off column is only drawn where there is something to write off -
 * a column of zeroes says nothing and makes the ones that matter harder to
 * find.
 */
function TicketEntries({ ticket }: { ticket: TicketSummaryFieldsFragment }) {
    const hasWriteOffs = ticket.unbillableMinutes > 0;

    return (
        <div className="mt-3 overflow-x-auto border-t border-border/60 pt-3">
            <table className="w-full min-w-144 text-xs">
                <thead>
                    <tr className="text-[0.625rem] uppercase tracking-wide text-muted-foreground">
                        <th className="pb-1.5 pr-3 text-left font-medium">
                            Date
                        </th>
                        <th className="pb-1.5 pr-3 text-left font-medium">
                            Time
                        </th>
                        <th className="pb-1.5 pr-3 text-left font-medium">
                            What was done
                        </th>
                        <th className="pb-1.5 pr-3 text-right font-medium">
                            Hours
                        </th>
                        {hasWriteOffs && (
                            <th className="pb-1.5 text-right font-medium">
                                Written off
                            </th>
                        )}
                    </tr>
                </thead>

                <tbody>
                    {ticket.entries.map((entry) => {
                        const started = new Date(entry.startedAt);

                        return (
                            <tr
                                key={entry.id}
                                className="border-t border-border/40 align-top"
                            >
                                <td className="whitespace-nowrap py-1.5 pr-3 font-mono tabular-nums text-muted-foreground">
                                    {format(started, "EEE d MMM")}
                                </td>

                                <td className="whitespace-nowrap py-1.5 pr-3 font-mono tabular-nums text-muted-foreground">
                                    {format(started, "HH:mm")}
                                    {entry.endedAt &&
                                        `–${format(new Date(entry.endedAt), "HH:mm")}`}
                                </td>

                                <td className="py-1.5 pr-3 leading-snug">
                                    {entry.description}

                                    {entry.kind === "MEETING" && (
                                        <span className="ml-1.5 rounded bg-muted px-1 py-0.5 text-[0.5625rem] uppercase tracking-wide text-muted-foreground">
                                            Meeting
                                        </span>
                                    )}
                                </td>

                                <td className="whitespace-nowrap py-1.5 pr-3 text-right font-mono tabular-nums">
                                    {formatMinutesAsHours(entry.billedMinutes)}
                                </td>

                                {hasWriteOffs && (
                                    <td
                                        className={cn(
                                            "whitespace-nowrap py-1.5 text-right font-mono tabular-nums",
                                            entry.unbillableMinutes > 0
                                                ? "text-amber-400"
                                                : "text-muted-foreground/30",
                                        )}
                                    >
                                        {entry.unbillableMinutes > 0
                                            ? formatMinutesAsHours(
                                                  entry.unbillableMinutes,
                                              )
                                            : "·"}
                                    </td>
                                )}
                            </tr>
                        );
                    })}
                </tbody>

                <tfoot>
                    <tr className="border-t border-border/60 font-medium">
                        <td
                            colSpan={3}
                            className="pt-1.5 pr-3 text-right text-muted-foreground"
                        >
                            {ticket.entryCount}{" "}
                            {ticket.entryCount === 1 ? "entry" : "entries"}
                        </td>

                        <td className="pt-1.5 pr-3 text-right font-mono tabular-nums">
                            {formatMinutesAsHours(ticket.trackedMinutes)}
                        </td>

                        {hasWriteOffs && (
                            <td className="pt-1.5 text-right font-mono tabular-nums text-amber-400">
                                {formatMinutesAsHours(ticket.unbillableMinutes)}
                            </td>
                        )}
                    </tr>
                </tfoot>
            </table>
        </div>
    );
}

function StatusChip({ status }: { status: string }) {
    if (status === "NONE") {
        return null;
    }

    const label =
        status === "OVER"
            ? "Over estimate"
            : status === "NEARING"
              ? "Nearing estimate"
              : "On track";

    return (
        <span
            className={cn(
                "rounded px-1.5 py-0.5 text-[0.625rem] uppercase tracking-wide",
                status === "OVER"
                    ? "bg-destructive/15 text-destructive"
                    : status === "NEARING"
                      ? "bg-amber-500/15 text-amber-400"
                      : "bg-emerald-500/10 text-emerald-400",
            )}
        >
            {label}
        </span>
    );
}

export function describeRemaining(
    ticket: Pick<
        TicketSummaryFieldsFragment,
        "remainingMinutes" | "estimateMaxMinutes"
    >,
): string {
    if (ticket.estimateMaxMinutes == null || ticket.remainingMinutes == null) {
        return "";
    }

    return ticket.remainingMinutes < 0
        ? `${formatMinutesAsHours(-ticket.remainingMinutes)} h over`
        : `${formatMinutesAsHours(ticket.remainingMinutes)} h left`;
}

function matches(ticket: TicketSummaryFieldsFragment, search: string): boolean {
    const term = search.trim().toLowerCase();

    if (!term) {
        return true;
    }

    return [
        ticket.ticketNumber,
        ticket.project.name,
        ticket.project.client.name,
        ticket.project.client.shortName ?? "",
    ]
        .join(" ")
        .toLowerCase()
        .includes(term);
}

const STATUS_ORDER: Record<string, number> = {
    OVER: 0,
    NEARING: 1,
    OK: 2,
    NONE: 3,
};

/** How the list is ordered, which is a different question from what it shows. */
function sorterFor(sort: Sort) {
    if (sort === "hours") {
        return (
            a: TicketSummaryFieldsFragment,
            b: TicketSummaryFieldsFragment,
        ) => b.trackedMinutes - a.trackedMinutes;
    }

    if (sort === "recent") {
        return (
            a: TicketSummaryFieldsFragment,
            b: TicketSummaryFieldsFragment,
        ) => {
            // A ticket with no tracked time sorts last rather than first.
            const left = a.lastTrackedAt
                ? new Date(a.lastTrackedAt).getTime()
                : 0;
            const right = b.lastTrackedAt
                ? new Date(b.lastTrackedAt).getTime()
                : 0;

            return right - left;
        };
    }

    return compareTickets;
}

export interface ProjectTicketGroup {
    project: TicketSummaryFieldsFragment["project"];
    tickets: TicketSummaryFieldsFragment[];
    trackedMinutes: number;
    billableMinutes: number;
    unbillableMinutes: number;
    entryCount: number;
    /** How many of its tickets are over or nearing their estimate. */
    needsAttention: number;
    lastTrackedAt: string | null;
}

/**
 * The same tickets, gathered under the project they belong to.
 *
 * Order is inherited from the list rather than recomputed, so whichever sort
 * is chosen still decides what comes first inside each project; the projects
 * themselves lead with the one holding the most time.
 */
function groupByProject(
    tickets: readonly TicketSummaryFieldsFragment[],
): ProjectTicketGroup[] {
    const groups = new Map<string, ProjectTicketGroup>();

    for (const ticket of tickets) {
        let group = groups.get(ticket.project.id);

        if (!group) {
            group = {
                project: ticket.project,
                tickets: [],
                trackedMinutes: 0,
                billableMinutes: 0,
                unbillableMinutes: 0,
                entryCount: 0,
                needsAttention: 0,
                lastTrackedAt: null,
            };

            groups.set(ticket.project.id, group);
        }

        group.tickets.push(ticket);
        group.trackedMinutes += ticket.trackedMinutes;
        group.billableMinutes += ticket.billableMinutes;
        group.unbillableMinutes += ticket.unbillableMinutes;
        group.entryCount += ticket.entryCount;

        if (ticket.status === "OVER" || ticket.status === "NEARING") {
            group.needsAttention += 1;
        }

        if (
            ticket.lastTrackedAt &&
            (!group.lastTrackedAt ||
                new Date(ticket.lastTrackedAt) > new Date(group.lastTrackedAt))
        ) {
            group.lastTrackedAt = ticket.lastTrackedAt;
        }
    }

    return [...groups.values()].sort(
        (a, b) => b.trackedMinutes - a.trackedMinutes,
    );
}

function compareTickets(
    a: TicketSummaryFieldsFragment,
    b: TicketSummaryFieldsFragment,
): number {
    return (
        (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9) ||
        b.trackedMinutes - a.trackedMinutes
    );
}
