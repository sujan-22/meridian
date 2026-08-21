"use client";

import { useState } from "react";
import { useMutation } from "@apollo/client/react";

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
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import {
    ClearTicketEstimateDocument,
    SetTicketEstimateDocument,
    TicketSummariesDocument,
    type TicketSummaryFieldsFragment,
} from "@/gql/graphql";
import { formatMinutesAsHours } from "@/lib/duration";

interface EstimateDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    ticket: TicketSummaryFieldsFragment | null;
}

export function EstimateDialog({
    open,
    onOpenChange,
    ticket,
}: EstimateDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                {ticket && (
                    <EstimateForm
                        key={`${ticket.project.id}:${ticket.ticketNumber}`}
                        ticket={ticket}
                        onDone={() => onOpenChange(false)}
                    />
                )}
            </DialogContent>
        </Dialog>
    );
}

interface EstimateFormProps {
    ticket: TicketSummaryFieldsFragment;
    onDone: () => void;
}

function EstimateForm({ ticket, onDone }: EstimateFormProps) {
    const [minHours, setMinHours] = useState(
        ticket.estimateMinMinutes != null
            ? String(ticket.estimateMinMinutes / 60)
            : "",
    );
    const [maxHours, setMaxHours] = useState(
        ticket.estimateMaxMinutes != null
            ? String(ticket.estimateMaxMinutes / 60)
            : "",
    );
    const [notes, setNotes] = useState(ticket.estimateNotes ?? "");
    const [error, setError] = useState<string | null>(null);

    const options = {
        refetchQueries: [TicketSummariesDocument],
        awaitRefetchQueries: true,
    };

    const [setEstimate, { loading: saving }] = useMutation(
        SetTicketEstimateDocument,
        options,
    );
    const [clearEstimate, { loading: clearing }] = useMutation(
        ClearTicketEstimateDocument,
        options,
    );

    const pending = saving || clearing;

    async function handleSubmit(event: React.FormEvent) {
        event.preventDefault();
        setError(null);

        const max = Number(maxHours);
        const min = minHours.trim() === "" ? null : Number(minHours);

        if (!Number.isFinite(max) || max <= 0) {
            setError("Enter the estimate in hours, for example 35");

            return;
        }

        if (min !== null && (!Number.isFinite(min) || min < 0)) {
            setError("The low end has to be a number of hours");

            return;
        }

        if (min !== null && min > max) {
            setError("The low end cannot be greater than the high end");

            return;
        }

        try {
            await setEstimate({
                variables: {
                    input: {
                        projectId: ticket.project.id,
                        ticketNumber: ticket.ticketNumber,
                        minMinutes: min === null ? null : Math.round(min * 60),
                        maxMinutes: Math.round(max * 60),
                        notes: notes.trim() || null,
                    },
                },
            });

            toast.add({ title: "Estimate saved", type: "success" });
            onDone();
        } catch (caught) {
            setError(
                caught instanceof Error
                    ? caught.message
                    : "Could not save the estimate",
            );
        }
    }

    async function handleClear() {
        try {
            await clearEstimate({
                variables: {
                    projectId: ticket.project.id,
                    ticketNumber: ticket.ticketNumber,
                },
            });

            toast.add({ title: "Estimate removed", type: "success" });
            onDone();
        } catch (caught) {
            setError(
                caught instanceof Error
                    ? caught.message
                    : "Could not remove the estimate",
            );
        }
    }

    return (
        <form onSubmit={handleSubmit} className="contents">
            <DialogHeader>
                <DialogTitle>Estimate for #{ticket.ticketNumber}</DialogTitle>

                <DialogDescription>
                    {ticket.project.name} ·{" "}
                    {formatMinutesAsHours(ticket.trackedMinutes)} h tracked so
                    far.
                </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-3">
                    <label className="flex flex-col gap-1.5">
                        <span className="text-xs font-medium text-muted-foreground">
                            Low end (optional)
                        </span>

                        <Input
                            value={minHours}
                            onChange={(event) =>
                                setMinHours(event.target.value)
                            }
                            placeholder="20"
                            inputMode="decimal"
                            aria-label="Estimate low end in hours"
                            className="h-10 font-mono tabular-nums"
                        />
                    </label>

                    <label className="flex flex-col gap-1.5">
                        <span className="text-xs font-medium text-muted-foreground">
                            High end (hours)
                        </span>

                        <Input
                            value={maxHours}
                            onChange={(event) =>
                                setMaxHours(event.target.value)
                            }
                            placeholder="35"
                            inputMode="decimal"
                            aria-label="Estimate high end in hours"
                            className="h-10 font-mono tabular-nums"
                        />
                    </label>
                </div>

                <p className="text-[0.6875rem] text-muted-foreground">
                    Quoted as a range like 20–35? Put both in. Remaining hours
                    and warnings are measured against the high end.
                </p>

                <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-muted-foreground">
                        Notes
                    </span>

                    <Textarea
                        value={notes}
                        onChange={(event) => setNotes(event.target.value)}
                        rows={2}
                        placeholder="Quoted to client on 12 Aug, excludes UAT"
                        className="resize-none"
                    />
                </label>

                {error && <p className="text-sm text-destructive">{error}</p>}
            </div>

            <DialogFooter className="sm:justify-between">
                <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={pending || ticket.estimateMaxMinutes == null}
                    onClick={handleClear}
                >
                    Remove estimate
                </Button>

                <div className="flex gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onDone}
                        disabled={pending}
                    >
                        Cancel
                    </Button>

                    <Button type="submit" disabled={pending}>
                        Save estimate
                    </Button>
                </div>
            </DialogFooter>
        </form>
    );
}
