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

            const next = resolve(current, moveEvent, hourHeight);

            previewRef.current = next;
            setPreview(next);
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
    const deltaMinutes = snap(
        ((event.clientY - origin.pointerY) / hourHeight) * 60,
    );

    if (origin.mode === "move") {
        const duration = origin.endMinute - origin.startMinute;

        const startMinute = clamp(
            snap(origin.startMinute) + deltaMinutes,
            0,
            MINUTES_PER_DAY - duration,
        );

        return {
            entryId: origin.entryId,
            dayIndex: columnAt(origin.columns, event.clientX) ?? origin.dayIndex,
            startMinute,
            endMinute: startMinute + duration,
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
    };
}
