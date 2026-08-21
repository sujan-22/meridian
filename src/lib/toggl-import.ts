/**
 * Reading a Toggl "time entries" CSV export.
 *
 * The export carries no client and marks everything non-billable, so those two
 * columns are deliberately not trusted - billing comes from the project's own
 * default instead. See `parseTogglCsv` for the rest of the quirks.
 */

import { parseCsvRecords } from "./csv";

export interface TogglRow {
    /** 1-based line in the file, for reporting problems back. */
    line: number;
    projectName: string;
    description: string;
    /** Only meaningful when Toggl actually recorded a billable entry. */
    billable: boolean;
    startedAt: Date;
    endedAt: Date;
}

export interface TogglParseResult {
    rows: TogglRow[];
    skipped: Array<{ line: number; reason: string }>;
    /** Distinct project names in the file, in order of first appearance. */
    projectNames: string[];
}

const REQUIRED_COLUMNS = [
    "Project",
    "Description",
    "Billable",
    "Start date",
    "Start time",
    "End date",
    "End time",
];

export class TogglCsvError extends Error {}

/** `2026-08-20` + `16:00:00` in the browser's own zone, which is how it was exported. */
function toLocalDate(date: string, time: string): Date | null {
    const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
    const timeMatch = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(time.trim());

    if (!dateMatch || !timeMatch) {
        return null;
    }

    const value = new Date(
        Number(dateMatch[1]),
        Number(dateMatch[2]) - 1,
        Number(dateMatch[3]),
        Number(timeMatch[1]),
        Number(timeMatch[2]),
        Number(timeMatch[3] ?? "0"),
        0,
    );

    return Number.isNaN(value.getTime()) ? null : value;
}

export function parseTogglCsv(text: string): TogglParseResult {
    const records = parseCsvRecords(text);

    if (records.length === 0) {
        throw new TogglCsvError("That file has no rows.");
    }

    const missing = REQUIRED_COLUMNS.filter(
        (column) => !(column in records[0]),
    );

    if (missing.length > 0) {
        throw new TogglCsvError(
            `This does not look like a Toggl export - missing ${missing.join(", ")}.`,
        );
    }

    const rows: TogglRow[] = [];
    const skipped: TogglParseResult["skipped"] = [];
    const projectNames: string[] = [];

    records.forEach((record, index) => {
        // +2: one for the header, one to make it 1-based.
        const line = index + 2;

        const description = record.Description.trim();

        if (!description) {
            skipped.push({ line, reason: "No description" });

            return;
        }

        const startedAt = toLocalDate(record["Start date"], record["Start time"]);
        const endedAt = toLocalDate(record["End date"], record["End time"]);

        if (!startedAt || !endedAt) {
            skipped.push({ line, reason: "Unreadable start or end time" });

            return;
        }

        if (endedAt.getTime() < startedAt.getTime()) {
            skipped.push({ line, reason: "Ends before it starts" });

            return;
        }

        const projectName = record.Project.trim();

        if (projectName && !projectNames.includes(projectName)) {
            projectNames.push(projectName);
        }

        rows.push({
            line,
            projectName,
            description,
            billable: record.Billable.trim().toLowerCase() === "yes",
            startedAt,
            endedAt,
        });
    });

    return { rows, skipped, projectNames };
}

/**
 * Toggl project names read "Client - Stream", so the leading segment is the
 * client. Used to attach newly created projects to the right client.
 */
export function clientNameFromProject(projectName: string): string {
    const [leading] = projectName.split(/\s+-\s+/);

    return (leading ?? projectName).trim();
}
