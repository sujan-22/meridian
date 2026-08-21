"use client";

import { useState } from "react";
import { useQuery } from "@apollo/client/react";
import { format, formatDistanceToNowStrict } from "date-fns";
import {
    Archive,
    ArchiveRestore,
    CircleDollarSign,
    MoreHorizontal,
    Pencil,
    Plus,
    Search,
    Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { ProjectDialog } from "@/components/projects/project-dialog";
import { useProjectActions } from "@/components/projects/use-project-actions";
import {
    ClientsDocument,
    ProjectSummariesDocument,
    type ProjectFieldsFragment,
    type ProjectSummariesQuery,
} from "@/gql/graphql";
import { formatMinutesAsHours } from "@/lib/duration";
import { projectColor } from "@/lib/project-color";
import { cn } from "@/lib/utils";

type Summary = ProjectSummariesQuery["projectSummaries"][number];

type SortMode = "name" | "tracked" | "newest";

const SORT_OPTIONS: Array<{ value: SortMode; label: string }> = [
    { value: "name", label: "Name" },
    { value: "tracked", label: "Most tracked" },
    { value: "newest", label: "Newest" },
];

export function ProjectsView() {
    const [search, setSearch] = useState("");
    const [sort, setSort] = useState<SortMode>("name");
    const [showArchived, setShowArchived] = useState(false);

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<ProjectFieldsFragment | null>(null);

    const summariesQuery = useQuery(ProjectSummariesDocument, {
        variables: { includeArchived: true },
    });

    const clientsQuery = useQuery(ClientsDocument);

    const { updateProject, deleteProject } = useProjectActions();

    const all = summariesQuery.data?.projectSummaries ?? [];

    const visible = sortSummaries(
        all.filter((summary) => {
            if (!showArchived && summary.project.archived) {
                return false;
            }

            return matchesSearch(summary, search);
        }),
        sort,
    );

    const archivedCount = all.filter(
        (summary) => summary.project.archived,
    ).length;

    const totalMinutes = visible.reduce(
        (total, summary) => total + summary.totalMinutes,
        0,
    );

    function handleEdit(project: ProjectFieldsFragment) {
        setEditing(project);
        setDialogOpen(true);
    }

    function handleNew() {
        setEditing(null);
        setDialogOpen(true);
    }

    return (
        <div className="flex w-full flex-1 flex-col px-5 py-6 lg:px-8 2xl:px-10">
            <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h2 className="text-xl font-semibold tracking-tight">
                        Projects
                    </h2>

                    <p className="mt-1 text-sm text-muted-foreground">
                        {visible.length}{" "}
                        {visible.length === 1 ? "project" : "projects"} ·{" "}
                        <span className="font-mono tabular-nums">
                            {formatMinutesAsHours(totalMinutes)} h
                        </span>{" "}
                        tracked
                    </p>
                </div>

                <Button type="button" onClick={handleNew} className="gap-1.5">
                    <Plus className="size-4" />
                    New project
                </Button>
            </header>

            <div className="mb-4 flex flex-wrap items-center gap-2">
                <div className="relative min-w-0 flex-1 sm:max-w-72">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

                    <Input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search projects or clients"
                        aria-label="Search projects"
                        className="h-9 pl-9"
                    />
                </div>

                <SegmentedControl
                    label="Sort by"
                    options={SORT_OPTIONS}
                    value={sort}
                    onChange={setSort}
                />

                {archivedCount > 0 && (
                    <Button
                        type="button"
                        variant={showArchived ? "secondary" : "outline"}
                        size="sm"
                        aria-pressed={showArchived}
                        onClick={() => setShowArchived((shown) => !shown)}
                        className="gap-1.5"
                    >
                        <Archive className="size-3.5" />
                        Archived
                        <span className="text-muted-foreground">
                            {archivedCount}
                        </span>
                    </Button>
                )}
            </div>

            {summariesQuery.loading && all.length === 0 ? (
                <div className="flex flex-col gap-2">
                    <Skeleton className="h-12 w-full rounded-lg" />
                    <Skeleton className="h-12 w-full rounded-lg" />
                    <Skeleton className="h-12 w-full rounded-lg" />
                </div>
            ) : visible.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/70 px-6 py-16 text-center">
                    <p className="text-sm text-muted-foreground">
                        {search
                            ? "No projects match that search."
                            : "No projects yet."}
                    </p>
                </div>
            ) : (
                <div className="overflow-hidden rounded-xl border border-border/70 bg-card">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent">
                                    <TableHead>Project</TableHead>
                                    <TableHead>Client</TableHead>
                                    <TableHead>Billing</TableHead>
                                    <TableHead className="hidden lg:table-cell">
                                        Polaris task
                                    </TableHead>
                                    <TableHead className="hidden md:table-cell">
                                        Added
                                    </TableHead>
                                    <TableHead className="text-right">
                                        Entries
                                    </TableHead>
                                    <TableHead className="text-right">
                                        Tracked
                                    </TableHead>
                                    <TableHead className="w-10" />
                                </TableRow>
                            </TableHeader>

                            <TableBody>
                                {visible.map((summary) => (
                                    <ProjectRow
                                        key={summary.project.id}
                                        summary={summary}
                                        onEdit={handleEdit}
                                        onToggleArchived={(project) =>
                                            void updateProject(project.id, {
                                                archived: !project.archived,
                                            })
                                        }
                                        onDelete={(project) =>
                                            void deleteProject(project.id)
                                        }
                                    />
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            )}

            <ProjectDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                clients={clientsQuery.data?.clients ?? []}
                project={editing}
            />
        </div>
    );
}

interface ProjectRowProps {
    summary: Summary;
    onEdit: (project: ProjectFieldsFragment) => void;
    onToggleArchived: (project: ProjectFieldsFragment) => void;
    onDelete: (project: ProjectFieldsFragment) => void;
}

function ProjectRow({
    summary,
    onEdit,
    onToggleArchived,
    onDelete,
}: ProjectRowProps) {
    const { project } = summary;
    const color = projectColor(project);
    const billable = project.defaultBillingType === "BILLABLE";

    return (
        <TableRow className={cn(project.archived && "opacity-55")}>
            <TableCell>
                <button
                    type="button"
                    onClick={() => onEdit(project)}
                    className="flex min-w-0 items-center gap-2.5 text-left hover:underline"
                >
                    <span
                        aria-hidden
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: color }}
                    />

                    <span className="truncate font-medium">{project.name}</span>

                    {project.archived && (
                        <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[0.625rem] uppercase tracking-wide text-muted-foreground">
                            Archived
                        </span>
                    )}
                </button>
            </TableCell>

            <TableCell className="text-muted-foreground">
                {project.client.shortName ?? project.client.name}
            </TableCell>

            <TableCell>
                <span
                    className={cn(
                        "flex items-center gap-1.5 text-xs",
                        billable
                            ? "text-emerald-400"
                            : "text-muted-foreground",
                    )}
                >
                    <CircleDollarSign className="size-3.5" />
                    {billable ? "Billable" : "Non-billable"}
                </span>
            </TableCell>

            <TableCell className="hidden font-mono text-xs text-muted-foreground lg:table-cell">
                {project.polarisTask ?? "—"}
            </TableCell>

            <TableCell
                className="hidden text-xs text-muted-foreground md:table-cell"
                title={
                    summary.lastTrackedAt
                        ? `Last tracked ${format(new Date(summary.lastTrackedAt), "d MMM yyyy")}`
                        : "Never tracked"
                }
            >
                {format(new Date(project.createdAt), "d MMM yyyy")}
            </TableCell>

            <TableCell className="text-right font-mono text-xs tabular-nums text-muted-foreground">
                {summary.entryCount}
            </TableCell>

            <TableCell className="text-right">
                <span className="font-mono text-sm font-medium tabular-nums">
                    {formatMinutesAsHours(summary.totalMinutes)}
                </span>

                <span className="block text-[0.625rem] text-muted-foreground">
                    {summary.lastTrackedAt
                        ? formatDistanceToNowStrict(
                              new Date(summary.lastTrackedAt),
                              { addSuffix: true },
                          )
                        : "never"}
                </span>
            </TableCell>

            <TableCell>
                <DropdownMenu>
                    <DropdownMenuTrigger
                        render={
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Actions for ${project.name}`}
                            />
                        }
                    >
                        <MoreHorizontal className="size-4" />
                    </DropdownMenuTrigger>

                    <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={() => onEdit(project)}>
                            <Pencil />
                            Edit
                        </DropdownMenuItem>

                        <DropdownMenuItem
                            onClick={() => onToggleArchived(project)}
                        >
                            {project.archived ? (
                                <>
                                    <ArchiveRestore />
                                    Unarchive
                                </>
                            ) : (
                                <>
                                    <Archive />
                                    Archive
                                </>
                            )}
                        </DropdownMenuItem>

                        <DropdownMenuSeparator />

                        <DropdownMenuItem
                            variant="destructive"
                            disabled={summary.entryCount > 0}
                            title={
                                summary.entryCount > 0
                                    ? "Archive instead - this project has tracked time"
                                    : undefined
                            }
                            onClick={() => onDelete(project)}
                        >
                            <Trash2 />
                            Delete
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </TableCell>
        </TableRow>
    );
}

interface SegmentedControlProps<T extends string> {
    label: string;
    options: Array<{ value: T; label: string }>;
    value: T;
    onChange: (value: T) => void;
}

function SegmentedControl<T extends string>({
    label,
    options,
    value,
    onChange,
}: SegmentedControlProps<T>) {
    return (
        <div className="flex items-center gap-2">
            <span className="hidden text-xs text-muted-foreground sm:inline">
                {label}
            </span>

            <div
                role="radiogroup"
                aria-label={label}
                className="inline-flex rounded-md border border-input p-0.5"
            >
                {options.map((option) => (
                    <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={option.value === value}
                        onClick={() => onChange(option.value)}
                        className={cn(
                            "h-7 rounded-[6px] px-2.5 text-xs font-medium transition-colors",
                            option.value === value
                                ? "bg-secondary text-secondary-foreground"
                                : "text-muted-foreground hover:text-foreground",
                        )}
                    >
                        {option.label}
                    </button>
                ))}
            </div>
        </div>
    );
}

function matchesSearch(summary: Summary, search: string): boolean {
    const term = search.trim().toLowerCase();

    if (!term) {
        return true;
    }

    const haystack = [
        summary.project.name,
        summary.project.client.name,
        summary.project.client.shortName ?? "",
        summary.project.polarisTask ?? "",
    ]
        .join(" ")
        .toLowerCase();

    return haystack.includes(term);
}

function sortSummaries(summaries: Summary[], mode: SortMode): Summary[] {
    return [...summaries].sort((a, b) => {
        if (mode === "tracked") {
            return b.totalMinutes - a.totalMinutes;
        }

        if (mode === "newest") {
            return (
                new Date(b.project.createdAt).getTime() -
                new Date(a.project.createdAt).getTime()
            );
        }

        return (
            a.project.client.name.localeCompare(b.project.client.name) ||
            a.project.name.localeCompare(b.project.name)
        );
    });
}
