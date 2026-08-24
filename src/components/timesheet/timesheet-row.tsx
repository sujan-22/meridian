"use client";

import { Check, CircleDollarSign, Copy, Hash, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatTimeOfDay } from "@/lib/dates";
import { formatMinutesAsHours } from "@/lib/duration";
import {
    portionMinutes,
    type TimesheetEntry,
    type TimesheetRow as Row,
} from "@/lib/timesheet";
import { cn } from "@/lib/utils";

interface TimesheetRowProps {
    row: Row<TimesheetEntry>;
    copiedKey: string | null;
    onCopy: (key: string, value: string) => void;
    onToggleEntered: (row: Row<TimesheetEntry>, entered: boolean) => void;
}

/**
 * One line of the Polaris timesheet: the comment, the hours, the ticket, and a
 * tick to say it has been transferred.
 */
export function TimesheetRow({
    row,
    copiedKey,
    onCopy,
    onToggleEntered,
}: TimesheetRowProps) {
    const hours = formatMinutesAsHours(row.billedMinutes);
    const entered = row.allEntered;

    return (
        <div
            className={cn(
                "flex flex-col gap-2 px-3 py-2.5 transition-colors sm:flex-row sm:items-start sm:gap-3",
                entered ? "bg-muted/20" : "hover:bg-muted/30",
            )}
        >
            <button
                type="button"
                role="checkbox"
                aria-checked={entered}
                aria-label={`Mark ${row.comment} as entered in Polaris`}
                onClick={() => onToggleEntered(row, !entered)}
                className={cn(
                    "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border transition-colors",
                    entered
                        ? "border-emerald-500 bg-emerald-500 text-black"
                        : row.enteredCount > 0
                          ? "border-emerald-500/60 bg-emerald-500/20"
                          : "border-input hover:border-foreground/40",
                )}
            >
                {entered && <Check className="size-3.5" />}

                {!entered && row.enteredCount > 0 && (
                    <span className="size-2 rounded-[2px] bg-emerald-500" />
                )}
            </button>

            <div className={cn("min-w-0 flex-1", entered && "opacity-55")}>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    {row.ticketNumber ? (
                        <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.6875rem] text-foreground/80">
                            #{row.ticketNumber}
                        </span>
                    ) : row.isMeeting ? (
                        <span className="flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[0.6875rem] text-foreground/80">
                            <Users className="size-3" />
                            Meeting
                        </span>
                    ) : null}

                    {row.portion === "nonBillable" ? (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[0.6875rem] text-muted-foreground">
                            Written off
                        </span>
                    ) : (
                        <span className="flex items-center gap-1 text-[0.6875rem] text-emerald-400">
                            <CircleDollarSign className="size-3" />
                            Billable
                        </span>
                    )}

                    {row.entries.length > 1 && (
                        <span className="text-[0.6875rem] text-muted-foreground">
                            {row.entries.length} sessions
                        </span>
                    )}

                    <span className="font-mono text-[0.6875rem] tabular-nums text-muted-foreground">
                        {formatTimeOfDay(row.entries[0].startedAt)}
                        {row.entries.length > 1 &&
                            ` – ${formatTimeOfDay(
                                row.entries[row.entries.length - 1].endedAt ??
                                    row.entries[row.entries.length - 1]
                                        .startedAt,
                            )}`}
                    </span>
                </div>

                <p className="mt-1 text-sm leading-snug">{row.comment}</p>

                {row.entries.length > 1 && (
                    <ul className="mt-1.5 flex flex-col gap-0.5">
                        {row.entries.map((entry) => (
                            <li
                                key={entry.id}
                                className="flex gap-2 text-[0.6875rem] text-muted-foreground"
                            >
                                <span className="font-mono tabular-nums">
                                    {formatMinutesAsHours(
                                        portionMinutes(entry, row.portion),
                                    )}
                                </span>

                                <span className="truncate">
                                    {entry.description}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
                <span
                    className={cn(
                        "w-12 text-right font-mono text-sm font-medium tabular-nums",
                        entered && "opacity-55",
                    )}
                >
                    {hours}
                </span>

                <CopyButton
                    label="Comment"
                    copied={copiedKey === `${row.key}:comment`}
                    onClick={() => onCopy(`${row.key}:comment`, row.comment)}
                />

                <CopyButton
                    label={hours}
                    copied={copiedKey === `${row.key}:hours`}
                    onClick={() => onCopy(`${row.key}:hours`, hours)}
                />

                {row.ticketNumber && (
                    <CopyButton
                        icon={<Hash className="size-3" />}
                        label={row.ticketNumber}
                        copied={copiedKey === `${row.key}:ticket`}
                        onClick={() =>
                            onCopy(`${row.key}:ticket`, row.ticketNumber!)
                        }
                    />
                )}
            </div>
        </div>
    );
}

interface CopyButtonProps {
    label: string;
    icon?: React.ReactNode;
    copied: boolean;
    onClick: () => void;
}

function CopyButton({ label, icon, copied, onClick }: CopyButtonProps) {
    return (
        <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label={`Copy ${label}`}
            onClick={onClick}
            className={cn(
                "h-7 gap-1 font-mono text-[0.6875rem]",
                copied && "border-emerald-500/60 text-emerald-400",
            )}
        >
            {copied ? (
                <Check className="size-3" />
            ) : (
                (icon ?? <Copy className="size-3" />)
            )}

            {copied ? "Copied" : label}
        </Button>
    );
}
