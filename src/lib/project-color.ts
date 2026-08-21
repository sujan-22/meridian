/**
 * Projects carry their own colour, but nothing forces one to be set. Fall back
 * to a stable colour derived from the project id so the week view never shows
 * two adjacent blocks in the same default grey.
 */

const FALLBACK_COLORS = [
    "#6574cd",
    "#d84a4a",
    "#31b5a4",
    "#d88c34",
    "#d4c742",
    "#9b6bd6",
    "#4a9fd8",
    "#5fb85f",
] as const;

/**
 * The colours offered when creating or editing a project. Each one has to stay
 * legible as a 8px dot and as a calendar block against a near-black panel.
 */
export const PROJECT_COLOR_PALETTE = [
    { name: "Indigo", value: "#6574cd" },
    { name: "Violet", value: "#9b6bd6" },
    { name: "Blue", value: "#4a9fd8" },
    { name: "Teal", value: "#31b5a4" },
    { name: "Green", value: "#5fb85f" },
    { name: "Lime", value: "#a3c644" },
    { name: "Yellow", value: "#d4c742" },
    { name: "Amber", value: "#d88c34" },
    { name: "Orange", value: "#d9682f" },
    { name: "Red", value: "#d84a4a" },
    { name: "Pink", value: "#d6538f" },
    { name: "Slate", value: "#7b8794" },
] as const;

export function projectColor(project: {
    id: string;
    color?: string | null;
}): string {
    if (project.color) {
        return project.color;
    }

    let hash = 0;

    for (const char of project.id) {
        hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
    }

    return FALLBACK_COLORS[hash % FALLBACK_COLORS.length];
}
