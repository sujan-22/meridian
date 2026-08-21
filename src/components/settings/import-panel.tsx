"use client";

import { useRef, useState } from "react";
import { useMutation } from "@apollo/client/react";
import { format } from "date-fns";
import { FileUp, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import {
    ClientsDocument,
    ImportTimeEntriesDocument,
    ProjectSummariesDocument,
    ProjectsDocument,
    TicketSummariesDocument,
} from "@/gql/graphql";
import { formatMinutesAsHours } from "@/lib/duration";
import {
    parseTogglCsv,
    TogglCsvError,
    type TogglParseResult,
} from "@/lib/toggl-import";
import { cn } from "@/lib/utils";

interface Preview extends TogglParseResult {
    fileName: string;
    totalMinutes: number;
    from: Date;
    to: Date;
}

export function ImportPanel() {
    const inputRef = useRef<HTMLInputElement>(null);

    const [preview, setPreview] = useState<Preview | null>(null);
    const [error, setError] = useState<string | null>(null);

    const [importEntries, { loading }] = useMutation(
        ImportTimeEntriesDocument,
        {
            refetchQueries: [
                ProjectsDocument,
                ProjectSummariesDocument,
                ClientsDocument,
                TicketSummariesDocument,
            ],
            awaitRefetchQueries: true,
        },
    );

    async function handleFile(file: File) {
        setError(null);
        setPreview(null);

        try {
            const parsed = parseTogglCsv(await file.text());

            if (parsed.rows.length === 0) {
                setError("That file has no usable rows.");

                return;
            }

            const times = parsed.rows.map((row) => row.startedAt.getTime());

            setPreview({
                ...parsed,
                fileName: file.name,
                totalMinutes: parsed.rows.reduce(
                    (total, row) =>
                        total +
                        Math.round(
                            (row.endedAt.getTime() - row.startedAt.getTime()) /
                                60000,
                        ),
                    0,
                ),
                from: new Date(Math.min(...times)),
                to: new Date(Math.max(...times)),
            });
        } catch (caught) {
            setError(
                caught instanceof TogglCsvError
                    ? caught.message
                    : "Could not read that file.",
            );
        }
    }

    async function handleImport() {
        if (!preview) {
            return;
        }

        try {
            const result = await importEntries({
                variables: {
                    rows: preview.rows.map((row) => ({
                        projectName: row.projectName,
                        description: row.description,
                        billable: row.billable,
                        startedAt: row.startedAt.toISOString(),
                        endedAt: row.endedAt.toISOString(),
                    })),
                    createMissingProjects: true,
                },
            });

            const summary = result.data?.importTimeEntries;

            toast.add({
                title: `Imported ${summary?.imported ?? 0} entries`,
                description: [
                    summary?.duplicatesSkipped
                        ? `${summary.duplicatesSkipped} already present`
                        : null,
                    summary?.projectsCreated.length
                        ? `${summary.projectsCreated.length} projects created`
                        : null,
                    summary?.unmatchedRows
                        ? `${summary.unmatchedRows} had no project`
                        : null,
                ]
                    .filter(Boolean)
                    .join(" · "),
                type: "success",
            });

            setPreview(null);

            if (inputRef.current) {
                inputRef.current.value = "";
            }
        } catch (caught) {
            setError(
                caught instanceof Error
                    ? caught.message
                    : "The import failed.",
            );
        }
    }

    const withoutProject = preview
        ? preview.rows.filter((row) => !row.projectName).length
        : 0;

    return (
        <section className="rounded-xl border border-border/70 bg-card p-5">
            <h3 className="text-sm font-medium">Import from Toggl</h3>

            <p className="mt-1 text-xs text-muted-foreground">
                Take a CSV export from Toggl&apos;s Reports screen. Entries
                already present are skipped, so re-importing the same file is
                safe.
            </p>

            <input
                ref={inputRef}
                type="file"
                accept=".csv,text/csv"
                aria-label="Toggl CSV export"
                onChange={(event) => {
                    const file = event.target.files?.[0];

                    if (file) {
                        void handleFile(file);
                    }
                }}
                className="sr-only"
            />

            <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => inputRef.current?.click()}
                    className="gap-1.5"
                >
                    <FileUp className="size-3.5" />
                    Choose CSV
                </Button>

                {preview && (
                    <span className="text-xs text-muted-foreground">
                        {preview.fileName}
                    </span>
                )}
            </div>

            {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

            {preview && (
                <div className="mt-4 flex flex-col gap-3 rounded-lg border border-border/60 bg-muted/20 p-3">
                    <div className="flex flex-wrap gap-x-6 gap-y-2">
                        <Fact
                            label="Entries"
                            value={String(preview.rows.length)}
                        />
                        <Fact
                            label="Hours"
                            value={formatMinutesAsHours(preview.totalMinutes)}
                        />
                        <Fact
                            label="Range"
                            value={`${format(preview.from, "d MMM")} – ${format(preview.to, "d MMM yyyy")}`}
                        />
                        <Fact
                            label="Projects"
                            value={String(preview.projectNames.length)}
                        />
                    </div>

                    <p className="text-[0.6875rem] leading-relaxed text-muted-foreground">
                        Projects in the file that don&apos;t exist yet will be
                        created, along with their clients. The export marks
                        everything non-billable, so each entry takes its
                        project&apos;s default billing instead.
                        {withoutProject > 0 && (
                            <span className="text-amber-400">
                                {" "}
                                {withoutProject} row
                                {withoutProject === 1 ? " has" : "s have"} no
                                project and will be skipped.
                            </span>
                        )}
                        {preview.skipped.length > 0 && (
                            <span className="text-amber-400">
                                {" "}
                                {preview.skipped.length} unreadable row
                                {preview.skipped.length === 1 ? "" : "s"}{" "}
                                ignored.
                            </span>
                        )}
                    </p>

                    <div className="flex flex-wrap gap-1.5">
                        {preview.projectNames.map((name) => (
                            <span
                                key={name}
                                className="rounded bg-muted px-1.5 py-0.5 text-[0.625rem] text-foreground/70"
                            >
                                {name}
                            </span>
                        ))}
                    </div>

                    <div className="flex justify-end gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setPreview(null)}
                            disabled={loading}
                        >
                            Cancel
                        </Button>

                        <Button
                            type="button"
                            size="sm"
                            onClick={handleImport}
                            disabled={loading}
                            className={cn("gap-1.5", loading && "opacity-70")}
                        >
                            <Upload className="size-3.5" />
                            {loading
                                ? "Importing…"
                                : `Import ${preview.rows.length} entries`}
                        </Button>
                    </div>
                </div>
            )}
        </section>
    );
}

function Fact({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <p className="text-[0.6875rem] uppercase tracking-[0.12em] text-muted-foreground">
                {label}
            </p>

            <p className="mt-0.5 font-mono text-sm font-medium tabular-nums">
                {value}
            </p>
        </div>
    );
}
