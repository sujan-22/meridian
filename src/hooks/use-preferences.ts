"use client";

import { useQuery } from "@apollo/client/react";

import {
    PreferencesDocument,
    type PreferencesFieldsFragment,
} from "@/gql/graphql";

/**
 * Used until the stored row arrives, so nothing renders against a half-built
 * layout on first paint. Mirrors the column defaults.
 */
export const DEFAULT_PREFERENCES: PreferencesFieldsFragment = {
    weekStartsOn: 1,
    showWeekend: false,
    dayStartHour: 9,
    dayEndHour: 17,
    calendarZoom: 1,
    dailyTargetMinutes: 450,
    weeklyTargetMinutes: 2250,
};

export function usePreferences() {
    const { data, loading } = useQuery(PreferencesDocument);

    return {
        preferences: data?.preferences ?? DEFAULT_PREFERENCES,
        loading,
    };
}
