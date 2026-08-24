"use client";

import { FolderOpen } from "lucide-react";

import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import type { BillingType } from "@/gql/graphql";
import { projectColor } from "@/lib/project-color";
import { cn } from "@/lib/utils";

export interface SelectableProject {
    id: string;
    name: string;
    color?: string | null;
    defaultBillingType: BillingType;
    polarisTask?: string | null;
    client: {
        id: string;
        name: string;
        shortName?: string | null;
    };
}

interface ProjectSelectProps {
    projects: readonly SelectableProject[];
    /**
     * The project already on the entry. Archived projects are kept out of the
     * list, but an entry that still points at one has to keep showing it -
     * otherwise editing anything else about that entry would silently move it
     * to a different project.
     */
    keepSelectable?: SelectableProject | null;
    value: string | null;
    onChange: (projectId: string | null) => void;
    loading?: boolean;
    error?: boolean;
    className?: string;
    triggerClassName?: string;
}

/** Projects grouped under their client, each with its tracking colour. */
export function ProjectSelect({
    projects,
    keepSelectable,
    value,
    onChange,
    loading = false,
    error = false,
    className,
    triggerClassName,
}: ProjectSelectProps) {
    const options =
        keepSelectable &&
        !projects.some((project) => project.id === keepSelectable.id)
            ? [...projects, keepSelectable]
            : projects;

    const groups = groupByClient(options);

    let placeholder = "Select project";

    if (loading) {
        placeholder = "Loading projects…";
    }

    if (error) {
        placeholder = "Failed to load projects";
    }

    const items = options.map((project) => ({
        label: project.name,
        value: project.id,
    }));

    return (
        <div className={cn("relative min-w-0", className)}>
            <FolderOpen className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground" />

            <Select
                items={items}
                value={value}
                onValueChange={(next) => onChange(next as string | null)}
                disabled={loading || error}
            >
                <SelectTrigger
                    aria-label="Project"
                    className={cn("h-10 w-full pl-9", triggerClassName)}
                >
                    <SelectValue placeholder={placeholder} />
                </SelectTrigger>

                {/* No max-height override: the popup already caps itself at
                    `--available-height`, and a shorter cap only forced a
                    scrollbar that did not need to be there. */}
                <SelectContent alignItemWithTrigger={false}>
                    {groups.map((group) => (
                        <SelectGroup key={group.clientId}>
                            <SelectLabel>{group.clientName}</SelectLabel>

                            {group.projects.map((project) => (
                                <SelectItem key={project.id} value={project.id}>
                                    <span className="flex min-w-0 items-center gap-2">
                                        <span
                                            aria-hidden
                                            className="size-2 shrink-0 rounded-full"
                                            style={{
                                                backgroundColor:
                                                    projectColor(project),
                                            }}
                                        />

                                        <span className="truncate">
                                            {project.name}
                                        </span>
                                    </span>
                                </SelectItem>
                            ))}
                        </SelectGroup>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}

function groupByClient(projects: readonly SelectableProject[]) {
    const groups = new Map<
        string,
        { clientId: string; clientName: string; projects: SelectableProject[] }
    >();

    for (const project of projects) {
        const existing = groups.get(project.client.id);

        if (existing) {
            existing.projects.push(project);

            continue;
        }

        groups.set(project.client.id, {
            clientId: project.client.id,
            clientName: project.client.shortName || project.client.name,
            projects: [project],
        });
    }

    return [...groups.values()];
}
