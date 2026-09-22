import { cn } from "@/lib/utils";

/**
 * The Meridian mark: a black hole seen edge-on, its disc crossing behind the
 * sphere at the top and in front of it at the bottom.
 *
 * The horizon is a mask rather than a filled circle, so it is a real hole -
 * whatever sits behind the mark shows through it. That is the point: the mark
 * has no background of its own and takes the colour of whatever it is on.
 *
 * The disc keeps its own warm colours rather than following `currentColor`,
 * because the heat gradient across it is the thing that makes it read as an
 * accretion disc and not a ring.
 */
export function Logo({ className }: { className?: string }) {
    return (
        <svg
            viewBox="0 0 48 48"
            fill="none"
            aria-hidden="true"
            className={cn("size-5", className)}
        >
            <defs>
                <linearGradient
                    id="meridian-disc"
                    x1="5"
                    y1="32"
                    x2="43"
                    y2="16"
                    gradientUnits="userSpaceOnUse"
                >
                    <stop offset="0" stopColor="#7c2d12" />
                    <stop offset="0.16" stopColor="#ea580c" />
                    <stop offset="0.4" stopColor="#fdba74" />
                    <stop offset="0.54" stopColor="#fffbeb" />
                    <stop offset="0.7" stopColor="#fb923c" />
                    <stop offset="1" stopColor="#7c2d12" />
                </linearGradient>

                <filter
                    id="meridian-glow"
                    x="-60%"
                    y="-60%"
                    width="220%"
                    height="220%"
                >
                    <feGaussianBlur stdDeviation="1.4" />
                </filter>

                {/* The horizon: punched out, not painted over. */}
                <mask id="meridian-horizon">
                    <rect width="48" height="48" fill="white" />
                    <circle cx="24" cy="24" r="9.6" fill="black" />
                </mask>
            </defs>

            <g transform="rotate(-22 24 24)">
                {/* Everything behind the sphere, clipped by the horizon. */}
                <g mask="url(#meridian-horizon)">
                    <ellipse
                        cx="24"
                        cy="24"
                        rx="21"
                        ry="9.8"
                        stroke="url(#meridian-disc)"
                        strokeWidth="0.55"
                        opacity="0.3"
                    />

                    <g filter="url(#meridian-glow)" opacity="0.8">
                        <path
                            d="M4 24 A 20 8.6 0 0 1 44 24"
                            stroke="url(#meridian-disc)"
                            strokeWidth="3"
                            strokeLinecap="round"
                        />
                    </g>

                    <path
                        d="M4 24 A 20 8.6 0 0 1 44 24"
                        stroke="url(#meridian-disc)"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                    />
                </g>

                {/* The near edge of the disc, which passes in front. */}
                <g filter="url(#meridian-glow)" opacity="0.95">
                    <path
                        d="M4 24 A 20 8.6 0 0 0 44 24"
                        stroke="url(#meridian-disc)"
                        strokeWidth="3.6"
                        strokeLinecap="round"
                    />
                </g>

                <path
                    d="M4 24 A 20 8.6 0 0 0 44 24"
                    stroke="url(#meridian-disc)"
                    strokeWidth="2.7"
                    strokeLinecap="round"
                />
            </g>
        </svg>
    );
}
