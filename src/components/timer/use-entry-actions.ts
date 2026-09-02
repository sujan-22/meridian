"use client";

import { useMutation } from "@apollo/client/react";

import { toast } from "@/components/ui/toast";
import {
    CreateTimeEntryDocument,
    DeleteTimeEntryDocument,
    EntriesDocument,
    UpdateTimeEntryDocument,
    type CreateTimeEntryInput,
    type UpdateTimeEntryInput,
} from "@/gql/graphql";

/** Every mutation changes what the week looks like, so the week reloads. */
const mutationOptions = {
    refetchQueries: [EntriesDocument],
    awaitRefetchQueries: true,
};

function reportFailure(action: string, error: unknown) {
    const message =
        error instanceof Error ? error.message : "Something went wrong";

    toast.add({
        title: `Could not ${action}`,
        description: message,
        type: "error",
    });
}

export function useEntryActions() {
    const [createEntryMutation, createState] = useMutation(
        CreateTimeEntryDocument,
        mutationOptions,
    );

    const [updateEntryMutation, updateState] = useMutation(
        UpdateTimeEntryDocument,
        mutationOptions,
    );

    const [deleteEntryMutation, deleteState] = useMutation(
        DeleteTimeEntryDocument,
        mutationOptions,
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

        updateEntry: async (id: string, input: UpdateTimeEntryInput) => {
            try {
                await updateEntryMutation({ variables: { id, input } });

                toast.add({ title: "Entry updated", type: "success" });

                return true;
            } catch (error) {
                reportFailure("update the entry", error);

                return false;
            }
        },

        deleteEntry: async (id: string) => {
            try {
                await deleteEntryMutation({ variables: { id } });

                toast.add({ title: "Entry deleted", type: "success" });

                return true;
            } catch (error) {
                reportFailure("delete the entry", error);

                return false;
            }
        },
    };
}
