"use client";

import { ImportPanel } from "@/components/settings/import-panel";
import { PreferencesForm } from "@/components/settings/preferences-form";
import { Skeleton } from "@/components/ui/skeleton";
import { usePreferences } from "@/hooks/use-preferences";

export function SettingsView() {
    const { preferences, loading } = usePreferences();

    return (
        <div className="mx-auto w-full max-w-[1600px] px-5 py-6 lg:px-8 2xl:px-10">
            <header className="mb-6">
                <h2 className="text-xl font-semibold tracking-tight">
                    Settings
                </h2>

                <p className="mt-1 text-sm text-muted-foreground">
                    Configure time tracking and timesheet preferences.
                </p>
            </header>

            {loading ? (
                <div className="flex flex-col gap-3">
                    <Skeleton className="h-10 w-full rounded-lg" />
                    <Skeleton className="h-10 w-full rounded-lg" />
                    <Skeleton className="h-10 w-full rounded-lg" />
                </div>
            ) : (
                <div className="grid gap-4 xl:grid-cols-2 xl:items-start">
                    <div className="rounded-xl border border-border/70 bg-card p-5">
                        <PreferencesForm
                            key={JSON.stringify(preferences)}
                            preferences={preferences}
                        />
                    </div>

                    <ImportPanel />
                </div>
            )}
        </div>
    );
}
