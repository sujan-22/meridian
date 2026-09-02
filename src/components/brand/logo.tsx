import { cn } from "@/lib/utils";

/**
 * The Meridian mark: the meridian line crossing the day.
 *
 * A meridian is the line the sun crosses at noon - the thing that divides a
 * day into its morning and its afternoon, and where a.m. and p.m. get their
 * names. The circle is the day, the filled half is the part of it already
 * spent, and the line runs past both because the meridian is not part of the
 * day it divides.
 */
export function Logo({ className }: { className?: string }) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
            className={cn("size-5", className)}
        >
            {/* Morning, already behind you. */}
            <path
                d="M12 19 A 7 7 0 0 1 12 5"
                fill="currentColor"
                stroke="none"
            />

            <circle cx="12" cy="12" r="7" />

            <path d="M12 2 V 22" />
        </svg>
    );
}
