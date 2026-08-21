/**
 * Assistive parsing of a natural task description.
 *
 * Descriptions are typed the way they will eventually be pasted into Polaris:
 *
 *     Gardner 14214 - Discussion with lead - Review SQL queries
 *
 * From that we can usually infer the ticket number, the project, and whether
 * the entry is a ceremony rather than ticketed work. This is only ever a
 * suggestion - nothing here overwrites a choice the user made.
 */

export type EntryKind = "WORK" | "MEETING";

export interface ParsableProject {
    id: string;
    name: string;
    client?: {
        name?: string | null;
        shortName?: string | null;
    } | null;
}

export interface ParsedEntry {
    ticketNumber: string | null;
    projectId: string | null;
    kind: EntryKind;
}

/** Everything before the first " - ", which is where the ticket lives. */
function leadSegment(description: string): string {
    return description.split(/\s+[-–—]\s+/, 1)[0]?.trim() ?? "";
}

/**
 * The ticket is the second word of the lead segment:
 *
 *     "Gardner 14214 - Review X++"  -> 14214
 *     "CSBN 187 - Working session"  -> 187
 *     "Customer Care Scrum"         -> none  (second word is not a number)
 *     "Sujan / Joel - 1-on-1"       -> none  (second word is "/")
 *
 * Reading by position rather than scanning for any run of digits avoids
 * picking up numbers from the prose - "NET30", "1-on-1", "10.0.48".
 */
export function detectTicketNumber(description: string): string | null {
    const words = leadSegment(description).split(/\s+/);

    if (words.length < 2) {
        return null;
    }

    return /^\d{2,8}$/.test(words[1]) ? words[1] : null;
}

const CEREMONY_PATTERN =
    /\b(scrums?|stand-?ups?|retro(?:spectives?)?|synch?|1-on-1|one-on-one|meetings?|huddles?|forum|demos?|refinement|grooming|planning|check-?in|catch-?up|town\s?hall)\b/i;

/**
 * Scrums and syncs carry no ticket and usually map to a different Polaris
 * task. A ticket number is the strongest signal that something is real work,
 * so only unticketed descriptions are considered.
 */
export function detectKind(
    description: string,
    ticketNumber: string | null,
): EntryKind {
    if (ticketNumber) {
        return "WORK";
    }

    return CEREMONY_PATTERN.test(description) ? "MEETING" : "WORK";
}

/**
 * Words a project can be recognised by, longest first so that
 * "CSBN - Self Service Portal" wins over "CSBN - Ongoing Support" when the
 * description actually spells the whole thing out.
 */
function projectAliases(project: ParsableProject): string[] {
    const aliases = new Set<string>();

    const add = (value: string | null | undefined) => {
        const trimmed = value?.trim().toLowerCase();

        if (trimmed) {
            aliases.add(trimmed);
        }
    };

    add(project.name);
    add(project.client?.shortName);
    add(project.client?.name);

    // "Gardner - Ongoing Support" is very often typed as just "Gardner".
    const [leading] = project.name.split(/\s+-\s+/);
    add(leading);

    return [...aliases].sort((a, b) => b.length - a.length);
}

export function detectProjectId(
    description: string,
    projects: readonly ParsableProject[],
): string | null {
    const haystack = description.trim().toLowerCase();

    if (!haystack) {
        return null;
    }

    let best: { id: string; length: number } | null = null;

    for (const project of projects) {
        for (const alias of projectAliases(project)) {
            // Only match on a word boundary, and only near the start of the
            // description - a client named late in a sentence is usually
            // context, not the project being worked on.
            const index = haystack.indexOf(alias);

            if (index === -1 || index > 24) {
                continue;
            }

            const before = index === 0 ? " " : haystack[index - 1];
            const after = haystack[index + alias.length] ?? " ";

            if (/[a-z0-9]/.test(before) || /[a-z0-9]/.test(after)) {
                continue;
            }

            if (!best || alias.length > best.length) {
                best = { id: project.id, length: alias.length };
            }

            break;
        }
    }

    return best?.id ?? null;
}

export function parseEntryDescription(
    description: string,
    projects: readonly ParsableProject[],
): ParsedEntry {
    const ticketNumber = detectTicketNumber(description);

    return {
        ticketNumber,
        projectId: detectProjectId(description, projects),
        kind: detectKind(description, ticketNumber),
    };
}
