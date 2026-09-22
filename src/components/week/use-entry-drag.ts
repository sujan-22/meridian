"use client";

import { useEffect, useRef, useState } from "react";

import { QUARTER_MINUTES } from "@/lib/duration";

export type DragMode = "move" | "resize-start" | "resize-end";

export interface EntryPlacement {
    dayIndex: number;
    /** Minutes from midnight. */
    startMinute: number;
    endMinute: number;
}

export interface DragPreview extends EntryPlacement {
    entryId: string;
    /**
     * Pixels between where the block is laid out and where the pointer
     * actually is.
     *
     * Times snap to the quarter hour, which means the laid-out position only
     * changes every fifteen minutes - a 56px jump at the closest zoom, with a
     * dead 28px before it. Carrying the remainder lets the block sit exactly
     * under the cursor while the value underneath it stays on the grid.
     */
    offsetY: number;
}

interface DragOrigin extends EntryPlacement {
    entryId: string;
    mode: DragMode;
    pointerY: number;
    /** Column rectangles captured once, so moving across days is cheap. */
    columns: Array<{ index: number; left: number; right: number }>;
}

const MINUTES_PER_DAY = 24 * 60;

/** Below this the gesture is a click, not a drag. */
const DRAG_THRESHOLD_PX = 3;

const snap = (minutes: number) =>
    Math.round(minutes / QUARTER_MINUTES) * QUARTER_MINUTES;

const clamp = (value: number, min: number, max: number) =>
    Math.min(max, Math.max(min, value));

interface UseEntryDragOptions {
    hourHeight: number;
    /** Commit a finished gesture. Only called when something actually moved. */
    onCommit: (preview: DragPreview) => void;
    /** A press that never moved - treated as a plain click on the entry. */
    onActivate: (entryId: string, element: HTMLElement) => void;
}

export function useEntryDrag({
    hourHeight,
    onCommit,
    onActivate,
}: UseEntryDragOptions) {
    const originRef = useRef<DragOrigin | null>(null);
    const previewRef = useRef<DragPreview | null>(null);
    const teardownRef = useRef<(() => void) | null>(null);

    // Pointer events arrive faster than the screen refreshes, and each one was
    // re-rendering every block in the week. Only the latest is kept, and it is
    // applied once per frame.
    const latestRef = useRef<PointerEvent | null>(null);
    const frameRef = useRef<number | null>(null);

    const [preview, setPreview] = useState<DragPreview | null>(null);

    // A gesture in flight owns window-level listeners; make sure unmounting
    // mid-drag does not leave them behind.
    useEffect(() => () => teardownRef.current?.(), []);

    function begin(
        event: React.PointerEvent<HTMLElement>,
        mode: DragMode,
        entryId: string,
        placement: EntryPlacement,
    ) {
        // Only a primary press starts a gesture.
        if (event.button !== 0) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        const element = event.currentTarget;

        const columns = [
            ...document.querySelectorAll<HTMLElement>("[data-day-index]"),
        ].map((node) => {
            const rect = node.getBoundingClientRect();

            return {
                index: Number(node.dataset.dayIndex),
                left: rect.left,
                right: rect.right,
            };
        });

        const origin: DragOrigin = {
            ...placement,
            entryId,
            mode,
            pointerY: event.clientY,
            columns,
        };

        originRef.current = origin;
        previewRef.current = null;

        let moved = false;

        const applyLatest = () => {
            frameRef.current = null;

            const current = originRef.current;
            const moveEvent = latestRef.current;

            if (!current || !moveEvent) {
                return;
            }

            const next = resolve(current, moveEvent, hourHeight);

            previewRef.current = next;
            setPreview(next);
        };

        const handleMove = (moveEvent: PointerEvent) => {
            const current = originRef.current;

            if (!current) {
                return;
            }

            const deltaY = moveEvent.clientY - current.pointerY;

            if (!moved && Math.abs(deltaY) < DRAG_THRESHOLD_PX) {
                // Horizontal-only movement still counts as a drag once it
                // leaves the original column.
                const column = columnAt(current.columns, moveEvent.clientX);

                if (column === null || column === current.dayIndex) {
                    return;
                }
            }

            moved = true;
            latestRef.current = moveEvent;

            if (frameRef.current === null) {
                frameRef.current = requestAnimationFrame(applyLatest);
            }
        };

        const finish = () => {
            teardown();

            const current = originRef.current;
            const result = previewRef.current;

            originRef.current = null;
            previewRef.current = null;
            setPreview(null);

            if (!current) {
                return;
            }

            if (!moved || !result) {
                onActivate(current.entryId, element);

                return;
            }

            if (
                result.dayIndex !== current.dayIndex ||
                result.startMinute !== current.startMinute ||
                result.endMinute !== current.endMinute
            ) {
                onCommit(result);
            }
        };

        const handleCancel = () => {
            teardown();

            originRef.current = null;
            previewRef.current = null;
            setPreview(null);
        };

        const teardown = () => {
            if (frameRef.current !== null) {
                cancelAnimationFrame(frameRef.current);
                frameRef.current = null;
            }

            latestRef.current = null;

            window.removeEventListener("pointermove", handleMove);
            window.removeEventListener("pointerup", finish);
            window.removeEventListener("pointercancel", handleCancel);
            window.removeEventListener("keydown", handleKey);

            teardownRef.current = null;
        };

        const handleKey = (keyEvent: KeyboardEvent) => {
            if (keyEvent.key === "Escape") {
                handleCancel();
            }
        };

        window.addEventListener("pointermove", handleMove);
        window.addEventListener("pointerup", finish);
        window.addEventListener("pointercancel", handleCancel);
        window.addEventListener("keydown", handleKey);

        teardownRef.current = teardown;
    }

    return { preview, begin };
}

function columnAt(
    columns: DragOrigin["columns"],
    clientX: number,
): number | null {
    const hit = columns.find(
        (column) => clientX >= column.left && clientX <= column.right,
    );

    return hit ? hit.index : null;
}

function resolve(
    origin: DragOrigin,
    event: PointerEvent,
    hourHeight: number,
): DragPreview {
    const rawMinutes = ((event.clientY - origin.pointerY) / hourHeight) * 60;
    const deltaMinutes = snap(rawMinutes);

    if (origin.mode === "move") {
        const duration = origin.endMinute - origin.startMinute;

        const startMinute = clamp(
            snap(origin.startMinute) + deltaMinutes,
            0,
            MINUTES_PER_DAY - duration,
        );

        // What snapping threw away, in pixels - and only as far as the block
        // actually travelled, so it does not float past the top or bottom of
        // the day once clamped.
        const travelled = startMinute - snap(origin.startMinute);
        const residual = ((rawMinutes - travelled) / 60) * hourHeight;

        return {
            entryId: origin.entryId,
            dayIndex:
                columnAt(origin.columns, event.clientX) ?? origin.dayIndex,
            startMinute,
            endMinute: startMinute + duration,
            offsetY: residual,
        };
    }

    if (origin.mode === "resize-start") {
        return {
            entryId: origin.entryId,
            dayIndex: origin.dayIndex,
            startMinute: clamp(
                snap(origin.startMinute) + deltaMinutes,
                0,
                origin.endMinute - QUARTER_MINUTES,
            ),
            endMinute: origin.endMinute,
            // An edge being dragged reads better snapped: the block shows the
            // length it will actually have.
            offsetY: 0,
        };
    }

    return {
        entryId: origin.entryId,
        dayIndex: origin.dayIndex,
        startMinute: origin.startMinute,
        endMinute: clamp(
            snap(origin.endMinute) + deltaMinutes,
            origin.startMinute + QUARTER_MINUTES,
            MINUTES_PER_DAY,
        ),
        offsetY: 0,
    };
}
