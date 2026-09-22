import { cn } from "@/lib/utils";

/**
 * The Meridian mark: a meridian cutting across the day.
 *
 * A meridian is the line the sun crosses at noon - what divides a day into
 * its morning and its afternoon, and where a.m. and p.m. get their names. The
 * circle is the day; the blade is the line, tapered to a point at each end
 * and running past the circle on both sides, because the meridian is not part
 * of the day it divides.
 */
export function Logo({ className }: { className?: string }) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            className={cn("size-5", className)}
        >
            <circle
                cx="12"
                cy="12"
                r="6.5"
                stroke="currentColor"
                strokeWidth="1.75"
            />

            {/* Two quadratics meeting at the tips: widest at noon, nothing at
                either end. */}
            <path
                d="M20 4 Q 14.8 14.8 4 20 Q 9.2 9.2 20 4 Z"
                fill="currentColor"
            />
        </svg>
    );
}
