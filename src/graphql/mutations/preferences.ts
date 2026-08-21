import { GraphQLError } from "graphql";

import { savePreferences } from "@/db/queries/preferences";

import type { AppBuilder } from "../builder";
import type { Refs } from "../refs";

function clampHour(value: number, label: string): number {
    if (!Number.isInteger(value) || value < 0 || value > 24) {
        throw new GraphQLError(`${label} must be a whole hour between 0 and 24`);
    }

    return value;
}

export function registerPreferencesMutations(
    builder: AppBuilder,
    refs: Refs,
) {
    const UpdatePreferencesInput = builder.inputType(
        "UpdatePreferencesInput",
        {
            fields: (t) => ({
                weekStartsOn: t.int(),
                showWeekend: t.boolean(),
                dayStartHour: t.int(),
                dayEndHour: t.int(),
                calendarZoom: t.int(),
                dailyTargetMinutes: t.int(),
                weeklyTargetMinutes: t.int(),
            }),
        },
    );

    builder.mutationFields((t) => ({
        updatePreferences: t.field({
            type: refs.Preferences,

            args: {
                input: t.arg({
                    type: UpdatePreferencesInput,
                    required: true,
                }),
            },

            resolve: async (_parent, { input }) => {
                if (
                    input.weekStartsOn != null &&
                    (input.weekStartsOn < 0 || input.weekStartsOn > 6)
                ) {
                    throw new GraphQLError(
                        "weekStartsOn must be between 0 (Sunday) and 6 (Saturday)",
                    );
                }

                const dayStartHour =
                    input.dayStartHour == null
                        ? undefined
                        : clampHour(input.dayStartHour, "Day start");

                const dayEndHour =
                    input.dayEndHour == null
                        ? undefined
                        : clampHour(input.dayEndHour, "Day end");

                if (
                    dayStartHour !== undefined &&
                    dayEndHour !== undefined &&
                    dayEndHour <= dayStartHour
                ) {
                    throw new GraphQLError(
                        "The day has to end after it starts",
                    );
                }

                return savePreferences({
                    ...(input.weekStartsOn != null && {
                        weekStartsOn: input.weekStartsOn,
                    }),
                    ...(input.showWeekend != null && {
                        showWeekend: input.showWeekend,
                    }),
                    ...(dayStartHour !== undefined && { dayStartHour }),
                    ...(dayEndHour !== undefined && { dayEndHour }),
                    ...(input.calendarZoom != null && {
                        calendarZoom: input.calendarZoom,
                    }),
                    ...(input.dailyTargetMinutes != null && {
                        dailyTargetMinutes: input.dailyTargetMinutes,
                    }),
                    ...(input.weeklyTargetMinutes != null && {
                        weeklyTargetMinutes: input.weeklyTargetMinutes,
                    }),
                });
            },
        }),
    }));
}
