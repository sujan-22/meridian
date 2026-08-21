import type { PreferencesRow } from "@/db/queries/preferences";

import type { AppBuilder } from "../builder";

export type PreferencesModel = PreferencesRow;

export function preferencesRef(builder: AppBuilder) {
    return builder.objectRef<PreferencesModel>("Preferences").implement({
        fields: (t) => ({
            /** 0 = Sunday … 6 = Saturday. */
            weekStartsOn: t.exposeInt("weekStartsOn"),

            showWeekend: t.exposeBoolean("showWeekend"),

            dayStartHour: t.exposeInt("dayStartHour"),
            dayEndHour: t.exposeInt("dayEndHour"),

            calendarZoom: t.exposeInt("calendarZoom"),

            dailyTargetMinutes: t.exposeInt("dailyTargetMinutes"),
            weeklyTargetMinutes: t.exposeInt("weeklyTargetMinutes"),
        }),
    });
}

export type PreferencesRef = ReturnType<typeof preferencesRef>;
