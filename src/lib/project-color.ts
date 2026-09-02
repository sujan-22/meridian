/**
 * Projects carry their own colour, but nothing forces one to be set. Fall back
 * to a stable colour derived from the project id so the week view never shows
 * two adjacent blocks in the same default grey.
 */

/**
 * The colours offered when creating or editing a project.
 *
 * Every one sits at the same lightness and chroma in OKLCH (L 0.74, C ~0.15)
 * with the hues spread around the wheel, so they read as one family rather
 * than a bag of unrelated web colours - and each stays legible both as an 8px
 * dot and as a calendar block against a near-black panel. A project is not
 * limited to these; any colour can be set by hand.
 */
export const PROJECT_COLOR_PALETTE = [
    { name: "Rose", value: "#fa7f91" },
    { name: "Coral", value: "#fa8467" },
    { name: "Amber", value: "#e69825" },
    { name: "Lime", value: "#95bb46" },
    { name: "Green", value: "#60c473" },
    { name: "Teal", value: "#12c3bf" },
    { name: "Cyan", value: "#07bfde" },
    { name: "Sky", value: "#39b5ff" },
    { name: "Blue", value: "#82a8fd" },
    { name: "Indigo", value: "#a29dff" },
    { name: "Violet", value: "#c190f6" },
    { name: "Orchid", value: "#df86d7" },
    { name: "Slate", value: "#9aa5b1" },
] as const;

/** Used when a project has no colour of its own. */
const FALLBACK_COLORS = PROJECT_COLOR_PALETTE.map((entry) => entry.value);

/** A six-digit hex colour, which is what the colour input speaks. */
export const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export function isValidHexColor(value: string): boolean {
    return HEX_COLOR.test(value.trim());
}

/** Accepts `abc123` as readily as `#abc123`, and normalises the case. */
export function normalizeHexColor(value: string): string | null {
    const trimmed = value.trim();
    const withHash = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;

    return isValidHexColor(withHash) ? withHash.toLowerCase() : null;
}

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
