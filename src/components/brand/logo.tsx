import { cn } from "@/lib/utils";

/**
 * The Quanta mark: a square split into four, with one quarter filled.
 *
 * Everything in the app is measured in quarter hours - the smallest unit that
 * can be billed - so the mark is that unit rather than yet another clock face.
 */
export function Logo({ className }: { className?: string }) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            className={cn("size-5", className)}
        >
            <rect
                x="13"
                y="3"
                width="8"
                height="8"
                rx="2.5"
                fill="currentColor"
            />
            <rect
                x="3"
                y="3"
                width="8"
                height="8"
                rx="2.5"
                fill="currentColor"
                opacity="0.32"
            />
            <rect
                x="3"
                y="13"
                width="8"
                height="8"
                rx="2.5"
                fill="currentColor"
                opacity="0.32"
            />
            <rect
                x="13"
                y="13"
                width="8"
                height="8"
                rx="2.5"
                fill="currentColor"
                opacity="0.32"
            />
        </svg>
    );
}
