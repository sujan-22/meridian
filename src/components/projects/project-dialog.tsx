"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { ColorPicker } from "@/components/projects/color-picker";
import { useProjectActions } from "@/components/projects/use-project-actions";
import type { BillingType, ProjectFieldsFragment } from "@/gql/graphql";
import { PROJECT_COLOR_PALETTE, projectColor } from "@/lib/project-color";

export interface SelectableClient {
    id: string;
    name: string;
    shortName?: string | null;
}

interface ProjectDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    clients: readonly SelectableClient[];
    /** Omit to create a new project. */
    project?: ProjectFieldsFragment | null;
}

const BILLING_OPTIONS = [
    { label: "Billable", value: "BILLABLE" },
    { label: "Non-billable", value: "NON_BILLABLE" },
] as const;

export function ProjectDialog({
    open,
    onOpenChange,
    clients,
    project,
}: ProjectDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <ProjectForm
                    key={project?.id ?? "new"}
                    clients={clients}
                    project={project}
                    onDone={() => onOpenChange(false)}
                />
            </DialogContent>
        </Dialog>
    );
}

interface ProjectFormProps {
    clients: readonly SelectableClient[];
    project?: ProjectFieldsFragment | null;
    onDone: () => void;
}

function ProjectForm({ clients, project, onDone }: ProjectFormProps) {
    const editing = Boolean(project);

    const [name, setName] = useState(project?.name ?? "");
    const [clientId, setClientId] = useState<string | null>(
        project?.client.id ?? clients[0]?.id ?? null,
    );
    const [color, setColor] = useState<string>(
        project
            ? projectColor(project)
            : PROJECT_COLOR_PALETTE[
                  // Vary the default so consecutive new projects differ.
                  clients.length % PROJECT_COLOR_PALETTE.length
              ].value,
    );
    const [billingType, setBillingType] = useState<BillingType>(
        project?.defaultBillingType ?? "BILLABLE",
    );
    const [polarisTask, setPolarisTask] = useState(project?.polarisTask ?? "");

    const [newClientName, setNewClientName] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const { createProject, updateProject, createClient, pending } =
        useProjectActions();

    async function handleSubmit(event: React.FormEvent) {
        event.preventDefault();
        setError(null);

        if (!name.trim()) {
            setError("A project name is required");

            return;
        }

        let targetClientId = clientId;

        // A brand new client is created first so the project has something to
        // belong to; if that fails the project is not created either.
        if (newClientName !== null) {
            if (!newClientName.trim()) {
                setError("Enter a name for the new client");

                return;
            }

            const created = await createClient({
                name: newClientName.trim(),
                shortName: newClientName.trim().split(/\s+/)[0],
            });

            if (!created) {
                return;
            }

            targetClientId = created.id;
        }

        if (!targetClientId) {
            setError("Pick a client");

            return;
        }

        const shared = {
            name: name.trim(),
            color,
            defaultBillingType: billingType,
            polarisTask: polarisTask.trim() || null,
        };

        const saved = project
            ? await updateProject(project.id, {
                  ...shared,
                  clientId: targetClientId,
              })
            : await createProject({ ...shared, clientId: targetClientId });

        if (saved) {
            onDone();
        }
    }

    return (
        <form onSubmit={handleSubmit} className="contents">
            <DialogHeader>
                <DialogTitle>
                    {editing ? "Edit project" : "New project"}
                </DialogTitle>

                <DialogDescription>
                    {editing
                        ? "Changes apply everywhere this project is used."
                        : "Projects group the time you track for a client."}
                </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-4">
                <Field label="Name">
                    <Input
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        placeholder="Gardner - Ongoing Support"
                        autoComplete="off"
                        className="h-10"
                    />
                </Field>

                <Field label="Client">
                    {newClientName === null ? (
                        <div className="flex gap-2">
                            <Select
                                items={clients.map((client) => ({
                                    label: client.name,
                                    value: client.id,
                                }))}
                                value={clientId}
                                onValueChange={(value) =>
                                    setClientId(value as string)
                                }
                            >
                                <SelectTrigger
                                    aria-label="Client"
                                    className="h-10 flex-1"
                                >
                                    <SelectValue placeholder="Select client" />
                                </SelectTrigger>

                                <SelectContent alignItemWithTrigger={false}>
                                    {clients.map((client) => (
                                        <SelectItem
                                            key={client.id}
                                            value={client.id}
                                        >
                                            {client.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <Button
                                type="button"
                                variant="outline"
                                size="icon-lg"
                                aria-label="Add a new client"
                                title="Add a new client"
                                onClick={() => setNewClientName("")}
                            >
                                <Plus />
                            </Button>
                        </div>
                    ) : (
                        <div className="flex gap-2">
                            <Input
                                value={newClientName}
                                onChange={(event) =>
                                    setNewClientName(event.target.value)
                                }
                                placeholder="New client name"
                                autoComplete="off"
                                aria-label="New client name"
                                autoFocus
                                className="h-10 flex-1"
                            />

                            <Button
                                type="button"
                                variant="outline"
                                size="icon-lg"
                                aria-label="Cancel new client"
                                onClick={() => setNewClientName(null)}
                            >
                                <X />
                            </Button>
                        </div>
                    )}
                </Field>

                <Field label="Colour">
                    <ColorPicker value={color} onChange={setColor} />
                </Field>

                <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Default billing">
                        <Select
                            items={[...BILLING_OPTIONS]}
                            value={billingType}
                            onValueChange={(value) =>
                                setBillingType(value as BillingType)
                            }
                        >
                            <SelectTrigger
                                aria-label="Default billing"
                                className="h-10"
                            >
                                <SelectValue />
                            </SelectTrigger>

                            <SelectContent alignItemWithTrigger={false}>
                                {BILLING_OPTIONS.map((option) => (
                                    <SelectItem
                                        key={option.value}
                                        value={option.value}
                                    >
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </Field>

                    <Field label="Polaris task">
                        <Input
                            value={polarisTask}
                            onChange={(event) =>
                                setPolarisTask(event.target.value)
                            }
                            placeholder="1500 - Ongoing Support"
                            autoComplete="off"
                            className="h-10"
                        />
                    </Field>
                </div>

                {error && <p className="text-sm text-destructive">{error}</p>}
            </div>

            <DialogFooter>
                <Button
                    type="button"
                    variant="outline"
                    onClick={onDone}
                    disabled={pending}
                >
                    Cancel
                </Button>

                <Button type="submit" disabled={pending}>
                    {editing ? "Save changes" : "Create project"}
                </Button>
            </DialogFooter>
        </form>
    );
}

interface FieldProps {
    label: string;
    children: React.ReactNode;
}

function Field({ label, children }: FieldProps) {
    return (
        <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">
                {label}
            </span>

            {children}
        </label>
    );
}
