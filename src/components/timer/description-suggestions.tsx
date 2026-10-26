"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@apollo/client/react";
import { format } from "date-fns";

import { DescriptionSuggestionsDocument } from "@/gql/graphql";
import type { TimeEntryFieldsFragment } from "@/gql/graphql";
import { projectColor } from "@/lib/project-color";
import { cn } from "@/lib/utils";

/** Below this there is nothing useful to match on. */
const MIN_QUERY = 3;

/** How long typing has to pause before the server is asked. */
const SETTLE_MS = 150;

interface DescriptionSuggestionsProps {
    query: string;
    /** Hidden while a value is being applied or the field is not focused. */
    open: boolean;
    onPick: (entry: TimeEntryFieldsFragment) => void;
    onDismiss: () => void;
}

/**
 * Past descriptions matching what is being typed.
 *
 * The same work comes back week after week, and these descriptions are long -
 * reusing one is far quicker, and keeps the Polaris comment consistent.
 */
export function DescriptionSuggestions({
    query,
    open,
    onPick,
    onDismiss,
}: DescriptionSuggestionsProps) {
    const term = query.trim();
    const ref = useRef<HTMLDivElement>(null);

    const [highlighted, setHighlighted] = useState(0);

    // The server is asked once typing pauses rather than on every keystroke.
    // At production latency the answers to earlier keystrokes were still
    // arriving while later ones were typed, so the list redrew for each and
    // trailed behind the field.
    const [settledTerm, setSettledTerm] = useState(term);

    useEffect(() => {
        const timer = setTimeout(() => setSettledTerm(term), SETTLE_MS);

        return () => clearTimeout(timer);
    }, [term]);

    const { data, previousData } = useQuery(DescriptionSuggestionsDocument, {
        variables: { query: settledTerm, limit: 6 },
        skip: settledTerm.length < MIN_QUERY,
        // Past descriptions do not change while the dialog is open, so a term
        // already asked about - backspacing, say - is answered from the cache.
        fetchPolicy: "cache-first",
    });

    // The last answer stays up while the next is on its way, so the list
    // narrows in place instead of blinking empty between keystrokes. A stable
    // reference, so the key handler below is not rebound each render.
    const suggestions = useMemo(
        () =>
            ((data ?? previousData)?.descriptionSuggestions ??
                []) as TimeEntryFieldsFragment[],
        [data, previousData],
    );

    // Typing changes the list underneath the cursor, so start from the top.
    // Adjusted during render rather than in an effect - React re-renders
    // before painting, so there is no flash of the stale highlight.
    const [lastTerm, setLastTerm] = useState(term);

    if (term !== lastTerm) {
        setLastTerm(term);
        setHighlighted(0);
    }

    useEffect(() => {
        if (!open) {
            return;
        }

        const handleKey = (event: KeyboardEvent) => {
            if (suggestions.length === 0) {
                return;
            }

            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();

                setHighlighted((current) => {
                    const next =
                        event.key === "ArrowDown" ? current + 1 : current - 1;

                    return (next + suggestions.length) % suggestions.length;
                });

                return;
            }

            if (event.key === "Tab") {
                event.preventDefault();
                onPick(suggestions[highlighted]);
            }

            if (event.key === "Escape") {
                onDismiss();
            }
        };

        window.addEventListener("keydown", handleKey, true);

        return () => window.removeEventListener("keydown", handleKey, true);
    }, [open, suggestions, highlighted, onPick, onDismiss]);

    /**
     * A press anywhere else closes the list.
     *
     * It is drawn over the controls below the field, so without this the only
     * way out was Escape and the rest of the dialog could not be reached.
     * The boundary is the wrapper rather than the list itself, so pressing
     * back into the description does not dismiss what you are reading.
     */
    useEffect(() => {
        if (!open) {
            return;
        }

        const handlePointerDown = (event: PointerEvent) => {
            const anchor = ref.current?.parentElement;
            const target = event.target as Node | null;

            if (!anchor || (target && anchor.contains(target))) {
                return;
            }

            onDismiss();
        };

        window.addEventListener("pointerdown", handlePointerDown, true);

        return () =>
            window.removeEventListener("pointerdown", handlePointerDown, true);
    }, [open, onDismiss]);

    if (!open || term.length < MIN_QUERY || suggestions.length === 0) {
        return null;
    }

    return (
        <div
            ref={ref}
            role="listbox"
            aria-label="Previous descriptions"
            className="absolute inset-x-0 top-full z-40 mt-1 max-h-56 overflow-y-auto rounded-lg border border-border bg-popover shadow-xl"
        >
            <p className="border-b border-border/60 px-3 py-1.5 text-[0.625rem] uppercase tracking-[0.12em] text-muted-foreground">
                From previous work · Tab to use
            </p>

            {suggestions.map((entry, index) => (
                <button
                    key={entry.id}
                    type="button"
                    role="option"
                    aria-selected={index === highlighted}
                    onPointerDown={(event) => {
                        // Keep the input focused so picking does not blur it.
                        event.preventDefault();
                        onPick(entry);
                    }}
                    onMouseEnter={() => setHighlighted(index)}
                    className={cn(
                        "flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors",
                        index === highlighted
                            ? "bg-accent"
                            : "hover:bg-muted/50",
                    )}
                >
                    <span
                        aria-hidden
                        className="size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: projectColor(entry.project) }}
                    />

                    <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs">
                            {entry.description}
                        </span>

                        <span className="block truncate text-[0.625rem] text-muted-foreground">
                            {entry.project.name}
                            {entry.ticketNumber
                                ? ` · #${entry.ticketNumber}`
                                : ""}
                            {" · "}
                            {format(new Date(entry.startedAt), "d MMM")}
                        </span>
                    </span>
                </button>
            ))}
        </div>
    );
}
