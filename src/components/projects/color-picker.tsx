"use client";

import { Check, Pipette } from "lucide-react";
import { useId, useState } from "react";

import { Input } from "@/components/ui/input";
import { normalizeHexColor, PROJECT_COLOR_PALETTE } from "@/lib/project-color";
import { cn } from "@/lib/utils";

interface ColorPickerProps {
    value: string | null;
    onChange: (color: string) => void;
}

/**
 * Project colour is the main way work is told apart at a glance - in the week
 * calendar, the timesheet and the project list - so the palette comes first
 * and is designed to stay distinguishable. Anything outside it can still be
 * set: the swatch at the end opens the system colour picker, and the hex can
 * be typed or pasted straight in.
 */
export function ColorPicker({ value, onChange }: ColorPickerProps) {
    const inputId = useId();

    const selectedFromPalette = PROJECT_COLOR_PALETTE.some(
        (color) => color.value.toLowerCase() === value?.toLowerCase(),
    );

    // What is in the text field while it is being edited, which is not yet a
    // colour - "#a2" is a reasonable thing to have typed halfway through.
    const [draft, setDraft] = useState(value ?? "");

    const custom = value && !selectedFromPalette ? value : null;

    function commit(next: string) {
        const normalized = normalizeHexColor(next);

        if (normalized) {
            onChange(normalized);
        }
    }

    return (
        <div className="flex flex-col gap-2.5">
            <div
                role="radiogroup"
                aria-label="Project colour"
                className="flex flex-wrap gap-1.5"
            >
                {PROJECT_COLOR_PALETTE.map((color) => {
                    const selected =
                        value?.toLowerCase() === color.value.toLowerCase();

                    return (
                        <button
                            key={color.value}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            aria-label={color.name}
                            title={color.name}
                            onClick={() => {
                                setDraft(color.value);
                                onChange(color.value);
                            }}
                            className={cn(
                                "flex size-7 items-center justify-center rounded-md ring-offset-2 ring-offset-popover transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                selected && "ring-2 ring-foreground/60",
                            )}
                            style={{ backgroundColor: color.value }}
                        >
                            {selected && (
                                <Check className="size-3.5 text-black/70" />
                            )}
                        </button>
                    );
                })}

                {/* The native picker, wearing the current colour. */}
                <label
                    htmlFor={inputId}
                    title="Custom colour"
                    className={cn(
                        "flex size-7 cursor-pointer items-center justify-center rounded-md border border-dashed border-border ring-offset-2 ring-offset-popover transition-transform hover:scale-110",
                        custom && "border-solid ring-2 ring-foreground/60",
                    )}
                    style={custom ? { backgroundColor: custom } : undefined}
                >
                    <Pipette
                        className={cn(
                            "size-3.5",
                            custom ? "text-black/70" : "text-muted-foreground",
                        )}
                    />

                    <input
                        id={inputId}
                        type="color"
                        value={value ?? "#888888"}
                        onChange={(event) => {
                            setDraft(event.target.value);
                            onChange(event.target.value);
                        }}
                        className="sr-only"
                    />
                </label>
            </div>

            <div className="flex items-center gap-2">
                <Input
                    value={draft}
                    onChange={(event) => {
                        setDraft(event.target.value);
                        commit(event.target.value);
                    }}
                    onBlur={() => setDraft(value ?? "")}
                    spellCheck={false}
                    aria-label="Colour hex code"
                    placeholder="#a29dff"
                    className="h-8 w-28 font-mono text-xs"
                />

                <span className="text-xs text-muted-foreground">
                    or paste a hex code
                </span>
            </div>
        </div>
    );
}
