/**
 * Reading Replicon's task catalogue.
 *
 * `BulkGetProjectOrTaskDetails` answers with, for each task id, the project it
 * belongs to, the client that project is for, and the task's own code and
 * label - which together are everything needed to map a Meridian project onto
 * a Polaris row without anyone typing an id by hand.
 *
 * Parsed defensively: this is somebody else's undocumented response, so every
 * field is treated as possibly absent rather than assumed.
 */

export interface RepliconTask {
    /** Numeric id from the URN, which is what a time entry references. */
    id: string;
    /** "0220", when the task has a code. */
    code: string | null;
    /** "0220 - Scrum Meetings". */
    label: string;
    projectName: string | null;
    clientName: string | null;
    programName: string | null;
}

function text(value: unknown): string | null {
    return typeof value === "string" && value.trim() ? value.trim() : null;
}

function record(value: unknown): Record<string, unknown> | null {
    return typeof value === "object" && value !== null && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null;
}

/** The numeric tail of `urn:replicon-tenant:<tenant>:task:11646`. */
function taskIdFromUri(uri: unknown): string | null {
    const value = text(uri);

    if (!value) {
        return null;
    }

    const match = /:task:([^:]+)$/.exec(value);

    return match ? match[1] : null;
}

/**
 * The client, which sits three levels down a schedule that can hold several
 * entries. The first one is the one the timesheet shows.
 */
function clientName(entry: Record<string, unknown>): string | null {
    const schedule = entry.clientSchedule;

    if (!Array.isArray(schedule)) {
        return null;
    }

    for (const period of schedule) {
        const clients = record(period)?.clients;

        if (!Array.isArray(clients)) {
            continue;
        }

        for (const holder of clients) {
            const client = record(record(holder)?.client);
            const name = text(client?.displayText) ?? text(client?.name);

            if (name) {
                return name;
            }
        }
    }

    return null;
}

export function parseRepliconTasks(payload: unknown): RepliconTask[] {
    // The service wraps its answer in `d`, in the old ASP.NET style.
    const items = record(payload)?.d ?? payload;

    if (!Array.isArray(items)) {
        return [];
    }

    const tasks: RepliconTask[] = [];

    for (const raw of items) {
        const entry = record(raw);

        if (!entry) {
            continue;
        }

        const id = taskIdFromUri(entry.uri);

        if (!id) {
            continue;
        }

        const task = record(record(entry.taskAncestry)?.task);
        const project = record(entry.project);
        const program = record(entry.program);

        const label =
            text(task?.displayText) ??
            text(task?.name) ??
            // A row can point at a project rather than a task beneath it.
            text(project?.displayText) ??
            id;

        tasks.push({
            id,
            code: text(task?.code),
            label,
            projectName: text(project?.displayText) ?? text(project?.name),
            clientName: clientName(entry),
            programName: text(program?.displayText) ?? text(program?.name),
        });
    }

    return tasks;
}

/** Comparable form: lower case, punctuation flattened. */
function norm(value: string): string {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
}

/** Company suffixes carry no information about which client this is. */
const SUFFIXES = /\b(inc|corp|corporation|ltd|limited|llc|co|company|the)\b/g;

function clientKey(value: string): string {
    return norm(value).replace(SUFFIXES, "").replace(/\s+/g, " ").trim();
}

/**
 * Whether a task belongs to the same client as a project.
 *
 * Containment rather than equality, because the two systems spell the same
 * client differently - "SNDL" against "SNDL Inc.", "Copperstate" against
 * "Copper State Bolt & Nut Co.".
 */
export function sameClient(task: RepliconTask, clientName: string): boolean {
    const a = clientKey(task.clientName ?? "");
    const b = clientKey(clientName);

    if (!a || !b) {
        return false;
    }

    return a === b || a.includes(b) || b.includes(a);
}

/** Whether a task looks like the one meetings are booked to. */
export function isMeetingTask(task: RepliconTask): boolean {
    return /\b(scrum|meeting|forum|stand-?up)\b/i.test(task.label);
}

export interface TaskMatch {
    work: RepliconTask | null;
    meeting: RepliconTask | null;
    /** Candidates that were plausible but not decisive. */
    ambiguousWork: RepliconTask[];
    ambiguousMeeting: RepliconTask[];
}

/**
 * Suggests the tasks a Meridian project books to.
 *
 * The client narrows the field; the count decides confidence. One work task
 * for a client is an answer, several is a question - and a question is
 * reported rather than resolved by picking the highest-scoring one. An
 * earlier version scored client and project together, and three unrelated
 * Evenica projects all came out mapped to "CC - Testing" because sharing a
 * client was enough to clear the bar.
 */
export function matchTasks(
    project: { name: string; clientName: string },
    tasks: readonly RepliconTask[],
): TaskMatch {
    const mine = tasks.filter((task) => sameClient(task, project.clientName));

    const work = mine.filter((task) => !isMeetingTask(task));
    const meeting = mine.filter((task) => isMeetingTask(task));

    /**
     * With several candidates, an exact project-name match still settles it -
     * that is a direct statement, not an inference from a shared client.
     */
    const decide = (candidates: RepliconTask[]): RepliconTask | null => {
        if (candidates.length === 1) {
            return candidates[0];
        }

        const wanted = norm(project.name);

        const exact = candidates.filter(
            (task) => norm(task.projectName ?? "") === wanted,
        );

        return exact.length === 1 ? exact[0] : null;
    };

    const chosenWork = decide(work);
    const chosenMeeting = decide(meeting);

    return {
        work: chosenWork,
        meeting: chosenMeeting,
        ambiguousWork: chosenWork ? [] : work,
        ambiguousMeeting: chosenMeeting ? [] : meeting,
    };
}
