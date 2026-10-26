import { Skeleton } from "@/components/ui/skeleton";

/**
 * Shown the moment a page in the app is clicked.
 *
 * Every page here is dynamic, and without a loading boundary Next.js neither
 * prefetches a dynamic page nor changes anything on screen until the server
 * has answered - so each click in the sidebar left the old page sitting there,
 * looking ignored, for a full round trip to the server. With this file the
 * fallback is prefetched and swapped in immediately, and the page replaces it
 * as soon as it arrives.
 *
 * It only has to hold the space: each view draws its own skeleton for its
 * data, so this stays deliberately plain.
 */
export default function AppLoading() {
    return (
        <div
            aria-busy
            className="flex w-full flex-1 flex-col px-5 py-6 lg:px-8 2xl:px-10"
        >
            <Skeleton className="h-7 w-40" />
            <Skeleton className="mt-2 h-4 w-72 max-w-full" />
            <Skeleton className="mt-6 h-64 w-full rounded-xl" />
        </div>
    );
}
