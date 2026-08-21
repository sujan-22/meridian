"use client";

import { useState } from "react";
import { useQuery } from "@apollo/client/react";
import { formatDistanceToNowStrict } from "date-fns";
import { Gauge, Search, TriangleAlert } from "lucide-react";

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

const FILTERS: Array<{ value: Filter; label: string }> = [
    { value: "all", label: "All" },
    { value: "attention", label: "Needs attention" },
    { value: "estimated", label: "Estimated" },
    { value: "unestimated", label: "No estimate" },
];

export function TicketsView() {
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState<Filter>("all");
    const [editing, setEditing] =
        useState<TicketSummaryFieldsFragment | null>(null);

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
                return (
                    ticket.status === "OVER" || ticket.status === "NEARING"
                );
            }

            return true;
        })
        .filter((ticket) => matches(ticket, search))
        .sort(compareTickets);

    return (
        <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col px-5 py-6 lg:px-8">
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
                        {attention.length === 1 ? "ticket needs" : "tickets need"}{" "}
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
            </div>

            {loading && tickets.length === 0 ? (
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

interface TicketCardProps {
    ticket: TicketSummaryFieldsFragment;
    onEdit: (ticket: TicketSummaryFieldsFragment) => void;
}

function TicketCard({ ticket, onEdit }: TicketCardProps) {
    const color = projectColor(ticket.project);
    const max = ticket.estimateMaxMinutes;
    const min = ticket.estimateMinMinutes;

    const percent =
        max && max > 0
            ? Math.min(100, (ticket.trackedMinutes / max) * 100)
            : 0;

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

                    <p className="mt-1 text-[11px] text-muted-foreground">
                        {ticket.entryCount}{" "}
                        {ticket.entryCount === 1 ? "entry" : "entries"}
                        {ticket.lastTrackedAt &&
                            ` · last worked ${formatDistanceToNowStrict(
                                new Date(ticket.lastTrackedAt),
                                { addSuffix: true },
                            )}`}
                        {ticket.estimateNotes && ` · ${ticket.estimateNotes}`}
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
                                    "text-[11px] tabular-nums",
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
        </li>
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
                "rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide",
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

function matches(
    ticket: TicketSummaryFieldsFragment,
    search: string,
): boolean {
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

function compareTickets(
    a: TicketSummaryFieldsFragment,
    b: TicketSummaryFieldsFragment,
): number {
    return (
        (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9) ||
        b.trackedMinutes - a.trackedMinutes
    );
}
