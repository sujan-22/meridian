import { cn } from "@/lib/utils";

/**
 * The Meridian mark: a sphere with its meridian drawn on it.
 *
 * It is deliberately two shapes and no more. The mark is used at 20px in the
 * sidebar and 16px in a browser tab, and anything with a gradient, a glow or
 * a third element turns to mush at that size - which is the same reason the
 * hero image on the sign-in page cannot do this job.
 *
 * It follows `currentColor`, so it takes the colour of whatever it sits in
 * and needs no background of its own. The sphere is also the shape in
 * `public/logo.png`, which is what ties the small mark to the large image.
 */
export function Logo({ className }: { className?: string }) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            aria-hidden="true"
            className={cn("size-5", className)}
        >
            <circle cx="12" cy="12" r="9" strokeWidth="1.6" />

            {/* The meridian: a full circle seen edge-on, so it reads as a
                line running over a sphere rather than a slot cut into it. */}
            <ellipse cx="12" cy="12" rx="3.6" ry="9" strokeWidth="1.35" />
        </svg>
    );
}
