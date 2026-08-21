/**
 * Placing entries on a day column.
 *
 * Nothing stops two entries from overlapping - a forgotten timer, or work
 * logged twice - so blocks are packed into columns the way a calendar does it
 * rather than being drawn on top of each other.
 */

export interface LayoutInput {
    id: string;
    /** Minutes from midnight. */
    startMinute: number;
    endMinute: number;
}

export interface PositionedBlock<T extends LayoutInput> {
    item: T;
    /** Fractions of the column width, 0-1. */
    left: number;
    width: number;
}

/** Blocks below this are too short to read, so they are drawn taller. */
export const MIN_BLOCK_MINUTES = 15;

export function layoutDay<T extends LayoutInput>(
    items: readonly T[],
): PositionedBlock<T>[] {
    const sorted = [...items].sort(
        (a, b) => a.startMinute - b.startMinute || a.endMinute - b.endMinute,
    );

    const positioned: PositionedBlock<T>[] = [];

    // A cluster is a run of entries that transitively overlap; every entry in
    // one shares the column count so their widths line up.
    let cluster: T[] = [];
    let clusterEnd = -Infinity;

    const flush = () => {
        if (cluster.length === 0) {
            return;
        }

        const columnEnds: number[] = [];
        const columnOf = new Map<string, number>();

        for (const item of cluster) {
            const displayEnd = Math.max(
                item.endMinute,
                item.startMinute + MIN_BLOCK_MINUTES,
            );

            let column = columnEnds.findIndex((end) => end <= item.startMinute);

            if (column === -1) {
                column = columnEnds.length;
            }

            columnEnds[column] = displayEnd;
            columnOf.set(item.id, column);
        }

        const columns = columnEnds.length;

        for (const item of cluster) {
            const column = columnOf.get(item.id) ?? 0;

            positioned.push({
                item,
                left: column / columns,
                width: 1 / columns,
            });
        }

        cluster = [];
        clusterEnd = -Infinity;
    };

    for (const item of sorted) {
        const displayEnd = Math.max(
            item.endMinute,
            item.startMinute + MIN_BLOCK_MINUTES,
        );

        if (item.startMinute >= clusterEnd) {
            flush();
        }

        cluster.push(item);
        clusterEnd = Math.max(clusterEnd, displayEnd);
    }

    flush();

    return positioned;
}

/**
 * The hour window the grid should cover: the working day, widened to include
 * anything tracked outside it.
 */
export function visibleHourRange(
    items: readonly LayoutInput[],
    defaultStart = 8,
    defaultEnd = 18,
): { startHour: number; endHour: number } {
    let startHour = defaultStart;
    let endHour = defaultEnd;

    for (const item of items) {
        startHour = Math.min(startHour, Math.floor(item.startMinute / 60));

        endHour = Math.max(endHour, Math.ceil(item.endMinute / 60));
    }

    return {
        startHour: Math.max(0, startHour),
        endHour: Math.min(24, Math.max(endHour, startHour + 1)),
    };
}
