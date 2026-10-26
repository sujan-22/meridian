"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@apollo/client/react";
import {
    endOfMonth,
    endOfYear,
    format,
    startOfMonth,
    startOfYear,
    subMonths,
} from "date-fns";
import { CircleDollarSign, Users } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { useToday } from "@/hooks/use-clock";
import { usePreferences } from "@/hooks/use-preferences";
import { EntriesDocument } from "@/gql/graphql";
import type { WeekStartsOn } from "@/lib/dates";
import { formatMinutesAsHours } from "@/lib/duration";
import { projectColor } from "@/lib/project-color";
import { buildReport, type ReportGroup } from "@/lib/reports";
import { cn } from "@/lib/utils";

type PeriodKey = "month" | "lastMonth" | "quarter" | "year";

const PERIODS: Array<{ value: PeriodKey; label: string }> = [
    { value: "month", label: "This month" },
    { value: "lastMonth", label: "Last month" },
    { value: "quarter", label: "Last 3 months" },
    { value: "year", label: "This year" },
];

type Grouping = "clients" | "projects";

const GROUPINGS: Array<{ value: Grouping; label: string }> = [
    { value: "clients", label: "Client" },
    { value: "projects", label: "Project" },
];

function rangeFor(period: PeriodKey, today: Date): { from: Date; to: Date } {
    if (period === "lastMonth") {
        const previous = subMonths(today, 1);

        return { from: startOfMonth(previous), to: endOfMonth(previous) };
    }

    if (period === "quarter") {
        return {
            from: startOfMonth(subMonths(today, 2)),
            to: endOfMonth(today),
        };
    }

    if (period === "year") {
        return { from: startOfYear(today), to: endOfYear(today) };
    }

    return { from: startOfMonth(today), to: endOfMonth(today) };
}

function formatPercent(value: number): string {
    return `${Number(value.toFixed(1))}%`;
}

/**
 * What the tracked time adds up to over a span longer than a week.
 *
 * The week screen answers "is today accounted for" and the timesheet answers
 * "what goes into Polaris". This answers the questions those cannot: how much
 * of the work is billable, where it is going, and whether the weeks are
 * landing on target.
 */
export function ReportsView() {
    const today = useToday();
    const { preferences } = usePreferences();
    // Early in a month there is barely anything to show, so the page opens on
    // the span that is always worth looking at.
    const [period, setPeriod] = useState<PeriodKey>("quarter");
    const [grouping, setGrouping] = useState<Grouping>("clients");

    const range = today ? rangeFor(period, today) : null;

    const { data, loading } = useQuery(EntriesDocument, {
        variables: range
            ? { from: range.from.toISOString(), to: range.to.toISOString() }
            : { from: "", to: "" },
        skip: !range,
    });

    const entries = useMemo(() => data?.entries ?? [], [data]);

    const report = useMemo(
        () =>
            range
                ? buildReport(entries, {
                      from: range.from,
                      to: range.to,
                      weekStartsOn: preferences.weekStartsOn as WeekStartsOn,
                      dailyTargetMinutes: preferences.dailyTargetMinutes,
                  })
                : null,
        [entries, range, preferences],
    );

    const busiestWeek = report
        ? Math.max(
              report.targetMinutes > 0 ? preferences.weeklyTargetMinutes : 0,
              ...report.weeks.map((week) => week.trackedMinutes),
              1,
          )
        : 1;

    return (
        <div className="flex w-full flex-1 flex-col px-5 py-6 lg:px-8 2xl:px-10">
            <header className="mb-4 flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h2 className="text-xl font-semibold tracking-tight">
                        Reports
                    </h2>

                    <p className="mt-1 text-sm text-muted-foreground">
                        {range
                            ? `Tracked time from ${format(
                                  range.from,
                                  "d MMM yyyy",
                              )} to ${format(range.to, "d MMM yyyy")}.`
                            : "\u00a0"}
                    </p>
                </div>

                <div
                    role="radiogroup"
                    aria-label="Reporting period"
                    className="inline-flex rounded-md border border-input p-0.5"
                >
                    {PERIODS.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            role="radio"
                            aria-checked={option.value === period}
                            onClick={() => setPeriod(option.value)}
                            className={cn(
                                "h-7 rounded-[6px] px-2.5 text-xs font-medium transition-colors",
                                option.value === period
                                    ? "bg-secondary text-secondary-foreground"
                                    : "text-muted-foreground hover:text-foreground",
                            )}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
            </header>

            {loading && !data ? (
                <div className="flex flex-col gap-3">
                    <Skeleton className="h-24 w-full rounded-xl" />
                    <Skeleton className="h-56 w-full rounded-xl" />
                </div>
            ) : !report ? null : report.trackedMinutes === 0 ? (
                <div className="rounded-xl border border-dashed border-border/70 px-6 py-16 text-center">
                    <p className="text-sm text-muted-foreground">
                        Nothing tracked in this period.
                    </p>
                </div>
            ) : (
                <div className="flex flex-col gap-4">
                    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <Stat
                            label="Tracked"
                            value={formatMinutesAsHours(report.trackedMinutes)}
                            detail={`of ${formatMinutesAsHours(
                                report.targetMinutes,
                            )} h expected`}
                        />

                        <Stat
                            label="Billable"
                            value={formatMinutesAsHours(report.billableMinutes)}
                            detail={`${formatPercent(report.billablePercent)} of tracked time`}
                            tone="good"
                        />

                        <Stat
                            label="Written off"
                            value={formatMinutesAsHours(
                                report.unbillableMinutes,
                            )}
                            detail={
                                report.unbillableMinutes > 0
                                    ? `${formatPercent(100 - report.billablePercent)} not charged`
                                    : "nothing written off"
                            }
                            tone={
                                report.unbillableMinutes > 0 ? "warn" : "muted"
                            }
                        />

                        <Stat
                            label="In meetings"
                            value={formatMinutesAsHours(report.meetingMinutes)}
                            detail={
                                report.trackedMinutes > 0
                                    ? formatPercent(
                                          (report.meetingMinutes /
                                              report.trackedMinutes) *
                                              100,
                                      ) + " of tracked time"
                                    : ""
                            }
                        />
                    </section>

                    <section className="rounded-xl border border-border/70 bg-card p-4">
                        <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Week by week
                        </h3>

                        <div className="flex items-end gap-1.5 overflow-x-auto pb-1">
                            {report.weeks.map((week) => {
                                const height = (minutes: number) =>
                                    `${(minutes / busiestWeek) * 140}px`;

                                return (
                                    <div
                                        key={week.weekStart}
                                        className="flex min-w-10 flex-1 flex-col items-center gap-1.5"
                                        title={`${format(
                                            week.date,
                                            "d MMM",
                                        )} · ${formatMinutesAsHours(week.trackedMinutes)} h`}
                                    >
                                        <span className="font-mono text-[0.625rem] tabular-nums text-muted-foreground">
                                            {week.trackedMinutes > 0
                                                ? formatMinutesAsHours(
                                                      week.trackedMinutes,
                                                  )
                                                : ""}
                                        </span>

                                        <div className="relative flex h-35 w-full flex-col justify-end">
                                            {/* Where the week was meant to land. */}
                                            <span
                                                aria-hidden
                                                className="absolute inset-x-0 border-t border-dashed border-border"
                                                style={{
                                                    bottom: height(
                                                        preferences.weeklyTargetMinutes,
                                                    ),
                                                }}
                                            />

                                            <div
                                                className="w-full rounded-t-sm bg-amber-500/70"
                                                style={{
                                                    height: height(
                                                        week.unbillableMinutes,
                                                    ),
                                                }}
                                            />

                                            <div
                                                className="w-full bg-emerald-500/80"
                                                style={{
                                                    height: height(
                                                        week.billableMinutes,
                                                    ),
                                                }}
                                            />
                                        </div>

                                        <span className="font-mono text-[0.5625rem] tabular-nums text-muted-foreground/70">
                                            {format(week.date, "d MMM")}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>

                        <p className="mt-2 flex items-center gap-3 text-[0.625rem] text-muted-foreground">
                            <span className="flex items-center gap-1.5">
                                <span className="size-2 rounded-sm bg-emerald-500/80" />
                                Billable
                            </span>

                            <span className="flex items-center gap-1.5">
                                <span className="size-2 rounded-sm bg-amber-500/70" />
                                Written off
                            </span>

                            <span className="flex items-center gap-1.5">
                                <span className="w-3 border-t border-dashed border-border" />
                                Weekly target
                            </span>
                        </p>
                    </section>

                    <div className="grid gap-4 xl:grid-cols-2">
                        <Breakdown
                            title="Where the time went"
                            icon={<Users className="size-3.5" />}
                            groups={
                                grouping === "clients"
                                    ? report.clients
                                    : report.projects
                            }
                            toggle={
                                <div
                                    role="radiogroup"
                                    aria-label="Group time by"
                                    className="inline-flex rounded-md border border-input p-0.5"
                                >
                                    {GROUPINGS.map((option) => (
                                        <button
                                            key={option.value}
                                            type="button"
                                            role="radio"
                                            aria-checked={
                                                option.value === grouping
                                            }
                                            onClick={() =>
                                                setGrouping(option.value)
                                            }
                                            className={cn(
                                                "h-6 rounded-[5px] px-2 text-[0.6875rem] font-medium transition-colors",
                                                option.value === grouping
                                                    ? "bg-secondary text-secondary-foreground"
                                                    : "text-muted-foreground hover:text-foreground",
                                            )}
                                        >
                                            {option.label}
                                        </button>
                                    ))}
                                </div>
                            }
                        />

                        <Breakdown
                            title="Busiest tickets"
                            icon={<CircleDollarSign className="size-3.5" />}
                            groups={report.tickets.slice(0, 12)}
                            empty="No ticketed work in this period."
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

function Stat({
    label,
    value,
    detail,
    tone = "plain",
}: {
    label: string;
    value: string;
    detail: string;
    tone?: "plain" | "good" | "warn" | "muted";
}) {
    return (
        <div className="rounded-xl border border-border/70 bg-card px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {label}
            </p>

            <p
                className={cn(
                    "mt-1 font-mono text-2xl font-medium tabular-nums",
                    tone === "good" && "text-emerald-400",
                    tone === "warn" && "text-amber-400",
                    tone === "muted" && "text-muted-foreground",
                )}
            >
                {value}
                <span className="ml-1 text-sm font-normal text-muted-foreground">
                    h
                </span>
            </p>

            <p className="mt-0.5 text-[0.6875rem] text-muted-foreground">
                {detail}
            </p>
        </div>
    );
}

function Breakdown({
    title,
    icon,
    groups,
    toggle,
    empty = "Nothing here yet.",
}: {
    title: string;
    icon: React.ReactNode;
    groups: readonly ReportGroup[];
    toggle?: React.ReactNode;
    empty?: string;
}) {
    return (
        <section className="rounded-xl border border-border/70 bg-card p-4">
            <div className="mb-3 flex min-h-7 items-center justify-between gap-3">
                <h3 className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {icon}
                    {title}
                </h3>

                {toggle}
            </div>

            {groups.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                    {empty}
                </p>
            ) : (
                <ul className="flex flex-col gap-2.5">
                    {groups.map((group) => (
                        <li key={group.key}>
                            <div className="flex items-baseline justify-between gap-3">
                                <span className="flex min-w-0 items-center gap-2">
                                    <span
                                        aria-hidden
                                        className="size-2 shrink-0 rounded-full"
                                        style={{
                                            backgroundColor: projectColor({
                                                id: group.colorKey ?? group.key,
                                                color: group.color,
                                            }),
                                        }}
                                    />

                                    <span className="truncate text-sm">
                                        {group.name}
                                    </span>

                                    <span className="truncate text-[0.6875rem] text-muted-foreground">
                                        {group.detail}
                                    </span>
                                </span>

                                <span className="shrink-0 font-mono text-sm tabular-nums">
                                    {formatMinutesAsHours(group.trackedMinutes)}
                                    <span className="ml-1.5 text-[0.6875rem] text-muted-foreground">
                                        {formatPercent(group.share)}
                                    </span>
                                </span>
                            </div>

                            {/* Billable against written off, at a glance. */}
                            <div className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-muted">
                                <div
                                    className="bg-emerald-500/80"
                                    style={{
                                        width: `${
                                            (group.billableMinutes /
                                                group.trackedMinutes) *
                                            100
                                        }%`,
                                    }}
                                />

                                <div
                                    className="bg-amber-500/70"
                                    style={{
                                        width: `${
                                            (group.unbillableMinutes /
                                                group.trackedMinutes) *
                                            100
                                        }%`,
                                    }}
                                />
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
