"use client";

import { Ticket, Users } from "lucide-react";

import type { EntryKind } from "@/gql/graphql";
import { cn } from "@/lib/utils";

const OPTIONS: Array<{
    value: EntryKind;
    label: string;
    icon: typeof Users;
    hint: string;
}> = [
    {
        value: "WORK",
        label: "Work",
        icon: Ticket,
        hint: "Ticketed work against a project",
    },
    {
        value: "MEETING",
        label: "Meeting",
        icon: Users,
        hint: "Scrum, sync or ceremony - no ticket",
    },
];

interface KindToggleProps {
    value: EntryKind;
    onChange: (kind: EntryKind) => void;
}

/**
 * Meetings carry no ticket and usually map to a different Polaris task, so
 * they are worth separating from ticketed work at entry time.
 */
export function KindToggle({ value, onChange }: KindToggleProps) {
    return (
        <div
            role="radiogroup"
            aria-label="Entry type"
            className="inline-flex rounded-md border border-input p-0.5"
        >
            {OPTIONS.map((option) => {
                const selected = option.value === value;

                return (
                    <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        title={option.hint}
                        onClick={() => onChange(option.value)}
                        className={cn(
                            "flex h-8 items-center gap-1.5 rounded-[6px] px-3 text-xs font-medium transition-colors",
                            selected
                                ? "bg-secondary text-secondary-foreground"
                                : "text-muted-foreground hover:text-foreground",
                        )}
                    >
                        <option.icon className="size-3.5" />
                        {option.label}
                    </button>
                );
            })}
        </div>
    );
}
