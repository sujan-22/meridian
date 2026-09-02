"use client";

import { useMutation, useQuery } from "@apollo/client/react";
import { Calendar, CircleCheck, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import {
    CalendarStatusDocument,
    ProjectsDocument,
    UpdateCalendarSettingsDocument,
} from "@/gql/graphql";
import { signOut } from "@/lib/auth/client";

const NO_PROJECT = "__none__";

/**
 * Google Calendar, as far as the user needs to see it: whether meetings can
 * be read at all, where a promoted one lands, and whether finished meetings
 * become entries on their own.
 */
export function CalendarPanel() {
    const { data, loading } = useQuery(CalendarStatusDocument);
    const projectsQuery = useQuery(ProjectsDocument);
    const router = useRouter();
    const [reconnecting, setReconnecting] = useState(false);

    const [save] = useMutation(UpdateCalendarSettingsDocument, {
        refetchQueries: [CalendarStatusDocument],
    });

    const status = data?.calendarStatus;
    const projects = projectsQuery.data?.projects ?? [];

    async function reconnect() {
        setReconnecting(true);

        // Calendar access is granted during sign-in, so a grant that predates
        // it can only be widened by going through Google again.
        await signOut();

        router.push("/sign-in");
        router.refresh();
    }

    return (
        <div className="rounded-xl border border-border/70 bg-card p-5">
            <div className="mb-4 flex items-start gap-3">
                <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Calendar className="size-4" />
                </div>

                <div className="min-w-0">
                    <h3 className="text-sm font-medium">Google Calendar</h3>

                    <p className="mt-0.5 text-xs text-muted-foreground">
                        Meetings appear in a second lane on the week, as dotted
                        outlines. Click one to add it to the day.
                    </p>
                </div>
            </div>

            {loading ? (
                <p className="text-sm text-muted-foreground">Checking…</p>
            ) : status?.hasCalendarScope ? (
                <div className="flex flex-col gap-4">
                    <p className="flex items-center gap-1.5 text-xs text-emerald-400">
                        <CircleCheck className="size-3.5" />
                        Connected
                        {status.lastSyncedAt
                            ? ` · last read ${new Date(status.lastSyncedAt).toLocaleString()}`
                            : " · not read yet"}
                    </p>

                    <label className="flex flex-col gap-1.5">
                        <span className="text-xs font-medium">
                            Project for promoted meetings
                        </span>

                        <span className="text-[0.6875rem] text-muted-foreground">
                            Used when the meeting title does not name one.
                            Without it, a meeting that cannot be matched stays
                            in the lane.
                        </span>

                        <Select
                            value={status.defaultProjectId ?? NO_PROJECT}
                            onValueChange={(next: string | null) => {
                                void save({
                                    variables:
                                        !next || next === NO_PROJECT
                                            ? { clearDefaultProject: true }
                                            : { defaultProjectId: next },
                                }).then(() =>
                                    toast.add({
                                        title: "Saved",
                                        type: "success",
                                    }),
                                );
                            }}
                        >
                            <SelectTrigger className="mt-1 h-10">
                                <SelectValue placeholder="No default" />
                            </SelectTrigger>

                            <SelectContent>
                                <SelectItem value={NO_PROJECT}>
                                    No default
                                </SelectItem>

                                {projects.map((project) => (
                                    <SelectItem
                                        key={project.id}
                                        value={project.id}
                                    >
                                        {project.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </label>

                    <label className="flex items-start gap-2.5">
                        <input
                            type="checkbox"
                            checked={status.autoPromote}
                            onChange={(event) => {
                                void save({
                                    variables: {
                                        autoPromote: event.target.checked,
                                    },
                                });
                            }}
                            className="mt-0.5 size-4 accent-primary"
                        />

                        <span>
                            <span className="block text-xs font-medium">
                                Add meetings once they have finished
                            </span>

                            <span className="block text-[0.6875rem] text-muted-foreground">
                                A 09:15 scrum becomes an entry by itself after
                                09:30. Only applies to meetings that end after
                                the calendar was connected, so linking it never
                                fills in past weeks.
                            </span>
                        </span>
                    </label>
                </div>
            ) : (
                <div className="flex flex-col items-start gap-3">
                    <p className="flex items-start gap-1.5 text-xs text-amber-400">
                        <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />

                        <span>
                            This account was signed in before calendar access
                            was asked for. Signing in again grants it — nothing
                            you have tracked is affected.
                        </span>
                    </p>

                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={reconnecting}
                        onClick={reconnect}
                    >
                        {reconnecting
                            ? "Signing out…"
                            : "Sign in again to connect"}
                    </Button>
                </div>
            )}
        </div>
    );
}
