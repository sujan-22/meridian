"use client";

import { useSyncExternalStore } from "react";

import { startOfDay } from "date-fns";

/**
 * Clock hooks.
 *
 * The clock is an external system, so it is subscribed to rather than mirrored
 * into state: one interval serves every consumer, and the server snapshot is
 * `null` so nothing time-dependent is rendered until after hydration. That
 * matters because both the running timer and the day boundary depend on the
 * browser's clock and timezone, which the server cannot know.
 */

type Listener = () => void;

function createClockStore<T>(
    intervalMs: number,
    read: () => T,
    changed: (previous: T, next: T) => boolean,
) {
    const listeners = new Set<Listener>();

    let snapshot: T | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;

    function tick() {
        const next = read();

        if (snapshot !== null && !changed(snapshot, next)) {
            return;
        }

        snapshot = next;

        for (const listener of listeners) {
            listener();
        }
    }

    return {
        subscribe(listener: Listener) {
            listeners.add(listener);

            if (timer === null) {
                tick();

                timer = setInterval(tick, intervalMs);
            }

            return () => {
                listeners.delete(listener);

                if (listeners.size === 0 && timer !== null) {
                    clearInterval(timer);

                    timer = null;
                }
            };
        },

        getSnapshot: () => snapshot,

        getServerSnapshot: () => null,
    };
}

const nowStore = createClockStore(
    1_000,
    () => Date.now(),
    (previous, next) => previous !== next,
);

// The week calendar only needs minute resolution: a second-by-second tick
// would re-lay-out the whole grid for no visible gain.
const minuteStore = createClockStore(
    15_000,
    () => Math.floor(Date.now() / 60_000) * 60_000,
    (previous, next) => previous !== next,
);

const todayStore = createClockStore(
    30_000,
    () => startOfDay(new Date()),
    // Keep the same Date instance all day so it is safe to use directly as a
    // query variable without refetching on every tick.
    (previous, next) => previous.getTime() !== next.getTime(),
);

/** Milliseconds since the epoch, ticking each second. `null` until mounted. */
export function useNow(): number | null {
    return useSyncExternalStore(
        nowStore.subscribe,
        nowStore.getSnapshot,
        nowStore.getServerSnapshot,
    );
}

/** Milliseconds since the epoch, truncated to the minute. `null` until mounted. */
export function useMinute(): number | null {
    return useSyncExternalStore(
        minuteStore.subscribe,
        minuteStore.getSnapshot,
        minuteStore.getServerSnapshot,
    );
}

/** Midnight of the current local day, with a stable identity. */
export function useToday(): Date | null {
    return useSyncExternalStore(
        todayStore.subscribe,
        todayStore.getSnapshot,
        todayStore.getServerSnapshot,
    );
}
