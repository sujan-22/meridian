/**
 * Building the requests Polaris (Replicon) accepts for a week of time.
 *
 * Replicon's own web client posts one request per filled cell to
 * `PutTimeEntryRevisionGroup`, so that is what this produces - the same shape,
 * from the grid Meridian already computes. Nothing here talks to Replicon:
 * this module only says what would be sent, and something running inside an
 * already-signed-in browser does the sending. Meridian never holds a
 * corporate credential.
 */

import type { PolarisGrid, PolarisRow } from "./polaris";

export interface RepliconConfig {
    /** Replicon tenant slug, from the URNs on the timesheet page. */
    tenant: string;
    /** Numeric user id, likewise. */
    userId: string;
    /**
     * The extension field that holds the ticket number.
     *
     * Replicon does not model the ticket as time-entry metadata; it is a
     * tenant-defined extension field, so its id belongs in configuration
     * rather than baked in here.
     */
    ticketFieldId: string;
    /**
     * Rate sent with billable time. Replicon's client omits this key entirely
     * on non-billable entries, which is why it is applied conditionally.
     */
    billingRateUri?: string;
}

const DEFAULT_BILLING_RATE = "urn:replicon:project-specific-billing-rate";

/** Where a row sits on the Polaris grid, which the payload has to name. */
export interface RepliconRowPlacement {
    /** Replicon's numeric task id. */
    taskId: string;
    /** The row's position on the timesheet grid. */
    rowNumber: number;
}

export interface RepliconRequest {
    /** For a person reading the plan before running it. */
    summary: string;
    body: unknown;
}

export interface RepliconPlan {
    requests: RepliconRequest[];
    /** Rows that could not be placed, and why. */
    skipped: Array<{ row: string; reason: string }>;
    totalHours: number;
}

function taskUri(tenant: string, taskId: string): string {
    return `urn:replicon-tenant:${tenant}:task:${taskId}`;
}

/**
 * Replicon takes a duration as hours, minutes and seconds. Everything here is
 * quarter-aligned, so minutes is always 0, 15, 30 or 45.
 */
function interval(hours: number) {
    const totalMinutes = Math.round(hours * 60);

    return {
        hours: {
            hours: Math.floor(totalMinutes / 60),
            minutes: totalMinutes % 60,
            seconds: 0,
        },
        timePair: null,
    };
}

/** `2026-08-31` as Replicon's date object. */
function entryDate(day: string) {
    const [year, month, date] = day.split("-").map(Number);

    return { year, month, day: date };
}

/**
 * A correlation id per request.
 *
 * Replicon's client sends a short random token and a unit-of-work id with
 * each call; they are echoed back rather than checked, but sending something
 * unique keeps a batch from looking like one request retried.
 */
function correlationId(): string {
    return Math.random().toString(36).slice(2, 10);
}

function unitOfWorkId(index: number): string {
    return `Meridian.Transfer_${Date.now()}_${index}`;
}

/**
 * Turns a week's grid into the requests that would fill it in.
 *
 * `placements` says where each row lives on the Polaris grid; a row with no
 * placement is skipped and reported rather than guessed at, because posting a
 * cell against the wrong row number files hours under someone else's task.
 */
export function buildRepliconPlan(
    grid: PolarisGrid,
    config: RepliconConfig,
    placements: ReadonlyMap<string, RepliconRowPlacement>,
    newRevisionGroupId: () => string = () => crypto.randomUUID(),
): RepliconPlan {
    const requests: RepliconRequest[] = [];
    const skipped: RepliconPlan["skipped"] = [];

    let index = 0;
    let totalHours = 0;

    for (const row of grid.rows) {
        const placement = placements.get(row.key);

        if (!placement) {
            skipped.push({
                row: describe(row),
                reason: "no matching row on the Polaris grid",
            });

            continue;
        }

        for (const cell of row.cells) {
            if (cell.hours <= 0) {
                continue;
            }

            totalHours += cell.hours;

            requests.push({
                summary: `${cell.day}  ${cell.hours.toFixed(2)}h  ${describe(row)}`,
                body: {
                    timeEntryRevisionGroup: {
                        target: {
                            parameterCorrelationId: correlationId(),
                            uri: `urn:replicon-tenant:${config.tenant}:time-entry-revision-group:${newRevisionGroupId()}`,
                        },
                        user: {
                            uri: `urn:replicon-tenant:${config.tenant}:user:${config.userId}`,
                        },
                        interval: interval(cell.hours),
                        timeAllocationTypeUris: [
                            "urn:replicon:time-allocation-type:attendance",
                            "urn:replicon:time-allocation-type:project",
                        ],
                        entryDate: entryDate(cell.day),
                        customMetadata: [
                            // Only billable time carries a rate, matching what
                            // Replicon's own client sends.
                            ...(row.billing === "Billable"
                                ? [
                                      {
                                          keyUri: "urn:replicon:time-entry-metadata-key:billing-rate",
                                          value: {
                                              uri:
                                                  config.billingRateUri ??
                                                  DEFAULT_BILLING_RATE,
                                          },
                                      },
                                  ]
                                : []),
                            {
                                keyUri: "urn:replicon:time-entry-metadata-key:is-billable",
                                value: { bool: row.billing === "Billable" },
                            },
                            {
                                keyUri: "urn:replicon:time-entry-metadata-key:task",
                                value: {
                                    uri: taskUri(
                                        config.tenant,
                                        placement.taskId,
                                    ),
                                },
                            },
                            {
                                keyUri: "urn:replicon:time-entry-metadata-key:comments",
                                value: { text: row.comment },
                            },
                            {
                                keyUri: "urn:replicon:widget-ui-metadata-key:row-number",
                                value: { number: placement.rowNumber },
                            },
                        ],
                        // The ticket is an extension field, not metadata.
                        extensionFieldValues: row.ticketNumber
                            ? [
                                  {
                                      definition: {
                                          uri: `urn:replicon-tenant:${config.tenant}:object-extension-tag-definition:${config.ticketFieldId}`,
                                      },
                                      numericValue: null,
                                      textValue: row.ticketNumber,
                                      tag: null,
                                      jsonValue: null,
                                  },
                              ]
                            : [],
                    },
                    unitOfWorkId: unitOfWorkId(index),
                },
            });

            index += 1;
        }
    }

    return {
        requests,
        skipped,
        totalHours: Math.round(totalHours * 100) / 100,
    };
}

function describe(row: PolarisRow): string {
    return [
        row.task,
        row.billing,
        row.ticketNumber ? `#${row.ticketNumber}` : null,
    ]
        .filter(Boolean)
        .join(" · ");
}
