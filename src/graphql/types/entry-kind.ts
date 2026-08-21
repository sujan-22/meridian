import type { AppBuilder } from "../builder";

export function entryKindRef(builder: AppBuilder) {
    return builder.enumType("EntryKind", {
        values: {
            WORK: {
                value: "work",
            },
            MEETING: {
                value: "meeting",
            },
        } as const,
    });
}

export type EntryKindRef = ReturnType<typeof entryKindRef>;
