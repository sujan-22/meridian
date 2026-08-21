"use client";

import { useState } from "react";
import { useMutation } from "@apollo/client/react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import {
    PreferencesDocument,
    UpdatePreferencesDocument,
    type PreferencesFieldsFragment,
} from "@/gql/graphql";
import { formatMinutesAsHours } from "@/lib/duration";
import { cn } from "@/lib/utils";

const WEEK_START_OPTIONS = [
    { label: "Monday", value: "1" },
    { label: "Saturday", value: "6" },
    { label: "Sunday", value: "0" },
] as const;

const HOUR_OPTIONS = Array.from({ length: 25 }, (_, hour) => ({
    label: `${String(hour).padStart(2, "0")}:00`,
    value: String(hour),
}));

interface PreferencesFormProps {
    preferences: PreferencesFieldsFragment;
    onSaved?: () => void;
    onCancel?: () => void;
}

export function PreferencesForm({
    preferences,
    onSaved,
    onCancel,
}: PreferencesFormProps) {
    const [weekStartsOn, setWeekStartsOn] = useState(
        String(preferences.weekStartsOn),
    );
    const [showWeekend, setShowWeekend] = useState(preferences.showWeekend);
    const [dayStartHour, setDayStartHour] = useState(
        String(preferences.dayStartHour),
    );
    const [dayEndHour, setDayEndHour] = useState(String(preferences.dayEndHour));
    const [dailyHours, setDailyHours] = useState(
        formatMinutesAsHours(preferences.dailyTargetMinutes),
    );
    const [weeklyHours, setWeeklyHours] = useState(
        formatMinutesAsHours(preferences.weeklyTargetMinutes),
    );

    const [error, setError] = useState<string | null>(null);

    const [updatePreferences, { loading }] = useMutation(
        UpdatePreferencesDocument,
        {
            refetchQueries: [PreferencesDocument],
            awaitRefetchQueries: true,
        },
    );

    async function handleSubmit(event: React.FormEvent) {
        event.preventDefault();
        setError(null);

        const daily = Number(dailyHours);
        const weekly = Number(weeklyHours);

        if (!Number.isFinite(daily) || daily <= 0) {
            setError("Daily target must be a number of hours");

            return;
        }

        if (!Number.isFinite(weekly) || weekly <= 0) {
            setError("Weekly target must be a number of hours");

            return;
        }

        if (Number(dayEndHour) <= Number(dayStartHour)) {
            setError("The day has to end after it starts");

            return;
        }

        try {
            await updatePreferences({
                variables: {
                    input: {
                        weekStartsOn: Number(weekStartsOn),
                        showWeekend,
                        dayStartHour: Number(dayStartHour),
                        dayEndHour: Number(dayEndHour),
                        dailyTargetMinutes: Math.round(daily * 60),
                        weeklyTargetMinutes: Math.round(weekly * 60),
                    },
                },
            });

            toast.add({ title: "Settings saved", type: "success" });

            onSaved?.();
        } catch (caught) {
            setError(
                caught instanceof Error
                    ? caught.message
                    : "Could not save settings",
            );
        }
    }

    return (
        <form onSubmit={handleSubmit} className="contents">
            <div className="flex flex-col gap-5">
                <section className="flex flex-col gap-3">
                    <SectionTitle>Week</SectionTitle>

                    <Field
                        label="Week starts on"
                        hint="Polaris weeks run Saturday to Friday."
                    >
                        <OptionSelect
                            label="Week starts on"
                            options={WEEK_START_OPTIONS}
                            value={weekStartsOn}
                            onChange={setWeekStartsOn}
                        />
                    </Field>

                    <ToggleRow
                        label="Show weekend"
                        hint="Hidden by default - Saturday and Sunday carry no target."
                        checked={showWeekend}
                        onChange={setShowWeekend}
                    />
                </section>

                <section className="flex flex-col gap-3">
                    <SectionTitle>Working day</SectionTitle>

                    <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="Day starts">
                            <OptionSelect
                                label="Day starts"
                                options={HOUR_OPTIONS}
                                value={dayStartHour}
                                onChange={setDayStartHour}
                            />
                        </Field>

                        <Field label="Day ends">
                            <OptionSelect
                                label="Day ends"
                                options={HOUR_OPTIONS}
                                value={dayEndHour}
                                onChange={setDayEndHour}
                            />
                        </Field>
                    </div>

                    <p className="text-xs text-muted-foreground">
                        The week calendar draws this window, and still widens to
                        show anything tracked outside it.
                    </p>
                </section>

                <section className="flex flex-col gap-3">
                    <SectionTitle>Targets</SectionTitle>

                    <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="Hours per day">
                            <Input
                                value={dailyHours}
                                onChange={(event) =>
                                    setDailyHours(event.target.value)
                                }
                                inputMode="decimal"
                                aria-label="Hours per day"
                                className="h-10 font-mono tabular-nums"
                            />
                        </Field>

                        <Field label="Hours per week">
                            <Input
                                value={weeklyHours}
                                onChange={(event) =>
                                    setWeeklyHours(event.target.value)
                                }
                                inputMode="decimal"
                                aria-label="Hours per week"
                                className="h-10 font-mono tabular-nums"
                            />
                        </Field>
                    </div>
                </section>

                {error && <p className="text-sm text-destructive">{error}</p>}
            </div>

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                {onCancel && (
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onCancel}
                        disabled={loading}
                    >
                        Cancel
                    </Button>
                )}

                <Button type="submit" disabled={loading}>
                    Save settings
                </Button>
            </div>
        </form>
    );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
    return (
        <h3 className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {children}
        </h3>
    );
}

interface FieldProps {
    label: string;
    hint?: string;
    children: React.ReactNode;
}

function Field({ label, hint, children }: FieldProps) {
    return (
        <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium">{label}</span>

            {children}

            {hint && (
                <span className="text-[11px] text-muted-foreground">
                    {hint}
                </span>
            )}
        </label>
    );
}

interface OptionSelectProps {
    label: string;
    options: ReadonlyArray<{ label: string; value: string }>;
    value: string;
    onChange: (value: string) => void;
}

function OptionSelect({ label, options, value, onChange }: OptionSelectProps) {
    return (
        <Select
            items={[...options]}
            value={value}
            onValueChange={(next) => onChange(next as string)}
        >
            <SelectTrigger aria-label={label} className="h-10">
                <SelectValue />
            </SelectTrigger>

            <SelectContent alignItemWithTrigger={false} className="max-h-72">
                {options.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                        {option.label}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}

interface ToggleRowProps {
    label: string;
    hint: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
}

function ToggleRow({ label, hint, checked, onChange }: ToggleRowProps) {
    return (
        <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
                <p className="text-xs font-medium">{label}</p>
                <p className="text-[11px] text-muted-foreground">{hint}</p>
            </div>

            <button
                type="button"
                role="switch"
                aria-checked={checked}
                aria-label={label}
                onClick={() => onChange(!checked)}
                className={cn(
                    "relative h-6 w-10 shrink-0 rounded-full transition-colors",
                    checked ? "bg-primary" : "bg-muted",
                )}
            >
                <span
                    className={cn(
                        "absolute top-0.5 size-5 rounded-full bg-background transition-[left]",
                        checked ? "left-[1.125rem]" : "left-0.5",
                    )}
                />
            </button>
        </div>
    );
}
