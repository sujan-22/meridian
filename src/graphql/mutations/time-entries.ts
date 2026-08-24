import { and, eq, isNull } from "drizzle-orm";
import { GraphQLError } from "graphql";

import { db } from "@/db";
import { projects, timeEntries } from "@/db/schema";
import { findEntryById, findRunningEntry } from "@/db/queries/time-entries";
import { toQuarterMinutes } from "@/lib/duration";

import type { AppBuilder } from "../builder";
import type { Refs } from "../refs";
import type { TimeEntryModel } from "../types/time-entry";

type BillingType = (typeof timeEntries.$inferSelect)["billingType"];

/** A percentage outside 0-100 is a client bug, not something to persist. */
function clampPercent(value: number | null | undefined): number {
    if (value == null) {
        return 0;
    }

    return Math.min(100, Math.max(0, Math.round(value)));
}

function durationBetween(startedAt: Date, endedAt: Date): number {
    const seconds = Math.round((endedAt.getTime() - startedAt.getTime()) / 1000);

    if (seconds < 0) {
        throw new GraphQLError("An entry cannot end before it starts");
    }

    return seconds;
}

/**
 * Raw seconds plus the quarter-hour figure that gets reported and copied into
 * Polaris. The exact timestamps are always preserved; this is derived.
 */
function durationFields(startedAt: Date, endedAt: Date) {
    const durationSeconds = durationBetween(startedAt, endedAt);

    return {
        durationSeconds,
        timesheetDurationMinutes: toQuarterMinutes(durationSeconds),
    };
}

async function requireProjectBilling(projectId: string): Promise<BillingType> {
    const rows = await db
        .select({ defaultBillingType: projects.defaultBillingType })
        .from(projects)
        .where(eq(projects.id, projectId))
        .limit(1);

    if (!rows[0]) {
        throw new GraphQLError(`No project with id ${projectId}`);
    }

    return rows[0].defaultBillingType;
}

async function loadOrThrow(id: string): Promise<TimeEntryModel> {
    const entry = await findEntryById(id);

    if (!entry) {
        throw new GraphQLError(`No time entry with id ${id}`);
    }

    return entry;
}

/**
 * Close whatever timer is currently running. Only one entry may be open at a
 * time, so starting new work implicitly stops the previous timer.
 */
async function stopRunningTimers(at: Date): Promise<void> {
    const running = await findRunningEntry();

    if (!running) {
        return;
    }

    // A clock skew or a manually edited start time should never produce a
    // negative duration - clamp the end to the start instead.
    const endedAt =
        at.getTime() < running.startedAt.getTime() ? running.startedAt : at;

    await db
        .update(timeEntries)
        .set({
            endedAt,
            ...durationFields(running.startedAt, endedAt),
        })
        .where(and(eq(timeEntries.id, running.id), isNull(timeEntries.endedAt)));
}

export function registerTimeEntryMutations(builder: AppBuilder, refs: Refs) {
    const StartTimerInput = builder.inputType("StartTimerInput", {
        fields: (t) => ({
            projectId: t.id({ required: true }),
            description: t.string({ required: true }),
            ticketNumber: t.string(),
            billingType: t.field({ type: refs.BillingType }),
            kind: t.field({ type: refs.EntryKind }),
            unbillablePercent: t.int(),
            startedAt: t.field({ type: "DateTime" }),
        }),
    });

    const CreateTimeEntryInput = builder.inputType("CreateTimeEntryInput", {
        fields: (t) => ({
            projectId: t.id({ required: true }),
            description: t.string({ required: true }),
            ticketNumber: t.string(),
            billingType: t.field({ type: refs.BillingType }),
            kind: t.field({ type: refs.EntryKind }),
            unbillablePercent: t.int(),
            startedAt: t.field({ type: "DateTime", required: true }),
            endedAt: t.field({ type: "DateTime", required: true }),
        }),
    });

    const UpdateTimeEntryInput = builder.inputType("UpdateTimeEntryInput", {
        fields: (t) => ({
            projectId: t.id(),
            description: t.string(),
            ticketNumber: t.string(),
            billingType: t.field({ type: refs.BillingType }),
            kind: t.field({ type: refs.EntryKind }),
            unbillablePercent: t.int(),
            startedAt: t.field({ type: "DateTime" }),
            endedAt: t.field({ type: "DateTime" }),
        }),
    });

    builder.mutationFields((t) => ({
        startTimer: t.field({
            type: refs.TimeEntry,

            args: {
                input: t.arg({ type: StartTimerInput, required: true }),
            },

            resolve: async (_parent, { input }) => {
                const projectId = String(input.projectId);
                const startedAt = input.startedAt ?? new Date();

                await stopRunningTimers(startedAt);

                const billingType =
                    input.billingType ??
                    (await requireProjectBilling(projectId));

                const [created] = await db
                    .insert(timeEntries)
                    .values({
                        projectId,
                        description: input.description.trim(),
                        ticketNumber: input.ticketNumber?.trim() || null,
                        billingType,
                        kind: input.kind ?? "work",
                        unbillablePercent: clampPercent(input.unbillablePercent),
                        startedAt,
                        endedAt: null,
                        durationSeconds: null,
                        timesheetDurationMinutes: null,
                    })
                    .returning({ id: timeEntries.id });

                return loadOrThrow(created.id);
            },
        }),

        stopTimer: t.field({
            type: refs.TimeEntry,

            args: {
                id: t.arg.id({ required: true }),
                endedAt: t.arg({ type: "DateTime" }),
            },

            resolve: async (_parent, args) => {
                const id = String(args.id);
                const entry = await loadOrThrow(id);

                if (entry.endedAt) {
                    return entry;
                }

                const endedAt = args.endedAt ?? new Date();

                await db
                    .update(timeEntries)
                    .set({
                        endedAt,
                        ...durationFields(entry.startedAt, endedAt),
                    })
                    .where(eq(timeEntries.id, id));

                return loadOrThrow(id);
            },
        }),

        createTimeEntry: t.field({
            type: refs.TimeEntry,

            args: {
                input: t.arg({ type: CreateTimeEntryInput, required: true }),
            },

            resolve: async (_parent, { input }) => {
                const projectId = String(input.projectId);

                const billingType =
                    input.billingType ??
                    (await requireProjectBilling(projectId));

                const [created] = await db
                    .insert(timeEntries)
                    .values({
                        projectId,
                        description: input.description.trim(),
                        ticketNumber: input.ticketNumber?.trim() || null,
                        billingType,
                        kind: input.kind ?? "work",
                        unbillablePercent: clampPercent(input.unbillablePercent),
                        startedAt: input.startedAt,
                        endedAt: input.endedAt,
                        ...durationFields(input.startedAt, input.endedAt),
                    })
                    .returning({ id: timeEntries.id });

                return loadOrThrow(created.id);
            },
        }),

        updateTimeEntry: t.field({
            type: refs.TimeEntry,

            args: {
                id: t.arg.id({ required: true }),
                input: t.arg({ type: UpdateTimeEntryInput, required: true }),
            },

            resolve: async (_parent, args) => {
                const id = String(args.id);
                const entry = await loadOrThrow(id);
                const { input } = args;

                const startedAt = input.startedAt ?? entry.startedAt;

                // `undefined` leaves the end time alone; an explicit `null`
                // reopens the entry as a running timer.
                const endedAt =
                    input.endedAt === undefined ? entry.endedAt : input.endedAt;

                await db
                    .update(timeEntries)
                    .set({
                        ...(input.projectId != null && {
                            projectId: String(input.projectId),
                        }),

                        ...(input.description != null && {
                            description: input.description.trim(),
                        }),

                        ...(input.ticketNumber !== undefined && {
                            ticketNumber: input.ticketNumber?.trim() || null,
                        }),

                        ...(input.billingType != null && {
                            billingType: input.billingType,
                        }),

                        ...(input.kind != null && { kind: input.kind }),

                        ...(input.unbillablePercent != null && {
                            unbillablePercent: clampPercent(
                                input.unbillablePercent,
                            ),
                        }),

                        startedAt,
                        endedAt,

                        ...(endedAt
                            ? durationFields(startedAt, endedAt)
                            : {
                                  durationSeconds: null,
                                  timesheetDurationMinutes: null,
                              }),
                    })
                    .where(eq(timeEntries.id, id));

                return loadOrThrow(id);
            },
        }),

        deleteTimeEntry: t.boolean({
            args: {
                id: t.arg.id({ required: true }),
            },

            resolve: async (_parent, args) => {
                const deleted = await db
                    .delete(timeEntries)
                    .where(eq(timeEntries.id, String(args.id)))
                    .returning({ id: timeEntries.id });

                return deleted.length > 0;
            },
        }),
    }));
}
