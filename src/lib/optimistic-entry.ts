/**
 * Working out what an entry will look like before the server says so.
 *
 * A dragged block used to wait for two round trips before it moved: the
 * mutation, and then a refetch of the whole week that the mutation was told to
 * wait for. On a serverless deployment that is most of a second at best, and
 * the block sat back in its old place for all of it.
 *
 * Every field the server would derive is derived here too, so the cached entry
 * is a faithful guess rather than a half-filled one - otherwise the week's
 * totals flicker to the wrong number and back.
 */

import type {
    TimeEntryFieldsFragment,
    UpdateTimeEntryInput,
} from "@/gql/graphql";

import { splitBillableMinutes, toQuarterMinutes } from "./duration";

type Project = TimeEntryFieldsFragment["project"];

/**
 * As much of a project as a caller happens to hold.
 *
 * The project picker selects fewer fields than an entry carries, and marks
 * some of them optional. Spelling the patch out keeps the merge honest rather
 * than casting the difference away.
 */
export interface ProjectPatch {
    id?: string;
    name?: string;
    color?: string | null;
    defaultBillingType?: Project["defaultBillingType"];
    polarisTask?: string | null;
    polarisMeetingTask?: string | null;
    client?: { id?: string; name?: string; shortName?: string | null };
}

/** Anything the patch leaves out stays as it was - it did not change. */
function mergeProject(current: Project, patch?: ProjectPatch | null): Project {
    if (!patch) {
        return current;
    }

    const { client, ...rest } = patch;

    return {
        ...current,
        ...rest,
        client: client
            ? {
                  ...current.client,
                  ...client,
                  shortName: client.shortName ?? current.client.shortName,
              }
            : current.client,
    };
}

/**
 * The entry as it will be once `input` is applied.
 *
 * `project` is only needed when the project itself changed, and may carry
 * only the fields the caller happens to hold - the picker selects a narrower
 * shape than an entry does. Whatever is missing stays as it was, which is
 * right: those fields did not change.
 */
export function optimisticEntry(
    entry: TimeEntryFieldsFragment,
    input: UpdateTimeEntryInput,
    project?: ProjectPatch | null,
): TimeEntryFieldsFragment {
    const startedAt = input.startedAt ?? entry.startedAt;
    const endedAt = input.endedAt === undefined ? entry.endedAt : input.endedAt;

    const durationSeconds = endedAt
        ? Math.max(
              0,
              Math.round(
                  (new Date(endedAt).getTime() -
                      new Date(startedAt).getTime()) /
                      1000,
              ),
          )
        : null;

    const billedMinutes = durationSeconds
        ? toQuarterMinutes(durationSeconds)
        : 0;

    const billingType = input.billingType ?? entry.billingType;

    const unbillablePercent =
        input.unbillablePercent ?? entry.unbillablePercent ?? 0;

    const split = splitBillableMinutes(
        billedMinutes,
        unbillablePercent,
        billingType === "BILLABLE",
    );

    return {
        ...entry,
        description: input.description ?? entry.description,
        ticketNumber:
            input.ticketNumber === undefined
                ? entry.ticketNumber
                : input.ticketNumber,
        kind: input.kind ?? entry.kind,
        billingType,
        unbillablePercent,
        startedAt,
        endedAt,
        durationSeconds,
        elapsedSeconds: durationSeconds ?? entry.elapsedSeconds,
        isRunning: !endedAt,
        timesheetDurationMinutes: durationSeconds ? billedMinutes : null,
        billedMinutes,
        billableMinutes: split.billableMinutes,
        unbillableMinutes: split.unbillableMinutes,
        project: mergeProject(entry.project, project),
    };
}
