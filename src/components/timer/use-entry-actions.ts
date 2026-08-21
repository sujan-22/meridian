"use client";

import { useMutation } from "@apollo/client/react";

import { toast } from "@/components/ui/toast";
import {
    ActiveTimerDocument,
    CreateTimeEntryDocument,
    DeleteTimeEntryDocument,
    EntriesDocument,
    RecentEntriesDocument,
    StartTimerDocument,
    StopTimerDocument,
    UpdateTimeEntryDocument,
    type CreateTimeEntryInput,
    type StartTimerInput,
    type UpdateTimeEntryInput,
} from "@/gql/graphql";

/**
 * Every mutation changes what "today" looks like, so the day list, the active
 * timer and the recent-work strip are all refreshed together.
 */
const refetchQueries = [
    ActiveTimerDocument,
    EntriesDocument,
    RecentEntriesDocument,
];

const mutationOptions = {
    refetchQueries,
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
    const [startTimerMutation, startState] = useMutation(
        StartTimerDocument,
        mutationOptions,
    );

    const [stopTimerMutation, stopState] = useMutation(
        StopTimerDocument,
        mutationOptions,
    );

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
            startState.loading ||
            stopState.loading ||
            createState.loading ||
            updateState.loading ||
            deleteState.loading,

        startTimer: async (input: StartTimerInput) => {
            try {
                await startTimerMutation({ variables: { input } });

                return true;
            } catch (error) {
                reportFailure("start the timer", error);

                return false;
            }
        },

        stopTimer: async (id: string) => {
            try {
                await stopTimerMutation({ variables: { id } });

                return true;
            } catch (error) {
                reportFailure("stop the timer", error);

                return false;
            }
        },

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
