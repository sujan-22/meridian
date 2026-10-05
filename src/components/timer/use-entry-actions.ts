"use client";

import { useMutation } from "@apollo/client/react";

import { toast } from "@/components/ui/toast";
import {
    CreateTimeEntryDocument,
    DeleteTimeEntryDocument,
    EntriesDocument,
    UpdateTimeEntryDocument,
    type CreateTimeEntryInput,
    type TimeEntryFieldsFragment,
    type UpdateTimeEntryInput,
} from "@/gql/graphql";
import { optimisticEntry, type ProjectPatch } from "@/lib/optimistic-entry";

function reportFailure(action: string, error: unknown) {
    const message =
        error instanceof Error ? error.message : "Something went wrong";

    toast.add({
        title: `Could not ${action}`,
        description: message,
        type: "error",
    });
}

/**
 * The three ways an entry changes, each answering before the server does.
 *
 * Editing and deleting are applied to the cache immediately and reconciled
 * when the mutation lands - a dragged block has to arrive where it was
 * dropped, not a round trip later. Creating still waits, because a new entry
 * has no identity until the server gives it one, but the refetch is no longer
 * awaited so nothing on screen is blocked on it.
 */
export function useEntryActions() {
    const [createEntryMutation, createState] = useMutation(
        CreateTimeEntryDocument,
        {
            // Not awaited: the dialog closes on its own, and the entry appears
            // when the week comes back.
            refetchQueries: [EntriesDocument],
        },
    );

    const [updateEntryMutation, updateState] = useMutation(
        UpdateTimeEntryDocument,
    );

    const [deleteEntryMutation, deleteState] = useMutation(
        DeleteTimeEntryDocument,
    );

    return {
        pending:
            createState.loading || updateState.loading || deleteState.loading,

        createEntry: async (input: CreateTimeEntryInput) => {
            try {
                await createEntryMutation({ variables: { input } });

                toast.add({ title: "Entry added", type: "success" });

                return true;
            } catch (error) {
                reportFailure("add the entry", error);

                return false;
            }
        },

        /**
         * `entry` is the one being changed, not just its id: an optimistic
         * result has to be a whole entry, and only the caller knows the rest
         * of it.
         */
        updateEntry: async (
            entry: TimeEntryFieldsFragment,
            input: UpdateTimeEntryInput,
            project?: ProjectPatch | null,
        ) => {
            try {
                await updateEntryMutation({
                    variables: { id: entry.id, input },
                    optimisticResponse: {
                        updateTimeEntry: optimisticEntry(entry, input, project),
                    },
                });

                return true;
            } catch (error) {
                // Apollo rolls the optimistic write back on its own, so the
                // block returns to where it was and the message explains why.
                reportFailure("update the entry", error);

                return false;
            }
        },

        deleteEntry: async (entry: TimeEntryFieldsFragment) => {
            try {
                await deleteEntryMutation({
                    variables: { id: entry.id },
                    optimisticResponse: { deleteTimeEntry: true },
                    update: (cache) => {
                        // Evicting by identity drops it from every cached
                        // week at once, without having to know which ranges
                        // are in play.
                        cache.evict({ id: cache.identify(entry) });
                        cache.gc();
                    },
                });

                toast.add({ title: "Entry deleted", type: "success" });

                return true;
            } catch (error) {
                reportFailure("delete the entry", error);

                return false;
            }
        },
    };
}
