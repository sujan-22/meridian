import type { ReactNode } from "react";

/**
 * The signed-out shell: no sidebar, no topbar, nothing to navigate to. There
 * is exactly one thing to do on these pages.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
    return (
        <div className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden px-4 py-10">
            {/* A quiet wash of the brand colour, so the page is not a plain
                white sheet without competing with the card. */}
            <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(60rem_40rem_at_50%_-10%,color-mix(in_oklab,var(--primary)_10%,transparent),transparent)]"
            />

            <div className="relative w-full max-w-sm">{children}</div>
        </div>
    );
}
