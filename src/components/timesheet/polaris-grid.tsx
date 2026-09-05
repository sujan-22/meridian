"use client";

import { format } from "date-fns";
import { TriangleAlert } from "lucide-react";

import { formatMinutesAsHours } from "@/lib/duration";
import { buildPolarisGrid } from "@/lib/polaris";
import type { TimesheetEntry } from "@/lib/timesheet";
import { cn } from "@/lib/utils";

interface PolarisGridViewProps {
    entries: readonly TimesheetEntry[];
    days: readonly Date[];
}

function dayKey(date: Date): string {
    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0"),
    ].join("-");
}

/**
 * The week as Polaris will hold it: one row per task, billing and ticket,
 * with hours in a cell per day.
 *
 * Laid out the same way as the Polaris grid on purpose - the point is to be
 * checkable against the real thing at a glance, so a wrong row is obvious
 * before it becomes an invoice.
 */
export function PolarisGridView({ entries, days }: PolarisGridViewProps) {
    const grid = buildPolarisGrid(entries);

    return (
        <div className="flex flex-col gap-3">
            {grid.unmappable.length > 0 && (
                <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2.5 text-xs">
                    <p className="flex items-center gap-1.5 font-medium text-amber-400">
                        <TriangleAlert className="size-3.5" />
                        {formatMinutesAsHours(
                            grid.unmappable.reduce(
                                (sum, u) => sum + u.minutes,
                                0,
                            ),
                        )}{" "}
                        h has nowhere to go in Polaris
                    </p>

                    <ul className="mt-1.5 flex flex-col gap-0.5 text-muted-foreground">
                        {grid.unmappable.map((item) => (
                            <li key={`${item.projectId}:${item.missing}`}>
                                <span className="text-foreground/80">
                                    {item.clientName} / {item.projectName}
                                </span>{" "}
                                has no {item.missing} task —{" "}
                                <span className="font-mono tabular-nums">
                                    {formatMinutesAsHours(item.minutes)} h
                                </span>
                            </li>
                        ))}
                    </ul>

                    <p className="mt-1.5 text-[0.6875rem] text-muted-foreground">
                        Set them on the project, in Projects. Nothing is filed
                        under a guess.
                    </p>
                </div>
            )}

            <div className="overflow-x-auto rounded-lg border border-border/70">
                <table className="w-full min-w-184 text-sm">
                    <thead>
                        <tr className="border-b border-border/60 bg-muted/30 text-[0.6875rem] uppercase tracking-wide text-muted-foreground">
                            <th className="px-3 py-2 text-left font-medium">
                                Task
                            </th>
                            <th className="px-3 py-2 text-left font-medium">
                                Billing
                            </th>
                            <th className="px-3 py-2 text-left font-medium">
                                Ticket #
                            </th>

                            {days.map((day) => (
                                <th
                                    key={day.toISOString()}
                                    className="px-2 py-2 text-right font-medium"
                                >
                                    {format(day, "EEE d")}
                                </th>
                            ))}

                            <th className="px-3 py-2 text-right font-medium">
                                Total
                            </th>
                        </tr>
                    </thead>

                    <tbody>
                        {grid.rows.map((row) => {
                            const byDay = new Map(
                                row.cells.map((cell) => [cell.day, cell.hours]),
                            );

                            return (
                                <tr
                                    key={row.key}
                                    className={cn(
                                        "border-b border-border/40 last:border-0",
                                        row.entered && "opacity-55",
                                    )}
                                >
                                    <td className="px-3 py-2">
                                        <span className="block font-mono text-xs">
                                            {row.task}
                                        </span>

                                        <span className="block truncate text-[0.6875rem] text-muted-foreground">
                                            {row.clientName}
                                        </span>
                                    </td>

                                    <td
                                        className={cn(
                                            "px-3 py-2 text-xs",
                                            row.billing === "Billable"
                                                ? "text-emerald-400"
                                                : "text-muted-foreground",
                                        )}
                                    >
                                        {row.billing}
                                    </td>

                                    <td className="px-3 py-2 font-mono text-xs">
                                        {row.ticketNumber ?? "—"}
                                    </td>

                                    {days.map((day) => {
                                        const hours = byDay.get(dayKey(day));

                                        return (
                                            <td
                                                key={day.toISOString()}
                                                className={cn(
                                                    "px-2 py-2 text-right font-mono text-xs tabular-nums",
                                                    hours
                                                        ? ""
                                                        : "text-muted-foreground/30",
                                                )}
                                            >
                                                {hours ? hours.toFixed(2) : "·"}
                                            </td>
                                        );
                                    })}

                                    <td className="px-3 py-2 text-right font-mono text-xs font-medium tabular-nums">
                                        {row.totalHours.toFixed(2)}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>

                    <tfoot>
                        <tr className="border-t border-border/60 bg-muted/20">
                            <td
                                colSpan={3 + days.length}
                                className="px-3 py-2 text-right text-xs text-muted-foreground"
                            >
                                Total going into Polaris
                            </td>

                            <td className="px-3 py-2 text-right font-mono text-sm font-medium tabular-nums">
                                {grid.totalHours.toFixed(2)}
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
}
