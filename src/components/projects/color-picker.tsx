"use client";

import { Check } from "lucide-react";

import { PROJECT_COLOR_PALETTE } from "@/lib/project-color";
import { cn } from "@/lib/utils";

interface ColorPickerProps {
    value: string | null;
    onChange: (color: string) => void;
}

/**
 * Project colour is the main way work is told apart at a glance - in the
 * entry list, the week calendar and the reports - so it is picked from a
 * fixed palette rather than typed as a hex code.
 */
export function ColorPicker({ value, onChange }: ColorPickerProps) {
    return (
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
                        onClick={() => onChange(color.value)}
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
        </div>
    );
}
